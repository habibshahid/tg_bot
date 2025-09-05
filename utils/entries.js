const Call = require("../models/call");
const { get_bot } = require("../telegram_bot/botInstance");
const { get_settings } = require("./settings");
const telegramQueue = require("./telegramQueue");

let entries = [];
let unprocessedData = [];

const get_entry_by_number = (phoneNumber) => {
  return entries.find((entry) => entry.phoneNumber === phoneNumber) || null;
};

exports.add_entry_to_database = async (phoneNumber, dtmfEntry) => {
  const entry = get_entry_by_number(phoneNumber);
  const settings = get_settings();
  const dtmfDigit = settings.dtmf_digit || '1';

  const existingCall = await Call.findOne({
	  where: {
		phoneNumber: `+${phoneNumber}`,
		campaignId: settings.campaign_id
	  }
  });

  if (existingCall) {
    // Update the existing call with DTMF response
    await existingCall.update({
      pressedOne: true,
      pressedDigit: dtmfEntry
    });
    console.log(`Updated call entry for +${phoneNumber} - pressed ${dtmfEntry}`);
  } else {
    // Create new call entry (shouldn't happen in normal flow)
    const newCall = await Call.create({
      phoneNumber: `+${phoneNumber}`,
      rawLine: entry?.rawLine || '',
      pressedOne: true,
      pressedDigit: dtmfEntry,
      campaignId: settings.campaign_id,
      callStatus: 'success'
    });
  }

  const bot = get_bot();
  telegramQueue.sendMessage(
    settings.notifications_chat_id,
    `✅ ${phoneNumber} pressed ${dtmfEntry}. Do /line to retrieve their info.`,
    { parse_mode: "HTML" }
  );
};

exports.add_other_entry_to_database = async (phoneNumber, dtmfEntry) => {
  const entry = get_entry_by_number(phoneNumber);
  const settings = get_settings();
  const dtmfDigit = settings.dtmf_digit || '1';

  const existingCall = await Call.findOne({
	  where: {
		phoneNumber: `+${phoneNumber}`,
		campaignId: settings.campaign_id
	  }
  });

  if (existingCall) {
    // Update the existing call with DTMF response
    await existingCall.update({
      pressedOne: true,
      pressedDigit: dtmfEntry
    });
    console.log(`Updated call entry for +${phoneNumber} - pressed ${dtmfEntry}`);
  } else {
    // Create new call entry (shouldn't happen in normal flow)
    const newCall = await Call.create({
      phoneNumber: `+${phoneNumber}`,
      rawLine: entry?.rawLine || '',
      pressedOne: true,
      pressedDigit: dtmfEntry,
      campaignId: settings.campaign_id,
      callStatus: 'success'
    });
  }

  const bot = get_bot();
  telegramQueue.sendMessage(
    settings.notifications_chat_id,
    `✅ ${phoneNumber} pressed ${dtmfEntry} which is not set in campaign. Do /line to retrieve their info.`,
    { parse_mode: "HTML" }
  );
};

exports.call_started = async (phoneNumber) => {
  const entry = get_entry_by_number(phoneNumber);
  const settings = get_settings();
  
  // Check if call already exists for this campaign
  let call = await Call.findOne({
	  where:{
    phoneNumber: `+${phoneNumber}`,
    campaignId: settings.campaign_id
	  }
  });
  
  if (call) {
    // Update existing call
    await call.update({
      callStarted: new Date(),
      callStatus: 'calling',
      used: true
    });
  } else {
    // Create new call
    call = await Call.create({
      phoneNumber: `+${phoneNumber}`,
      rawLine: entry?.rawLine || '',
      campaignId: settings.campaign_id,
      callStarted: new Date(),
      callStatus: 'calling',
      used: true
    });
  }

  const bot = get_bot();
  /*telegramQueue.sendMessage(
    settings.notifications_chat_id,
    `📞 Call Started: ${phoneNumber}`,
    { parse_mode: "HTML" }
  );*/
};

exports.call_ended = async (phoneNumber, callStatus) => {
  const entry = get_entry_by_number(phoneNumber);
  const settings = get_settings();

  if(settings?.campaign_id){
  const existingCall = await Call.findOne({
	  where:{
		phoneNumber: `+${phoneNumber}`,
		campaignId: settings.campaign_id
	  }
  });

  if (existingCall) {
    await existingCall.update({
      callEnded: new Date(),
      callStatus: existingCall.pressedOne ? 'success' : 'failed'
    });
  }

  const bot = get_bot();
  /*telegramQueue.sendMessage(
    settings.notifications_chat_id,
    `📴 Call Ended: ${phoneNumber} with ${callStatus}`,
    { parse_mode: "HTML" }
  );*/
  }else{
	  console.log('invalid call');
  }
};

exports.add_entry_to_memory = (entry) => {
  if (!entries.some((e) => e.phoneNumber === entry.phoneNumber)) {
    entries.push(entry);
  }
};

exports.set_unprocessed_data = (data) => {
  unprocessedData = data;
};

exports.pop_unprocessed_line = () => {
  return unprocessedData.pop();
};