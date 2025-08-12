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
const { start_bot_instance } = require("./botInstance");
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
  if (!text) return text;
  return text
    .replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
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

async function startCallingProcess(data, campaign) {
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
        dtmf_responses: campaign.dtmfResponses,
        success_rate: campaign.totalCalls > 0 ? ((campaign.successfulCalls / campaign.totalCalls) * 100).toFixed(2) : 0,
        response_rate: campaign.successfulCalls > 0 ? ((campaign.dtmfResponses / campaign.successfulCalls) * 100).toFixed(2) : 0
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
		  const permittedUser2 = await Allowed.findOne({ 
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
		  const permittedUser3 = await Allowed.findOne({ 
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
            trunkList += `${index + 1}. *${trunk.name}*\n`;
            trunkList += `   📍 Host: ${trunk.host}\n`;
            trunkList += `   👤 Username: ${trunk.username || trunk.defaultuser}\n`;
            if (trunk.description) {
              trunkList += `   📝 ${trunk.description}\n`;
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
		  
		  // Use escape characters for special markdown characters
		  bot.sendMessage(
			chatId,
			`📈 *Campaign Statistics*\n\n` +
			`*Campaign Info:*\n` +
			`• Name: ${escapeMarkdown(currentCampaignStats.campaignName)}\n` +
			`• SIP Trunk: ${trunkInfo}\n` +
			`• Caller ID: ${escapeMarkdown(currentCampaignStats.callerId || 'Not set ⚠️')}\n` +
			`• Concurrent Calls: ${currentCampaignStats.concurrentCalls}\n` +
			`• DTMF Digit: ${currentCampaignStats.dtmfDigit}\n` +
			`• Dial Prefix: ${currentCampaign.dialPrefix || 'None'}\n` +
			`• IVR Intro: ${escapeMarkdown(currentCampaignStats.ivrIntroFile || 'Using default')}\n` +
			`• IVR Outro: ${escapeMarkdown(currentCampaignStats.ivrOutroFile || 'Using default')}\n\n` +
			`*Campaign Performance:*\n` +
			`• Total Calls: ${currentCampaignStats.totalCalls}\n` +
			`• Successful: ${currentCampaignStats.successfulCalls}\n` +
			`• Failed: ${currentCampaignStats.failedCalls}\n` +
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
				dtmfResponses: 0,
				callCounter: 0
			  });
			  
			  // Clear the pressedNumbers set in asterisk instance
			  const { ami } = require("../asterisk/instance");
			  ami.emit('clear_pressed_numbers');
			  
			  bot.sendMessage(
				chatId,
				`🚀 *Campaign Started!*\n\n` +
				`Campaign: ${campaign.campaignName}\n` +
				`SIP Trunk: ${campaign.sipTrunk.name}\n` +
				`Caller ID: ${campaign.callerId}\n` +
				`DTMF Digit: ${campaign.dtmfDigit}\n` +
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
		  
		  case "waiting_leads_file":
			  console.log('[Document] Processing leads file');
			  
			  // Leads files must be documents, not audio
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
			  
			  // Get current campaign to check if we can auto-start
			  const currentCampaign = await getOrCreateCampaign();
			  
			  const unprocessedData2 = await filterProcessedNumbers(data2, currentCampaign.id);
			  if (unprocessedData2.length === 0) {
				bot.sendMessage(chatId, "⚠️ All numbers have already been processed.");
				return;
			  }
			  
			  // Check if SIP trunk and caller ID are configured
			  const canAutoStart = currentCampaign.sipTrunkId && currentCampaign.callerId;
			  
			  if (canAutoStart) {
				// Validate SIP trunk
				const trunkValidation = await validateSipTrunk(currentCampaign.sipTrunkId);
				if (!trunkValidation.valid) {
				  bot.sendMessage(
					chatId,
					`⚠️ *Leads Uploaded but Campaign NOT Started*\n\n` +
					`Total numbers: ${data2.length}\n` +
					`New numbers: ${unprocessedData2.length}\n` +
					`Duplicates: ${data2.length - unprocessedData2.length}\n\n` +
					`❌ SIP Trunk Error: ${trunkValidation.message}\n\n` +
					`Please fix the SIP trunk configuration and use "Start Campaign" to begin dialing.`,
					{ parse_mode: "Markdown", ...mainMenu }
				  );
				  
				  // Still save the leads
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
				
				// Reset campaign statistics for new batch
				await currentCampaign.update({
				  totalCalls: 0,
				  successfulCalls: 0,
				  failedCalls: 0,
				  dtmfResponses: 0,
				  callCounter: 0
				});
				
				// Include the SIP trunk in campaign
				const campaignWithTrunk = await Campaign.findByPk(currentCampaign.id, {
				  include: [{ model: SipPeer, as: 'sipTrunk' }]
				});
				
				// Clear the pressedNumbers set
				const { ami } = require("../asterisk/instance");
				ami.emit('clear_pressed_numbers');
				
				bot.sendMessage(
				  chatId,
				  `✅ *Leads Uploaded & Campaign Auto-Started!*\n\n` +
				  `Total numbers: ${data2.length}\n` +
				  `New numbers: ${unprocessedData2.length}\n` +
				  `Duplicates: ${data2.length - unprocessedData2.length}\n\n` +
				  `🚀 *Auto-Starting Campaign:*\n` +
				  `SIP Trunk: ${campaignWithTrunk.sipTrunk.name}\n` +
				  `Caller ID: ${campaignWithTrunk.callerId}\n` +
				  `DTMF Digit: ${campaignWithTrunk.dtmfDigit}\n` +
				  `Concurrent Calls: ${campaignWithTrunk.concurrentCalls}\n\n` +
				  `Dialing will begin automatically...`,
				  { parse_mode: "Markdown", ...mainMenu }
				);
				
				// Update settings with campaign data
				set_settings({
				  notifications_chat_id: campaignWithTrunk.notificationsChatId || chatId,
				  concurrent_calls: campaignWithTrunk.concurrentCalls,
				  sip_trunk: campaignWithTrunk.sipTrunk,
				  caller_id: campaignWithTrunk.callerId,
				  campaign_id: campaignWithTrunk.id,
				  dtmf_digit: campaignWithTrunk.dtmfDigit,
				  ivr_intro_file: campaignWithTrunk.ivrIntroFile,
				  ivr_outro_file: campaignWithTrunk.ivrOutroFile
				});
				
				// Start calling process automatically
				startCallingProcess(unprocessedData2, campaignWithTrunk);
				
			  } else {
				// Can't auto-start - show what's missing
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
				
				// Save leads to database with campaign ID
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
bot.onText(/\/line/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  try {
    // Get current campaign
    const campaign = await getOrCreateCampaign();
    
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