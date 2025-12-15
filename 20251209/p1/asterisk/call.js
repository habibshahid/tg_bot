const { get_bot } = require("../telegram_bot/botInstance");
const {
  add_entry_to_memory,
  pop_unprocessed_line,
} = require("../utils/entries");
const { sanitize_phoneNumber } = require("../utils/sanitization");
const { get_settings } = require("../utils/settings");
const { ami } = require("./instance");
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
  add_entry_to_memory({ ...entry, phoneNumber: number });

  const actionId = `call-${number}-${Date.now()}`;
  
  // Get the SIP trunk name and caller ID from settings
  const sipTrunk = settings.sip_trunk;
  const trunkName = sipTrunk ? sipTrunk.name : 'main';
  let callerId = settings.caller_id || number;
  const dialPrefix = settings.dial_prefix || '';
  
  const dialedNumber = dialPrefix + number;
   
  // ANI rotation logic
  if (settings.campaign_id && callerId && callerId.length >= 4) {
    const campaign = await Campaign.findByPk(settings.campaign_id);
    if (campaign) {
      // Increment call counter
      await campaign.increment('callCounter');
      await campaign.increment('totalCalls');
      
      // Check if we need to rotate (every 100 calls)
      if (campaign.callCounter % 100 === 0) {
        // Generate random last 4 digits
        const randomLast4 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        // Replace last 4 digits
        callerId = callerId.substring(0, callerId.length - 4) + randomLast4;
        console.log(`ANI Rotation: Original ${settings.caller_id} -> New ${callerId} (Call #${campaign.callCounter})`);
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
	DESTINATION: number
  };

  // Add IVR files if they exist
  if (settings.ivr_intro_file) {
    variables.__CAMPAIGN_INTRO = settings.ivr_intro_file;
  }
  if (settings.ivr_outro_file) {
    variables.__CAMPAIGN_OUTRO = settings.ivr_outro_file;
  }
  
  // Add Call Routing variables
  const routingType = settings.routing_type || 'sip_trunk';
  variables.__ROUTING_TYPE = routingType;
  
  if (routingType === 'sip_trunk') {
    // SIP Trunk routing - send destination number and trunk name
    variables.__ROUTING_DESTINATION = settings.routing_destination;
    variables.__ROUTING_TRUNK_NAME = settings.sip_trunk.name;
  } else if (routingType === 'queue') {
    // Queue/Agent routing - send queue name
    variables.__ROUTING_QUEUE = settings.routing_destination;
  }
  
  ami.action(
    {
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
          Campaign.increment('failedCalls', { where: { id: settings.campaign_id } });
        }
        
        const bot = get_bot();
        bot.sendMessage(
          settings?.notifications_chat_id,
          `❌ Failed to call ${number}\n` +
          `Error: ${err.message}\n` +
          `Trunk: ${trunkName}\n` +
		  `${dialPrefix ? `Prefix: ${dialPrefix}\n` : ''}` +
          `Caller ID: ${callerId}`,
          { parse_mode: "HTML" }
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