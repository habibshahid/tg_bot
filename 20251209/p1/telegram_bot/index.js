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
const { parseCallerIds, getNextCallerId } = require("../utils/aniRotation");
const Queue = require("../models/queue");
const QueueMember = require("../models/queueMember");

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

// Helper: Escape HTML special characters
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

// Helper: Check if user is admin (creator or has admin permission)
async function isAdmin(userId) {
  if (String(userId) === String(config.creator_telegram_id)) return true;
  
  const allowed = await Allowed.findOne({ 
    where: { telegramId: String(userId) } 
  });
  
  return allowed && allowed.permissionLevel === 'admin';
}

// Helper: Check if user has any access (admin or user level)
async function hasAccess(userId) {
  if (String(userId) === String(config.creator_telegram_id)) return true;
  
  const allowed = await Allowed.findOne({ 
    where: { telegramId: String(userId) } 
  });
  
  return !!allowed;
}

// Helper: Check if user can only use /line (whitelisted but not admin)
async function isLineOnlyUser(userId) {
  if (String(userId) === String(config.creator_telegram_id)) return false;
  
  const allowed = await Allowed.findOne({ 
    where: { telegramId: String(userId) } 
  });
  
  return allowed && allowed.permissionLevel === 'user';
}

// Helper: Check if chat is private (DM)
function isPrivateChat(msg) {
  return msg.chat.type === 'private';
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
    include: [
      { model: SipPeer, as: 'sipTrunk' },
      { model: SipPeer, as: 'callbackTrunk' },
      { model: SipPeer, as: 'routingTrunk' }  // Include if you added routing
    ]
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

// Get available queues from database
async function getQueues() {
  return await Queue.findAll({
    order: [['name', 'ASC']]
  });
}

// Get queue members (agents) for a queue
async function getQueueMembers(queueName) {
  return await QueueMember.findAll({
    where: { queue_name: queueName }
  });
}

// Get all queue memberships for an agent
async function getAgentQueues(agentName) {
  return await QueueMember.findAll({
    where: { 
      [Op.or]: [
        { membername: agentName },
        { interface: `SIP/${agentName}` }
      ]
    }
  });
}

// Get available agents (SIP peers that are not trunks)
async function getAvailableAgents() {
  return await SipPeer.findAll({
    where: { 
      category: { [Op.ne]: 'trunk' },
      status: 1
    },
    order: [['name', 'ASC']]
  });
}

// Get all agents (including inactive)
async function getAllAgents() {
  return await SipPeer.findAll({
    where: { 
      category: { [Op.ne]: 'trunk' }
    },
    order: [['name', 'ASC']]
  });
}

// Generate random SIP password
function generateSipPassword(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Get call statistics
async function getCallStats(campaignId = null) {
  if (campaignId) {
    const campaign = await Campaign.findByPk(campaignId);
    if (campaign) {
		const campaignStats = {
			total: campaign.totalCalls,
			successful: campaign.successfulCalls,
			failed: campaign.failedCalls,
			voicemail: campaign.voicemailCalls,
			dtmf_responses: campaign.dtmfResponses,
			success_rate: campaign.totalCalls > 0 ? (((campaign.successfulCalls) / campaign.totalCalls) * 100).toFixed(2) : 0,
			response_rate: campaign.successfulCalls > 0 ? ((campaign.dtmfResponses / (campaign.successfulCalls)) * 100).toFixed(2) : 0
		};
		
		return campaignStats;
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
		  [{
				text: "🔄 Toggle Rotation", callback_data: "toggle_rotation"
		  },{ text: "📞 Caller ID Settings", callback_data: "caller_id_menu" }],
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
			{ text: "📲 Initiate Callback", callback_data: "initiate_callback" },
			{ text: "🗑️ Clear Database", callback_data: "clear_database" }
		  ],
		  [
			{ text: "📍 Set Line Output Group", callback_data: "set_line_output" },
			{ text: "📝 Set Private Notepad", callback_data: "set_private_notepad" }
		  ],
		  [
		    { text: "🔀 Call Routing", callback_data: "call_routing_menu" },
		    { text: "👥 Agent Management", callback_data: "agent_management_menu" }
		  ]
		]
	  }
	};

  // Start command - show main menu
  bot.onText(/\/start/, async (msg) => {
	  const chatId = msg.chat.id;
	  const userId = msg.from.id;
	  
	  // Check if user is line-only (show restricted menu)
	  if (await isLineOnlyUser(userId)) {
		bot.sendMessage(
		  chatId,
		  `🤖 <b>Call Campaign Bot</b>\n\n` +
		  `You have limited access. Available commands:\n\n` +
		  `• /line - Get next P1 line\n` +
		  `• /line &lt;number&gt; - Lookup specific number\n` +
		  `• /linecount - Show P1 statistics`,
		  { parse_mode: "HTML" }
		);
		return;
	  }
	  
	  // Check if has any access
	  if (!(await hasAccess(userId))) {
		bot.sendMessage(
		  chatId,
		  `❌ <b>Access Denied</b>\n\nYou are not authorized to use this bot.\n\nContact the administrator for access.`,
		  { parse_mode: "HTML" }
		);
		return;
	  }
	  
	  // Show full menu for admins
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
		case "call_routing_menu":
		  if (!(await isAdmin(userId))) {
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  const campaignRouting = await getOrCreateCampaign();
		  const currentRouting = campaignRouting.routingType || 'sip_trunk';
		  const routingDest = campaignRouting.routingDestination || 'Not set';
		  
		  let routingInfo = `🔀 <b>Call Routing Configuration</b>\n\n`;
		  routingInfo += `<b>Current Mode:</b> ${currentRouting === 'sip_trunk' ? '📞 SIP Trunk' : '👥 Agent Queue'}\n`;
		  routingInfo += `<b>Destination:</b> ${escapeHtml(routingDest)}\n`;
		  
		  if (currentRouting === 'sip_trunk' && campaignRouting.routingTrunkId) {
			const routingTrunk = await SipPeer.findByPk(campaignRouting.routingTrunkId);
			if (routingTrunk) {
			  routingInfo += `<b>Routing Trunk:</b> ${escapeHtml(routingTrunk.name)}\n`;
			}
		  }
		  
		  bot.sendMessage(chatId, routingInfo, {
			parse_mode: "HTML",
			reply_markup: {
			  inline_keyboard: [
				[
				  { text: "📞 Route to SIP Trunk", callback_data: "routing_sip_trunk" },
				  { text: "👥 Route to Queue", callback_data: "routing_queue" }
				],
				[
				  { text: "📊 View Current Config", callback_data: "routing_view_config" }
				],
				[{ text: "🔙 Back", callback_data: "back_to_menu" }]
			  ]
			}
		  });
		  break;

		case "routing_sip_trunk":
		  if (!(await isAdmin(userId))) {
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  const routingTrunks = await getSipTrunks();
		  
		  if (routingTrunks.length === 0) {
			bot.sendMessage(chatId, `❌ No SIP Trunks Found. Please configure SIP trunks first.`);
			return;
		  }
		  
		  let trunkListRouting = "📞 <b>Select SIP Trunk for Call Routing:</b>\n\n";
		  routingTrunks.forEach((trunk, index) => {
			trunkListRouting += `${index + 1}. <b>${escapeHtml(trunk.name)}</b>\n`;
			trunkListRouting += `   📍 Host: ${escapeHtml(trunk.host)}\n`;
			trunkListRouting += `   🔌 Status: ${trunk.status ? '✅ Active' : '❌ Inactive'}\n\n`;
		  });
		  trunkListRouting += "Enter the number of the trunk:";
		  
		  const campaignForRouting = await getOrCreateCampaign();
		  bot.sendMessage(chatId, trunkListRouting, { parse_mode: "HTML" });
		  userStates[userId] = { 
			action: "waiting_routing_trunk_selection", 
			sipTrunks: routingTrunks,
			campaignId: campaignForRouting.id 
		  };
		  break;

		case "routing_queue":
		  if (!(await isAdmin(userId))) {
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  const queues = await getQueues();
		  
		  if (queues.length === 0) {
			bot.sendMessage(
			  chatId,
			  `❌ <b>No Queues Found</b>\n\nNo agent queues are configured. Create one first.`,
			  { 
				parse_mode: "HTML",
				reply_markup: {
				  inline_keyboard: [
					[{ text: "➕ Create New Queue", callback_data: "create_queue" }],
					[{ text: "🔙 Back", callback_data: "call_routing_menu" }]
				  ]
				}
			  }
			);
			return;
		  }
		  
		  let queueList = "👥 <b>Select Queue for Call Routing:</b>\n\n";
		  for (let i = 0; i < queues.length; i++) {
			const queue = queues[i];
			const members = await getQueueMembers(queue.name);
			queueList += `${i + 1}. <b>${escapeHtml(queue.name)}</b>\n`;
			queueList += `   👥 Members: ${members.length}\n`;
			queueList += `   📋 Strategy: ${escapeHtml(queue.strategy || 'wrandom')}\n\n`;
		  }
		  queueList += "Enter the number of the queue:";
		  
		  const campaignForQueue = await getOrCreateCampaign();
		  bot.sendMessage(chatId, queueList, { parse_mode: "HTML" });
		  userStates[userId] = { 
			action: "waiting_routing_queue_selection", 
			queues: queues,
			campaignId: campaignForQueue.id 
		  };
		  break;

		case "routing_view_config":
		  if (!(await isAdmin(userId))) {
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  const campaignConfig = await getOrCreateCampaign();
		  let configMsg = `📊 <b>Current Call Routing Configuration</b>\n\n`;
		  configMsg += `<b>Routing Type:</b> ${campaignConfig.routingType === 'sip_trunk' ? '📞 SIP Trunk' : '👥 Agent Queue'}\n`;
		  configMsg += `<b>Destination:</b> ${escapeHtml(campaignConfig.routingDestination || 'Not configured')}\n`;
		  
		  if (campaignConfig.routingType === 'sip_trunk') {
			if (campaignConfig.routingTrunkId) {
			  const rTrunk = await SipPeer.findByPk(campaignConfig.routingTrunkId);
			  configMsg += `<b>Routing Trunk:</b> ${rTrunk ? escapeHtml(rTrunk.name) : 'Not found'}\n`;
			  if (rTrunk) {
				configMsg += `<b>Trunk Host:</b> ${escapeHtml(rTrunk.host)}\n`;
			  }
			}
		  } else if (campaignConfig.routingType === 'queue') {
			if (campaignConfig.routingDestination) {
			  const members = await getQueueMembers(campaignConfig.routingDestination);
			  configMsg += `<b>Queue Members:</b> ${members.length}\n`;
			  if (members.length > 0) {
				configMsg += `<b>Agents:</b>\n`;
				members.forEach(m => {
				  configMsg += `  • ${escapeHtml(m.membername || m.interface)}\n`;
				});
			  }
			}
		  }
		  
		  configMsg += `\n<b>IVR Intro:</b> ${escapeHtml(campaignConfig.ivrIntroFile || 'Default')}\n`;
		  configMsg += `<b>IVR Outro:</b> ${escapeHtml(campaignConfig.ivrOutroFile || 'Default')}\n`;
		  
		  bot.sendMessage(chatId, configMsg, { 
			parse_mode: "HTML",
			reply_markup: {
			  inline_keyboard: [
				[{ text: "🔙 Back to Routing", callback_data: "call_routing_menu" }]
			  ]
			}
		  });
		  break;

		// ==========================================
		// AGENT MANAGEMENT MENU
		// ==========================================
		case "agent_management_menu":
		  if (!(await isAdmin(userId))) {
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  const allAgents = await getAllAgents();
		  const activeAgents = allAgents.filter(a => a.status);
		  const allQueues = await getQueues();
		  
		  let agentMenuMsg = `👥 <b>Agent Management</b>\n\n`;
		  agentMenuMsg += `📊 <b>Overview:</b>\n`;
		  agentMenuMsg += `• Total Agents: ${allAgents.length}\n`;
		  agentMenuMsg += `• Active: ${activeAgents.length}\n`;
		  agentMenuMsg += `• Inactive: ${allAgents.length - activeAgents.length}\n`;
		  agentMenuMsg += `• Queues: ${allQueues.length}\n`;
		  
		  bot.sendMessage(chatId, agentMenuMsg, {
			parse_mode: "HTML",
			reply_markup: {
			  inline_keyboard: [
				[
				  { text: "📋 View Agents", callback_data: "view_agents" },
				  { text: "➕ Create Agent", callback_data: "create_agent" }
				],
				[
				  { text: "📁 Manage Queues", callback_data: "manage_queues" },
				  { text: "➕ Create Queue", callback_data: "create_queue" }
				],
				[
				  { text: "🔗 Assign Agent to Queue", callback_data: "assign_agent_to_queue" },
				  { text: "🔓 Unassign Agent", callback_data: "unassign_agent_from_queue" }
				],
				[
				  { text: "📊 View All Assignments", callback_data: "view_all_assignments" }
				],
				[{ text: "🔙 Back", callback_data: "back_to_menu" }]
			  ]
			}
		  });
		  break;

		// ==========================================
		// VIEW AGENTS
		// ==========================================
		case "view_agents":
		  if (!(await isAdmin(userId))) {
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  const agentsList = await getAllAgents();
		  
		  if (agentsList.length === 0) {
			bot.sendMessage(
			  chatId,
			  `📋 <b>No Agents Found</b>\n\nNo agents are configured yet.`,
			  { 
				parse_mode: "HTML",
				reply_markup: {
				  inline_keyboard: [
					[{ text: "➕ Create Agent", callback_data: "create_agent" }],
					[{ text: "🔙 Back", callback_data: "agent_management_menu" }]
				  ]
				}
			  }
			);
			return;
		  }
		  
		  let agentListMsg = `📋 <b>All Agents (${agentsList.length})</b>\n\n`;
		  for (let i = 0; i < agentsList.length; i++) {
			const agent = agentsList[i];
			const agentQs = await getAgentQueues(agent.name);
			const statusIcon = agent.status ? '🟢' : '🔴';
			agentListMsg += `${i + 1}. ${statusIcon} <b>${escapeHtml(agent.name)}</b>\n`;
			if (agent.first_name || agent.last_name) {
			  agentListMsg += `   👤 ${escapeHtml(agent.first_name || '')} ${escapeHtml(agent.last_name || '')}\n`;
			}
			if (agent.extension_no) {
			  agentListMsg += `   📞 Ext: ${escapeHtml(agent.extension_no)}\n`;
			}
			agentListMsg += `   📁 Queues: ${agentQs.length > 0 ? agentQs.map(q => q.queue_name).join(', ') : 'None'}\n\n`;
		  }
		  
		  agentListMsg += `\nEnter agent number for details:`;
		  
		  bot.sendMessage(chatId, agentListMsg, { 
			parse_mode: "HTML",
			reply_markup: {
			  inline_keyboard: [
				[
				  { text: "➕ Create Agent", callback_data: "create_agent" },
				  { text: "🔄 Refresh", callback_data: "view_agents" }
				],
				[{ text: "🔙 Back", callback_data: "agent_management_menu" }]
			  ]
			}
		  });
		  userStates[userId] = { action: "waiting_agent_selection_for_details", agents: agentsList };
		  break;

		// ==========================================
		// CREATE AGENT
		// ==========================================
		case "create_agent":
		  if (!(await isAdmin(userId))) {
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  bot.sendMessage(
			chatId,
			`➕ <b>Create New Agent</b>\n\n` +
			`Enter agent details in this format:\n\n` +
			`<code>extension:firstname:lastname</code>\n\n` +
			`<b>Examples:</b>\n` +
			`• <code>1001:John:Doe</code>\n` +
			`• <code>1002:Jane:Smith</code>\n` +
			`• <code>agent01:Mike:Johnson</code>\n\n` +
			`The extension will be used as the SIP username.\n` +
			`A random secure password will be generated.`,
			{ parse_mode: "HTML" }
		  );
		  userStates[userId] = { action: "waiting_new_agent_details" };
		  break;

		// ==========================================
		// MANAGE QUEUES
		// ==========================================
		case "manage_queues":
		  if (!(await isAdmin(userId))) {
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  const queuesList = await getQueues();
		  
		  if (queuesList.length === 0) {
			bot.sendMessage(
			  chatId,
			  `📁 <b>No Queues Found</b>\n\nCreate a queue to organize agents.`,
			  { 
				parse_mode: "HTML",
				reply_markup: {
				  inline_keyboard: [
					[{ text: "➕ Create Queue", callback_data: "create_queue" }],
					[{ text: "🔙 Back", callback_data: "agent_management_menu" }]
				  ]
				}
			  }
			);
			return;
		  }
		  
		  let queueListMsg = `📁 <b>All Queues (${queuesList.length})</b>\n\n`;
		  for (let i = 0; i < queuesList.length; i++) {
			const queue = queuesList[i];
			const members = await getQueueMembers(queue.name);
			queueListMsg += `${i + 1}. <b>${escapeHtml(queue.name)}</b>\n`;
			queueListMsg += `   👥 Members: ${members.length}\n`;
			queueListMsg += `   📋 Strategy: ${escapeHtml(queue.strategy || 'ringall')}\n`;
			queueListMsg += `   ⏱ Timeout: ${queue.timeout || 25}s\n\n`;
		  }
		  
		  queueListMsg += `\nEnter queue number for details:`;
		  
		  bot.sendMessage(chatId, queueListMsg, { 
			parse_mode: "HTML",
			reply_markup: {
			  inline_keyboard: [
				[
				  { text: "➕ Create Queue", callback_data: "create_queue" },
				  { text: "🔄 Refresh", callback_data: "manage_queues" }
				],
				[{ text: "🔙 Back", callback_data: "agent_management_menu" }]
			  ]
			}
		  });
		  userStates[userId] = { action: "waiting_queue_selection_for_details", queues: queuesList };
		  break;

		// ==========================================
		// CREATE QUEUE
		// ==========================================
		case "create_queue":
		  if (!(await isAdmin(userId))) {
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  bot.sendMessage(
			chatId,
			`➕ <b>Create New Queue</b>\n\n` +
			`Enter queue details in this format:\n\n` +
			`<code>name:strategy</code>\n\n` +
			`<b>Available strategies:</b>\n` +
			`• <code>ringall</code> - Ring all agents simultaneously\n` +
			`• <code>roundrobin</code> - Distribute calls evenly\n` +
			`• <code>leastrecent</code> - Agent with longest idle time\n` +
			`• <code>fewestcalls</code> - Agent with fewest calls\n` +
			`• <code>random</code> - Random agent\n\n` +
			`<b>Examples:</b>\n` +
			`• <code>sales:ringall</code>\n` +
			`• <code>support:roundrobin</code>\n` +
			`• <code>vip:leastrecent</code>`,
			{ parse_mode: "HTML" }
		  );
		  userStates[userId] = { action: "waiting_new_queue_details" };
		  break;

		// ==========================================
		// ASSIGN AGENT TO QUEUE
		// ==========================================
		case "assign_agent_to_queue":
		  if (!(await isAdmin(userId))) {
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  const agentsForAssign = await getAvailableAgents();
		  
		  if (agentsForAssign.length === 0) {
			bot.sendMessage(chatId, `❌ No active agents available. Create agents first.`, {
			  reply_markup: {
				inline_keyboard: [
				  [{ text: "➕ Create Agent", callback_data: "create_agent" }],
				  [{ text: "🔙 Back", callback_data: "agent_management_menu" }]
				]
			  }
			});
			return;
		  }
		  
		  let assignAgentMsg = `🔗 <b>Assign Agent to Queue</b>\n\n`;
		  assignAgentMsg += `<b>Step 1:</b> Select an agent:\n\n`;
		  agentsForAssign.forEach((agent, i) => {
			assignAgentMsg += `${i + 1}. ${escapeHtml(agent.name)}`;
			if (agent.first_name) assignAgentMsg += ` (${escapeHtml(agent.first_name)} ${escapeHtml(agent.last_name || '')})`;
			assignAgentMsg += `\n`;
		  });
		  assignAgentMsg += `\nEnter agent number:`;
		  
		  bot.sendMessage(chatId, assignAgentMsg, { parse_mode: "HTML" });
		  userStates[userId] = { action: "waiting_agent_for_assignment", agents: agentsForAssign };
		  break;

		// ==========================================
		// UNASSIGN AGENT FROM QUEUE
		// ==========================================
		case "unassign_agent_from_queue":
		  if (!(await isAdmin(userId))) {
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  const queuesForUnassign = await getQueues();
		  
		  if (queuesForUnassign.length === 0) {
			bot.sendMessage(chatId, `❌ No queues found.`, {
			  reply_markup: {
				inline_keyboard: [
				  [{ text: "🔙 Back", callback_data: "agent_management_menu" }]
				]
			  }
			});
			return;
		  }
		  
		  let unassignMsg = `🔓 <b>Unassign Agent from Queue</b>\n\n`;
		  unassignMsg += `<b>Step 1:</b> Select a queue:\n\n`;
		  for (let i = 0; i < queuesForUnassign.length; i++) {
			const q = queuesForUnassign[i];
			const mems = await getQueueMembers(q.name);
			unassignMsg += `${i + 1}. ${escapeHtml(q.name)} (${mems.length} members)\n`;
		  }
		  unassignMsg += `\nEnter queue number:`;
		  
		  bot.sendMessage(chatId, unassignMsg, { parse_mode: "HTML" });
		  userStates[userId] = { action: "waiting_queue_for_unassignment", queues: queuesForUnassign };
		  break;

		// ==========================================
		// VIEW ALL ASSIGNMENTS
		// ==========================================
		case "view_all_assignments":
		  if (!(await isAdmin(userId))) {
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  const allQueuesAssign = await getQueues();
		  let assignMsg = `📊 <b>All Queue Assignments</b>\n\n`;
		  
		  if (allQueuesAssign.length === 0) {
			assignMsg += `<i>No queues configured.</i>`;
		  } else {
			for (const queue of allQueuesAssign) {
			  const members = await getQueueMembers(queue.name);
			  assignMsg += `<b>📁 ${escapeHtml(queue.name)}</b> (${escapeHtml(queue.strategy || 'ringall')})\n`;
			  if (members.length === 0) {
				assignMsg += `   <i>No agents assigned</i>\n`;
			  } else {
				members.forEach(m => {
				  const pauseIcon = m.paused ? '⏸' : '▶️';
				  assignMsg += `   ${pauseIcon} ${escapeHtml(m.membername || m.interface)}\n`;
				});
			  }
			  assignMsg += `\n`;
			}
		  }
		  
		  // Also show unassigned agents
		  const allAgentsCheck = await getAllAgents();
		  const unassignedAgents = [];
		  for (const agent of allAgentsCheck) {
			const agentQs = await getAgentQueues(agent.name);
			if (agentQs.length === 0) {
			  unassignedAgents.push(agent);
			}
		  }
		  
		  if (unassignedAgents.length > 0) {
			assignMsg += `\n<b>⚠️ Unassigned Agents:</b>\n`;
			unassignedAgents.forEach(a => {
			  const statusIcon = a.status ? '🟢' : '🔴';
			  assignMsg += `   ${statusIcon} ${escapeHtml(a.name)}\n`;
			});
		  }
		  
		  bot.sendMessage(chatId, assignMsg, { 
			parse_mode: "HTML",
			reply_markup: {
			  inline_keyboard: [
				[{ text: "🔗 Assign Agent", callback_data: "assign_agent_to_queue" }],
				[{ text: "🔄 Refresh", callback_data: "view_all_assignments" }],
				[{ text: "🔙 Back", callback_data: "agent_management_menu" }]
			  ]
			}
		  });
		  break;



		case "clear_database":
			// Check if user is admin
			let permittedUserClearDB = await Allowed.findOne({
				where: {
					telegramId: userId
				}
			});
			console.log(`Request from User ${userId} for clear_database`);

			if (userId == adminId) {
				permittedUserClearDB = true;
			}

			if (!permittedUserClearDB) {
				console.log("❌ Admin access required to clear_database!", userId);
				bot.sendMessage(chatId, "❌ Admin access required!");
				return;
			}

			// Get current call count
			const callCount = await Call.count();

			bot.sendMessage(
				chatId,
				`🗑️ *Clear Call Database*\n\n` +
				`⚠️ *WARNING: This action cannot be undone!*\n\n` +
				`This will permanently delete:\n` +
				`• All ${callCount} call records\n` +
				`• All phone numbers\n` +
				`• All call history\n` +
				`• All DTMF responses\n\n` +
				`Campaign statistics will NOT be affected.\n\n` +
				`Are you sure you want to continue?`, {
					parse_mode: "Markdown",
					reply_markup: {
						inline_keyboard: [
							[{
									text: "✅ Yes, Clear Database",
									callback_data: "confirm_clear_database"
								},
								{
									text: "❌ Cancel",
									callback_data: "back_to_menu"
								}
							]
						]
					}
				}
			);
			break;
			
		case "confirm_clear_database":
			// Double check admin access
			let permittedUserConfirmClear = await Allowed.findOne({
				where: {
					telegramId: userId
				}
			});

			if (userId == adminId) {
				permittedUserConfirmClear = true;
			}

			if (!permittedUserConfirmClear) {
				console.log("❌ Admin access required to confirm_clear_database!", userId);
				bot.sendMessage(chatId, "❌ Admin access required!");
				return;
			}

			try {
				// Get count before deletion
				const totalCalls = await Call.count();

				console.log(`[Clear DB] User ${userId} is clearing calls table (${totalCalls} records)`);

				// Truncate the calls table
				await Call.destroy({
					where: {},
					truncate: true,
					cascade: true
				});

				console.log(`[Clear DB] Successfully cleared ${totalCalls} call records`);

				bot.sendMessage(
					chatId,
					`✅ *Database Cleared Successfully!*\n\n` +
					`Deleted: ${totalCalls} call records\n\n` +
					`The calls table has been completely cleared.\n` +
					`You can now start fresh with new campaigns.`, {
						parse_mode: "Markdown",
						...mainMenu
					}
				);

			} catch (error) {
				console.error('[Clear DB] Error:', error);
				bot.sendMessage(
					chatId,
					`❌ *Error Clearing Database*\n\n` +
					`Error: ${escapeMarkdown(error.message)}\n\n` +
					`Please check the logs and try again.`, {
						parse_mode: "Markdown",
						...mainMenu
					}
				);
			}
			break;
			
		case "caller_id_menu":
			if (!(await isAdmin(userId))) {
			  bot.sendMessage(chatId, "❌ Admin access required!");
			  return;
			}
			
			const campaignCID = await getOrCreateCampaign();
			const cids = campaignCID.callerIds || [];
			const rotStatus = campaignCID.callerIdRotationEnabled ? '✅ ON' : '❌ OFF';
			
			let cidInfo = `📞 <b>Caller ID Settings</b>\n\n`;
			cidInfo += `<b>Rotation:</b> ${rotStatus}\n`;
			cidInfo += `<b>Calls per ID:</b> ${campaignCID.callsPerCallerId || 1}\n`;
			cidInfo += `<b>Total:</b> ${cids.length}\n\n`;
			
			if (cids.length > 0) {
			  cids.forEach((c, i) => {
				const marker = i === campaignCID.callerIdIndex ? '➡️' : '  ';
				cidInfo += `${marker} ${i + 1}. <code>${escapeHtml(c)}</code>\n`;
			  });
			} else {
			  cidInfo += `⚠️ No caller IDs configured.`;
			}
			
			bot.sendMessage(chatId, cidInfo, {
			  parse_mode: "HTML",
			  reply_markup: {
				inline_keyboard: [
				  [
					{ text: "➕ Add Caller IDs", callback_data: "add_caller_ids" },
					{ text: "🗑️ Remove", callback_data: "remove_caller_id" }
				  ],
				  [
					{ text: "🔄 Toggle Rotation", callback_data: "toggle_cid_rotation" },
					{ text: "⚙️ Calls Per ID", callback_data: "set_calls_per_id" }
				  ],
				  [
					{ text: "🧹 Clear All", callback_data: "clear_caller_ids" },
					{ text: "🔁 Reset Index", callback_data: "reset_cid_index" }
				  ],
				  [{ text: "🔙 Back", callback_data: "back_to_menu" }]
				]
			  }
			});
			break;

		  case "add_caller_ids":
			if (!(await isAdmin(userId))) {
			  bot.sendMessage(chatId, "❌ Admin access required!");
			  return;
			}
			const campAdd = await getOrCreateCampaign();
			bot.sendMessage(chatId,
			  `➕ <b>Add Caller IDs</b>\n\nEnter caller ID(s) - one per line or comma-separated:\n\n` +
			  `Example:\n<code>12025551234\n12025555678\n12025559012</code>`,
			  { parse_mode: "HTML" }
			);
			userStates[userId] = { action: "waiting_add_caller_ids", campaignId: campAdd.id };
			break;

		  case "toggle_cid_rotation":
			if (!(await isAdmin(userId))) {
			  bot.sendMessage(chatId, "❌ Admin access required!");
			  return;
			}
			const campToggle = await getOrCreateCampaign();
			const newState = !campToggle.callerIdRotationEnabled;
			await campToggle.update({ callerIdRotationEnabled: newState });
			bot.sendMessage(chatId, `🔄 Caller ID Rotation: <b>${newState ? 'ENABLED' : 'DISABLED'}</b>`, { parse_mode: "HTML" });
			break;

		  case "set_calls_per_id":
			if (!(await isAdmin(userId))) {
			  bot.sendMessage(chatId, "❌ Admin access required!");
			  return;
			}
			const campCalls = await getOrCreateCampaign();
			bot.sendMessage(chatId,
			  `⚙️ <b>Calls Per Caller ID</b>\n\nCurrent: ${campCalls.callsPerCallerId || 1}\n\nEnter number (1-1000):`,
			  { parse_mode: "HTML" }
			);
			userStates[userId] = { action: "waiting_calls_per_id", campaignId: campCalls.id };
			break;

		  case "remove_caller_id":
			if (!(await isAdmin(userId))) {
			  bot.sendMessage(chatId, "❌ Admin access required!");
			  return;
			}
			const campRem = await getOrCreateCampaign();
			const remIds = campRem.callerIds || [];
			if (remIds.length === 0) {
			  bot.sendMessage(chatId, "❌ No caller IDs to remove.");
			  return;
			}
			let remMsg = `🗑️ Enter number to remove:\n\n`;
			remIds.forEach((c, i) => { remMsg += `${i + 1}. <code>${escapeHtml(c)}</code>\n`; });
			bot.sendMessage(chatId, remMsg, { parse_mode: "HTML" });
			userStates[userId] = { action: "waiting_remove_caller_id", campaignId: campRem.id };
			break;

		  case "clear_caller_ids":
			if (!(await isAdmin(userId))) {
			  bot.sendMessage(chatId, "❌ Admin access required!");
			  return;
			}
			const campClear = await getOrCreateCampaign();
			await campClear.update({ callerIds: [], callerIdIndex: 0 });
			bot.sendMessage(chatId, "✅ All caller IDs cleared.");
			break;

		  case "reset_cid_index":
			if (!(await isAdmin(userId))) {
			  bot.sendMessage(chatId, "❌ Admin access required!");
			  return;
			}
			const campReset = await getOrCreateCampaign();
			await campReset.update({ callerIdIndex: 0 });
			bot.sendMessage(chatId, "✅ Rotation index reset to 0.");
			break;
		case "set_line_output":
		  if (!(await isAdmin(userId))) {
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  bot.sendMessage(
			chatId,
			`📍 <b>Set Line Output Group</b>\n\n` +
			`Current chat ID: <code>${chatId}</code>\n\n` +
			`Options:\n` +
			`1️⃣ Use this chat as line output (reply "this")\n` +
			`2️⃣ Enter a different group chat ID\n\n` +
			`The /line command results will be sent to the configured group.`,
			{ parse_mode: "HTML" }
		  );
		  userStates[userId] = { action: "waiting_line_output_chat" };
		  break;

		case "set_private_notepad":
		  if (!(await isAdmin(userId))) {
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  if (!isPrivateChat(query.message)) {
			const botInfo = await bot.getMe();
			bot.sendMessage(
			  chatId,
			  `📝 <b>Private Notepad Setup</b>\n\n` +
			  `⚠️ Please message me in DM (private chat) to set up your private notepad.\n\n` +
			  `Click here: @${botInfo.username}`,
			  { parse_mode: "HTML" }
			);
			return;
		  }
		  
		  // In DM - set this as private notepad chat
		  const campaignForNotepad = await getOrCreateCampaign();
		  await campaignForNotepad.update({ adminPrivateChatId: String(chatId) });
		  
		  bot.sendMessage(
			chatId,
			`✅ <b>Private Notepad Configured!</b>\n\n` +
			`This DM is now your private notepad.\n\n` +
			`📌 Lines you input here stay private.\n` +
			`📌 Use /setgroup to choose output group.\n` +
			`📌 Group users can only use /line to get lines one at a time.`,
			{ parse_mode: "HTML" }
		  );
		  break;

		  
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
		  if (!(await isAdmin(userId))) {
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  bot.sendMessage(
			chatId,
			`👤 <b>Permit User</b>\n\n` +
			`Enter the Telegram ID and permission level:\n\n` +
			`Format: <code>ID</code> or <code>ID admin</code>\n\n` +
			`Examples:\n` +
			`• <code>123456789</code> - User level (only /line)\n` +
			`• <code>123456789 admin</code> - Full access\n\n` +
			`Default is user level (can only use /line)`,
			{ parse_mode: "HTML" }
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
		
	  default:
		  // Toggle agent active/inactive status
		  if (callbackData.startsWith('toggle_agent_')) {
			if (!(await isAdmin(userId))) {
			  bot.sendMessage(chatId, "❌ Admin access required!");
			  return;
			}
			const agentId = parseInt(callbackData.replace('toggle_agent_', ''));
			const agent = await SipPeer.findByPk(agentId);
			if (agent) {
			  await agent.update({ status: !agent.status });
			  bot.sendMessage(
				chatId, 
				`✅ Agent ${escapeHtml(agent.name)} is now <b>${agent.status ? 'Active' : 'Inactive'}</b>`,
				{ parse_mode: "HTML" }
			  );
			}
		  }
		  
		  // Delete agent confirmation
		  else if (callbackData.startsWith('delete_agent_')) {
			if (!(await isAdmin(userId))) {
			  bot.sendMessage(chatId, "❌ Admin access required!");
			  return;
			}
			const agentId = parseInt(callbackData.replace('delete_agent_', ''));
			const agent = await SipPeer.findByPk(agentId);
			if (!agent) {
			  bot.sendMessage(chatId, "❌ Agent not found.");
			  return;
			}
			userStates[userId] = { action: "confirm_delete_agent", agentId: agentId };
			bot.sendMessage(
			  chatId,
			  `⚠️ <b>Confirm Delete</b>\n\n` +
			  `Are you sure you want to delete agent <b>${escapeHtml(agent.name)}</b>?\n\n` +
			  `This will also remove them from all queues.\n\n` +
			  `Type <code>DELETE</code> to confirm:`,
			  { parse_mode: "HTML" }
			);
		  }
		  
		  // Delete queue confirmation
		  else if (callbackData.startsWith('delete_queue_')) {
			if (!(await isAdmin(userId))) {
			  bot.sendMessage(chatId, "❌ Admin access required!");
			  return;
			}
			const queueId = parseInt(callbackData.replace('delete_queue_', ''));
			const queue = await Queue.findByPk(queueId);
			if (!queue) {
			  bot.sendMessage(chatId, "❌ Queue not found.");
			  return;
			}
			userStates[userId] = { action: "confirm_delete_queue", queueId: queueId };
			bot.sendMessage(
			  chatId,
			  `⚠️ <b>Confirm Delete</b>\n\n` +
			  `Are you sure you want to delete queue <b>${escapeHtml(queue.name)}</b>?\n\n` +
			  `All agent assignments to this queue will be removed.\n\n` +
			  `Type <code>DELETE</code> to confirm:`,
			  { parse_mode: "HTML" }
			);
		  }
		  
		  // Add agent to specific queue (from queue details)
		  else if (callbackData.startsWith('queue_add_agent_')) {
			if (!(await isAdmin(userId))) {
			  bot.sendMessage(chatId, "❌ Admin access required!");
			  return;
			}
			const queueName = callbackData.replace('queue_add_agent_', '');
			const agents = await getAvailableAgents();
			const currentMembers = await getQueueMembers(queueName);
			const availableAgents = agents.filter(a => !currentMembers.find(m => m.interface === `SIP/${a.name}`));
			
			if (availableAgents.length === 0) {
			  bot.sendMessage(chatId, "❌ All active agents are already in this queue.");
			  return;
			}
			
			let addMsg = `➕ <b>Add Agent to ${escapeHtml(queueName)}</b>\n\n`;
			availableAgents.forEach((a, i) => {
			  addMsg += `${i + 1}. ${escapeHtml(a.name)}`;
			  if (a.first_name) addMsg += ` (${escapeHtml(a.first_name)})`;
			  addMsg += `\n`;
			});
			addMsg += `\nEnter agent number:`;
			
			bot.sendMessage(chatId, addMsg, { parse_mode: "HTML" });
			userStates[userId] = { 
			  action: "waiting_agent_to_add_to_queue", 
			  queueName: queueName,
			  agents: availableAgents 
			};
		  }
		  
		  // Remove agent from specific queue (from queue details)
		  else if (callbackData.startsWith('queue_remove_agent_')) {
			if (!(await isAdmin(userId))) {
			  bot.sendMessage(chatId, "❌ Admin access required!");
			  return;
			}
			const queueName = callbackData.replace('queue_remove_agent_', '');
			const members = await getQueueMembers(queueName);
			
			if (members.length === 0) {
			  bot.sendMessage(chatId, "❌ No agents in this queue.");
			  return;
			}
			
			let removeMsg = `➖ <b>Remove Agent from ${escapeHtml(queueName)}</b>\n\n`;
			members.forEach((m, i) => {
			  removeMsg += `${i + 1}. ${escapeHtml(m.membername || m.interface)}\n`;
			});
			removeMsg += `\nEnter agent number:`;
			
			bot.sendMessage(chatId, removeMsg, { parse_mode: "HTML" });
			userStates[userId] = { 
			  action: "waiting_member_for_unassignment", 
			  queueName: queueName,
			  members: members 
			};
		  }
		  
		  // Remove agent from queues (from agent details)
		  else if (callbackData.startsWith('agent_remove_queues_')) {
			if (!(await isAdmin(userId))) {
			  bot.sendMessage(chatId, "❌ Admin access required!");
			  return;
			}
			const agentId = parseInt(callbackData.replace('agent_remove_queues_', ''));
			const agent = await SipPeer.findByPk(agentId);
			if (!agent) {
			  bot.sendMessage(chatId, "❌ Agent not found.");
			  return;
			}
			
			const agentQueues = await getAgentQueues(agent.name);
			
			if (agentQueues.length === 0) {
			  bot.sendMessage(chatId, `❌ ${escapeHtml(agent.name)} is not assigned to any queue.`, { parse_mode: "HTML" });
			  return;
			}
			
			let removeQMsg = `🔓 <b>Remove ${escapeHtml(agent.name)} from Queue</b>\n\n`;
			removeQMsg += `Select a queue:\n\n`;
			agentQueues.forEach((q, i) => {
			  removeQMsg += `${i + 1}. ${escapeHtml(q.queue_name)}\n`;
			});
			removeQMsg += `\nEnter queue number:`;
			
			bot.sendMessage(chatId, removeQMsg, { parse_mode: "HTML" });
			userStates[userId] = { 
			  action: "waiting_queue_removal_for_agent", 
			  agent: agent,
			  queues: agentQueues 
			};
		  }
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
		case "waiting_routing_trunk_selection":
		  const trunkIdxRouting = parseInt(text) - 1;
		  if (isNaN(trunkIdxRouting) || trunkIdxRouting < 0 || trunkIdxRouting >= userState.sipTrunks.length) {
			bot.sendMessage(chatId, "❌ Invalid selection. Please try again.");
			return;
		  }
		  
		  const selectedRoutingTrunk = userState.sipTrunks[trunkIdxRouting];
		  
		  bot.sendMessage(
			chatId,
			`📞 <b>Selected Trunk: ${escapeHtml(selectedRoutingTrunk.name)}</b>\n\n` +
			`Now enter the destination number for call routing:\n\n` +
			`This is the number that will be dialed when a caller presses the DTMF digit.\n\n` +
			`Example: 18001234567`,
			{ parse_mode: "HTML" }
		  );
		  userStates[userId] = { 
			action: "waiting_routing_destination", 
			routingType: 'sip_trunk',
			trunkId: selectedRoutingTrunk.id,
			trunkName: selectedRoutingTrunk.name,
			campaignId: userState.campaignId 
		  };
		  break;

		case "waiting_routing_destination":
		  const routingDestInput = text.trim();
		  if (!routingDestInput) {
			bot.sendMessage(chatId, "❌ Please enter a valid destination number.");
			return;
		  }
		  
		  const campaignRoutingUpdate = await Campaign.findByPk(userState.campaignId);
		  await campaignRoutingUpdate.update({
			routingType: userState.routingType,
			routingDestination: routingDestInput,
			routingTrunkId: userState.trunkId || null
		  });
		  
		  let routingSuccessMsg = `✅ <b>Call Routing Configured!</b>\n\n`;
		  routingSuccessMsg += `<b>Type:</b> ${userState.routingType === 'sip_trunk' ? '📞 SIP Trunk' : '👥 Agent Queue'}\n`;
		  routingSuccessMsg += `<b>Destination:</b> ${escapeHtml(routingDestInput)}\n`;
		  if (userState.trunkName) {
			routingSuccessMsg += `<b>Trunk:</b> ${escapeHtml(userState.trunkName)}\n`;
		  }
		  
		  bot.sendMessage(chatId, routingSuccessMsg, { parse_mode: "HTML", ...mainMenu });
		  delete userStates[userId];
		  break;

		case "waiting_routing_queue_selection":
		  const queueIdxRouting = parseInt(text) - 1;
		  if (isNaN(queueIdxRouting) || queueIdxRouting < 0 || queueIdxRouting >= userState.queues.length) {
			bot.sendMessage(chatId, "❌ Invalid selection. Please try again.");
			return;
		  }
		  
		  const selectedQueueRouting = userState.queues[queueIdxRouting];
		  const campaignQueueUpdate = await Campaign.findByPk(userState.campaignId);
		  await campaignQueueUpdate.update({
			routingType: 'queue',
			routingDestination: selectedQueueRouting.name,
			routingTrunkId: null
		  });
		  
		  const queueMembersRouting = await getQueueMembers(selectedQueueRouting.name);
		  
		  let queueRoutingMsg = `✅ <b>Call Routing Configured!</b>\n\n`;
		  queueRoutingMsg += `<b>Type:</b> 👥 Agent Queue\n`;
		  queueRoutingMsg += `<b>Queue:</b> ${escapeHtml(selectedQueueRouting.name)}\n`;
		  queueRoutingMsg += `<b>Members:</b> ${queueMembersRouting.length}\n`;
		  
		  if (queueMembersRouting.length > 0) {
			queueRoutingMsg += `\n<b>Agents in queue:</b>\n`;
			queueMembersRouting.forEach(m => {
			  queueRoutingMsg += `  • ${escapeHtml(m.membername || m.interface)}\n`;
			});
		  } else {
			queueRoutingMsg += `\n⚠️ No agents in this queue. Add agents to receive calls.`;
		  }
		  
		  bot.sendMessage(chatId, queueRoutingMsg, { parse_mode: "HTML", ...mainMenu });
		  delete userStates[userId];
		  break;

		// ==========================================
		// AGENT MANAGEMENT TEXT HANDLERS
		// ==========================================
		
		// Create new agent
		case "waiting_new_agent_details":
		  const agentParts = text.trim().split(':');
		  if (agentParts.length < 1) {
			bot.sendMessage(chatId, "❌ Invalid format. Use: extension:firstname:lastname");
			return;
		  }
		  
		  const extension = agentParts[0].trim();
		  const firstName = agentParts[1] ? agentParts[1].trim() : '';
		  const lastName = agentParts[2] ? agentParts[2].trim() : '';
		  
		  if (!extension || !/^[a-zA-Z0-9_-]+$/.test(extension)) {
			bot.sendMessage(chatId, "❌ Invalid extension. Use only letters, numbers, underscore, or hyphen.");
			return;
		  }
		  
		  // Check if agent already exists
		  const existingAgent = await SipPeer.findOne({ where: { name: extension } });
		  if (existingAgent) {
			bot.sendMessage(chatId, `❌ Agent with extension "${extension}" already exists.`);
			return;
		  }
		  
		  // Generate SIP password
		  const sipPassword = generateSipPassword();
		  
		  // Create the agent
		  const newAgent = await SipPeer.create({
			name: extension,
			username: extension,
			defaultuser: extension,
			secret: sipPassword,
			sippasswd: sipPassword,
			first_name: firstName,
			last_name: lastName,
			extension_no: extension,
			context: 'from-internal',
			host: 'dynamic',
			type: 'friend',
			category: 'sip',
			nat: 'force_rport,comedia',
			qualify: 'yes',
			disallow: 'all',
			allow: 'alaw;ulaw;gsm',
			directmedia: 'no',
			canreinvite: 'no',
			status: 1
		  });
		  
		  let newAgentMsg = `✅ <b>Agent Created Successfully!</b>\n\n`;
		  newAgentMsg += `<b>Extension:</b> <code>${escapeHtml(extension)}</code>\n`;
		  newAgentMsg += `<b>Name:</b> ${escapeHtml(firstName)} ${escapeHtml(lastName)}\n`;
		  newAgentMsg += `<b>SIP Password:</b> <code>${escapeHtml(sipPassword)}</code>\n\n`;
		  newAgentMsg += `⚠️ <b>Save the password now!</b> It won't be shown again.\n\n`;
		  newAgentMsg += `<b>SIP Registration:</b>\n`;
		  newAgentMsg += `• Username: <code>${escapeHtml(extension)}</code>\n`;
		  newAgentMsg += `• Password: <code>${escapeHtml(sipPassword)}</code>\n`;
		  newAgentMsg += `• Domain: Your Asterisk server IP`;
		  
		  bot.sendMessage(chatId, newAgentMsg, { 
			parse_mode: "HTML",
			reply_markup: {
			  inline_keyboard: [
				[{ text: "🔗 Assign to Queue", callback_data: "assign_agent_to_queue" }],
				[{ text: "🔙 Back to Agents", callback_data: "view_agents" }]
			  ]
			}
		  });
		  delete userStates[userId];
		  break;

		// Create new queue
		case "waiting_new_queue_details":
		  const queueParts = text.trim().split(':');
		  const queueName = queueParts[0].trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
		  const strategy = queueParts[1] ? queueParts[1].trim().toLowerCase() : 'ringall';
		  
		  if (!queueName || queueName.length < 2) {
			bot.sendMessage(chatId, "❌ Queue name must be at least 2 characters.");
			return;
		  }
		  
		  const validStrategies = ['ringall', 'roundrobin', 'leastrecent', 'fewestcalls', 'random', 'rrmemory', 'linear', 'wrandom'];
		  if (!validStrategies.includes(strategy)) {
			bot.sendMessage(chatId, `❌ Invalid strategy. Use: ${validStrategies.join(', ')}`);
			return;
		  }
		  
		  const existingQueueCheck = await Queue.findOne({ where: { name: queueName } });
		  if (existingQueueCheck) {
			bot.sendMessage(chatId, `❌ Queue "${queueName}" already exists.`);
			return;
		  }
		  
		  await Queue.create({
			name: queueName,
			strategy: strategy,
			timeout: 25,
			retry: 5,
			maxlen: 0,
			joinempty: 'yes',
			leavewhenempty: 'no'
		  });
		  
		  bot.sendMessage(
			chatId,
			`✅ <b>Queue Created!</b>\n\n` +
			`<b>Name:</b> ${escapeHtml(queueName)}\n` +
			`<b>Strategy:</b> ${escapeHtml(strategy)}\n` +
			`<b>Timeout:</b> 25s\n\n` +
			`Now add agents to this queue.`,
			{ 
			  parse_mode: "HTML",
			  reply_markup: {
				inline_keyboard: [
				  [{ text: "🔗 Add Agents", callback_data: "assign_agent_to_queue" }],
				  [{ text: "🔙 Back to Queues", callback_data: "manage_queues" }]
				]
			  }
			}
		  );
		  delete userStates[userId];
		  break;

		// Agent selection for details
		case "waiting_agent_selection_for_details":
		  const agentDetailIdx = parseInt(text) - 1;
		  if (isNaN(agentDetailIdx) || agentDetailIdx < 0 || agentDetailIdx >= userState.agents.length) {
			bot.sendMessage(chatId, "❌ Invalid selection.");
			delete userStates[userId];
			return;
		  }
		  
		  const selectedAgentDetail = userState.agents[agentDetailIdx];
		  const agentQueuesDetail = await getAgentQueues(selectedAgentDetail.name);
		  
		  let agentDetailMsg = `👤 <b>Agent Details</b>\n\n`;
		  agentDetailMsg += `<b>Name/Extension:</b> ${escapeHtml(selectedAgentDetail.name)}\n`;
		  agentDetailMsg += `<b>First Name:</b> ${escapeHtml(selectedAgentDetail.first_name || 'N/A')}\n`;
		  agentDetailMsg += `<b>Last Name:</b> ${escapeHtml(selectedAgentDetail.last_name || 'N/A')}\n`;
		  agentDetailMsg += `<b>Extension:</b> ${escapeHtml(selectedAgentDetail.extension_no || selectedAgentDetail.name)}\n`;
		  agentDetailMsg += `<b>Status:</b> ${selectedAgentDetail.status ? '🟢 Active' : '🔴 Inactive'}\n`;
		  agentDetailMsg += `<b>Context:</b> ${escapeHtml(selectedAgentDetail.context || 'default')}\n\n`;
		  
		  agentDetailMsg += `<b>Queue Memberships:</b>\n`;
		  if (agentQueuesDetail.length > 0) {
			agentQueuesDetail.forEach(q => {
			  const pauseStatus = q.paused ? '⏸ Paused' : '▶️ Active';
			  agentDetailMsg += `  • ${escapeHtml(q.queue_name)} - ${pauseStatus}\n`;
			});
		  } else {
			agentDetailMsg += `  <i>Not assigned to any queue</i>\n`;
		  }
		  
		  bot.sendMessage(chatId, agentDetailMsg, {
			parse_mode: "HTML",
			reply_markup: {
			  inline_keyboard: [
				[
				  { text: selectedAgentDetail.status ? "🔴 Deactivate" : "🟢 Activate", callback_data: `toggle_agent_${selectedAgentDetail.id}` },
				  { text: "🗑 Delete", callback_data: `delete_agent_${selectedAgentDetail.id}` }
				],
				[
				  { text: "🔗 Assign to Queue", callback_data: "assign_agent_to_queue" },
				  { text: "🔓 Remove from Queue", callback_data: `agent_remove_queues_${selectedAgentDetail.id}` }
				],
				[{ text: "🔙 Back to Agents", callback_data: "view_agents" }]
			  ]
			}
		  });
		  delete userStates[userId];
		  break;

		// Queue selection for details
		case "waiting_queue_selection_for_details":
		  const queueDetailIdx = parseInt(text) - 1;
		  if (isNaN(queueDetailIdx) || queueDetailIdx < 0 || queueDetailIdx >= userState.queues.length) {
			bot.sendMessage(chatId, "❌ Invalid selection.");
			delete userStates[userId];
			return;
		  }
		  
		  const selectedQueueDetail = userState.queues[queueDetailIdx];
		  const queueMembersDetail = await getQueueMembers(selectedQueueDetail.name);
		  
		  let queueDetailMsg = `📁 <b>Queue Details</b>\n\n`;
		  queueDetailMsg += `<b>Name:</b> ${escapeHtml(selectedQueueDetail.name)}\n`;
		  queueDetailMsg += `<b>Strategy:</b> ${escapeHtml(selectedQueueDetail.strategy || 'ringall')}\n`;
		  queueDetailMsg += `<b>Timeout:</b> ${selectedQueueDetail.timeout || 25}s\n`;
		  queueDetailMsg += `<b>Retry:</b> ${selectedQueueDetail.retry || 5}s\n`;
		  queueDetailMsg += `<b>Max Length:</b> ${selectedQueueDetail.maxlen || 0} (0=unlimited)\n\n`;
		  
		  queueDetailMsg += `<b>Members (${queueMembersDetail.length}):</b>\n`;
		  if (queueMembersDetail.length > 0) {
			queueMembersDetail.forEach((m, i) => {
			  const pauseStatus = m.paused ? '⏸' : '▶️';
			  queueDetailMsg += `${i + 1}. ${pauseStatus} ${escapeHtml(m.membername || m.interface)}\n`;
			});
		  } else {
			queueDetailMsg += `<i>No members assigned</i>\n`;
		  }
		  
		  bot.sendMessage(chatId, queueDetailMsg, {
			parse_mode: "HTML",
			reply_markup: {
			  inline_keyboard: [
				[
				  { text: "➕ Add Agent", callback_data: `queue_add_agent_${selectedQueueDetail.name}` },
				  { text: "➖ Remove Agent", callback_data: `queue_remove_agent_${selectedQueueDetail.name}` }
				],
				[
				  { text: "🗑 Delete Queue", callback_data: `delete_queue_${selectedQueueDetail.id}` }
				],
				[{ text: "🔙 Back to Queues", callback_data: "manage_queues" }]
			  ]
			}
		  });
		  delete userStates[userId];
		  break;

		// Agent selection for assignment (Step 1)
		case "waiting_agent_for_assignment":
		  const assignAgentIdx = parseInt(text) - 1;
		  if (isNaN(assignAgentIdx) || assignAgentIdx < 0 || assignAgentIdx >= userState.agents.length) {
			bot.sendMessage(chatId, "❌ Invalid selection.");
			delete userStates[userId];
			return;
		  }
		  
		  const agentForAssign = userState.agents[assignAgentIdx];
		  const queuesForAgent = await getQueues();
		  
		  if (queuesForAgent.length === 0) {
			bot.sendMessage(chatId, "❌ No queues available. Create a queue first.", {
			  reply_markup: {
				inline_keyboard: [
				  [{ text: "➕ Create Queue", callback_data: "create_queue" }],
				  [{ text: "🔙 Back", callback_data: "agent_management_menu" }]
				]
			  }
			});
			delete userStates[userId];
			return;
		  }
		  
		  // Get queues agent is already in
		  const agentCurrentQueues = await getAgentQueues(agentForAssign.name);
		  const agentQueueNames = agentCurrentQueues.map(q => q.queue_name);
		  
		  // Filter out queues agent is already in
		  const availableQueuesForAssign = queuesForAgent.filter(q => !agentQueueNames.includes(q.name));
		  
		  if (availableQueuesForAssign.length === 0) {
			bot.sendMessage(chatId, `❌ ${escapeHtml(agentForAssign.name)} is already assigned to all available queues.`, { parse_mode: "HTML" });
			delete userStates[userId];
			return;
		  }
		  
		  let selectQueueMsg = `🔗 <b>Assign ${escapeHtml(agentForAssign.name)} to Queue</b>\n\n`;
		  selectQueueMsg += `<b>Step 2:</b> Select a queue:\n\n`;
		  availableQueuesForAssign.forEach((q, i) => {
			selectQueueMsg += `${i + 1}. ${escapeHtml(q.name)} (${q.strategy || 'ringall'})\n`;
		  });
		  selectQueueMsg += `\nEnter queue number:`;
		  
		  bot.sendMessage(chatId, selectQueueMsg, { parse_mode: "HTML" });
		  userStates[userId] = { 
			action: "waiting_queue_for_agent_assignment", 
			agent: agentForAssign,
			queues: availableQueuesForAssign 
		  };
		  break;

		// Queue selection for assignment (Step 2)
		case "waiting_queue_for_agent_assignment":
		  const assignQueueIdx = parseInt(text) - 1;
		  if (isNaN(assignQueueIdx) || assignQueueIdx < 0 || assignQueueIdx >= userState.queues.length) {
			bot.sendMessage(chatId, "❌ Invalid selection.");
			delete userStates[userId];
			return;
		  }
		  
		  const queueForAssign = userState.queues[assignQueueIdx];
		  const agentToAssign = userState.agent;
		  
		  // Create queue membership
		  await QueueMember.create({
			membername: agentToAssign.name,
			queue_name: queueForAssign.name,
			interface: `SIP/${agentToAssign.name}`,
			penalty: 0,
			paused: 0
		  });
		  
		  bot.sendMessage(
			chatId,
			`✅ <b>Agent Assigned Successfully!</b>\n\n` +
			`<b>Agent:</b> ${escapeHtml(agentToAssign.name)}\n` +
			`<b>Queue:</b> ${escapeHtml(queueForAssign.name)}\n\n` +
			`The agent will now receive calls from this queue.`,
			{ 
			  parse_mode: "HTML",
			  reply_markup: {
				inline_keyboard: [
				  [{ text: "🔗 Assign Another", callback_data: "assign_agent_to_queue" }],
				  [{ text: "📊 View Assignments", callback_data: "view_all_assignments" }],
				  [{ text: "🔙 Back", callback_data: "agent_management_menu" }]
				]
			  }
			}
		  );
		  delete userStates[userId];
		  break;

		// Queue selection for unassignment (Step 1)
		case "waiting_queue_for_unassignment":
		  const unassignQueueIdx = parseInt(text) - 1;
		  if (isNaN(unassignQueueIdx) || unassignQueueIdx < 0 || unassignQueueIdx >= userState.queues.length) {
			bot.sendMessage(chatId, "❌ Invalid selection.");
			delete userStates[userId];
			return;
		  }
		  
		  const queueForUnassign = userState.queues[unassignQueueIdx];
		  const membersInQueue = await getQueueMembers(queueForUnassign.name);
		  
		  if (membersInQueue.length === 0) {
			bot.sendMessage(chatId, `❌ No agents assigned to queue "${escapeHtml(queueForUnassign.name)}".`, { parse_mode: "HTML" });
			delete userStates[userId];
			return;
		  }
		  
		  let selectMemberMsg = `🔓 <b>Unassign Agent from ${escapeHtml(queueForUnassign.name)}</b>\n\n`;
		  selectMemberMsg += `<b>Step 2:</b> Select an agent to remove:\n\n`;
		  membersInQueue.forEach((m, i) => {
			selectMemberMsg += `${i + 1}. ${escapeHtml(m.membername || m.interface)}\n`;
		  });
		  selectMemberMsg += `\nEnter agent number:`;
		  
		  bot.sendMessage(chatId, selectMemberMsg, { parse_mode: "HTML" });
		  userStates[userId] = { 
			action: "waiting_member_for_unassignment", 
			queueName: queueForUnassign.name,
			members: membersInQueue 
		  };
		  break;

		// Member selection for unassignment (Step 2)
		case "waiting_member_for_unassignment":
		  const unassignMemberIdx = parseInt(text) - 1;
		  if (isNaN(unassignMemberIdx) || unassignMemberIdx < 0 || unassignMemberIdx >= userState.members.length) {
			bot.sendMessage(chatId, "❌ Invalid selection.");
			delete userStates[userId];
			return;
		  }
		  
		  const memberToUnassign = userState.members[unassignMemberIdx];
		  
		  await QueueMember.destroy({
			where: {
			  queue_name: userState.queueName,
			  interface: memberToUnassign.interface
			}
		  });
		  
		  bot.sendMessage(
			chatId,
			`✅ <b>Agent Unassigned Successfully!</b>\n\n` +
			`<b>Agent:</b> ${escapeHtml(memberToUnassign.membername || memberToUnassign.interface)}\n` +
			`<b>Queue:</b> ${escapeHtml(userState.queueName)}\n\n` +
			`The agent will no longer receive calls from this queue.`,
			{ 
			  parse_mode: "HTML",
			  reply_markup: {
				inline_keyboard: [
				  [{ text: "🔓 Unassign Another", callback_data: "unassign_agent_from_queue" }],
				  [{ text: "📊 View Assignments", callback_data: "view_all_assignments" }],
				  [{ text: "🔙 Back", callback_data: "agent_management_menu" }]
				]
			  }
			}
		  );
		  delete userStates[userId];
		  break;

		// Confirm agent deletion
		case "confirm_delete_agent":
		  if (text.trim().toUpperCase() !== 'DELETE') {
			bot.sendMessage(chatId, "❌ Deletion cancelled.", mainMenu);
			delete userStates[userId];
			return;
		  }
		  
		  const agentToDelete = await SipPeer.findByPk(userState.agentId);
		  if (agentToDelete) {
			// Remove from all queues first
			await QueueMember.destroy({
			  where: {
				[Op.or]: [
				  { membername: agentToDelete.name },
				  { interface: `SIP/${agentToDelete.name}` }
				]
			  }
			});
			// Delete agent
			await agentToDelete.destroy();
			bot.sendMessage(chatId, `✅ Agent ${escapeHtml(agentToDelete.name)} has been deleted.`, { parse_mode: "HTML", ...mainMenu });
		  } else {
			bot.sendMessage(chatId, "❌ Agent not found.", mainMenu);
		  }
		  delete userStates[userId];
		  break;

		// Confirm queue deletion
		case "confirm_delete_queue":
		  if (text.trim().toUpperCase() !== 'DELETE') {
			bot.sendMessage(chatId, "❌ Deletion cancelled.", mainMenu);
			delete userStates[userId];
			return;
		  }
		  
		  const queueToDelete = await Queue.findByPk(userState.queueId);
		  if (queueToDelete) {
			// Remove all members first
			await QueueMember.destroy({ where: { queue_name: queueToDelete.name } });
			// Delete queue
			await queueToDelete.destroy();
			bot.sendMessage(chatId, `✅ Queue ${escapeHtml(queueToDelete.name)} has been deleted.`, { parse_mode: "HTML", ...mainMenu });
		  } else {
			bot.sendMessage(chatId, "❌ Queue not found.", mainMenu);
		  }
		  delete userStates[userId];
		  break;

		// Agent to add to specific queue
		case "waiting_agent_to_add_to_queue":
		  const addToQAgentIdx = parseInt(text) - 1;
		  if (isNaN(addToQAgentIdx) || addToQAgentIdx < 0 || addToQAgentIdx >= userState.agents.length) {
			bot.sendMessage(chatId, "❌ Invalid selection.");
			delete userStates[userId];
			return;
		  }
		  
		  const agentToAddToQ = userState.agents[addToQAgentIdx];
		  
		  await QueueMember.create({
			membername: agentToAddToQ.name,
			queue_name: userState.queueName,
			interface: `SIP/${agentToAddToQ.name}`,
			penalty: 0,
			paused: 0
		  });
		  
		  bot.sendMessage(
			chatId,
			`✅ Added ${escapeHtml(agentToAddToQ.name)} to queue ${escapeHtml(userState.queueName)}`,
			{ parse_mode: "HTML", ...mainMenu }
		  );
		  delete userStates[userId];
		  break;

		// Queue selection for removing agent from specific agent's queues
		case "waiting_queue_removal_for_agent":
		  const removeQIdx = parseInt(text) - 1;
		  if (isNaN(removeQIdx) || removeQIdx < 0 || removeQIdx >= userState.queues.length) {
			bot.sendMessage(chatId, "❌ Invalid selection.");
			delete userStates[userId];
			return;
		  }
		  
		  const queueToRemoveFrom = userState.queues[removeQIdx];
		  
		  await QueueMember.destroy({
			where: {
			  queue_name: queueToRemoveFrom.queue_name,
			  [Op.or]: [
				{ membername: userState.agent.name },
				{ interface: `SIP/${userState.agent.name}` }
			  ]
			}
		  });
		  
		  bot.sendMessage(
			chatId,
			`✅ Removed ${escapeHtml(userState.agent.name)} from ${escapeHtml(queueToRemoveFrom.queue_name)}`,
			{ parse_mode: "HTML", ...mainMenu }
		  );
		  delete userStates[userId];
		  break;
		
		
		
		case "waiting_add_caller_ids":
			const addRes = parseCallerIds(text);
			if (!addRes.valid) {
			  bot.sendMessage(chatId, `❌ ${addRes.message}`);
			  delete userStates[userId];
			  return;
			}
			const campAddIds = await Campaign.findByPk(userState.campaignId);
			const existing = campAddIds.callerIds || [];
			const combined = [...new Set([...existing, ...addRes.callerIds])];
			await campAddIds.update({ callerIds: combined, callerId: combined[0] });
			bot.sendMessage(chatId, `✅ Added ${addRes.callerIds.length} caller ID(s). Total: ${combined.length}`);
			delete userStates[userId];
			break;

		  case "waiting_calls_per_id":
			const cpiNum = parseInt(text);
			if (isNaN(cpiNum) || cpiNum < 1 || cpiNum > 1000) {
			  bot.sendMessage(chatId, "❌ Enter a number between 1-1000.");
			  return;
			}
			const campCpi = await Campaign.findByPk(userState.campaignId);
			await campCpi.update({ callsPerCallerId: cpiNum });
			bot.sendMessage(chatId, `✅ Caller ID will rotate every ${cpiNum} call(s).`);
			delete userStates[userId];
			break;

		  case "waiting_remove_caller_id":
			const remIdx = parseInt(text) - 1;
			const campRemId = await Campaign.findByPk(userState.campaignId);
			const currIds = campRemId.callerIds || [];
			if (isNaN(remIdx) || remIdx < 0 || remIdx >= currIds.length) {
			  bot.sendMessage(chatId, `❌ Enter 1-${currIds.length}.`);
			  return;
			}
			const removed = currIds[remIdx];
			const newIds = currIds.filter((_, i) => i !== remIdx);
			let newIdx = campRemId.callerIdIndex >= newIds.length ? 0 : campRemId.callerIdIndex;
			await campRemId.update({ callerIds: newIds, callerIdIndex: newIdx, callerId: newIds[0] || null });
			bot.sendMessage(chatId, `✅ Removed: ${removed}`);
			delete userStates[userId];
			break;
		case "waiting_line_output_chat":
		  const lineOutputInput = text.trim().toLowerCase();
		  const campaignLineOutput = await getOrCreateCampaign();
		  
		  if (lineOutputInput === 'this') {
			await campaignLineOutput.update({ lineOutputChatId: String(chatId) });
			bot.sendMessage(
			  chatId,
			  `✅ This chat is now set as the line output group.`,
			  mainMenu
			);
		  } else {
			// Validate it's a number (chat ID)
			if (!/^-?\d+$/.test(text.trim())) {
			  bot.sendMessage(chatId, "❌ Invalid chat ID. Please enter a valid number or 'this'.");
			  return;
			}
			await campaignLineOutput.update({ lineOutputChatId: text.trim() });
			bot.sendMessage(
			  chatId,
			  `✅ Line output group set to: <code>${escapeHtml(text.trim())}</code>`,
			  { parse_mode: "HTML", ...mainMenu }
			);
		  }
		  delete userStates[userId];
		  break;
		  
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
			  ivr_outro_file: campaignCb.ivrOutroFile,
			  routing_type: campaign.routingType,
			  routing_destination: campaign.routingDestination,
			  routing_trunk: campaign.routingTrunk
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
            transport: 'udp,tls,ws',
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
		  const permitParts = text.trim().split(/\s+/);
		  const permitId = permitParts[0];
		  const permLevel = permitParts[1]?.toLowerCase() === 'admin' ? 'admin' : 'user';
		  
		  if (!/^\d+$/.test(permitId)) {
			bot.sendMessage(chatId, "❌ Invalid ID. Please enter numbers only.");
			return;
		  }
		  
		  try {
			const existing = await Allowed.findOne({ 
			  where: { telegramId: permitId } 
			});
			
			if (existing) {
			  // Update existing user's permission
			  await existing.update({ permissionLevel: permLevel });
			  bot.sendMessage(
				chatId, 
				`✅ User ${permitId} updated to ${permLevel} level.`,
				mainMenu
			  );
			} else {
			  await Allowed.create({ 
				telegramId: permitId,
				permissionLevel: permLevel
			  });
			  const accessNote = permLevel === 'user' 
				? '📌 They can only use /line command.' 
				: '📌 They have full access.';
			  bot.sendMessage(
				chatId, 
				`✅ User ${permitId} permitted with ${permLevel} level!\n\n${accessNote}`,
				mainMenu
			  );
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
				include: [{ model: SipPeer, as: 'sipTrunk' }, { model: SipPeer, as: 'routingTrunk' }]
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
	bot.onText(/\/lines(?:\s+info)?/, async (msg) => {
	  const chatId = msg.chat.id;
	  const userId = msg.from.id;
	  const text = msg.text.trim();
	  
	  // Check access
	  if (!(await hasAccess(userId))) {
		bot.sendMessage(chatId, "❌ You don't have permission to use this command.");
		return;
	  }
	  
	  try {
		const campaign = await Campaign.findOne({
		  where: { botToken: config.telegram_bot_token },
		  include: [
			{ model: SipPeer, as: 'sipTrunk' },
			{ model: SipPeer, as: 'callbackTrunk' }
		  ]
		});
		
		if (!campaign) {
		  bot.sendMessage(chatId, "❌ No campaign configured.");
		  return;
		}
		
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
			`📋 <b>No DTMF Responses Yet</b>\n\nNo callers have pressed ${campaign.dtmfDigit} in this campaign.`,
			{ parse_mode: "HTML" }
		  );
		  return;
		}
		
		let message = `📋 <b>Recent DTMF Responses (${campaign.dtmfDigit})</b>\n\n`;
		recentDTMF.forEach((call, index) => {
		  const time = call.updatedAt.toLocaleString();
		  const retrieved = call.lineRetrieved ? '✅' : '🆕';
		  message += `${index + 1}. ${retrieved} <code>${escapeHtml(call.phoneNumber)}</code>\n`;
		  message += `   Time: ${time}\n`;
		  if (call.rawLine) {
			const truncated = call.rawLine.substring(0, 50);
			message += `   Raw: ${escapeHtml(truncated)}${call.rawLine.length > 50 ? '...' : ''}\n`;
		  }
		  message += '\n';
		});
		
		message += `\n<b>Callback Configuration:</b>\n`;
		
		if (campaign.callbackTrunkId && campaign.callbackTrunk) {
		  message += `✅ Callback Trunk: ${escapeHtml(campaign.callbackTrunk.name)}\n`;
		  message += `📱 Callback Number: ${escapeHtml(campaign.callbackTrunkNumber || 'Not set')}\n`;
		  message += `📞 Regular Trunk: ${escapeHtml(campaign.sipTrunk ? campaign.sipTrunk.name : 'N/A')}\n`;
		  message += `🆔 Caller ID: ${escapeHtml(campaign.callerId || 'Not set')}\n\n`;
		  
		  if (campaign.callbackTrunkNumber) {
			message += `To initiate callback to all ${recentDTMF.length} numbers above, type: <b>yes</b>\n`;
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
		
		bot.sendMessage(chatId, message, { parse_mode: "HTML" });
		
	  } catch (error) {
		console.error('/lines error:', error);
		bot.sendMessage(chatId, `❌ Error: ${error.message}`);
	  }
	});

	bot.onText(/\/line(?:\s+(.+))?$/, async (msg, match) => {
	  const chatId = msg.chat.id;
	  const userId = msg.from.id;
	  const messageId = msg.message_id;
	  const argument = match[1] ? match[1].trim() : null;
	  
	  // Skip if this is /lines command
	  if (msg.text.startsWith('/lines')) return;
	  
	  // Check access - even line-only users can use this
	  if (!(await hasAccess(userId))) {
		bot.sendMessage(chatId, "❌ You don't have permission to use this command.", {
		  reply_to_message_id: messageId
		});
		return;
	  }
	  
	  try {
		const campaign = await Campaign.findOne({
		  where: { botToken: config.telegram_bot_token }
		});
		
		if (!campaign) {
		  bot.sendMessage(chatId, "❌ No campaign configured.", {
			reply_to_message_id: messageId
		  });
		  return;
		}
		
		// If argument provided, lookup specific number
		if (argument) {
		  const searchNumber = argument.replace(/\D/g, ''); // Remove non-digits
		  
		  // Search for the number (try with and without + prefix)
		  const call = await Call.findOne({
			where: {
			  campaignId: campaign.id,
			  [Op.or]: [
				{ phoneNumber: searchNumber },
				{ phoneNumber: `+${searchNumber}` },
				{ phoneNumber: { [Op.like]: `%${searchNumber}%` } }
			  ]
			}
		  });
		  
		  if (!call) {
			bot.sendMessage(chatId, `❌ No record found for number: ${argument}`, {
			  reply_to_message_id: messageId
			});
			return;
		  }
		  
		  // Format the lead data using HTML
		  let response = `📋 <b>Lead Information</b>\n\n`;
		  response += `📞 Phone: <code>${escapeHtml(call.phoneNumber)}</code>\n`;
		  
		  if (call.leadName) {
			response += `👤 Name: ${escapeHtml(call.leadName)}\n`;
		  }
		  if (call.leadEmail) {
			response += `📧 Email: ${escapeHtml(call.leadEmail)}\n`;
		  }
		  if (call.pressedDigit) {
			response += `🔢 Pressed: ${call.pressedDigit}\n`;
		  }
		  response += `📊 Status: ${call.callStatus}\n`;
		  
		  if (call.rawLine) {
			response += `\n📝 <b>Raw Data:</b>\n<pre>${escapeHtml(call.rawLine)}</pre>`;
		  }
		  
		  // Parse additional lead data if exists
		  if (call.leadData) {
			try {
			  const extraData = JSON.parse(call.leadData);
			  response += `\n📎 <b>Additional Info:</b>\n`;
			  for (const [key, value] of Object.entries(extraData)) {
				response += `• ${escapeHtml(key)}: ${escapeHtml(String(value))}\n`;
			  }
			} catch (e) {
			  response += `\n📎 Extra: ${escapeHtml(call.leadData)}`;
			}
		  }
		  
		  response += `\n⏰ Updated: ${call.updatedAt.toLocaleString()}`;
		  
		  bot.sendMessage(chatId, response, {
			parse_mode: "HTML",
			reply_to_message_id: messageId
		  });
		  return;
		}
		
		// No argument - get next unretrieved P1 line
		const nextLine = await Call.findOne({
		  where: {
			campaignId: campaign.id,
			pressedDigit: { [Op.ne]: null },  // Has pressed DTMF
			lineRetrieved: false              // Not yet retrieved
		  },
		  order: [['updatedAt', 'ASC']]  // Oldest first (FIFO)
		});
		
		if (!nextLine) {
		  bot.sendMessage(chatId, `📭 No new P1 lines available.\n\nAll DTMF responses have been retrieved.`, {
			reply_to_message_id: messageId
		  });
		  return;
		}
		
		// Mark as retrieved
		await nextLine.update({
		  lineRetrieved: true,
		  retrievedBy: String(userId),
		  retrievedAt: new Date()
		});
		
		// Count remaining
		const remainingCount = await Call.count({
		  where: {
			campaignId: campaign.id,
			pressedDigit: { [Op.ne]: null },
			lineRetrieved: false
		  }
		});
		
		// Send the raw line EXACTLY as stored (preserving formatting)
		// NO parse_mode to preserve exact formatting from user's notepad!
		let response = '';
		
		if (nextLine.rawLine) {
		  // Send raw line as-is without any parsing to preserve exact formatting
		  response = nextLine.rawLine;
		} else {
		  // Fallback if no raw line stored
		  response = `📞 ${nextLine.phoneNumber}`;
		  if (nextLine.leadName) response += `\n👤 ${nextLine.leadName}`;
		  if (nextLine.leadEmail) response += `\n📧 ${nextLine.leadEmail}`;
		}
		
		// Add footer with remaining count
		response += `\n\n━━━━━━━━━━━━━━━\n📊 Remaining P1s: ${remainingCount}`;
		
		// NO parse_mode here - this preserves EXACT formatting including emojis, spaces, etc.
		bot.sendMessage(chatId, response, {
		  reply_to_message_id: messageId
		});
		
	  } catch (error) {
		console.error('/line error:', error);
		bot.sendMessage(chatId, `❌ Error: ${error.message}`, {
		  reply_to_message_id: messageId
		});
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
	bot.onText(/\/resetlines/, async (msg) => {
	  const chatId = msg.chat.id;
	  const userId = msg.from.id;
	  
	  if (!(await isAdmin(userId))) {
		bot.sendMessage(chatId, "❌ Admin access required!");
		return;
	  }
	  
	  try {
		const campaign = await getOrCreateCampaign();
		
		// Reset all line_retrieved flags for this campaign
		const [updatedCount] = await Call.update(
		  { 
			lineRetrieved: false,
			retrievedBy: null,
			retrievedAt: null
		  },
		  {
			where: {
			  campaignId: campaign.id,
			  pressedDigit: { [Op.ne]: null }
			}
		  }
		);
		
		bot.sendMessage(
		  chatId,
		  `✅ <b>Lines Reset</b>\n\n${updatedCount} P1 lines have been marked as unretrieved.\n\nThey can now be retrieved again via /line.`,
		  { parse_mode: "HTML" }
		);
		
	  } catch (error) {
		bot.sendMessage(chatId, `❌ Error: ${error.message}`);
	  }
	});

	bot.onText(/\/linecount/, async (msg) => {
	  const chatId = msg.chat.id;
	  const userId = msg.from.id;
	  
	  if (!(await hasAccess(userId))) {
		bot.sendMessage(chatId, "❌ Access denied.");
		return;
	  }
	  
	  try {
		const campaign = await getOrCreateCampaign();
		
		const totalP1s = await Call.count({
		  where: {
			campaignId: campaign.id,
			pressedDigit: { [Op.ne]: null }
		  }
		});
		
		const retrievedP1s = await Call.count({
		  where: {
			campaignId: campaign.id,
			pressedDigit: { [Op.ne]: null },
			lineRetrieved: true
		  }
		});
		
		const availableP1s = totalP1s - retrievedP1s;
		
		bot.sendMessage(
		  chatId,
		  `📊 <b>P1 Line Statistics</b>\n\n` +
		  `📞 Total P1s: ${totalP1s}\n` +
		  `✅ Retrieved: ${retrievedP1s}\n` +
		  `🆕 Available: ${availableP1s}`,
		  { parse_mode: "HTML" }
		);
		
	  } catch (error) {
		bot.sendMessage(chatId, `❌ Error: ${error.message}`);
	  }
	});

};

module.exports = { initializeBot };