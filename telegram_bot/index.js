const config = require("../config");
const Call = require("../models/call");
const Campaign = require("../models/campaign");
const SipPeer = require("../models/sippeer");
const axios = require("axios");
const Allowed = require("../models/allowed");
const { get_settings, set_settings } = require("../utils/settings");
const { sanitize_phoneNumber } = require("../utils/sanitization");
const { waitForConnection } = require("../asterisk/instance");
const {
  set_unprocessed_data,
  pop_unprocessed_line,
} = require("../utils/entries");
const { start_bot_instance, get_bot } = require("./botInstance");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const sequelize = require("../config/database");

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);


// State management for user interactions
const userStates = {};

function logUserState(userId, action, state) {
  console.log(`[UserState] User: ${userId}, Action: ${action}, State:`, state);
  console.log('[UserStates] All states:', Object.keys(userStates));
}

function sanitizeFilename(filename) {
  // Remove extension first
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  // Replace spaces and special characters with underscore
  const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
  // Remove multiple underscores
  return sanitized.replace(/_+/g, '_').toLowerCase();
}

function escapeMarkdown(text) {
  if (!text) return '';
  // Convert to string in case it's not
  text = String(text);
  // Escape all special Markdown characters
  return text
    .replace(/\\/g, '\\\\') // Backslash must be first
    .replace(/\*/g, '\\*')   // Asterisk
    .replace(/_/g, '\\_')    // Underscore
    .replace(/\[/g, '\\[')   // Square bracket open
    .replace(/\]/g, '\\]')   // Square bracket close
    .replace(/\(/g, '\\(')   // Parenthesis open
    .replace(/\)/g, '\\)')   // Parenthesis close
    .replace(/~/g, '\\~')    // Tilde
    .replace(/`/g, '\\`')    // Backtick
    .replace(/>/g, '\\>')    // Greater than
    .replace(/#/g, '\\#')    // Hash
    .replace(/\+/g, '\\+')   // Plus
    .replace(/-/g, '\\-')    // Minus
    .replace(/=/g, '\\=')    // Equals
    .replace(/\|/g, '\\|')   // Pipe
    .replace(/\{/g, '\\{')   // Curly brace open
    .replace(/\}/g, '\\}')   // Curly brace close
    .replace(/\./g, '\\.')   // Period
    .replace(/!/g, '\\!');   // Exclamation
}

async function convertAudioFile(inputPath, outputPath) {
  try {
    // Using sox for conversion (install with: apt-get install sox libsox-fmt-all)
    const command = `sox "${inputPath}" -r 8000 -c 1 -b 16 "${outputPath}" norm -3`;
    
    await execPromise(command);
    console.log(`Audio converted successfully: ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`Audio conversion failed: ${error.message}`);
    // Fallback to ffmpeg if sox fails
    try {
      const ffmpegCommand = `ffmpeg -i "${inputPath}" -acodec pcm_s16le -ar 8000 -ac 1 -f wav "${outputPath}" -y`;
      await execPromise(ffmpegCommand);
      console.log(`Audio converted with ffmpeg: ${outputPath}`);
      return true;
    } catch (ffmpegError) {
      console.error(`FFmpeg conversion also failed: ${ffmpegError.message}`);
      throw new Error('Audio conversion failed. Please ensure sox or ffmpeg is installed.');
    }
  }
}

/*async function startCallingProcess(data, campaign) {
  const concurrentCalls = campaign.concurrentCalls;

  // Save all leads to database with campaign ID before starting
  for (const entry of data) {
    const phoneNumber = `+${sanitize_phoneNumber(entry.phoneNumber)}`;
    
    // Check if this number already exists for this campaign
    const existingCall = await Call.findOne({
      where: {
        phoneNumber: phoneNumber,
        campaignId: campaign.id
      }
    });
    
    if (!existingCall) {
      await Call.create({
        phoneNumber: phoneNumber,
        rawLine: entry.rawLine,
        used: false,
        campaignId: campaign.id,
        callStatus: 'pending'
      });
    }
  }

  await waitForConnection();

  set_unprocessed_data(data);

  const callPromises = [];

  for (let i = 0; i < concurrentCalls; i++) {
    const line = pop_unprocessed_line();
    if (line) {
      callPromises.push(require("../asterisk/call")(line));
    }
  }

  await Promise.all(callPromises);
  return;
}*/

async function startCallingProcess(data, campaign) {
  const concurrentCalls = campaign.concurrentCalls;
  const CALLS_PER_SECOND = 3; // Maximum 10 calls per second - adjust based on your asterisk server capacity
  
  // Save all leads to database with campaign ID before starting
  for (const entry of data) {
    const phoneNumber = `+${sanitize_phoneNumber(entry.phoneNumber)}`;
    
    // Check if this number already exists for this campaign
    const existingCall = await Call.findOne({
      where: {
        phoneNumber: phoneNumber,
        campaignId: campaign.id
      }
    });
    
    if (!existingCall) {
      await Call.create({
        phoneNumber: phoneNumber,
        rawLine: entry.rawLine,
        used: false,
        campaignId: campaign.id,
        callStatus: 'pending'
      });
    }
  }
  
  await waitForConnection();
  set_unprocessed_data(data);
  const callPromises = [];
  
  for (let i = 0; i < concurrentCalls; i++) {
    const line = pop_unprocessed_line();
    if (line) {
      const delayedCall = async () => {
        // Calculate delay to ensure rate limiting
        // For example with 10 calls/second:
        // Calls 0-9: start at 0ms, 100ms, 200ms, ..., 900ms
        // Calls 10-19: start at 1000ms, 1100ms, 1200ms, ..., 1900ms
        // And so on...
        const secondGroup = Math.floor(i / CALLS_PER_SECOND);
        const positionInGroup = i % CALLS_PER_SECOND;
        const delay = (secondGroup * 1500) + (positionInGroup * (1500 / CALLS_PER_SECOND));
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return require("../asterisk/call")(line);
      };
      callPromises.push(delayedCall());
    }
  }
  
  // Wait for all calls to complete
  await Promise.all(callPromises);
  const bot = get_bot();
  const settings = get_settings();
  
  bot.sendMessage(
	settings?.notifications_chat_id,
	`✅ All lines have been called`,
	{
	  parse_mode: "HTML",
	}
  );
  return;
}

// Get or create campaign for this bot
async function getOrCreateCampaign() {
  const botToken = config.telegram_bot_token;
  
  let campaign = await Campaign.findOne({
    where: { botToken },
    include: [{
      model: SipPeer,
      as: 'sipTrunk'
    }]
  });

  if (!campaign) {
    // Create default campaign
    campaign = await Campaign.create({
      botToken,
      campaignName: 'Default Campaign',
      concurrentCalls: config.concurrent_calls || 30,
      isActive: true
    });
  }

  return campaign;
}

// Validate caller ID format
function validateCallerId(callerId) {
  // Remove all non-numeric characters for validation
  const cleaned = callerId.replace(/\D/g, '');
  
  // Check if it's a valid US number (10 or 11 digits)
  if (cleaned.length === 10 || (cleaned.length === 11 && cleaned.startsWith('1'))) {
    return { valid: true, formatted: cleaned };
  }
  
  // Check if it's an international number (minimum 7 digits)
  if (cleaned.length >= 7 && cleaned.length <= 15) {
    return { valid: true, formatted: cleaned };
  }
  
  return { valid: false, message: "Invalid caller ID format. Please use a valid phone number." };
}

async function createCallbackEntry(phoneNumber, campaignId) {
  try {
    // Check if entry exists
    const existingCall = await Call.findOne({
      where: {
        phoneNumber: `+${phoneNumber}`,
        campaignId: campaignId
      }
    });
    
    if (!existingCall) {
      // Create new call entry for callback
      await Call.create({
        phoneNumber: `+${phoneNumber}`,
        rawLine: `callback-${phoneNumber}`,
        used: false,
        campaignId: campaignId,
        callStatus: 'pending'
      });
    }
  } catch (error) {
    console.error('Error creating callback entry:', error);
  }
}

// 8. CREATE CALLBACK FUNCTION - Add this to telegram_bot/index.js
async function initiateCallback(phoneNumber, campaign) {
  const { ami } = require("../asterisk/instance");
  const { set_settings, get_settings } = require("../utils/settings");
  
  if (!campaign.callbackTrunk) {
    throw new Error("Callback trunk not loaded");
  }
  
  if (!campaign.callbackTrunkNumber) {
    throw new Error("Callback trunk number not configured");
  }
  
  // Ensure campaign_id is set in settings for callback tracking
  const currentSettings = get_settings();
  if (!currentSettings.campaign_id || currentSettings.campaign_id !== campaign.id) {
    set_settings({
      ...currentSettings,
      campaign_id: campaign.id,
      notifications_chat_id: campaign.notificationsChatId,
      sip_trunk: campaign.sipTrunk,
      caller_id: campaign.callerId,
      dial_prefix: campaign.dialPrefix || '',
      dtmf_digit: campaign.dtmfDigit || '1'
    });
  }
  
  const actionId = `callback-${phoneNumber}-${Date.now()}`;
  const dialedNumber = (campaign.dialPrefix || '') + phoneNumber;
  
  const variables = {
    CALLBACK_TRUNK: campaign.callbackTrunk.name,
    CALLBACK_CALLERID: campaign.callerId || phoneNumber,
	CALLBACK_TRUNK_NUMBER: campaign.callbackTrunkNumber,
    CALLBACK_DESTINATION: phoneNumber,
    CAMPAIGN_ID: String(campaign.id)
  };
  
  console.log('Initiating callback:', {
    phoneNumber,
    dialedNumber,
    regularTrunk: campaign.sipTrunk.name,
    callbackTrunk: campaign.callbackTrunk.name,
	callbackTrunkNumber: campaign.callbackTrunkNumber,
    campaignId: campaign.id,
    variables
  });
  
  return new Promise((resolve, reject) => {
    ami.action({
      action: "Originate",
      channel: `SIP/${campaign.sipTrunk.name}/${dialedNumber}`,
      context: "callback-context",
      exten: dialedNumber,
      priority: 1,
      actionid: actionId,
      variable: Object.entries(variables).map(([key, value]) => `${key}=${value}`),
      CallerID: campaign.callerId || phoneNumber,
      async: true,
      timeout: 30000
    }, (err, res) => {
      if (err) {
        console.error("Callback Originate Error:", err);
        reject(err);
      } else {
        console.log("Callback Originate Response:", res);
        resolve(res);
      }
    });
  });
}

// Helper function to read and parse the file buffer uploaded by the user
function parseFileData(fileBuffer) {
  // Combined regex for US and Pakistan phone numbers
  const phoneRegexPatterns = [
    // Pakistan formats
    /(?:\+?92|0092|0)?[\s.-]?(?:3\d{2}|2\d|4\d|5\d|6\d|7\d|8\d|9\d)[\s.-]?\d{3}[\s.-]?\d{4}/,
    // US formats
    /(?:\+?1\s?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/
  ];

  return fileBuffer
    .toString("utf-8")
    .split("\n")
    .map((line) => {
      console.log('Processing line:', line);
      
      /*let phoneNumber = null;
      let matchedNumber = null;
      
      // Try each regex pattern
      for (const regex of phoneRegexPatterns) {
        const match = line.match(regex);
        if (match) {
          matchedNumber = match[0];
          break;
        }
      }
      
      if (matchedNumber) {
        // Clean the number - remove all non-digits
        phoneNumber = matchedNumber.replace(/\D/g, "");
        
        // Normalize Pakistan numbers
        if (phoneNumber.startsWith('0092')) {
          // Convert 0092 to 92
          phoneNumber = phoneNumber.substring(2);
        } else if (phoneNumber.length === 10 && phoneNumber.startsWith('3')) {
          // Pakistan mobile without 0 prefix - add country code
          phoneNumber = '92' + phoneNumber;
        } else if (phoneNumber.length === 11 && phoneNumber.startsWith('03')) {
          // Pakistan mobile with 0 prefix - replace 0 with 92
          phoneNumber = '92' + phoneNumber.substring(1);
        } else if (phoneNumber.length === 10 && phoneNumber.startsWith('2')) {
          // Possible Pakistan landline without area code 0
          phoneNumber = '92' + phoneNumber;
        } else if (phoneNumber.length === 11 && phoneNumber.startsWith('0') && !phoneNumber.startsWith('03')) {
          // Pakistan landline with 0 prefix
          phoneNumber = '92' + phoneNumber.substring(1);
        }
        
        console.log('Extracted number:', matchedNumber, '→ Normalized:', phoneNumber);
      }
      
      return phoneNumber ? { phoneNumber, rawLine: line.trim() } : null;*/
	  return { phoneNumber: line, rawLine: line.trim() };
    })
    .filter(Boolean);
}


// Function to filter out already processed phone numbers
async function filterProcessedNumbers(data, campaignId = null) {
  let whereClause = {};
  
  // If campaignId is provided, only check numbers for that campaign
  if (campaignId) {
    whereClause.campaignId = campaignId;
  }
  
  const processedNumbers = await Call.findAll({
    where: whereClause,
    attributes: ['phoneNumber']
  });
  
  const usedNumbers = new Set(
    processedNumbers.map((record) => record.phoneNumber)
  );
  
  return data.filter((entry) => {
    const sanitizedEntry = sanitize_phoneNumber(entry.phoneNumber);
    return !usedNumbers.has(`+${sanitizedEntry}`);
  });
}

// Get call statistics
async function getCallStats(campaignId = null) {
  if (campaignId) {
    const campaign = await Campaign.findByPk(campaignId);
    if (campaign) {
      return {
        total: campaign.totalCalls,
        successful: campaign.successfulCalls,
        failed: campaign.failedCalls,
		voicemail: campaign.voicemailCalls,
        dtmf_responses: campaign.dtmfResponses,
        success_rate: campaign.totalCalls > 0 ? (((campaign.successfulCalls) / campaign.totalCalls) * 100).toFixed(2) : 0,
        response_rate: campaign.successfulCalls > 0 ? ((campaign.dtmfResponses / (campaign.successfulCalls )) * 100).toFixed(2) : 0
      };
    }
  }
  
  // Fallback to old method if no campaign
  const totalCalls = await Call.count();
  const completedCalls = await Call.count({ where: { used: true } });
  const pendingCalls = await Call.count({ where: { used: false } });
  const pressedOne = await Call.count({ where: { pressedOne: true } });
  
  return {
    total: totalCalls,
    completed: completedCalls,
    pending: pendingCalls,
    pressed_one: pressedOne,
    success_rate: totalCalls > 0 ? ((pressedOne / totalCalls) * 100).toFixed(2) : 0
  };
}

// Get SIP trunks from database
async function getSipTrunks() {
  return await SipPeer.findAll({
    where: { 
      category: 'trunk',
      status: 1
    },
    order: [['id', 'ASC']]
  });
}

// Validate SIP trunk
async function validateSipTrunk(trunkId) {
  const trunk = await SipPeer.findByPk(trunkId);
  
  if (!trunk) {
    return { valid: false, message: "SIP trunk not found" };
  }
  
  if (!trunk.status) {
    return { valid: false, message: "SIP trunk is inactive" };
  }
  
  if (trunk.category !== 'trunk') {
    return { valid: false, message: "Selected SIP peer is not a trunk" };
  }
  
  return { valid: true, trunk: trunk };
}

// Initialize Telegram Bot
const initializeBot = () => {
  const bot = start_bot_instance();
  const adminId = config.creator_telegram_id;

  // Main menu - Updated with Caller ID option
  const mainMenu = {
	  reply_markup: {
		inline_keyboard: [
		  [
			{ text: "🚀 Start Campaign", callback_data: "start_campaign" },
			{ text: "📊 Check Call Status", callback_data: "call_status" }
		  ],
		  [
			{ text: "🆔 Get Your ID", callback_data: "get_id" },
			{ text: "📁 Upload Leads (TXT)", callback_data: "upload_leads" }
		  ],
		  [
			{ text: "⚙️ Set Concurrent Calls", callback_data: "set_concurrent" },
			{ text: "📞 Set Caller ID", callback_data: "set_caller_id" }
		  ],
		  [
			{ text: "🌐 Set SIP Trunk", callback_data: "set_sip" },
			{ text: "📢 Set Notifications", callback_data: "set_notifications" }
		  ],
		  [
			{ text: "🎵 Upload IVR", callback_data: "upload_ivr" },
			{ text: "👤 Permit User", callback_data: "permit_user" }
		  ],
		  [
			{ text: "🔢 Set DTMF Digit", callback_data: "set_dtmf" },
			{ text: "📈 Campaign Stats", callback_data: "campaign_stats" }
		  ],
		  [
			{ text: "➕ Set Dial Prefix", callback_data: "set_dial_prefix" },
			{ text: "- Remove Dial Prefix", callback_data: "remove_dial_prefix" }
		  ],
		  [
			{ text: "☎️ Set Callback Trunk", callback_data: "set_callback_trunk" },
			{ text: "📱 Set Callback Number", callback_data: "set_callback_number" }
		  ],
		  [
			{ text: "📲 Initiate Callback", callback_data: "initiate_callback" }
		  ]
		]
	  }
	};

  // Start command - show main menu
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId, 
      "🤖 *Welcome to Call Campaign Bot!*\n\nSelect an option from the menu below:",
      { 
        ...mainMenu,
        parse_mode: "Markdown"
      }
    );
  });

  // Handle callback queries
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const callbackData = query.data;

    // Answer callback to remove loading state
    bot.answerCallbackQuery(query.id);

    switch (callbackData) {
		case "set_callback_trunk":
		  let permittedUserCallback = await Allowed.findOne({ 
			where: { telegramId: userId } 
		  });
		  console.log(`Request from User ${userId} for set_callback_trunk`)
		  if(userId == adminId){
			permittedUserCallback = true;
		  }
		  if (!permittedUserCallback) {
			console.log("❌ Admin access required to set_callback_trunk!", userId);
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  // Get available SIP trunks for callback
		  const callbackTrunks = await getSipTrunks();
		  
		  if (callbackTrunks.length === 0) {
			bot.sendMessage(
			  chatId,
			  `☎️ *No SIP Trunks Found*\n\nNo SIP trunks are configured for callback.`,
			  { parse_mode: "Markdown" }
			);
		  } else {
			let trunkList = "☎️ *Select Callback SIP Trunk:*\n\n";
			callbackTrunks.forEach((trunk, index) => {
			  // PROPERLY ESCAPE all dynamic content
			  trunkList += `${index + 1}. *${escapeMarkdown(trunk.name)}*\n`;
			  trunkList += `   📍 Host: ${escapeMarkdown(trunk.host)}\n`;
			  trunkList += `   👤 Username: ${escapeMarkdown(trunk.username || trunk.defaultuser || 'N/A')}\n`;
			  trunkList += `   🔌 Status: ${trunk.status ? '✅ Active' : '❌ Inactive'}\n\n`;
			});
			trunkList += "Enter the number of the callback trunk you want to use:";
			
			const campaignCallback = await getOrCreateCampaign();
			bot.sendMessage(chatId, trunkList, { parse_mode: "Markdown" });
			userStates[userId] = { 
			  action: "waiting_callback_trunk_selection", 
			  sipTrunks: callbackTrunks,
			  campaignId: campaignCallback.id 
			};
		  }
		  break;

	case "initiate_callback":
	  const campaignCheck = await getOrCreateCampaign();
	  
	  if (!campaignCheck.callbackTrunkId) {
		bot.sendMessage(
		  chatId,
		  `❌ *Callback Trunk Not Set*\n\nPlease set a callback trunk first using "Set Callback Trunk" option.`,
		  { parse_mode: "Markdown" }
		);
		return;
	  }
	  
	  if (!campaignCheck.callbackTrunkNumber) {
		bot.sendMessage(
		  chatId,
		  `❌ *Callback Number Not Set*\n\nPlease set a callback trunk number using "Set Callback Number" option.`,
		  { parse_mode: "Markdown" }
		);
		return;
	  }
	  
	  // Load the callback trunk to get its name
	  const callbackTrunkInfo = await SipPeer.findByPk(campaignCheck.callbackTrunkId);
	  
	  bot.sendMessage(
		chatId,
		`📲 *Initiate Callback*\n\n` +
		`Callback Trunk: ${escapeMarkdown(callbackTrunkInfo ? callbackTrunkInfo.name : 'Loading...')}\n` +
		`Callback Number: ${escapeMarkdown(campaignCheck.callbackTrunkNumber)}\n\n` +
		`Select callback option:`,
		{
		  parse_mode: "Markdown",
		  reply_markup: {
			inline_keyboard: [
			  [
				{ text: "📞 Single Number", callback_data: "callback_single" },
				{ text: "📁 Upload List", callback_data: "callback_list" }
			  ],
			  [
				{ text: "🔙 Back", callback_data: "back_to_menu" }
			  ]
			]
		  }
		}
	  );
	  break;
	  
	case "set_callback_number":
	  let permittedUserCallbackNum = await Allowed.findOne({ 
		where: { telegramId: userId } 
	  });
	  console.log(`Request from User ${userId} for set_callback_number`)
	  if(userId == adminId){
		permittedUserCallbackNum = true;
	  }
	  if (!permittedUserCallbackNum) {
		console.log("❌ Admin access required to set_callback_number!", userId);
		bot.sendMessage(chatId, "❌ Admin access required!");
		return;
	  }
	  
	  const campaignForCallbackNum = await getOrCreateCampaign();
	  
	  // Check if callback trunk is set first
	  if (!campaignForCallbackNum.callbackTrunkId) {
		bot.sendMessage(
		  chatId,
		  `❌ *Callback Trunk Not Set*\n\nPlease set a callback trunk first before setting the callback number.`,
		  { parse_mode: "Markdown" }
		);
		return;
	  }
	  
	  const currentCallbackNum = campaignForCallbackNum.callbackTrunkNumber || 'Not set';
	  bot.sendMessage(
		chatId,
		`📱 *Set Callback Trunk Number*\n\n` +
		`Current Callback Number: ${escapeMarkdown(currentCallbackNum)}\n\n` +
		`This is the destination number/extension on the callback trunk.\n` +
		`Enter the number that will receive the callbacks:\n\n` +
		`Examples:\n` +
		`• 18001234567 (US number)\n` +
		`• 442012345678 (UK number)\n` +
		`• 1000 (Extension)\n` +
		`• s (for 's' extension in dialplan)`,
		{ parse_mode: "Markdown" }
	  );
	  userStates[userId] = { action: "waiting_callback_trunk_number", campaignId: campaignForCallbackNum.id };
	  break;

	case "callback_single":
	  const campaignSingle = await getOrCreateCampaign();
	  if (!campaignSingle.callbackTrunkId) {
		bot.sendMessage(chatId, "❌ Please set callback trunk first!");
		return;
	  }
	  bot.sendMessage(
		chatId,
		`📞 *Enter Single Number for Callback*\n\nEnter the phone number (with country code):`,
		{ parse_mode: "Markdown" }
	  );
	  userStates[userId] = { action: "waiting_callback_number", campaignId: campaignSingle.id };
	  break;

	case "callback_list":
	  const campaignList = await getOrCreateCampaign();
	  if (!campaignList.callbackTrunkId) {
		bot.sendMessage(chatId, "❌ Please set callback trunk first!");
		return;
	  }
	  bot.sendMessage(
		chatId,
		`📁 *Upload Callback List*\n\nPlease upload a TXT file with phone numbers (one per line).`,
		{ parse_mode: "Markdown" }
	  );
	  userStates[userId] = { action: "waiting_callback_file", campaignId: campaignList.id };
	  break;
	  
	  case "set_dial_prefix":
		  let permittedUserPrefix = await Allowed.findOne({ 
			where: { telegramId: userId } 
		  });
		  console.log(`Request from User ${userId} for set_dial_prefix`)
		  if(userId == adminId){
			permittedUserPrefix = true;
		  }
		  if (!permittedUserPrefix) {
			console.log("❌ Admin access required to set_dial_prefix!", userId);
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  const campaignForPrefix = await getOrCreateCampaign();
		  const currentPrefix = campaignForPrefix.dialPrefix || 'None';
		  bot.sendMessage(
			chatId,
			`➕ *Set Dial Prefix*\n\n` +
			`Current Dial Prefix: ${currentPrefix}\n\n` +
			`Enter the prefix to add before all dialed numbers.\n` +
			`Examples:\n` +
			`• 9 (for outbound access)\n` +
			`• 011 (for international calls)\n` +
			`• 1 (for long distance)\n` +
			`The prefix will be added to all numbers when dialing.`,
			{ parse_mode: "Markdown" }
		  );
		  userStates[userId] = { action: "waiting_dial_prefix", campaignId: campaignForPrefix.id };
		  break;
		  
	  case "remove_dial_prefix":
		  let permittedUserPrefix1 = await Allowed.findOne({ 
			where: { telegramId: userId } 
		  });
		  console.log(`Request from User ${userId} for set_dial_prefix`)
		  if(userId == adminId){
			permittedUserPrefix1 = true;
		  }
		  if (!permittedUserPrefix1) {
			console.log("❌ Admin access required to set_dial_prefix!", userId);
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  const campaignPrefix = await getOrCreateCampaign();
		  await campaignPrefix.update({ dialPrefix: '' });
		  
		  bot.sendMessage(
			chatId,
			`✅ *Dial Prefix Removed Successfully!*\n\n`,
			{ parse_mode: "Markdown", ...mainMenu }
		  );
		  delete userStates[userId];
		  break;
		  
      case "start_campaign":
        // Check for campaign in database
        const campaign = await getOrCreateCampaign();
        
        // Validate all required fields
        const missingFields = [];
        if (!campaign.sipTrunkId) missingFields.push("SIP Trunk");
        if (!campaign.callerId) missingFields.push("Caller ID");
        
        if (missingFields.length > 0) {
          bot.sendMessage(
            chatId, 
            `⚠️ *Cannot Start Campaign*\n\nThe following required fields are not configured:\n${missingFields.map(f => `• ${f}`).join('\n')}\n\nPlease configure all required fields before starting the campaign.`,
            { parse_mode: "Markdown", ...mainMenu }
          );
          return;
        }

        // Validate the SIP trunk
        const trunkValidation = await validateSipTrunk(campaign.sipTrunkId);
        if (!trunkValidation.valid) {
          bot.sendMessage(
            chatId,
            `⚠️ SIP Trunk Error: ${trunkValidation.message}\n\nPlease reconfigure your SIP trunk.`,
            { parse_mode: "Markdown" }
          );
          return;
        }

        bot.sendMessage(
		  chatId,
		  `📤 *Start Campaign*\n\n` +
		  `Campaign: ${escapeMarkdown(campaign.campaignName)}\n` +
		  `SIP Trunk: ${escapeMarkdown(trunkValidation.trunk.name)}\n` +
		  `Caller ID: ${escapeMarkdown(campaign.callerId)}\n` +
		  `Dial Prefix: ${campaign.dialPrefix || 'None'}\n` +
		  `Concurrent Calls: ${campaign.concurrentCalls}\n\n` +
		  `Please upload your leads file (TXT format) containing phone numbers.`,
		  { parse_mode: "Markdown" }
		);
        userStates[userId] = { action: "waiting_campaign_file", campaignId: campaign.id };
        break;

      case "set_dtmf":
		  const campaignForDtmf = await getOrCreateCampaign();
		  bot.sendMessage(
			chatId,
			`🔢 *Set DTMF Digit*\n\n` +
			`Current DTMF digit: ${campaignForDtmf.dtmfDigit || '1'}\n\n` +
			`Enter a single digit (0-9) that callers should press:`,
			{ parse_mode: "Markdown" }
		  );
		  userStates[userId] = { action: "waiting_dtmf_digit", campaignId: campaignForDtmf.id };
		  break;

		case "call_status":
		  const currentCampaign = await getOrCreateCampaign();
		  const stats = await getCallStats(currentCampaign.id);
		  bot.sendMessage(
			chatId,
			`📊 *Call Status Report*\n\n` +
			`Total Calls Made: ${stats.total || 0}\n` +
			`Successful Calls: ${stats.successful || 0}\n` +
			`Failed Calls: ${stats.failed || 0}\n` +
			`Voicemail Calls: ${stats.voicemail || 0}\n` +
			`DTMF Responses (${currentCampaign.dtmfDigit || '1'}): ${stats.dtmf_responses || 0}\n` +
			`Call Success Rate: ${stats.success_rate || 0}%\n` +
			`Response Rate: ${stats.response_rate || 0}%\n\n` +
			`Last updated: ${new Date().toLocaleString()}`,
			{ parse_mode: "Markdown" }
		  );
		  break;

      case "get_id":
        bot.sendMessage(
          chatId,
          `🔑 *Your Telegram ID*\n\nYour ID: \`${userId}\`\nChat ID: \`${chatId}\``,
          { parse_mode: "Markdown" }
        );
        break;

      case "upload_leads":
		  const checkCampaign = await getOrCreateCampaign();
		  const isConfigured = checkCampaign.sipTrunkId && checkCampaign.callerId;
		  
		  bot.sendMessage(
			chatId,
			`📁 *Upload Leads File*\n\n` +
			`Please send a TXT file with phone numbers (one per line).\n\n` +
			(isConfigured ? 
			  `✅ Campaign is configured and will auto-start after upload.\n` +
			  `• SIP Trunk: ${checkCampaign.sipTrunkId ? 'Set' : 'Not set'}\n` +
			  `• Caller ID: ${checkCampaign.callerId ? escapeMarkdown(checkCampaign.callerId) : 'Not set'}` :
			  `⚠️ Campaign is NOT fully configured.\n` +
			  `Missing: ${!checkCampaign.sipTrunkId ? 'SIP Trunk' : ''} ${!checkCampaign.callerId ? 'Caller ID' : ''}\n` +
			  `Leads will be saved but dialing won't start automatically.`
			),
			{ parse_mode: "Markdown" }
		  );
		  userStates[userId] = { action: "waiting_leads_file" };
		  break;

      case "set_caller_id":
		  let permittedUser = await Allowed.findOne({ 
			where: { telegramId: userId } 
		  });
		  console.log(`Request from User ${userId} for set_caller_id`)
		  if(userId == adminId){
			permittedUser = true;
		  }
		  if (!permittedUser) {
			console.log("❌ Admin access required to set_caller_id!", userId);
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  const campaignForCallerId = await getOrCreateCampaign();
		  const currentCallerId = campaignForCallerId.callerId || 'Not set';
		  bot.sendMessage(
			chatId,
			`📞 *Set Caller ID*\n\n` +
			`Current Caller ID: ${escapeMarkdown(currentCallerId)}\n\n` +
			`Please enter the phone number to use as Caller ID.\n` +
			`Formats accepted:\n` +
			`• 1234567890\n` +
			`• 11234567890\n` +
			`• +11234567890\n` +
			`• (123) 456-7890`,
			{ parse_mode: "Markdown" }
		  );
		  userStates[userId] = { action: "waiting_caller_id", campaignId: campaignForCallerId.id };
		  break;

      case "set_concurrent":
		  let permittedUser2 = await Allowed.findOne({ 
			where: { telegramId: userId } 
		  });
		  console.log(`Request from User ${userId} for set_concurrent`)
		  if(userId == adminId){
			permittedUser2 = true;
		  }
		  if (!permittedUser2) {
			console.log("❌ Admin access required to set_concurrent!", userId);
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  const campaign2 = await getOrCreateCampaign();
		  bot.sendMessage(
			chatId,
			`⚙️ *Set Concurrent Calls*\n\nCurrent: ${campaign2.concurrentCalls || 30}\nPlease enter the new number of concurrent calls (1-100):`,
			{ parse_mode: "Markdown" }
		  );
		  userStates[userId] = { action: "waiting_concurrent_number", campaignId: campaign2.id };
		  break;

      case "upload_ivr":
		  let permittedUser3 = await Allowed.findOne({ 
			  where: { telegramId: userId } 
		  });
		  console.log(`Request from User ${userId} for upload_ivr`)
		  if(userId == adminId){
			permittedUser3 = true;
		  }
		  if (!permittedUser3) {
			console.log("❌ Admin access required to upload_ivr!", userId);
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  bot.sendMessage(
			chatId,
			"🎵 *Upload IVR Audio*\n\n" +
			"Supported formats: WAV, MP3, MP4, M4A, AAC, OGG, FLAC\n" +
			"File will be converted to: PCM 16-bit, 8000Hz, Mono\n\n" +
			"Select type:",
			{
			  parse_mode: "Markdown",
			  reply_markup: {
				inline_keyboard: [
				  [
					{ text: "📥 Intro Message", callback_data: "ivr_intro" },
					{ text: "📤 Outro Message", callback_data: "ivr_outro" }
				  ]
				]
			  }
			}
		  );
		  break;

      case "ivr_intro":
      case "ivr_outro":
        const ivrType = callbackData.split("_")[1];
        const campaign3 = await getOrCreateCampaign();
		
		userStates[userId] = { 
			action: "waiting_ivr_file", 
			ivrType, 
			campaignId: campaign3.id 
		};
		
		logUserState(userId, 'Set waiting_ivr_file', userStates[userId]);
		
        bot.sendMessage(
          chatId,
          `Please upload the ${ivrType} audio file now.`,
          { parse_mode: "Markdown" }
        );
        break;

      case "set_sip":
		  let permittedUser4 = await Allowed.findOne({ 
			where: { telegramId: userId } 
		  });
		  console.log(`Request from User ${userId} for set_sip`)
		  if(userId == adminId){
			permittedUser4 = true;
		  }
		  if (!permittedUser4) {
			console.log("❌ Admin access required to set_sip!", userId);
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  // Get available SIP trunks
		  const sipTrunks = await getSipTrunks();
		  
		  if (sipTrunks.length === 0) {
			bot.sendMessage(
			  chatId,
			  `🌐 *No SIP Trunks Found*\n\nNo SIP trunks are configured in the system.\n\nYou can:\n1. Visit the web portal to create one: ${config.web_portal_url}\n2. Create a new SIP trunk here`,
			  {
				parse_mode: "Markdown",
				reply_markup: {
				  inline_keyboard: [
					[{ text: "➕ Create New SIP Trunk", callback_data: "create_sip_trunk" }],
					[{ text: "🔙 Back to Menu", callback_data: "back_to_menu" }]
				  ]
				}
			  }
			);
		  } else {
			// List available trunks with more details
			let trunkList = "🌐 *Available SIP Trunks:*\n\n";
			sipTrunks.forEach((trunk, index) => {
			  // PROPERLY ESCAPE all dynamic content
			  trunkList += `${index + 1}. *${escapeMarkdown(trunk.name)}*\n`;
			  trunkList += `   📍 Host: ${escapeMarkdown(trunk.host)}\n`;
			  trunkList += `   👤 Username: ${escapeMarkdown(trunk.username || trunk.defaultuser || 'N/A')}\n`;
			  if (trunk.description) {
				trunkList += `   📝 ${escapeMarkdown(trunk.description)}\n`;
			  }
			  trunkList += `   🔌 Status: ${trunk.status ? '✅ Active' : '❌ Inactive'}\n\n`;
			});
			trunkList += "Enter the number of the trunk you want to use:";
			
			const campaign4 = await getOrCreateCampaign();
			bot.sendMessage(chatId, trunkList, { parse_mode: "Markdown" });
			userStates[userId] = { 
			  action: "waiting_sip_selection", 
			  sipTrunks: sipTrunks,
			  campaignId: campaign4.id 
			};
		  }
		  break;

      case "create_sip_trunk":
        bot.sendMessage(
          chatId,
          "➕ *Create New SIP Trunk*\n\n" +
          "Please provide SIP details in this format:\n\n" +
          "`name:host:username:password:port:register:context`\n\n" +
          "Example:\n" +
          "`MyTrunk:sip.provider.com:myuser:mypass:5060:yes:outbound-trunk`\n\n" +
          "*Parameters:*\n" +
          "• name: Unique name for the trunk\n" +
          "• host: SIP provider hostname/IP\n" +
          "• username: Your SIP username\n" +
          "• password: Your SIP password\n" +
          "• port: SIP port (usually 5060)\n" +
          "• register: yes/no (for registration)\n" +
          "• context: Asterisk context (e.g., outbound-trunk)",
          { parse_mode: "Markdown" }
        );
        const campaign5 = await getOrCreateCampaign();
        userStates[userId] = { action: "waiting_new_sip_config", campaignId: campaign5.id };
        break;

      case "set_notifications":
        const campaign6 = await getOrCreateCampaign();
        await campaign6.update({ notificationsChatId: chatId });
        bot.sendMessage(
          chatId,
          `✅ *Notifications Channel Set*\n\nThis chat (${chatId}) will receive all notifications for this campaign.`,
          { parse_mode: "Markdown" }
        );
        break;

      case "permit_user":
        if (userId != adminId) {
          bot.sendMessage(chatId, "❌ Admin access required!");
          return;
        }
        bot.sendMessage(
          chatId,
          "👤 *Permit User*\n\nEnter the Telegram ID of the user to permit:",
          { parse_mode: "Markdown" }
        );
        userStates[userId] = { action: "waiting_permit_id" };
        break;

      case "campaign_stats":
		  const campaignStats = await getCallStats();
		  const currentCampaignStats = await getOrCreateCampaign();
		  
		  let trunkInfo = 'Not configured';
		  if (currentCampaignStats.sipTrunk) {
			trunkInfo = `${escapeMarkdown(currentCampaignStats.sipTrunk.name)} (${escapeMarkdown(currentCampaignStats.sipTrunk.host)})`;
			if (!currentCampaignStats.sipTrunk.status) {
			  trunkInfo += ' ⚠️ INACTIVE';
			}
		  }
		  
		  let callbackInfo = 'Not configured';
		  if (currentCampaignStats.callbackTrunkId) {
			const callbackTrunk = await SipPeer.findByPk(currentCampaignStats.callbackTrunkId);
			if (callbackTrunk) {
			  callbackInfo = `${escapeMarkdown(callbackTrunk.name)}`;
			  if (currentCampaignStats.callbackTrunkNumber) {
				callbackInfo += ` → ${escapeMarkdown(currentCampaignStats.callbackTrunkNumber)}`;
			  }
			}
		  }
		  
		  // Use escape characters for special markdown characters
		  bot.sendMessage(
			chatId,
			`📈 *Campaign Statistics*\n\n` +
			`*Campaign Info:*\n` +
			`• Name: ${escapeMarkdown(currentCampaignStats.campaignName)}\n` +
			`• SIP Trunk: ${trunkInfo}\n` +
			`• Caller ID: ${escapeMarkdown(currentCampaignStats.callerId || 'Not set ⚠️')}\n` +
			`• Callback Config: ${callbackInfo}\n` +
			`• Concurrent Calls: ${currentCampaignStats.concurrentCalls}\n` +
			`• DTMF Digit: ${currentCampaignStats.dtmfDigit}\n` +
			`• Dial Prefix: ${currentCampaignStats.dialPrefix || 'None'}\n` +
			`• IVR Intro: ${escapeMarkdown(currentCampaignStats.ivrIntroFile || 'Using default')}\n` +
			`• IVR Outro: ${escapeMarkdown(currentCampaignStats.ivrOutroFile || 'Using default')}\n\n` +
			`*Campaign Performance:*\n` +
			`• Total Calls: ${currentCampaignStats.totalCalls}\n` +
			`• Successful: ${currentCampaignStats.successfulCalls}\n` +
			`• Failed: ${currentCampaignStats.failedCalls}\n` +
			`• Voicemail: ${currentCampaignStats.voicemailCalls}\n` +
			`• DTMF Responses: ${currentCampaignStats.dtmfResponses}\n` +
			`• Success Rate: ${currentCampaignStats.totalCalls > 0 ? ((currentCampaignStats.successfulCalls / currentCampaignStats.totalCalls) * 100).toFixed(2) : 0}%\n` +
			`• Response Rate: ${currentCampaignStats.successfulCalls > 0 ? ((currentCampaignStats.dtmfResponses / currentCampaignStats.successfulCalls) * 100).toFixed(2) : 0}%`,
			{ parse_mode: "Markdown" }
		  );
		  break;

      case "back_to_menu":
        bot.editMessageText(
          "🤖 *Call Campaign Bot*\n\nSelect an option:",
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            ...mainMenu,
            parse_mode: "Markdown"
          }
        );
        break;
    }
  });

  // Handle text messages based on user state
  bot.on("text", async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;
    
    if (text.startsWith("/")) return; // Ignore commands
    
    const userState = userStates[userId];
    if (!userState) return;

    switch (userState.action) {
		case "waiting_callback_trunk_number":
		  const callbackTrunkNum = text.trim();
		  
		  // Basic validation - allow numbers, 's', or extensions
		  if (!callbackTrunkNum) {
			bot.sendMessage(chatId, "❌ Please enter a valid number or extension.");
			return;
		  }
		  
		  const campaignCbNum = await Campaign.findByPk(userState.campaignId);
		  await campaignCbNum.update({ callbackTrunkNumber: callbackTrunkNum });
		  
		  bot.sendMessage(
			chatId,
			`✅ *Callback Trunk Number Set Successfully!*\n\n` +
			`Callback Number: ${escapeMarkdown(callbackTrunkNum)}\n\n` +
			`This number will be dialed on the callback trunk when callbacks are initiated.`,
			{ parse_mode: "Markdown", ...mainMenu }
		  );
		  delete userStates[userId];
		  break;
		
		case "waiting_callback_confirmation":
		  if (text.toLowerCase() === 'yes') {
			const campaignCb = await Campaign.findByPk(userState.campaignId, {
			  include: [
				{ model: SipPeer, as: 'sipTrunk' },
				{ model: SipPeer, as: 'callbackTrunk' }
			  ]
			});
			
			if (!campaignCb.callbackTrunkId || !campaignCb.callbackTrunk) {
			  bot.sendMessage(chatId, "❌ Callback trunk not configured!");
			  delete userStates[userId];
			  return;
			}
			
			// Set campaign settings before initiating callbacks
			set_settings({
			  notifications_chat_id: campaignCb.notificationsChatId || chatId,
			  concurrent_calls: campaignCb.concurrentCalls,
			  sip_trunk: campaignCb.sipTrunk,
			  caller_id: campaignCb.callerId,
			  dial_prefix: campaignCb.dialPrefix || '',
			  campaign_id: campaignCb.id,
			  dtmf_digit: campaignCb.dtmfDigit || '1',
			  ivr_intro_file: campaignCb.ivrIntroFile,
			  ivr_outro_file: campaignCb.ivrOutroFile
			});
			
			bot.sendMessage(
			  chatId,
			  `🔄 *Initiating Callbacks*\n\nStarting callbacks to ${userState.dtmfNumbers.length} numbers...`,
			  { parse_mode: "Markdown" }
			);
			
			// Initiate callbacks for all DTMF numbers
			let callbackCount = 0;
			let failedCount = 0;
			
			for (const number of userState.dtmfNumbers) {
			  try {
				const cleanNumber = number.replace('+', '');
				await createCallbackEntry(cleanNumber, campaignCb.id);
				await initiateCallback(cleanNumber, campaignCb);
				callbackCount++;
				await new Promise(resolve => setTimeout(resolve, 1000));
			  } catch (error) {
				console.error(`Failed to initiate callback for ${number}:`, error);
				failedCount++;
			  }
			}
			
			bot.sendMessage(
			  chatId,
			  `✅ *Callbacks Complete*\n\n` +
			  `Successfully initiated: ${callbackCount} callbacks\n` +
			  `${failedCount > 0 ? `Failed: ${failedCount} callbacks\n` : ''}` +
			  `Using trunk: ${escapeMarkdown(campaignCb.callbackTrunk ? campaignCb.callbackTrunk.name : 'N/A')}\n` +
			  `Callback number: ${escapeMarkdown(campaignCb.callbackTrunkNumber || 'N/A')}`,
			  { parse_mode: "Markdown", ...mainMenu }
			);
		  } else {
			bot.sendMessage(chatId, "❌ Callback cancelled.", mainMenu);
		  }
		  delete userStates[userId];
		  break;
		  
		case "waiting_callback_trunk_selection":
		  const trunkIndexCallback = parseInt(text) - 1;
		  if (isNaN(trunkIndexCallback) || trunkIndexCallback < 0 || trunkIndexCallback >= userState.sipTrunks.length) {
			bot.sendMessage(chatId, "❌ Invalid selection. Please try again.");
			return;
		  }
		  
		  const selectedCallbackTrunk = userState.sipTrunks[trunkIndexCallback];
		  const campaignToUpdateCallback = await Campaign.findByPk(userState.campaignId);
		  
		  await campaignToUpdateCallback.update({ callbackTrunkId: selectedCallbackTrunk.id });
		  
		  bot.sendMessage(
			chatId,
			`✅ *Callback Trunk Set Successfully!*\n\nSelected: ${escapeMarkdown(selectedCallbackTrunk.name)}`,
			{ parse_mode: "Markdown", ...mainMenu }
		  );
		  delete userStates[userId];
		  break;

		case "waiting_callback_number":
		  const callbackNumber = sanitize_phoneNumber(text.trim());
		  if (!callbackNumber) {
			bot.sendMessage(chatId, "❌ Invalid phone number. Please try again.");
			return;
		  }
		  
		  const campaignForCallback = await Campaign.findByPk(userState.campaignId, {
			include: [
			  { model: SipPeer, as: 'sipTrunk' },
			  { model: SipPeer, as: 'callbackTrunk' }
			]
		  });
		  
		  // Set campaign settings before initiating callback
		  set_settings({
			notifications_chat_id: campaignForCallback.notificationsChatId || chatId,
			concurrent_calls: campaignForCallback.concurrentCalls,
			sip_trunk: campaignForCallback.sipTrunk,
			caller_id: campaignForCallback.callerId,
			dial_prefix: campaignForCallback.dialPrefix || '',
			campaign_id: campaignForCallback.id,
			dtmf_digit: campaignForCallback.dtmfDigit || '1',
			ivr_intro_file: campaignForCallback.ivrIntroFile,
			ivr_outro_file: campaignForCallback.ivrOutroFile
		  });
		  
		  // Initiate callback
		  try {
			await initiateCallback(callbackNumber, campaignForCallback);
			
			bot.sendMessage(
			  chatId,
			  `✅ *Callback Initiated*\n\n` +
			  `Calling: ${escapeMarkdown(callbackNumber)}\n` +
			  `Using trunk: ${escapeMarkdown(campaignForCallback.sipTrunk ? campaignForCallback.sipTrunk.name : 'N/A')}\n` +
			  `Callback trunk: ${escapeMarkdown(campaignForCallback.callbackTrunk ? campaignForCallback.callbackTrunk.name : 'N/A')}\n` +
			  `Callback number: ${escapeMarkdown(campaignForCallback.callbackTrunkNumber || 'N/A')}`,
			  { parse_mode: "Markdown" }
			);
		  } catch (error) {
			bot.sendMessage(
			  chatId,
			  `❌ *Failed to initiate callback*\n\nError: ${escapeMarkdown(error.message)}`,
			  { parse_mode: "Markdown" }
			);
		  }
		  
		  delete userStates[userId];
		  break;

		
	  case "waiting_dial_prefix":
		  const prefix = text.trim();
		  // Validate prefix - should only contain digits
		  if (prefix && !/^\d*$/.test(prefix)) {
			bot.sendMessage(chatId, "❌ Prefix should only contain numbers.");
			return;
		  }
		  
		  const campaignPrefix = await Campaign.findByPk(userState.campaignId);
		  await campaignPrefix.update({ dialPrefix: prefix });
		  
		  bot.sendMessage(
			chatId,
			`✅ *Dial Prefix ${prefix ? 'Set' : 'Removed'} Successfully!*\n\n` +
			`${prefix ? `Prefix: ${prefix}\n\nAll numbers will be dialed as: ${prefix} + [phone number]` : 'No prefix will be added to dialed numbers.'}`,
			{ parse_mode: "Markdown", ...mainMenu }
		  );
		  delete userStates[userId];
		  break;
		  
      case "waiting_caller_id":
		  const validation = validateCallerId(text);
		  if (!validation.valid) {
			bot.sendMessage(chatId, `❌ ${validation.message}`);
			return;
		  }
		  
		  const campaign = await Campaign.findByPk(userState.campaignId);
		  await campaign.update({ callerId: validation.formatted });
		  
		  bot.sendMessage(
			chatId,
			`✅ *Caller ID Set Successfully!*\n\nCaller ID: ${escapeMarkdown(validation.formatted)}\n\nThis number will be displayed to recipients when making calls.`,
			{ parse_mode: "Markdown", ...mainMenu }
		  );
		  delete userStates[userId];
		  break;

      case "waiting_concurrent_number":
        const concurrentNum = parseInt(text);
        if (isNaN(concurrentNum) || concurrentNum < 1 || concurrentNum > 100) {
          bot.sendMessage(chatId, "❌ Please enter a valid number between 1 and 100.");
          return;
        }
        const campaign2 = await Campaign.findByPk(userState.campaignId);
        await campaign2.update({ concurrentCalls: concurrentNum });
        bot.sendMessage(
          chatId,
          `✅ Concurrent calls set to: ${concurrentNum}`,
          mainMenu
        );
        delete userStates[userId];
        break;

	  case "waiting_dtmf_digit":
		  if (!/^[0-9]$/.test(text)) {
			bot.sendMessage(chatId, "❌ Please enter a single digit (0-9).");
			return;
		  }
		  const campaignDtmf = await Campaign.findByPk(userState.campaignId);
		  await campaignDtmf.update({ dtmfDigit: text });
		  bot.sendMessage(
			chatId,
			`✅ DTMF digit set to: ${text}`,
			mainMenu
		  );
		  delete userStates[userId];
		  break;


      case "waiting_sip_selection":
        const selection = parseInt(text);
        if (isNaN(selection) || selection < 1 || selection > userState.sipTrunks.length) {
          bot.sendMessage(chatId, "❌ Invalid selection. Please enter a valid number.");
          return;
        }
        const selectedTrunk = userState.sipTrunks[selection - 1];
        const campaign3 = await Campaign.findByPk(userState.campaignId);
        await campaign3.update({ sipTrunkId: selectedTrunk.id });
        bot.sendMessage(
          chatId,
          `✅ SIP trunk set to: ${selectedTrunk.name}`,
          mainMenu
        );
        delete userStates[userId];
        break;

      case "waiting_new_sip_config":
        const sipParts = text.split(":");
        if (sipParts.length !== 7) {
          bot.sendMessage(chatId, "❌ Invalid format. Use: name:host:username:password:port:register:context");
          return;
        }
        
        try {
          // Prepare register string if registration is enabled
          let registerString = null;
          if (sipParts[5].toLowerCase() === 'yes') {
            registerString = `${sipParts[2]}:${sipParts[3]}@${sipParts[1]}:${sipParts[4]}/${sipParts[2]}`;
          }
          
          // Create new SIP peer with actual schema fields
          const newSipPeer = await SipPeer.create({
            name: sipParts[0],
            host: sipParts[1],
            username: sipParts[2],
            defaultuser: sipParts[2],
            secret: sipParts[3],
            sippasswd: sipParts[3],
            port: sipParts[4] || '5060',
            context: sipParts[6] || 'outbound-trunk',
            category: 'trunk',
            type: 'peer',
            fromuser: sipParts[2],
            fromdomain: sipParts[1],
            register_string: registerString,
            insecure: 'port,invite',
            nat: 'force_rport,comedia',
            canreinvite: 'no',
            directmedia: 'no',
            qualify: 'yes',
            disallow: 'all',
            allow: 'alaw;ulaw;gsm',
            transport: 'udp',
            dtmfmode: 'rfc2833',
            status: 1,
            description: `Created via Telegram bot on ${new Date().toLocaleDateString()}`
          });

          // Update campaign
          const campaign4 = await Campaign.findByPk(userState.campaignId);
          await campaign4.update({ sipTrunkId: newSipPeer.id });

          bot.sendMessage(
            chatId,
            `✅ *SIP trunk created successfully!*\n\n` +
            `📌 Name: ${newSipPeer.name}\n` +
            `🌐 Host: ${newSipPeer.host}\n` +
            `👤 Username: ${newSipPeer.username}\n` +
            `🔌 Status: Active`,
            { parse_mode: "Markdown", ...mainMenu }
          );
          
        } catch (error) {
          bot.sendMessage(chatId, `❌ Error creating SIP trunk: ${error.message}`);
        }
        delete userStates[userId];
        break;

      case "waiting_permit_id":
        const permitId = text.trim();
        if (!/^\d+$/.test(permitId)) {
          bot.sendMessage(chatId, "❌ Invalid ID. Please enter numbers only.");
          return;
        }
        try {
          const existing = await Allowed.findOne({ 
            where: { telegramId: permitId } 
          });
          if (existing) {
            bot.sendMessage(chatId, "⚠️ User already permitted.");
          } else {
            await Allowed.create({ telegramId: permitId });
            bot.sendMessage(chatId, `✅ User ${permitId} permitted!`, mainMenu);
          }
        } catch (error) {
          bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        }
        delete userStates[userId];
        break;
    }
  });

  // Handle file uploads
  bot.on("message", async (msg) => {
	  if (!msg.audio && !msg.document) return;
	  
	  const chatId = msg.chat.id;
	  const userId = msg.from.id;
	  const userState = userStates[userId];
	  
	  // Get file info based on type
	  let fileId, fileName;
	  if (msg.audio) {
		fileId = msg.audio.file_id;
		fileName = msg.audio.file_name || `audio_${Date.now()}.mp3`;
	  } else if (msg.document) {
		fileId = msg.document.file_id;
		fileName = msg.document.file_name;
	  }
	  
	  console.log(`[File] Received from user ${userId}:`, {
		fileName,
		fileId,
		chatId,
		type: msg.audio ? 'audio' : 'document'
	  });
	  
	  console.log(`[File] User state for ${userId}:`, userState);
	  console.log('[File] All user states:', userStates);
	  
	  if (!userState) return;
	  
	  try {
		const file = await bot.getFile(fileId);
		const filePath = `https://api.telegram.org/file/bot${config.telegram_bot_token}/${file.file_path}`;
		const fileBuffer = (await axios.get(filePath, { responseType: "arraybuffer" })).data;
		
		console.log(`[File] Processing action: ${userState.action}`);
		
		switch (userState.action) {		
		  case "waiting_callback_file":
			  if (!msg.document) {
				bot.sendMessage(chatId, "❌ Please upload a TXT document file.");
				return;
			  }
			  
			  if (!fileName.endsWith('.txt')) {
				bot.sendMessage(chatId, "❌ Please upload a TXT file.");
				return;
			  }
			  
			  const callbackData = parseFileData(fileBuffer);
			  if (callbackData.length === 0) {
				bot.sendMessage(chatId, "❌ No valid phone numbers found in file.");
				return;
			  }
			  
			  const campaignWithCallback = await Campaign.findByPk(userState.campaignId, {
				include: [
				  { model: SipPeer, as: 'sipTrunk' },
				  { model: SipPeer, as: 'callbackTrunk' }
				]
			  });
			  
			  // Set campaign settings before initiating callbacks
			  set_settings({
				notifications_chat_id: campaignWithCallback.notificationsChatId || chatId,
				concurrent_calls: campaignWithCallback.concurrentCalls,
				sip_trunk: campaignWithCallback.sipTrunk,
				caller_id: campaignWithCallback.callerId,
				dial_prefix: campaignWithCallback.dialPrefix || '',
				campaign_id: campaignWithCallback.id,  // THIS IS CRITICAL
				dtmf_digit: campaignWithCallback.dtmfDigit || '1',
				ivr_intro_file: campaignWithCallback.ivrIntroFile,
				ivr_outro_file: campaignWithCallback.ivrOutroFile
			  });
			  
			  bot.sendMessage(
				chatId,
				`🚀 *Starting Callbacks*\n\nProcessing ${callbackData.length} numbers...`,
				{ parse_mode: "Markdown" }
			  );
			  
			  // Process callbacks with rate limiting
			  let successCount = 0;
			  let failCount = 0;
			  
			  for (const entry of callbackData) {
				try {
				  const number = sanitize_phoneNumber(entry.phoneNumber);
				  await initiateCallback(number, campaignWithCallback);
				  successCount++;
				  await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay between calls
				} catch (error) {
				  console.error(`Failed callback for ${entry.phoneNumber}:`, error);
				  failCount++;
				}
			  }
			  
			  bot.sendMessage(
				chatId,
				`✅ *Callbacks Complete*\n\n` +
				`Successfully initiated: ${successCount} callbacks\n` +
				`${failCount > 0 ? `Failed: ${failCount} callbacks\n` : ''}`,
				{ parse_mode: "Markdown", ...mainMenu }
			  );
			  delete userStates[userId];
			  break;

		  
		  case "waiting_campaign_file":
			  console.log('[Document] Processing campaign file');
			  
			  if (!msg.document) {
				bot.sendMessage(chatId, "❌ Please upload a TXT document file, not an audio file.");
				return;
			  }
			  
			  if (!fileName.endsWith('.txt')) {
				bot.sendMessage(chatId, "❌ Please upload a TXT file.");
				return;
			  }
			  
			  const data = parseFileData(fileBuffer);
			  if (data.length === 0) {
				bot.sendMessage(chatId, "❌ No valid phone numbers found in file.");
				return;
			  }
			  
			  const unprocessedData = await filterProcessedNumbers(data, userState.campaignId);
			  if (unprocessedData.length === 0) {
				bot.sendMessage(chatId, "⚠️ All numbers have already been processed.");
				return;
			  }
			  
			  const campaign = await Campaign.findByPk(userState.campaignId, {
				include: [{ model: SipPeer, as: 'sipTrunk' }]
			  });
			  
			  // Reset campaign statistics
			  await campaign.update({
				totalCalls: 0,
				successfulCalls: 0,
				failedCalls: 0,
				voicemailCalls: 0,
				dtmfResponses: 0,
				callCounter: 0
			  });
			  
			  // Clear the pressedNumbers set in asterisk instance
			  const { ami } = require("../asterisk/instance");
			  ami.emit('clear_pressed_numbers');
			  
			  // FIX: Properly escape all dynamic content in the message
			  bot.sendMessage(
				chatId,
				`🚀 *Campaign Started!*\n\n` +
				`Campaign: ${escapeMarkdown(campaign.campaignName || 'Default')}\n` +
				`SIP Trunk: ${escapeMarkdown(campaign.sipTrunk ? campaign.sipTrunk.name : 'N/A')}\n` +
				`Caller ID: ${escapeMarkdown(campaign.callerId || 'Not set')}\n` +
				`DTMF Digit: ${escapeMarkdown(campaign.dtmfDigit || '1')}\n` +
				`Processing ${unprocessedData.length} phone numbers...\n\n` +
				`Statistics have been reset for this new campaign.\n` +
				`You'll receive notifications as calls progress.`,
				{ parse_mode: "Markdown", ...mainMenu }
			  );
			  
			  // Update settings with campaign data including DTMF digit
			  set_settings({
				notifications_chat_id: campaign.notificationsChatId || chatId,
				concurrent_calls: campaign.concurrentCalls,
				sip_trunk: campaign.sipTrunk,
				caller_id: campaign.callerId,
				dial_prefix: campaign.dialPrefix || '',
				campaign_id: campaign.id,
				dtmf_digit: campaign.dtmfDigit,
				ivr_intro_file: campaign.ivrIntroFile,
				ivr_outro_file: campaign.ivrOutroFile
			  });
			  
			  startCallingProcess(unprocessedData, campaign);
			  delete userStates[userId];
			  break;

			// ALSO FIX the waiting_leads_file handler (auto-start campaign)
			case "waiting_leads_file":
			  console.log('[Document] Processing leads file');
			  
			  if (!msg.document) {
				bot.sendMessage(chatId, "❌ Please upload a TXT document file, not an audio file.");
				return;
			  }
			  
			  if (!fileName.endsWith('.txt')) {
				bot.sendMessage(chatId, "❌ Please upload a TXT file.");
				return;
			  }
			  
			  const data2 = parseFileData(fileBuffer);
			  if (data2.length === 0) {
				bot.sendMessage(chatId, "❌ No valid phone numbers found in file.");
				return;
			  }
			  
			  const currentCampaign = await getOrCreateCampaign();
			  
			  const unprocessedData2 = await filterProcessedNumbers(data2, currentCampaign.id);
			  if (unprocessedData2.length === 0) {
				bot.sendMessage(chatId, "⚠️ All numbers have already been processed.");
				return;
			  }
			  
			  const canAutoStart = currentCampaign.sipTrunkId && currentCampaign.callerId;
			  
			  if (canAutoStart) {
				const trunkValidation = await validateSipTrunk(currentCampaign.sipTrunkId);
				if (!trunkValidation.valid) {
				  bot.sendMessage(
					chatId,
					`⚠️ *Leads Uploaded but Campaign NOT Started*\n\n` +
					`Total numbers: ${data2.length}\n` +
					`New numbers: ${unprocessedData2.length}\n` +
					`Duplicates: ${data2.length - unprocessedData2.length}\n\n` +
					`❌ SIP Trunk Error: ${escapeMarkdown(trunkValidation.message)}\n\n` +
					`Please fix the SIP trunk configuration and use "Start Campaign" to begin dialing.`,
					{ parse_mode: "Markdown", ...mainMenu }
				  );
				  
				  for (const entry of unprocessedData2) {
					await Call.create({
					  phoneNumber: `+${sanitize_phoneNumber(entry.phoneNumber)}`,
					  rawLine: entry.rawLine,
					  used: false,
					  campaignId: currentCampaign.id
					});
				  }
				  delete userStates[userId];
				  return;
				}
				
				await currentCampaign.update({
				  totalCalls: 0,
				  successfulCalls: 0,
				  failedCalls: 0,
				  voicemailCalls: 0,
				  dtmfResponses: 0,
				  callCounter: 0
				});
				
				const campaignWithTrunk = await Campaign.findByPk(currentCampaign.id, {
				  include: [{ model: SipPeer, as: 'sipTrunk' }]
				});
				
				const { ami } = require("../asterisk/instance");
				ami.emit('clear_pressed_numbers');
				
				// FIX: Properly escape all dynamic content
				bot.sendMessage(
				  chatId,
				  `✅ *Leads Uploaded & Campaign Auto-Started!*\n\n` +
				  `Total numbers: ${data2.length}\n` +
				  `New numbers: ${unprocessedData2.length}\n` +
				  `Duplicates: ${data2.length - unprocessedData2.length}\n\n` +
				  `🚀 *Auto-Starting Campaign:*\n` +
				  `SIP Trunk: ${escapeMarkdown(campaignWithTrunk.sipTrunk ? campaignWithTrunk.sipTrunk.name : 'N/A')}\n` +
				  `Caller ID: ${escapeMarkdown(campaignWithTrunk.callerId || 'Not set')}\n` +
				  `DTMF Digit: ${escapeMarkdown(campaignWithTrunk.dtmfDigit || '1')}\n` +
				  `Concurrent Calls: ${campaignWithTrunk.concurrentCalls}\n\n` +
				  `Dialing will begin automatically...`,
				  { parse_mode: "Markdown", ...mainMenu }
				);
				
				set_settings({
				  notifications_chat_id: campaignWithTrunk.notificationsChatId || chatId,
				  concurrent_calls: campaignWithTrunk.concurrentCalls,
				  sip_trunk: campaignWithTrunk.sipTrunk,
				  caller_id: campaignWithTrunk.callerId,
				  dial_prefix: campaignWithTrunk.dialPrefix || '',
				  campaign_id: campaignWithTrunk.id,
				  dtmf_digit: campaignWithTrunk.dtmfDigit,
				  ivr_intro_file: campaignWithTrunk.ivrIntroFile,
				  ivr_outro_file: campaignWithTrunk.ivrOutroFile
				});
				
				startCallingProcess(unprocessedData2, campaignWithTrunk);
				
			  } else {
				const missingFields = [];
				if (!currentCampaign.sipTrunkId) missingFields.push("SIP Trunk");
				if (!currentCampaign.callerId) missingFields.push("Caller ID");
				
				bot.sendMessage(
				  chatId,
				  `✅ *Leads Uploaded Successfully*\n\n` +
				  `Total numbers: ${data2.length}\n` +
				  `New numbers: ${unprocessedData2.length}\n` +
				  `Duplicates: ${data2.length - unprocessedData2.length}\n\n` +
				  `⚠️ *Campaign NOT Started - Missing Configuration:*\n` +
				  `${missingFields.map(f => `• ${f}`).join('\n')}\n\n` +
				  `Please configure the missing fields and use "Start Campaign" to begin dialing.`,
				  { parse_mode: "Markdown", ...mainMenu }
				);
				
				for (const entry of unprocessedData2) {
				  await Call.create({
					phoneNumber: `+${sanitize_phoneNumber(entry.phoneNumber)}`,
					rawLine: entry.rawLine,
					used: false,
					campaignId: currentCampaign.id
				  });
				}
			  }
			  
			  delete userStates[userId];
			  break;

			
		  case "waiting_ivr_file":
			console.log('[IVR] Processing IVR file');
			console.log('[IVR] File type:', msg.audio ? 'audio' : 'document');
			console.log('[IVR] IVR Type:', userState.ivrType);
			console.log('[IVR] Campaign ID:', userState.campaignId);
			
			// Check file extension
			if (!fileName.toLowerCase().match(/\.(wav|mp3|mp4|m4a|aac|ogg|flac)$/)) {
			  bot.sendMessage(chatId, "❌ Please upload an audio file (WAV, MP3, MP4, M4A, AAC, OGG, or FLAC).");
			  return;
			}
			
			// Sanitize filename
			const baseFileName = sanitizeFilename(fileName);
			const ivrFileName = `${userState.ivrType}_${userState.campaignId}_${baseFileName}.wav`;
			console.log('waiting_ivr_file', baseFileName, ivrFileName);
			
			// Paths
			const soundsPath = "/var/lib/asterisk/sounds/";
			const tempPath = `/tmp/${Date.now()}_${fileName}`;
			const finalPath = path.join(soundsPath, ivrFileName);
			
			console.log('[IVR] File paths:', {
			  tempPath,
			  finalPath,
			  ivrFileName
			});
			
			try {
			  // Save uploaded file temporarily
			  fs.writeFileSync(tempPath, fileBuffer);
			  console.log('[IVR] Temp file saved');
			  
			  bot.sendMessage(chatId, "🔄 Converting audio file to Asterisk format...");
			  
			  // Convert audio to proper format
			  await convertAudioFile(tempPath, finalPath);
			  console.log('[IVR] Audio converted');
			  
			  // Clean up temp file
			  if (fs.existsSync(tempPath)) {
				fs.unlinkSync(tempPath);
			  }
			  
			  // Update campaign with the filename (without path)
			  const campaign4 = await Campaign.findByPk(userState.campaignId);
			  if (userState.ivrType === "intro") {
				await campaign4.update({ ivrIntroFile: ivrFileName });
			  } else {
				await campaign4.update({ ivrOutroFile: ivrFileName });
			  }
			  console.log('[IVR] Campaign updated');
			  
			  bot.sendMessage(
				chatId,
				`✅ IVR ${userState.ivrType} file uploaded and converted successfully!\n\n` +
				`📁 File: ${ivrFileName}\n` +
				`📍 Location: ${soundsPath}`,
				mainMenu
			  );
			  
			  delete userStates[userId];
			  console.log('[IVR] Process completed successfully');
			  
			} catch (err) {
			  console.error('[IVR] Processing error:', err);
			  // Clean up temp file if exists
			  if (fs.existsSync(tempPath)) {
				fs.unlinkSync(tempPath);
			  }
			  bot.sendMessage(chatId, `❌ Failed to process IVR file: ${err.message}`);
			}
			break;
			
		  default:
			console.log(`[File] Unknown action: ${userState.action}`);
			bot.sendMessage(chatId, "❌ Unknown action. Please try again from the menu.");
			break;
		}
	  } catch (error) {
		console.error('[File] Error processing file:', error);
		bot.sendMessage(chatId, `❌ Error processing file: ${error.message}`);
		delete userStates[userId];
	  }
	});
  // Additional commands
  bot.onText(/\/menu/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      "🤖 *Call Campaign Bot*\n\nSelect an option:",
      { 
        ...mainMenu,
        parse_mode: "Markdown"
      }
    );
  });
   
  // Add these commands to the telegram bot initialization

// /line command - get last pressed DTMF entries
bot.onText(/\/line(?:\s+info)?/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text.trim();
  const isInfo = text === '/line info';
  
  try {
    // Get current campaign with callback trunk
    const campaign = await Campaign.findOne({
      where: { botToken: config.telegram_bot_token },
      include: [
        { model: SipPeer, as: 'sipTrunk' },
        { model: SipPeer, as: 'callbackTrunk' }
      ]
    });
    
    // Get last 10 calls that pressed DTMF
    const recentDTMF = await Call.findAll({
      where: {
        campaignId: campaign.id,
        pressedDigit: { [Op.ne]: null }
      },
      order: [['updatedAt', 'DESC']],
      limit: 10
    });
    
    if (recentDTMF.length === 0) {
      bot.sendMessage(
        chatId,
        `📋 *No DTMF Responses Yet*\n\nNo callers have pressed ${campaign.dtmfDigit} in this campaign.`,
        { parse_mode: "Markdown" }
      );
      return;
    }
    
    let message = `📋 *Recent DTMF Responses (${campaign.dtmfDigit})*\n\n`;
    recentDTMF.forEach((call, index) => {
      const time = call.updatedAt.toLocaleString();
      message += `${index + 1}. ${escapeMarkdown(call.phoneNumber)}\n`;
      message += `   Time: ${time}\n`;
      if (call.rawLine) {
        message += `   Raw: ${escapeMarkdown(call.rawLine)}\n`;
      }
      message += '\n';
    });
    
    // Add callback info ONLY if /line info was used
    //if (isInfo) {
      message += `\n*Callback Configuration:*\n`;
      
      if (campaign.callbackTrunkId && campaign.callbackTrunk) {
        message += `✅ Callback Trunk: ${escapeMarkdown(campaign.callbackTrunk.name)}\n`;
        message += `📱 Callback Number: ${escapeMarkdown(campaign.callbackTrunkNumber || 'Not set')}\n`;
        message += `📞 Regular Trunk: ${escapeMarkdown(campaign.sipTrunk.name)}\n`;
        message += `🆔 Caller ID: ${escapeMarkdown(campaign.callerId || 'Not set')}\n\n`;
        
        if (campaign.callbackTrunkNumber) {
          message += `To initiate callback to all ${recentDTMF.length} numbers above, type: *yes*\n`;
          message += `To cancel, type anything else or use /menu`;
          
          userStates[userId] = { 
            action: "waiting_callback_confirmation", 
            campaignId: campaign.id,
            dtmfNumbers: recentDTMF.map(call => call.phoneNumber)
          };
        } else {
          message += `⚠️ Please set callback trunk number before initiating callbacks.`;
        }
      } else {
        message += `❌ Callback Trunk: Not configured\n`;
        message += `\nTo use callback feature, set both callback trunk and number from the main menu.`;
      }
    //}
    
    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    
  } catch (error) {
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

// /stats command - detailed statistics
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const campaign = await getOrCreateCampaign();
    const stats = await getCallStats(campaign.id);
    
    // Get hourly breakdown for last 24 hours
    const hourlyStats = await sequelize.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d %H:00') as hour,
        COUNT(*) as total_calls,
        SUM(CASE WHEN call_status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN pressed_digit IS NOT NULL THEN 1 ELSE 0 END) as dtmf_responses
      FROM calls
      WHERE campaign_id = :campaignId
        AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY hour
      ORDER BY hour DESC
      LIMIT 24
    `, {
      replacements: { campaignId: campaign.id },
      type: sequelize.QueryTypes.SELECT
    });
    
    let message = `📊 *Detailed Campaign Statistics*\n\n`;
    message += `*Overall Performance:*\n`;
    message += `├ Total Calls: ${stats.total}\n`;
    message += `├ Successful: ${stats.successful}\n`;
    message += `├ Failed: ${stats.failed}\n`;
	message += `├ Voicemail: ${stats.voicemail}\n`;
    message += `├ DTMF (${campaign.dtmfDigit}): ${stats.dtmf_responses}\n`;
    message += `├ Success Rate: ${stats.success_rate}%\n`;
    message += `└ Response Rate: ${stats.response_rate}%\n\n`;
    
    if (hourlyStats.length > 0) {
      message += `*Last 24 Hours:*\n`;
      hourlyStats.slice(0, 5).forEach(hour => {
        message += `${hour.hour}: ${hour.total_calls} calls, ${hour.dtmf_responses} responses\n`;
      });
    }
    
    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    
  } catch (error) {
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

// /reset command - reset campaign statistics (admin only)
bot.onText(/\/reset/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (userId != adminId) {
    bot.sendMessage(chatId, "❌ Admin access required!");
    return;
  }
  
  try {
    const campaign = await getOrCreateCampaign();
    
    await campaign.update({
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
	  voicemailCalls: 0,
      dtmfResponses: 0,
      callCounter: 0
    });
    
    // Clear pressed numbers
    const { ami } = require("../asterisk/instance");
    ami.emit('clear_pressed_numbers');
    
    bot.sendMessage(
      chatId,
      `✅ *Campaign Statistics Reset*\n\nAll counters have been reset to 0.`,
      { parse_mode: "Markdown", ...mainMenu }
    );
    
  } catch (error) {
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

};

module.exports = { initializeBot };