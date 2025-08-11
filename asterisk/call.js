// Updated asterisk/call.js to use caller ID from campaign

const { get_bot } = require("../telegram_bot/botInstance");
const {
  add_entry_to_memory,
  pop_unprocessed_line,
} = require("../utils/entries");
const { sanitize_phoneNumber } = require("../utils/sanitization");
const { get_settings } = require("../utils/settings");
const { ami } = require("./instance");

let hasLoggedAllLines = false;

module.exports = async (entry) => {
  if (!entry) {
    if (!hasLoggedAllLines) {
      const bot = get_bot();
      const settings = get_settings();
      
      bot.sendMessage(
        settings?.notifications_chat_id,
        `✅ All lines have been called`,
        {
          parse_mode: "HTML",
        }
      );
      hasLoggedAllLines = true;
    }
    return;
  }

  console.log('*************** call number *******************', entry)
  const number = sanitize_phoneNumber(entry?.phoneNumber);
  const settings = get_settings();
  add_entry_to_memory({ ...entry, phoneNumber: number });

  const actionId = `call-${number}-${Date.now()}`;
  
  // Get the SIP trunk name and caller ID from settings
  const sipTrunk = settings.sip_trunk;
  const trunkName = sipTrunk ? sipTrunk.name : 'main';
  const callerId = settings.caller_id || number; // Use campaign caller ID or fallback to called number

  console.log(`Ringing number ${number} using trunk: ${trunkName} with Caller ID: ${callerId}`);
  
  const variables = {
    callId: actionId,
    TRUNK_NAME: trunkName,
    CAMPAIGN_ID: String(settings.campaign_id || 'default'),
    CAMPAIGN_CALLERID: callerId
  };

  // Add IVR files if they exist
  if (settings.ivr_intro_file) {
    variables.__CAMPAIGN_INTRO = settings.ivr_intro_file;  // Double underscore for inheritance
  }
  if (settings.ivr_outro_file) {
    variables.__CAMPAIGN_OUTRO = settings.ivr_outro_file;  // Double underscore for inheritance
  }
  
  ami.action(
    {
      action: "Originate",
      channel: `SIP/${trunkName}/${number}`,  // Use dynamic trunk name
      context: `outbound-${settings?.agent || "coinbase"}`,
      exten: number,
      priority: 1,
      actionid: actionId,
      variable: Object.entries(variables).map(([key, value]) => `${key}=${value}`),
      CallerID: callerId,  // Use the campaign's caller ID
      async: true,
    },
    (err, res) => {
      if (err) {
        console.error("Originate Error:", err);
        
        // Notify about the error with more details
        const bot = get_bot();
        bot.sendMessage(
          settings?.notifications_chat_id,
          `❌ Failed to call ${number}\n` +
          `Error: ${err.message}\n` +
          `Trunk: ${trunkName}\n` +
          `Caller ID: ${callerId}`,
          { parse_mode: "HTML" }
        );
        
        // Try next number
        require("./call")(pop_unprocessed_line());
      } else {
        console.log("Originate Response:", res);
        
        // Optional: Send notification when call starts
        const bot = get_bot();
        bot.sendMessage(
          settings?.notifications_chat_id,
          `📞 Calling ${number}\n` +
          `Trunk: ${trunkName}\n` +
          `Caller ID: ${callerId}`,
          { parse_mode: "HTML" }
        );
      }
    }
  );

  hasLoggedAllLines = false;
};
