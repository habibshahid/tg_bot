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

// Import billing system components
const User = require("../models/user");
const { Provider, RateCard, Destination, Rate } = require("../models/provider");
const { Transaction, CallDetail } = require("../models/transaction");
const { handleApprovalCallbacks, handleApprovalTextMessages } = require('./approvalHandlers');

require("../models/associations");

const billingEngine = require("../services/billingEngine");
const { setupBillingEventHandlers } = require("../asterisk/billingCallHandler");
const adminUtilities = require("../utils/adminUtilities");
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
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
  return sanitized.replace(/_+/g, '_').toLowerCase();
}

function escapeMarkdown(text) {
  if (!text) return '';
  text = String(text);
  return text
    .replace(/\\/g, '\\\\') 
    .replace(/\*/g, '\\*')   
    .replace(/_/g, '\\_')    
    .replace(/\[/g, '\\[')   
    .replace(/\]/g, '\\]')   
    .replace(/\(/g, '\\(')   
    .replace(/\)/g, '\\)')   
    .replace(/~/g, '\\~')    
    .replace(/`/g, '\\`')    
    .replace(/>/g, '\\>')    
    .replace(/#/g, '\\#')    
    .replace(/\+/g, '\\+')   
    .replace(/-/g, '\\-')    
    .replace(/=/g, '\\=')    
    .replace(/\|/g, '\\|')   
    .replace(/\{/g, '\\{')   
    .replace(/\}/g, '\\}')   
    .replace(/\./g, '\\.')   
    .replace(/!/g, '\\!');   
}

async function convertAudioFile(inputPath, outputPath) {
  try {
    const command = `sox "${inputPath}" -r 8000 -c 1 -b 16 "${outputPath}" norm -3`;
    
    await execPromise(command);
    console.log(`Audio converted successfully: ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`Audio conversion failed: ${error.message}`);
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

// Enhanced user access check with billing integration
async function checkUserAccess(userId, chatId, requireAdmin = false) {
  let user = await User.findOne({ where: { telegramId: userId.toString() } });
  
  // Auto-create admin user if it's the first admin
  if (!user && userId.toString() === config.creator_telegram_id) {
    user = await User.create({
      telegramId: userId.toString(),
      userType: 'admin',
      status: 'active',
      balance: 1000, // Give admin initial balance for testing
      firstName: 'System Administrator',
      creditLimit: 10000
    });
    console.log('Auto-created admin user');
  }
  
  if (!user) {
    // For backward compatibility, check old Allowed table
    const allowedUser = await Allowed.findOne({ where: { telegramId: userId.toString() } });
    if (allowedUser || userId.toString() === config.creator_telegram_id) {
      // Migrate user to new system
      user = await User.create({
        telegramId: userId.toString(),
        userType: userId.toString() === config.creator_telegram_id ? 'admin' : 'user',
        status: 'active',
        balance: 0,
        firstName: 'Migrated User'
      });
      console.log(`Migrated user ${userId} to new billing system`);
    } else {
      return null; // User not authorized
    }
  }
  
  if (user.status !== 'active') {
    return null;
  }
  
  if (requireAdmin && user.userType !== 'admin') {
    return null;
  }
  
  // Update last login
  await user.update({ lastLoginAt: new Date() });
  
  return user;
}

// Enhanced startCallingProcess with user context and billing validation
async function startCallingProcess(data, campaign, userId = null) {
  let user = null;
  
  // Always try to get user for billing context
  if (userId) {
    user = await User.findOne({ where: { telegramId: userId.toString() } });
    if (!user) {
      console.warn(`User ${userId} not found, creating default user for billing`);
      // Create a default user for billing if doesn't exist
      user = await User.create({
        telegramId: userId.toString(),
        userType: 'user',
        status: 'active',
        balance: 0,
        firstName: 'Auto-created User',
        rateCardId: null // Will be assigned by admin later
      });
    }
  }

  const concurrentCalls = campaign.concurrentCalls;
  const CALLS_PER_SECOND = 3;
  
  // Save all leads to database with campaign ID before starting
  for (const entry of data) {
    const phoneNumber = `+${sanitize_phoneNumber(entry.phoneNumber)}`;
    
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
  
  // ALWAYS set user context for billing
  const currentSettings = get_settings();
  const updatedSettings = {
    ...currentSettings,
    notifications_chat_id: campaign.notificationsChatId,
    concurrent_calls: campaign.concurrentCalls,
    sip_trunk: campaign.sipTrunk,
    caller_id: campaign.callerId,
    dial_prefix: campaign.dialPrefix || '',
    campaign_id: campaign.id,
    dtmf_digit: campaign.dtmfDigit,
    ivr_intro_file: campaign.ivrIntroFile,
    ivr_outro_file: campaign.ivrOutroFile
  };
  
  // CRITICAL: Always set user context, even if no rate card
  if (user) {
    updatedSettings.user_id = user.id;
    updatedSettings.telegram_user_id = userId;
    console.log(`[Billing] User context set: ${user.telegramId}, Rate Card: ${user.rateCardId || 'None'}`);
  } else {
    console.log(`[Warning] No user context available for billing`);
  }
  
  set_settings(updatedSettings);
  
  const callPromises = [];
  
  for (let i = 0; i < concurrentCalls; i++) {
    const line = pop_unprocessed_line();
    if (line) {
      const delayedCall = async () => {
        const secondGroup = Math.floor(i / CALLS_PER_SECOND);
        const positionInGroup = i % CALLS_PER_SECOND;
        const delay = (secondGroup * 1500) + (positionInGroup * (1500 / CALLS_PER_SECOND));
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // ALWAYS use billing call handler
        console.log(`[System] Using billing handler for all calls (User: ${user ? user.telegramId : 'none'})`);
        return require("../asterisk/billingCallHandler")(line);
      };
      callPromises.push(delayedCall());
    }
  }
  
  // Wait for all calls to complete
  await Promise.all(callPromises);
  
  const bot = get_bot();
  const settings = get_settings();
  
  let completionMessage = `✅ *Campaign Completed*\n\nAll numbers have been processed.`;
  
  // Add billing summary if user has rate card
  if (user && user.rateCardId) {
    try {
      const finalSummary = await billingEngine.getUserFinancialSummary(user.id);
      completionMessage += `\n\nFinal Balance: $${finalSummary.summary.currentBalance.toFixed(2)}`;
    } catch (error) {
      console.error('Error getting final summary:', error);
    }
  } else {
    completionMessage += `\n\n💡 Contact admin to enable billing for future campaigns.`;
  }
  
  bot.sendMessage(
    settings?.notifications_chat_id,
    completionMessage,
    { parse_mode: "Markdown" }
  );
  return;
}

// Get or create campaign for this bot (enhanced with user context)
async function getOrCreateCampaign(userId = null) {
  const botToken = config.telegram_bot_token;
  
  let whereClause = { botToken };
  
  // If userId is provided, try to find user-specific campaign
  if (userId) {
    const user = await User.findOne({ where: { telegramId: userId.toString() } });
    if (user) {
      whereClause.createdBy = user.telegramId;
    }
  }
  
  let campaign = await Campaign.findOne({
    where: whereClause,
    include: [{
      model: SipPeer,
      as: 'sipTrunk'
    }]
  });

  if (!campaign) {
    // Create default campaign
    const campaignData = {
      botToken,
      campaignName: 'Default Campaign',
      concurrentCalls: config.concurrent_calls || 30,
      isActive: true
    };
    
    if (userId) {
      campaignData.createdBy = userId.toString();
      campaignData.campaignName = `Campaign for User ${userId}`;
    }
    
    campaign = await Campaign.create(campaignData);
  }

  return campaign;
}

// Validate caller ID format
function validateCallerId(callerId) {
  const cleaned = callerId.replace(/\D/g, '');
  
  if (cleaned.length === 10 || (cleaned.length === 11 && cleaned.startsWith('1'))) {
    return { valid: true, formatted: cleaned };
  }
  
  if (cleaned.length >= 7 && cleaned.length <= 15) {
    return { valid: true, formatted: cleaned };
  }
  
  return { valid: false, message: "Invalid caller ID format. Please use a valid phone number." };
}

async function createCallbackEntry(phoneNumber, campaignId) {
  try {
    const existingCall = await Call.findOne({
      where: {
        phoneNumber: `+${phoneNumber}`,
        campaignId: campaignId
      }
    });
    
    if (!existingCall) {
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

async function initiateCallback(phoneNumber, campaign) {
  const { ami } = require("../asterisk/instance");
  const { set_settings, get_settings } = require("../utils/settings");
  
  if (!campaign.callbackTrunk) {
    throw new Error("Callback trunk not loaded");
  }
  
  if (!campaign.callbackTrunkNumber) {
    throw new Error("Callback trunk number not configured");
  }
  
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

function parseFileData(fileBuffer) {
  return fileBuffer
    .toString("utf-8")
    .split("\n")
    .map((line) => {
      console.log('Processing line:', line);
      return { phoneNumber: line.trim(), rawLine: line.trim() };
    })
    .filter(entry => entry.phoneNumber);
}

async function filterProcessedNumbers(data, campaignId = null) {
  let whereClause = {};
  
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

/**
 * Handle cost estimation request
 */
async function handleCostEstimation(bot, chatId, userId) {
  const user = await User.findOne({ where: { telegramId: userId.toString() } });
  
  if (!user) {
    bot.sendMessage(chatId, "❌ User not found. Please contact administrator.");
    return;
  }
  
  if (!user.rateCardId) {
    bot.sendMessage(chatId, "❌ No rate card assigned. Please contact administrator.");
    return;
  }
  
  bot.sendMessage(chatId, 
    "📱 *Cost Estimation*\n\n" +
    "Please send the phone number you want to estimate cost for:\n\n" +
    "Format: +1234567890 or 1234567890",
    { parse_mode: 'Markdown' }
  );
  
  userStates[userId] = { action: 'cost_estimation' };
}

/**
 * Process cost estimation
 */
async function processCostEstimation(bot, chatId, userId, phoneNumber) {
  try {
    const user = await User.findOne({ where: { telegramId: userId.toString() } });
    
    // Estimate for different durations
    const durations = [1, 5, 10, 30];
    const estimates = [];
    
    for (const duration of durations) {
      const result = await billingEngine.estimateCallCost(user.id, phoneNumber, duration);
      
      if (result.success) {
        estimates.push({
          duration,
          cost: result.estimatedCost,
          destination: result.destination
        });
      } else {
        bot.sendMessage(chatId, `❌ ${result.userFriendlyMessage}`);
        return;
      }
    }
    
    if (estimates.length === 0) {
      bot.sendMessage(chatId, "❌ Unable to estimate cost for this number.");
      return;
    }
    
    const destination = estimates[0].destination;
    
    let message = `💰 *Cost Estimation*\n\n`;
    message += `📞 Number: ${escapeMarkdown(phoneNumber)}\n`;
    message += `🌍 Destination: ${escapeMarkdown(destination.countryName)}\n`;
    message += `📍 Prefix: ${escapeMarkdown(destination.prefix)}\n\n`;
    message += `💵 *Estimated Costs:*\n`;
    
    estimates.forEach(estimate => {
      message += `• ${estimate.duration} min: $${estimate.cost.toFixed(4)}\n`;
    });
    
    message += `\n💳 Current Balance: $${user.balance}\n`;
    message += `🔄 Credit Limit: $${user.creditLimit}\n`;
    message += `💎 Available: $${(parseFloat(user.balance) + parseFloat(user.creditLimit)).toFixed(4)}`;
    
    bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: "🔙 Back to Menu", callback_data: "back_to_menu" }
        ]]
      }
    });
    
  } catch (error) {
    console.error('Cost estimation error:', error);
    bot.sendMessage(chatId, "❌ Error estimating cost. Please try again.");
  }
}

async function userHasAssociatedAgents(userId) {
  const agents = await getUserAssociatedAgents(userId);
  return agents.length > 0;
}

async function userHasAssociatedTrunks(userId) {
  const trunks = await getUserAssociatedTrunks(userId);
  return trunks.length > 0;
}

/**
 * Bulk cost estimation for campaign
 */
async function estimateCampaignCost(userId, phoneNumbers) {
  try {
    const user = await User.findOne({ where: { telegramId: userId.toString() } });
    
    if (!user || !user.rateCardId) {
      throw new Error('User or rate card not found');
    }
    
    const estimates = [];
    let totalCost = 0;
    let validNumbers = 0;
    let invalidNumbers = 0;
    
    // Sample first 50 numbers for estimation
    const sampleSize = Math.min(phoneNumbers.length, 50);
    const sampleNumbers = phoneNumbers.slice(0, sampleSize);
    
    for (const phoneNumber of sampleNumbers) {
      const result = await billingEngine.estimateCallCost(user.id, phoneNumber, 3); // 3 min average
      
      if (result.success) {
        estimates.push({
          phoneNumber,
          cost: result.estimatedCost,
          destination: result.destination.countryName
        });
        totalCost += result.estimatedCost;
        validNumbers++;
      } else {
        invalidNumbers++;
      }
    }
    
    // Extrapolate to full campaign
    const avgCostPerCall = validNumbers > 0 ? totalCost / validNumbers : 0;
    const totalValidNumbers = Math.round((validNumbers / sampleSize) * phoneNumbers.length);
    const estimatedTotalCost = avgCostPerCall * totalValidNumbers;
    
    return {
      success: true,
      sampleSize,
      validNumbers,
      invalidNumbers,
      avgCostPerCall,
      totalNumbers: phoneNumbers.length,
      estimatedValidNumbers: totalValidNumbers,
      estimatedTotalCost,
      canAfford: (parseFloat(user.balance) + parseFloat(user.creditLimit)) >= estimatedTotalCost,
      availableBalance: parseFloat(user.balance) + parseFloat(user.creditLimit),
      estimates: estimates.slice(0, 10) // Return first 10 for display
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function checkUserPermissions(user, userId, adminId) {
  const isApprovedUser = user.approvalStatus === 'approved' && user.campaignSettingsComplete;
  const isAdminUser = userId == adminId || user.userType === 'admin';
  return { isApprovedUser, isAdminUser };
}

function parseDestinationRoute(destinationRoute) {
  if (!destinationRoute) return { type: null, name: null };
  
  if (destinationRoute.startsWith('trunk/')) {
    return {
      type: 'trunk',
      name: destinationRoute.replace('trunk/', '')
    };
  } else if (destinationRoute.startsWith('agent/')) {
    return {
      type: 'agent', 
      name: destinationRoute.replace('agent/', '')
    };
  }
  
  return { type: null, name: null };
}

async function getSipTrunks() {
  return await SipPeer.findAll({
    where: { 
      category: 'trunk',
      status: 1
    },
    order: [['id', 'ASC']]
  });
}

async function getUserSipTrunks() {
  return await SipPeer.findAll({
    where: { 
      category: 'trunk',
      status: 1  // Only active trunks
    },
    order: [['name', 'ASC']]
  });
}

async function getUserAgents() {
  return await SipPeer.findAll({
    where: { 
      category: { [Op.ne]: 'trunk' },  // All non-trunk entries (agents/extensions)
      status: 1  // Only active agents
    },
    order: [['name', 'ASC']]
  });
}

async function getUserAssociatedAgents(userId) {
  const user = await User.findOne({ where: { telegramId: userId.toString() } });
	
  return await SipPeer.findAll({
    where: { 
      category: { [Op.ne]: 'trunk' },  // All non-trunk entries (agents/extensions)
      status: 1,  // Only active agents
      telegram_id: user.id  // Only agents associated with this specific user
    },
    order: [['name', 'ASC']]
  });
}

async function getUserAssociatedTrunks(userId) {
  const user = await User.findOne({ where: { telegramId: userId.toString() } });
	
  return await SipPeer.findAll({
    where: { 
      category: 'trunk' ,  // All non-trunk entries (agents/extensions)
      status: 1,  // Only active agents
      telegram_id: user.id  // Only agents associated with this specific user
    },
    order: [['name', 'ASC']]
  });
}

// Keep the existing function for admin use or fallback
async function getAllAgents() {
  return await SipPeer.findAll({
    where: { 
      category: { [Op.ne]: 'trunk' },
      status: 1
    },
    order: [['name', 'ASC']]
  });
}

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

// Enhanced menu function based on user type and billing status
// Enhanced menu function based on user type and APPROVAL STATUS
function getUserMenu(user) {
  const isAdmin = user.userType === 'admin';
  const hasBilling = user.rateCardId ? true : false;
  // *** CRITICAL: NO MENU FOR NON-APPROVED USERS ***
  if (!isAdmin) {
    // Check approval status - NO MENU if not fully approved and configured
    if (user.approvalStatus !== 'approved' || !user.campaignSettingsComplete) {
      return {
        reply_markup: {
          inline_keyboard: [] // EMPTY MENU - NO BUTTONS
        }
      };
    }
  }
  
  let userButtons = [];
  if (hasBilling) {
    // User with billing enabled
    userButtons = [
      [
        { text: "📞 Manual Dial", callback_data: "manual_dial" }
      ],
	  [
		{ text: "➕ Set Dial Prefix", callback_data: "user_set_dial_prefix" }, 
		{ text: "📞 Set Caller ID", callback_data: "user_set_caller_id" }   
      ],
	  [
		//{ text: "🌐 Select SIP Trunk", callback_data: "user_select_sip_trunk" },     // *** EXISTING ***
		{ text: "🎯 Destination Route", callback_data: "user_destination_route" }   // *** NEW ***
	  ],
      [
        { text: "📊 My Statistics", callback_data: "my_stats" },
        { text: "📋 Recent Calls", callback_data: "recent_calls" }
      ],
	  [
        { text: "🎵 Upload IVR", callback_data: "upload_ivr" },         // *** ADDED ***
        { text: "🔢 Set DTMF Digit", callback_data: "set_dtmf" }      // *** ADDED ***
      ],
      [
        { text: "💳 My Rate Card", callback_data: "my_rates" },
		{ text: "💰 Check Balance", callback_data: "check_balance" }
      ],
      [
        { text: "💱 Estimate Cost", callback_data: "estimate_cost" },
        { text: "🆔 Get Your ID", callback_data: "get_id" }
      ]
    ];
  } else {
    // Approved legacy user or user without billing
    userButtons = [
      //[
        //{ text: "Restricted. Contact Administrator", callback_data: "restricted" }
      //];
	]
  }

  const adminButtons = [
    [
      { text: "👥 Manage Users", callback_data: "admin_users" },
      { text: "⏳ Pending Approvals", callback_data: "admin_pending_approvals" }
    ],
    [
      { text: "💳 Manage Rates", callback_data: "admin_rates" },
      { text: "💰 Add Credit", callback_data: "admin_add_credit" }
    ],
    [
      { text: "📊 System Stats", callback_data: "admin_system_stats" },
      { text: "👤 Permit User", callback_data: "permit_user" }
    ]
  ];

  return {
    reply_markup: {
      inline_keyboard: isAdmin ? [...adminButtons, ...userButtons] : userButtons
    }
  };
}

async function validateUserAgent(userId, agentId) {
  const agent = await SipPeer.findOne({
    where: {
      id: agentId,
      telegram_id: userId,
      category: { [Op.ne]: 'trunk' },
      status: 1
    }
  });
  
  return agent;
}

// Handle credit amount input
async function handleAddCreditAmount(bot, msg, userStates, userId) {
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const userState = userStates[userId];
  
  try {
    const amount = parseFloat(text);
    
    if (isNaN(amount) || amount <= 0) {
      bot.sendMessage(chatId, "❌ Invalid amount. Please enter a positive number.");
      return;
    }
    
    if (amount > 10000) {
      bot.sendMessage(chatId, "❌ Amount exceeds maximum limit ($10,000).");
      return;
    }
    
    const selectedUser = await User.findByPk(userState.selectedUserId);
    if (!selectedUser) {
      bot.sendMessage(chatId, "❌ User not found.");
      delete userStates[userId];
      return;
    }
    
    // Add credit using adminUtilities
    const result = await adminUtilities.addCredit({
      telegramId: selectedUser.telegramId,
      amount: amount,
      description: `Credit added by admin via Telegram bot`,
      createdBy: userId.toString()
    });
    
    bot.sendMessage(
      chatId,
      `✅ *Credit Added Successfully!*\n\n` +
      `User: ${escapeMarkdown(result.user.firstName || 'User')}\n` +
      `Amount Added: $${result.user.creditAdded}\n` +
      `Previous Balance: $${result.user.previousBalance}\n` +
      `New Balance: $${result.user.newBalance}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💰 Add More Credit', callback_data: 'admin_add_credit' }],
            [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
          ]
        }
      }
    );
    
    delete userStates[userId];
    
  } catch (error) {
    console.error('Error adding credit:', error);
    bot.sendMessage(chatId, `❌ Error adding credit: ${error.message}`);
    delete userStates[userId];
  }
}

async function handleAdminSetCallerId(bot, msg, userStates, userId) {
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const userState = userStates[userId];
  
  try {
    const validation = validateCallerId(text);
    if (!validation.valid) {
      bot.sendMessage(chatId, `❌ ${validation.message}`);
      return;
    }
    
    const selectedUser = await User.findByPk(userState.selectedUserId);
    if (!selectedUser) {
      bot.sendMessage(chatId, "❌ User not found.");
      delete userStates[userId];
      return;
    }
    
    const campaign = await Campaign.findOne({
      where: { createdBy: selectedUser.telegramId }
    });
    
    if (campaign) {
      await campaign.update({ callerId: validation.formatted });
      
      bot.sendMessage(
        chatId,
        `✅ *Caller ID Updated*\n\n` +
        `User: ${escapeMarkdown(selectedUser.firstName || selectedUser.username || 'User')}\n` +
        `Caller ID: ${escapeMarkdown(validation.formatted)}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📞 Back to Campaign Config', callback_data: `admin_campaign_config_${selectedUser.id}` }]
            ]
          }
        }
      );
    }
    
    delete userStates[userId];
  } catch (error) {
    console.error('Error setting caller ID:', error);
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    delete userStates[userId];
  }
}

// Handle prefix setting
async function handleAdminSetPrefix(bot, msg, userStates, userId) {
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const userState = userStates[userId];
  let prefix = '';
  
  try {
	if(text.toLowerCase() == 'none'){
		prefix = '';
	}
	else{
		prefix = text;
	}
	
    // Validate prefix (should only contain digits or be empty)
    if (prefix !== '' && prefix && !/^\d*$/.test(prefix)) {
      bot.sendMessage(chatId, "❌ Prefix should only contain numbers or be empty.");
      return;
    }

    const selectedUser = await User.findByPk(userState.selectedUserId);
    if (!selectedUser) {
      bot.sendMessage(chatId, "❌ User not found.");
      delete userStates[userId];
      return;
    }
    
    const campaign = await Campaign.findOne({
      where: { createdBy: selectedUser.telegramId }
    });
    
    if (campaign) {
      await campaign.update({ dialPrefix: prefix });
      
      bot.sendMessage(
        chatId,
        `✅ *Dial Prefix Updated*\n\n` +
        `User: ${escapeMarkdown(selectedUser.firstName || selectedUser.username || 'User')}\n` +
        `Dial Prefix: ${text || 'None'}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📞 Back to Campaign Config', callback_data: `admin_campaign_config_${selectedUser.id}` }]
            ]
          }
        }
      );
    }
    
    delete userStates[userId];
  } catch (error) {
    console.error('Error setting prefix:', error);
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    delete userStates[userId];
  }
}

async function handleAdminSetConcurrentCalls(bot, msg, userStates, userId) {
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const userState = userStates[userId];
  
  try {
    // Validate prefix (should only contain digits or be empty)
    if (text && !/^\d*$/.test(text)) {
      bot.sendMessage(chatId, "❌ Concurrent Calls should only contain numbers or be empty.");
      return;
    }
    
    const selectedUser = await User.findByPk(userState.selectedUserId);
    if (!selectedUser) {
      bot.sendMessage(chatId, "❌ User not found.");
      delete userStates[userId];
      return;
    }
    
    const campaign = await Campaign.findOne({
      where: { createdBy: selectedUser.telegramId }
    });
    
    if (campaign) {
      await campaign.update({ concurrentCalls: text });
      
      bot.sendMessage(
        chatId,
        `✅ *Concurrent Calls Updated*\n\n` +
        `User: ${escapeMarkdown(selectedUser.firstName || selectedUser.username || 'User')}\n` +
        `Concurrent Calls: ${text || 'None'}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📞 Back to Campaign Config', callback_data: `admin_campaign_config_${selectedUser.id}` }]
            ]
          }
        }
      );
    }
    
    delete userStates[userId];
  } catch (error) {
    console.error('Error setting Concurrent Calls:', error);
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    delete userStates[userId];
  }
}

// Initialize Telegram Bot
const initializeBot = () => {
  const bot = start_bot_instance();
  const adminId = config.creator_telegram_id;
  
  // Setup billing event handlers
  setupBillingEventHandlers();

  // Enhanced start command with user management
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    const user = await checkUserAccess(userId, chatId);
    if (!user) {
      bot.sendMessage(
        chatId,
        "❌ *Access Denied*\n\nYou are not registered in the system. Please contact the administrator.",
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    const isAdmin = user.userType === 'admin';
    const hasBilling = user.rateCardId ? true : false;
    const configCompleted = user.campaignSettingsComplete;
	
    let welcomeMessage = `🤖 *Welcome back`;
    if (isAdmin) {
      welcomeMessage += `, Administrator!*\n\n${escapeMarkdown(user.firstName || 'Admin')}, you have full system access.`  + "\n\nSelect an option from the menu below:";
    } else {
      welcomeMessage += `, ${escapeMarkdown(user.firstName || user.username || 'User')}!*`  + "\n\nSelect an option from the menu below:" ;
      if (hasBilling && configCompleted) {
        welcomeMessage += `\n\n💰 Balance: $${user.balance}\n📊 Rate Card: ${user.rateCardId ? 'Assigned' : 'Not Assigned'}`  + "\n\nSelect an option from the menu below:";
      } 
	  else if (hasBilling && configCompleted) {
		welcomeMessage += `\n\n💰 Balance: $${user.balance}\n📊 Rate Card: ${user.rateCardId ? 'Assigned' : 'Not Assigned'}`  + "\n\nCampaign config is not complete. Contact Administrator";  
	  }
	  else {
        welcomeMessage += `\n\nState not approved or billing not set. Contact admin for billing features.` ;
      }
    }
    
    bot.sendMessage(
      chatId, 
      welcomeMessage,
      { 
        ...getUserMenu(user),
        parse_mode: "Markdown"
      }
    );
  });

  // Enhanced callback query handler
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const callbackData = query.data;

    bot.answerCallbackQuery(query.id);

    const user = await checkUserAccess(userId, chatId);
	const approvalHandled = await handleApprovalCallbacks(bot, query, user, chatId, callbackData, userStates, userId);
	if (approvalHandled) return;

    if (!user) {
      bot.sendMessage(chatId, "❌ Access denied!");
      return;
    }

    switch (callbackData) {
      // Billing-specific callbacks
	  case "user_select_sip_trunk":
		  // Check user permissions
		  const isApprovedUserSip = user.approvalStatus === 'approved' && user.campaignSettingsComplete;
		  const isAdminUserSip = userId == adminId || user.userType === 'admin';
		  
		  if (!isAdminUserSip && !isApprovedUserSip) {
			bot.sendMessage(chatId, 
			  "❌ *Access Denied*\n\nYou need to be approved and have complete campaign settings to select SIP trunk.",
			  { parse_mode: "Markdown" }
			);
			return;
		  }
		  
		  try {
			const sipTrunks = await getUserSipTrunks();
			
			if (sipTrunks.length === 0) {
			  bot.sendMessage(
				chatId,
				`🌐 *No SIP Trunks Available*\n\nNo active SIP trunks are configured in the system.\n\nPlease contact the administrator.`,
				{ parse_mode: "Markdown" }
			  );
			  return;
			}
			
			// Get user's current campaign to show current selection
			let userCampaignSip = await Campaign.findOne({
			  where: { createdBy: user.telegramId },
			  include: [{ model: SipPeer, as: 'sipTrunk' }]
			});
			
			if (!userCampaignSip) {
			  // Create campaign if it doesn't exist
			  userCampaignSip = await Campaign.create({
				botToken: config.telegram_bot_token,
				campaignName: `${user.firstName || user.username || 'User'}'s Campaign`,
				createdBy: user.telegramId,
				concurrentCalls: 30,
				notificationsChatId: chatId,
				isActive: true
			  });
			}
			
			let trunkList = "🌐 *Select SIP Trunk for Outbound Calls*\n\n";
			
			if (userCampaignSip.sipTrunk) {
			  trunkList += `📍 *Current Selection:* ${escapeMarkdown(userCampaignSip.sipTrunk.name)}\n\n`;
			}
			
			trunkList += "*Available SIP Trunks:*\n\n";
			
			sipTrunks.forEach((trunk, index) => {
			  const isSelected = userCampaignSip.sipTrunkId === trunk.id ? " ✅" : "";
			  trunkList += `${index + 1}. *${escapeMarkdown(trunk.name)}*${isSelected}\n`;
			  trunkList += `   📍 Host: ${escapeMarkdown(trunk.host)}\n`;
			  trunkList += `   👤 Username: ${escapeMarkdown(trunk.username || trunk.defaultuser || 'N/A')}\n`;
			  if (trunk.description) {
				trunkList += `   📝 ${escapeMarkdown(trunk.description)}\n`;
			  }
			  trunkList += `   🔌 Status: ${trunk.status ? '✅ Active' : '❌ Inactive'}\n\n`;
			});
			
			trunkList += "Enter the number of the SIP trunk you want to use:";
			
			bot.sendMessage(chatId, trunkList, { parse_mode: "Markdown" });
			userStates[userId] = { 
			  action: "user_waiting_sip_selection", 
			  sipTrunks: sipTrunks,
			  campaignId: userCampaignSip.id 
			};
			
		  } catch (error) {
			console.error('Error in user_select_sip_trunk:', error);
			bot.sendMessage(chatId, `❌ Error: ${error.message}`);
		  }
		  break;
		  
		 case "user_destination_route":
		  // Check user permissions
		  const isApprovedUserDestRoute = user.approvalStatus === 'approved' && user.campaignSettingsComplete;
		  const isAdminUserDestRoute = userId == adminId || user.userType === 'admin';
		  
		  if (!isAdminUserDestRoute && !isApprovedUserDestRoute) {
			bot.sendMessage(chatId, 
			  "❌ *Access Denied*\n\nYou need to be approved and have complete campaign settings to set destination route.",
			  { parse_mode: "Markdown" }
			);
			return;
		  }
		  
		  // Get user's current campaign to show current selection
		  let userCampaignDestRoute = await Campaign.findOne({
			where: { createdBy: user.telegramId }
		  });
		  
		  if (!userCampaignDestRoute) {
			// Create campaign if it doesn't exist
			userCampaignDestRoute = await Campaign.create({
			  botToken: config.telegram_bot_token,
			  campaignName: `${user.firstName || user.username || 'User'}'s Campaign`,
			  createdBy: user.telegramId,
			  concurrentCalls: 30,
			  notificationsChatId: chatId,
			  isActive: true
			});
		  }
		  
		  let message = "🎯 *Set Destination Route*\n\n";
		  
		  // Show current destination route if exists
		  if (userCampaignDestRoute.destinationRoute) {
			message += `📍 *Current Route:* ${escapeMarkdown(userCampaignDestRoute.destinationRoute)}\n\n`;
		  } else {
			message += `📍 *Current Route:* Not set\n\n`;
		  }
		  
		  message += "Choose the type of destination for your calls:";
		  
		  bot.sendMessage(
			chatId,
			message,
			{
			  parse_mode: "Markdown",
			  reply_markup: {
				inline_keyboard: [
				  [
					{ text: "🌐 SIP Trunk", callback_data: "dest_route_sip" },
					{ text: "👤 Agent/Extension", callback_data: "dest_route_agent" }
				  ],
				  [
					{ text: "🗑️ Clear Route", callback_data: "dest_route_clear" }
				  ],
				  [
					{ text: "🔙 Back to Menu", callback_data: "back_to_menu" }
				  ]
				]
			  }
			}
		  );
		  break;

		case "dest_route_sip":
		  // Show SIP trunk selection for destination route
		  try {
			const sipTrunks = await getUserAssociatedTrunks(userId);
			
			if (sipTrunks.length === 0) {
			  bot.sendMessage(
				chatId,
				`🌐 *No SIP Trunks Available*\n\nNo active SIP trunks are configured in the system.\n\nPlease contact the administrator.`,
				{ parse_mode: "Markdown" }
			  );
			  return;
			}
			
			// Get user's current campaign
			let userCampaignSipRoute = await Campaign.findOne({
			  where: { createdBy: user.telegramId }
			});
			
			if (!userCampaignSipRoute) {
			  userCampaignSipRoute = await Campaign.create({
				botToken: config.telegram_bot_token,
				campaignName: `${user.firstName || user.username || 'User'}'s Campaign`,
				createdBy: user.telegramId,
				concurrentCalls: 30,
				notificationsChatId: chatId,
				isActive: true
			  });
			}
			
			let trunkList = "🌐 *Select SIP Trunk for Destination Route*\n\n";
			
			// Check if current destination route is a trunk and highlight it
			let currentTrunkName = null;
			if (userCampaignSipRoute.destinationRoute && userCampaignSipRoute.destinationRoute.startsWith('trunk/')) {
			  currentTrunkName = userCampaignSipRoute.destinationRoute.replace('trunk/', '');
			  trunkList += `📍 *Current Route:* ${escapeMarkdown(userCampaignSipRoute.destinationRoute)}\n\n`;
			}
			
			trunkList += "*Available SIP Trunks:*\n\n";
			
			sipTrunks.forEach((trunk, index) => {
			  const isSelected = currentTrunkName === trunk.name ? " ✅" : "";
			  trunkList += `${index + 1}. *${escapeMarkdown(trunk.name)}*${isSelected}\n`;
			  trunkList += `   📍 Host: ${escapeMarkdown(trunk.host)}\n`;
			  trunkList += `   👤 Username: ${escapeMarkdown(trunk.username || trunk.defaultuser || 'N/A')}\n`;
			  if (trunk.description) {
				trunkList += `   📝 ${escapeMarkdown(trunk.description)}\n`;
			  }
			  trunkList += `   🔌 Status: ${trunk.status ? '✅ Active' : '❌ Inactive'}\n\n`;
			});
			
			trunkList += "Enter the number of the SIP trunk for destination route:";
			
			bot.sendMessage(chatId, trunkList, { parse_mode: "Markdown" });
			userStates[userId] = { 
			  action: "dest_route_waiting_trunk", 
			  sipTrunks: sipTrunks,
			  campaignId: userCampaignSipRoute.id 
			};
			
		  } catch (error) {
			console.error('Error in dest_route_sip:', error);
			bot.sendMessage(chatId, `❌ Error: ${error.message}`);
		  }
		  break;

		

		case "dest_route_agent":
		  // Show agent selection for destination route - UPDATED to use user's agents
		  try {
			const userAssociatedAgents = await getUserAssociatedAgents(userId);
			
			if (userAssociatedAgents.length === 0) {
			  bot.sendMessage(
				chatId,
				`👤 *No Associated Agents*\n\nYou don't have any agents associated with your account.\n\nPlease contact the administrator to assign agents to your account.`,
				{ 
				  parse_mode: "Markdown",
				  reply_markup: {
					inline_keyboard: [
					  [{ text: "🔙 Back to Menu", callback_data: "back_to_menu" }]
					]
				  }
				}
			  );
			  return;
			}
			
			// Get user's current campaign
			let userCampaignAgentRoute = await Campaign.findOne({
			  where: { createdBy: user.telegramId }
			});
			
			if (!userCampaignAgentRoute) {
			  userCampaignAgentRoute = await Campaign.create({
				botToken: config.telegram_bot_token,
				campaignName: `${user.firstName || user.username || 'User'}'s Campaign`,
				createdBy: user.telegramId,
				concurrentCalls: 30,
				notificationsChatId: chatId,
				isActive: true
			  });
			}
			
			let agentList = "👤 *Select Your Associated Agent*\n\n";
			
			// Check if current destination route is an agent and highlight it
			let currentAgentName = null;
			if (userCampaignAgentRoute.destinationRoute && userCampaignAgentRoute.destinationRoute.startsWith('agent/')) {
			  currentAgentName = userCampaignAgentRoute.destinationRoute.replace('agent/', '');
			  agentList += `📍 *Current Route:* ${escapeMarkdown(userCampaignAgentRoute.destinationRoute)}\n\n`;
			}
			
			agentList += "*Your Associated Agents:*\n\n";
			
			userAssociatedAgents.forEach((agent, index) => {
			  const isSelected = currentAgentName === agent.name ? " ✅" : "";
			  agentList += `${index + 1}. *${escapeMarkdown(agent.name)}*${isSelected}\n`;
			  agentList += `   📞 Extension: ${escapeMarkdown(agent.defaultuser || agent.username || 'N/A')}\n`;
			  agentList += `   🏷️ Category: ${escapeMarkdown(agent.category || 'Agent')}\n`;
			  if (agent.description) {
				agentList += `   📝 ${escapeMarkdown(agent.description)}\n`;
			  }
			  agentList += `   🔌 Status: ${agent.status ? '✅ Active' : '❌ Inactive'}\n\n`;
			});
			
			agentList += "Enter the number of the agent you want to use for destination route:";
			
			bot.sendMessage(chatId, agentList, { parse_mode: "Markdown" });
			userStates[userId] = { 
			  action: "dest_route_waiting_agent", 
			  agents: userAssociatedAgents,
			  campaignId: userCampaignAgentRoute.id 
			};
			
		  } catch (error) {
			console.error('Error in dest_route_agent:', error);
			bot.sendMessage(chatId, `❌ Error: ${error.message}`);
		  }
		  break;
		
		case "dest_route_clear":
		  // Clear the destination route
		  try {
			let userCampaignClear = await Campaign.findOne({
			  where: { createdBy: user.telegramId }
			});
			
			if (userCampaignClear) {
			  await userCampaignClear.update({ destinationRoute: null });
			}
			
			// Also clear from user
			await user.update({ destinationRoute: null });
			
			bot.sendMessage(
			  chatId,
			  `✅ *Destination Route Cleared*\n\nThe destination route has been removed from your campaign settings.`,
			  { parse_mode: "Markdown", ...getUserMenu(user) }
			);
			
		  } catch (error) {
			console.error('Error clearing destination route:', error);
			bot.sendMessage(chatId, `❌ Error: ${error.message}`);
		  }
		  break;
	  case "user_set_caller_id":
		  // Check user permissions
		  const isApprovedUserCallerId = user.approvalStatus === 'approved' && user.campaignSettingsComplete;
		  const isAdminUserCallerId = userId == adminId || user.userType === 'admin';
		  
		  if (!isAdminUserCallerId && !isApprovedUserCallerId) {
			bot.sendMessage(chatId, 
			  "❌ *Access Denied*\n\nYou need to be approved and have complete campaign settings to modify caller ID.",
			  { parse_mode: "Markdown" }
			);
			return;
		  }
		  
		  // Get user's campaign
		  let userCampaign = await Campaign.findOne({
			where: { createdBy: user.telegramId }
		  });
		  
		  if (!userCampaign) {
			// Create campaign if it doesn't exist
			userCampaign = await Campaign.create({
			  botToken: config.telegram_bot_token,
			  campaignName: `${user.firstName || user.username || 'User'}'s Campaign`,
			  createdBy: user.telegramId,
			  concurrentCalls: 30,
			  notificationsChatId: chatId,
			  isActive: true
			});
		  }
		  
		  const currentCallerId = userCampaign.callerId || 'Not set';
		  bot.sendMessage(
			chatId,
			`📞 *Set Your Caller ID*\n\n` +
			`Current Caller ID: ${escapeMarkdown(currentCallerId)}\n\n` +
			`Please enter the phone number to use as your Caller ID.\n` +
			`This number will be displayed to recipients when making calls.\n\n` +
			`Formats accepted:\n` +
			`• 1234567890\n` +
			`• 11234567890\n` +
			`• +11234567890\n` +
			`• (123) 456-7890`,
			{ parse_mode: "Markdown" }
		  );
		  userStates[userId] = { 
			action: "user_waiting_caller_id", 
			campaignId: userCampaign.id 
		  };
		  break;

		case "user_set_dial_prefix":
		  // Check user permissions
		  const isApprovedUserPrefix = user.approvalStatus === 'approved' && user.campaignSettingsComplete;
		  const isAdminUserPrefix = userId == adminId || user.userType === 'admin';
		  
		  if (!isAdminUserPrefix && !isApprovedUserPrefix) {
			bot.sendMessage(chatId, 
			  "❌ *Access Denied*\n\nYou need to be approved and have complete campaign settings to modify dial prefix.",
			  { parse_mode: "Markdown" }
			);
			return;
		  }
		  
		  // Get user's campaign
		  let userCampaignPrefix = await Campaign.findOne({
			where: { createdBy: user.telegramId }
		  });
		  
		  if (!userCampaignPrefix) {
			// Create campaign if it doesn't exist
			userCampaignPrefix = await Campaign.create({
			  botToken: config.telegram_bot_token,
			  campaignName: `${user.firstName || user.username || 'User'}'s Campaign`,
			  createdBy: user.telegramId,
			  concurrentCalls: 30,
			  notificationsChatId: chatId,
			  isActive: true
			});
		  }
		  
		  const currentPrefix = userCampaignPrefix.dialPrefix || 'None';
		  bot.sendMessage(
			chatId,
			`➕ *Set Your Dial Prefix*\n\n` +
			`Current Dial Prefix: ${escapeMarkdown(currentPrefix)}\n\n` +
			`Enter the prefix to add before all dialed numbers.\n\n` +
			`Examples:\n` +
			`• 9 (for outbound access)\n` +
			`• 011 (for international calls)\n` +
			`• 1 (for long distance)\n` +
			`• Type "none" to remove prefix\n\n` +
			`The prefix will be added to all numbers when dialing.`,
			{ parse_mode: "Markdown" }
		  );
		  userStates[userId] = { 
			action: "user_waiting_dial_prefix", 
			campaignId: userCampaignPrefix.id 
		  };
		  break;
	  case "manual_dial":
		  // Check user permissions - only allow approved users or legacy permitted users
		  const isApprovedUserManual = user.approvalStatus === 'approved' && user.campaignSettingsComplete;
		  const isAdminUserManual = userId == adminId || user.userType === 'admin';
		  
		  // Check if user is in the Allowed table (legacy permission system)
		  let permittedUserManual = await Allowed.findOne({ 
			where: { telegramId: userId } 
		  });
		  
		  console.log(`Request from User ${userId} for manual_dial`);
		  console.log(`User approval status: ${user.approvalStatus}, Campaign complete: ${user.campaignSettingsComplete}`);
		  console.log(`Is admin: ${isAdminUserManual}, Is permitted (legacy): ${!!permittedUserManual}, Is approved user: ${isApprovedUserManual}`);
		  
		  // Allow access if user is admin OR approved with complete settings OR in legacy allowed list
		  if (!isAdminUserManual && !isApprovedUserManual && !permittedUserManual) {
			console.log("❌ Access denied for manual_dial!");
			bot.sendMessage(chatId, 
			  "❌ *Access Denied*\n\nYou need to be approved and have complete campaign settings to use manual dial.",
			  { parse_mode: "Markdown" }
			);
			return;
		  }
		  
		  const campaignManual = await getOrCreateCampaign(userId);
		  
		  if (!campaignManual.notificationsChatId) {
			await campaignManual.update({ notificationsChatId: chatId });
			// Reload the campaign to get updated data
			await campaignManual.reload({
			  include: [{ model: SipPeer, as: 'sipTrunk' }]
			});
		  }
		  
		  // Check if user has required campaign settings
		  if (!campaignManual.sipTrunkId || !campaignManual.callerId) {
			const missingSettings = [];
			if (!campaignManual.sipTrunkId) missingSettings.push("SIP Trunk");
			if (!campaignManual.callerId) missingSettings.push("Caller ID");
			
			bot.sendMessage(
			  chatId,
			  `❌ *Manual Dial Unavailable*\n\n` +
			  `Missing required settings:\n` +
			  `${missingSettings.map(s => `• ${s}`).join('\n')}\n\n` +
			  `Please configure these settings first.`,
			  { parse_mode: "Markdown" }
			);
			return;
		  }
		  
		  if (campaignManual.destinationRoute) {
			if (campaignManual.destinationRoute.startsWith('agent/')) {
			  const hasAgents = await userHasAssociatedAgents(userId);
			  if (!hasAgents) {
				bot.sendMessage(
				  chatId,
				  `❌ *Manual Dial Unavailable*\n\n` +
				  `Your destination is set to an agent, but you have no associated agents.\n\n` +
				  `Please contact the administrator to assign agents to your account or change your destination route.`,
				  { parse_mode: "Markdown" }
				);
				return;
			  }
			}
		  }
		  
		  // Show current destination route in the dial info
		  let destinationInfo = '';
		  if (campaignManual.destinationRoute) {
			destinationInfo = `\nDestination Route: ${escapeMarkdown(campaignManual.destinationRoute)}`;
		  }
		  
		  bot.sendMessage(
			chatId,
			`📞 *Manual Dial*\n\n` +
			`SIP Trunk: ${escapeMarkdown(campaignManual.sipTrunk ? campaignManual.sipTrunk.name : 'N/A')}\n` +
			`Caller ID: ${escapeMarkdown(campaignManual.callerId)}\n` +
			`Dial Prefix: ${escapeMarkdown(campaignManual.dialPrefix || 'None')}${destinationInfo}\n\n` +
			`Enter the phone number to dial:\n\n` +
			`Formats accepted:\n` +
			`• 1234567890\n` +
			`• +1234567890\n` +
			`• 011234567890\n` +
			`• (123) 456-7890`,
			{ parse_mode: "Markdown" }
		  );
		  userStates[userId] = { 
			action: "waiting_manual_dial_number", 
			campaignId: campaignManual.id 
		  };
		  break;
  
      case "check_balance":
        if (!user.rateCardId) {
          bot.sendMessage(chatId, "💳 No rate card assigned. Contact administrator.");
          return;
        }
        
        try {
          const financial = await billingEngine.getUserFinancialSummary(user.id);
          
          bot.sendMessage(
            chatId,
            `💰 *Account Balance*\n\n` +
            `Current Balance: $${financial.summary.currentBalance.toFixed(2)}\n` +
            `Credit Limit: $${financial.summary.creditLimit.toFixed(2)}\n` +
            `Available Balance: $${financial.summary.availableBalance.toFixed(2)}\n\n` +
            `📊 *Usage Summary*\n` +
            `Total Calls: ${financial.summary.totalCalls}\n` +
            `Answered Calls: ${financial.summary.answeredCalls}\n` +
            `Total Minutes: ${financial.summary.totalMinutes.toFixed(2)}\n` +
            `Total Spent: $${financial.summary.totalSpent.toFixed(2)}`,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        }
        break;
      
      case "my_stats":
        if (!user.rateCardId) {
          // Fall back to legacy stats
          const currentCampaign = await getOrCreateCampaign(userId);
          const stats = await getCallStats(currentCampaign.id);
          bot.sendMessage(
            chatId,
            `📊 *Your Statistics*\n\n` +
            `Total Calls: ${stats.total}\n` +
            `Successful: ${stats.successful}\n` +
            `Failed: ${stats.failed}\n` +
            `DTMF Responses: ${stats.dtmf_responses}\n` +
            `Success Rate: ${stats.success_rate}%`,
            { parse_mode: 'Markdown' }
          );
          return;
        }
        
        try {
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          
          const [monthlyData, allTimeData] = await Promise.all([
            billingEngine.getUserFinancialSummary(user.id, startOfMonth),
            billingEngine.getUserFinancialSummary(user.id)
          ]);
          
          bot.sendMessage(
            chatId,
            `📊 *Your Statistics*\n\n` +
            `💰 *Account Status*\n` +
            `Balance: $${allTimeData.summary.currentBalance.toFixed(2)}\n` +
            `Available: $${allTimeData.summary.availableBalance.toFixed(2)}\n\n` +
            `📅 *This Month*\n` +
            `Calls Made: ${monthlyData.summary.totalCalls}\n` +
            `Answered: ${monthlyData.summary.answeredCalls}\n` +
            `Minutes: ${monthlyData.summary.totalMinutes.toFixed(2)}\n` +
            `Spent: $${monthlyData.summary.totalSpent.toFixed(2)}\n\n` +
            `📈 *All Time*\n` +
            `Total Calls: ${allTimeData.summary.totalCalls}\n` +
            `Total Minutes: ${allTimeData.summary.totalMinutes.toFixed(2)}\n` +
            `Total Spent: $${allTimeData.summary.totalSpent.toFixed(2)}`,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        }
        break;

      case "recent_calls":
        if (!user.rateCardId) {
          bot.sendMessage(chatId, "💳 No rate card assigned. Contact administrator.");
          return;
        }
        
        try {
          const data = await billingEngine.getUserFinancialSummary(user.id);
          
          if (data.recentCalls.length === 0) {
            bot.sendMessage(chatId, "📋 *No Recent Calls*\n\nYou haven't made any calls yet.", { parse_mode: 'Markdown' });
            return;
          }
          
          let message = "📋 *Recent Calls*\n\n";
          
          data.recentCalls.slice(0, 10).forEach((call, index) => {
            const status = call.callStatus === 'answered' ? '✅' : '❌';
            const duration = call.callStatus === 'answered' ? `${Math.round(call.billableDuration/60)}min` : 'N/A';
            const cost = call.totalCharge > 0 ? `$${call.totalCharge.toFixed(4)}` : 'Free';
            
            message += `${index + 1}. ${status} ${escapeMarkdown(call.phoneNumber)}\n`;
            message += `   Duration: ${duration} | Cost: ${cost}\n`;
            message += `   ${call.createdAt.toLocaleDateString()} ${call.createdAt.toLocaleTimeString()}\n\n`;
          });
          
          bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (error) {
          bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        }
        break;

      case "my_rates":
        if (!user.rateCardId) {
          bot.sendMessage(
            chatId, 
            "💳 *No Rate Card Assigned*\n\nYou don't have a rate card assigned. Please contact the administrator.",
            { parse_mode: 'Markdown' }
          );
          return;
        }
        
        try {
          const rateCard = await RateCard.findByPk(user.rateCardId, {
            include: [
              { 
                model: Provider, 
                as: 'provider' 
              }
            ]
          });
          
          bot.sendMessage(
            chatId,
            `💳 *Your Rate Card*\n\n` +
            `Name: ${escapeMarkdown(rateCard.name)}\n` +
            `Provider: ${escapeMarkdown(rateCard.provider.name)}\n` +
            `Currency: ${rateCard.currency}\n\n` +
            `To see specific rates for destinations, use /estimate command.`,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        }
        break;

      case "estimate_cost":
        if (!user.rateCardId) {
          bot.sendMessage(chatId, "💳 No rate card assigned. Contact administrator.");
          return;
        }
        
        bot.sendMessage(
          chatId,
          "💱 *Estimate Call Cost*\n\nSend a phone number to get rate information.\nExample: +1234567890",
          { parse_mode: "Markdown" }
        );
        userStates[userId] = { action: "waiting_estimate_number" };
        break;

      // Admin callbacks
      case "admin_add_credit":
		  if (user.userType !== 'admin') {
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  try {
			const users = await User.findAll({
			  where: { status: 'active' },
			  order: [['createdAt', 'DESC']],
			  limit: 20
			});
			
			if (users.length === 0) {
			  bot.sendMessage(chatId, "❌ No users found in the system.");
			  return;
			}
			
			let message = "💰 *Add Credit - Select User*\n\n";
			
			const userButtons = users.map((u, index) => [{
			  text: `${u.firstName || u.username || 'User'} (${u.telegramId}) - $${u.balance}`,
			  callback_data: `admin_add_credit_${u.id}`
			}]);
			
			userButtons.push([{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]);
			
			bot.sendMessage(
			  chatId,
			  message,
			  {
				parse_mode: 'Markdown',
				reply_markup: {
				  inline_keyboard: userButtons
				}
			  }
			);
		  } catch (error) {
			bot.sendMessage(chatId, `❌ Error: ${error.message}`);
		  }
		  break;

      case "admin_users":
		  if (user.userType !== 'admin') {
			bot.sendMessage(chatId, "❌ Admin access required!");
			return;
		  }
		  
		  try {
			const users = await User.findAll({
			  include: [{ 
				model: RateCard, 
				as: 'rateCard',
				include: [{ model: Provider, as: 'provider' }]
			  }],
			  order: [['createdAt', 'DESC']],
			  limit: 20
			});
			
			if (users.length === 0) {
			  bot.sendMessage(chatId, "❌ No users found in the system.");
			  return;
			}
			
			let message = "👥 *User Management*\n\nSelect a user to manage:\n\n";
			
			const userButtons = users.map((u, index) => {
			  const status = u.status === 'active' ? '✅' : '❌';
			  const type = u.userType === 'admin' ? '👑 Administrator' : '👤';
			  const rateCardName = u.rateCard ? u.rateCard.name : 'No Rate Card';
			  
			  return [{
				text: `${type} ${status} ${u.telegramId} - ${rateCardName}`,
				callback_data: `admin_manage_user_${u.id}`
			  }];
			});
			
			userButtons.push([
			  { text: '➕ Add New User', callback_data: 'admin_add_user' },
			  { text: '🏠 Main Menu', callback_data: 'back_to_menu' }
			]);
			
			bot.sendMessage(
			  chatId,
			  message,
			  {
				parse_mode: 'Markdown',
				reply_markup: {
				  inline_keyboard: userButtons
				}
			  }
			);
		  } catch (error) {
			console.error('Error in admin_users:', error);
			bot.sendMessage(chatId, `❌ Error: ${error.message}`);
		  }
		  break;

      case "admin_system_stats":
        if (user.userType !== 'admin') {
          bot.sendMessage(chatId, "❌ Admin access required!");
          return;
        }
        
        try {
          const [totalUsers, activeUsers, totalCalls, totalRevenue] = await Promise.all([
            User.count(),
            User.count({ where: { status: 'active' } }),
            CallDetail.count(),
            Transaction.sum('amount', { where: { transactionType: 'debit' } })
          ]);
          
          bot.sendMessage(
            chatId,
            `📊 *System Statistics*\n\n` +
            `👥 Total Users: ${totalUsers}\n` +
            `✅ Active Users: ${activeUsers}\n` +
            `📞 Total Calls: ${totalCalls || 0}\n` +
            `💰 Total Revenue: $${(totalRevenue || 0).toFixed(2)}`,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        }
        break;

	  case "admin_rates":
        if (user.userType !== 'admin') {
          bot.sendMessage(chatId, "❌ Admin access required!");
          return;
        }
        
        try {
          const rateCards = await RateCard.findAll({
            include: [
              { model: Provider, as: 'provider' },
              { model: Rate, as: 'rates' }
            ],
            order: [['createdAt', 'DESC']],
            limit: 10
          });
          
          if (rateCards.length === 0) {
            bot.sendMessage(
              chatId,
              "💳 *No Rate Cards Found*\n\nThere are no rate cards in the system yet. Create one first.",
              {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '🏗️ Create Rate Card', callback_data: 'admin_create_rate' }],
                    [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
                  ]
                }
              }
            );
            return;
          }
          
          let message = "💳 *Rate Card Management*\n\n";
          
          rateCards.forEach((rc, index) => {
            const rateCount = rc.rates ? rc.rates.length : 0;
            const status = rc.status === 'active' ? '✅' : '❌';
            
            message += `${index + 1}. ${status} ${escapeMarkdown(rc.name)}\n`;
            message += `   Provider: ${escapeMarkdown(rc.provider.name)}\n`;
            message += `   Rates: ${rateCount} destinations\n`;
            message += `   ID: ${rc.id}\n\n`;
          });
          
          bot.sendMessage(
            chatId,
            message,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🏗️ Create Rate Card', callback_data: 'admin_create_rate' }],
                  [{ text: '📋 Bulk Upload Rates', callback_data: 'admin_bulk_upload' }],
                  [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
                ]
              }
            }
          );
        } catch (error) {
          console.error('Error fetching rate cards:', error);
          bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        }
        break;

      case "admin_create_rate":
        if (user.userType !== 'admin') {
          bot.sendMessage(chatId, "❌ Admin access required!");
          return;
        }
        
        try {
          const providers = await Provider.findAll({
            where: { status: 'active' },
            order: [['name', 'ASC']]
          });
          
          if (providers.length === 0) {
            bot.sendMessage(
              chatId,
              "🏢 *No Providers Found*\n\nYou need to create a provider first before creating rate cards.",
              {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '🏢 Create Provider', callback_data: 'admin_create_provider' }],
                    [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
                  ]
                }
              }
            );
            return;
          }
          
          let message = "🏗️ *Create Rate Card*\n\nSelect a provider:\n\n";
          
          const providerButtons = providers.map(provider => [{
            text: `${provider.name} (${provider.currency})`,
            callback_data: `admin_create_rate_${provider.id}`
          }]);
          
          providerButtons.push([{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]);
          
          bot.sendMessage(
            chatId,
            message,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: providerButtons
              }
            }
          );
        } catch (error) {
          console.error('Error fetching providers:', error);
          bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        }
        break;

      case "admin_bulk_upload":
        if (user.userType !== 'admin') {
          bot.sendMessage(chatId, "❌ Admin access required!");
          return;
        }
        
        try {
          const rateCards = await RateCard.findAll({
            where: { status: 'active' },
            include: [{ model: Provider, as: 'provider' }],
            order: [['name', 'ASC']]
          });
          
          if (rateCards.length === 0) {
            bot.sendMessage(
              chatId,
              "💳 *No Rate Cards Found*\n\nCreate a rate card first before uploading rates.",
              {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '🏗️ Create Rate Card', callback_data: 'admin_create_rate' }],
                    [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
                  ]
                }
              }
            );
            return;
          }
          
          let message = "📋 *Bulk Upload Rates*\n\nSelect a rate card to upload rates to:\n\n";
          
          const rateCardButtons = rateCards.map(rc => [{
            text: `${rc.name} (${rc.provider.name})`,
            callback_data: `admin_upload_rates_${rc.id}`
          }]);
          
          rateCardButtons.push([{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]);
          
          bot.sendMessage(
            chatId,
            message,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: rateCardButtons
              }
            }
          );
        } catch (error) {
          console.error('Error fetching rate cards:', error);
          bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        }
        break;

      case "admin_create_provider":
        if (user.userType !== 'admin') {
          bot.sendMessage(chatId, "❌ Admin access required!");
          return;
        }
        
        bot.sendMessage(
          chatId,
          "🏢 *Create Provider*\n\nEnter provider details in this format:\n\n" +
          "`Name | Description | Currency | Billing Increment | Minimum Duration`\n\n" +
          "Example:\n" +
          "`Global Telecom | Premium wholesale provider | USD | 60 | 60`\n\n" +
          "Note: Billing Increment and Minimum Duration are in seconds.",
          { parse_mode: 'Markdown' }
        );
        
        userStates[userId] = { action: 'admin_creating_provider' };
        break;

      case "admin_providers":
        if (user.userType !== 'admin') {
          bot.sendMessage(chatId, "❌ Admin access required!");
          return;
        }
        
        try {
          const providers = await Provider.findAll({
            order: [['createdAt', 'DESC']],
            limit: 10
          });
          
          if (providers.length === 0) {
            bot.sendMessage(
              chatId,
              "🏢 *No Providers Found*\n\nThere are no providers in the system yet. Create one first.",
              {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '🏢 Create Provider', callback_data: 'admin_create_provider' }],
                    [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
                  ]
                }
              }
            );
            return;
          }
          
          let message = "🏢 *Provider Management*\n\n";
          
          providers.forEach((provider, index) => {
            const status = provider.status === 'active' ? '✅' : '❌';
            
            message += `${index + 1}. ${status} ${escapeMarkdown(provider.name)}\n`;
            message += `   Currency: ${provider.currency}\n`;
            message += `   Billing: ${provider.billingIncrement}s increments\n`;
            message += `   Min Duration: ${provider.minimumDuration}s\n`;
            message += `   ID: ${provider.id}\n\n`;
          });
          
          bot.sendMessage(
            chatId,
            message,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🏢 Create Provider', callback_data: 'admin_create_provider' }],
                  [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
                ]
              }
            }
          );
        } catch (error) {
          console.error('Error fetching providers:', error);
          bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        }
        break;

      // Legacy callbacks (preserved)
      case "set_callback_trunk":
        let permittedUserCallback = await Allowed.findOne({ 
          where: { telegramId: userId } 
        });
        console.log(`Request from User ${userId} for set_callback_trunk`)
        if(userId == adminId){
          permittedUserCallback = true;
        }
        if (!permittedUserCallback && user.userType !== 'admin') {
          console.log("❌ Admin access required to set_callback_trunk!", userId);
          bot.sendMessage(chatId, "❌ Admin access required!");
          return;
        }
        
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
            trunkList += `${index + 1}. *${escapeMarkdown(trunk.name)}*\n`;
            trunkList += `   📍 Host: ${escapeMarkdown(trunk.host)}\n`;
            trunkList += `   👤 Username: ${escapeMarkdown(trunk.username || trunk.defaultuser || 'N/A')}\n`;
            trunkList += `   🔌 Status: ${trunk.status ? '✅ Active' : '❌ Inactive'}\n\n`;
          });
          trunkList += "Enter the number of the callback trunk you want to use:";
          
          const campaignCallback = await getOrCreateCampaign(userId);
          bot.sendMessage(chatId, trunkList, { parse_mode: "Markdown" });
          userStates[userId] = { 
            action: "waiting_callback_trunk_selection", 
            sipTrunks: callbackTrunks,
            campaignId: campaignCallback.id 
          };
        }
        break;

      case "initiate_callback":
        const campaignCheck = await getOrCreateCampaign(userId);
        
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
        if (!permittedUserCallbackNum && user.userType !== 'admin') {
          console.log("❌ Admin access required to set_callback_number!", userId);
          bot.sendMessage(chatId, "❌ Admin access required!");
          return;
        }
        
        const campaignForCallbackNum = await getOrCreateCampaign(userId);
        
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
        const campaignSingle = await getOrCreateCampaign(userId);
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
        const campaignList = await getOrCreateCampaign(userId);
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
        if (!permittedUserPrefix && user.userType !== 'admin') {
          console.log("❌ Admin access required to set_dial_prefix!", userId);
          bot.sendMessage(chatId, "❌ Admin access required!");
          return;
        }
        
        const campaignForPrefix = await getOrCreateCampaign(userId);
        const currentPrefix1 = campaignForPrefix.dialPrefix || 'None';
        bot.sendMessage(
          chatId,
          `➕ *Set Dial Prefix*\n\n` +
          `Current Dial Prefix: ${currentPrefix1}\n\n` +
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
        if (!permittedUserPrefix1 && user.userType !== 'admin') {
          console.log("❌ Admin access required to set_dial_prefix!", userId);
          bot.sendMessage(chatId, "❌ Admin access required!");
          return;
        }
        
        const campaignPrefix = await getOrCreateCampaign(userId);
        await campaignPrefix.update({ dialPrefix: '' });
        
        bot.sendMessage(
          chatId,
          `✅ *Dial Prefix Removed Successfully!*\n\n`,
          { parse_mode: "Markdown", ...getUserMenu(user) }
        );
        delete userStates[userId];
        break;
        
      case "start_campaign":
		  // Check if user can create campaigns
		  if (!user.canCreateCampaign()) {
			bot.sendMessage(chatId, 
			  "❌ *Cannot Start Campaign*\n\n" +
			  "Your account setup is incomplete. Please contact the administrator to complete your configuration.\n\n" +
			  `Status: ${user.approvalStatus}\n` +
			  `Settings Complete: ${user.campaignSettingsComplete ? 'Yes' : 'No'}`,
			  { parse_mode: 'Markdown' }
			);
			return;
		  }

		  // Get or create campaign with user's settings
		  let campaign = await Campaign.findOne({
			where: { createdBy: user.telegramId },
			include: [
			  { model: SipPeer, as: 'sipTrunk' },
			  { model: SipPeer, as: 'callbackTrunk' }
			]
		  });

		  if (campaign) {
			// Update existing campaign with user's current settings
			if (user.callerId && !campaign.callerId) {
			  await campaign.update({ callerId: user.callerId });
			}
			if (user.dialPrefix !== undefined && user.dialPrefix !== null && !campaign.dialPrefix) {
			  await campaign.update({ dialPrefix: user.dialPrefix });
			}
			
			if (user.destinationRoute && !campaignForManualDial.destinationRoute) {
			  await campaignForManualDial.update({ destinationRoute: user.destinationRoute });
			}

			// In start campaign case, add after campaign sync:
			if (user.destinationRoute && !campaign.destinationRoute) {
			  await campaign.update({ destinationRoute: user.destinationRoute });
			}

			await campaign.update({
			  sipTrunkId: user.sipTrunkId,
			  callbackTrunkId: user.callbackTrunkId,
			  callerId: user.callerId,
			  dialPrefix: user.dialPrefix,
			  concurrentCalls: user.concurrentCalls,
			  notificationsChatId: chatId
			});
			
			// Reload with associations
			campaign = await Campaign.findByPk(campaign.id, {
			  include: [
				{ model: SipPeer, as: 'sipTrunk' },
				{ model: SipPeer, as: 'callbackTrunk' }
			  ]
			});
		  } else {
			// Create new campaign with user's settings
			campaign = await Campaign.create({
			  botToken: config.telegram_bot_token,
			  campaignName: `${user.firstName || user.username || 'User'}'s Campaign`,
			  createdBy: user.telegramId,
			  sipTrunkId: user.sipTrunkId,
			  callbackTrunkId: user.callbackTrunkId,
			  callerId: user.callerId,
			  dialPrefix: user.dialPrefix,
			  concurrentCalls: user.concurrentCalls,
			  notificationsChatId: chatId,
			  isActive: true
			});
			
			// Reload with associations
			campaign = await Campaign.findByPk(campaign.id, {
			  include: [
				{ model: SipPeer, as: 'sipTrunk' },
				{ model: SipPeer, as: 'callbackTrunk' }
			  ]
			});
		  }

		  // Check if campaign has numbers
		  const callCount = await Call.count({
			where: { 
			  campaignId: campaign.id,
			  used: false 
			}
		  });

		  if (callCount === 0) {
			bot.sendMessage(
			  chatId,
			  `📋 *Campaign Ready*\n\n` +
			  `Campaign: ${escapeMarkdown(campaign.campaignName)}\n` +
			  `SIP Trunk: ${escapeMarkdown(campaign.sipTrunk ? campaign.sipTrunk.name : 'N/A')}\n` +
			  `Caller ID: ${escapeMarkdown(campaign.callerId)}\n` +
			  `Concurrent Calls: ${campaign.concurrentCalls}\n` +
			  `Dial Prefix: ${escapeMarkdown(campaign.dialPrefix || 'None')}\n\n` +
			  `❌ *No leads found!*\n\n` +
			  `Please upload leads first using "📁 Upload Leads".`,
			  { 
				parse_mode: 'Markdown',
				reply_markup: {
				  inline_keyboard: [
					[{ text: '📁 Upload Leads', callback_data: 'upload_leads' }],
					[{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
				  ]
				}
			  }
			);
			return;
		  }

		  // Start campaign with user's settings
		  const unprocessedCalls = await Call.findAll({
			where: { 
			  campaignId: campaign.id,
			  used: false 
			}
		  });

		  const unprocessedData = unprocessedCalls.map(call => ({
			phoneNumber: call.phoneNumber.replace('+', ''),
			rawLine: call.rawLine
		  }));

		  bot.sendMessage(
			chatId,
			`🚀 *Campaign Starting*\n\n` +
			`Campaign: ${escapeMarkdown(campaign.campaignName)}\n` +
			`Numbers to dial: ${unprocessedData.length}\n` +
			`SIP Trunk: ${escapeMarkdown(campaign.sipTrunk ? campaign.sipTrunk.name : 'N/A')}\n` +
			`Caller ID: ${escapeMarkdown(campaign.callerId)}\n` +
			`Concurrent Calls: ${campaign.concurrentCalls}\n` +
			`Dial Prefix: ${escapeMarkdown(campaign.dialPrefix || 'None')}\n\n` +
			`Dialing will begin automatically...`,
			{ parse_mode: "Markdown" }
		  );

		  // Set campaign settings from user configuration
		  set_settings({
			notifications_chat_id: chatId,
			concurrent_calls: campaign.concurrentCalls,
			sip_trunk: campaign.sipTrunk,
			caller_id: campaign.callerId,
			dial_prefix: campaign.dialPrefix || '',
			campaign_id: campaign.id,
			dtmf_digit: campaign.dtmfDigit || '1',
			ivr_intro_file: campaign.ivrIntroFile,
			ivr_outro_file: campaign.ivrOutroFile
		  });

		  // Start the calling process
		  startCallingProcess(unprocessedData, campaign, user.telegramId);
		  break;

      case "set_dtmf":
		  // Updated permission check: Allow approved users with complete campaign settings
		  const isApprovedUserDtmf = user.approvalStatus === 'approved' && user.campaignSettingsComplete;
		  const isAdminUserDtmf = userId == adminId || user.userType === 'admin';
		  
		  // Check if user is in the Allowed table (legacy permission system)
		  let permittedUserDtmf = await Allowed.findOne({ 
			  where: { telegramId: userId } 
		  });
		  
		  console.log(`Request from User ${userId} for set_dtmf`);
		  console.log(`User approval status: ${user.approvalStatus}, Campaign complete: ${user.campaignSettingsComplete}`);
		  console.log(`Is admin: ${isAdminUserDtmf}, Is permitted (legacy): ${!!permittedUserDtmf}, Is approved user: ${isApprovedUserDtmf}`);
		  
		  // Allow access if user is admin OR approved with complete settings OR in legacy allowed list
		  if (!isAdminUserDtmf && !isApprovedUserDtmf && !permittedUserDtmf) {
			console.log("❌ Access denied for set_dtmf!", userId);
			bot.sendMessage(chatId, 
			  "❌ *Access Required*\n\n" +
			  "DTMF setup requires:\n" +
			  "• Account approval\n" +
			  "• Complete campaign setup\n\n" +
			  "Please contact the administrator if you believe this is an error.",
			  { parse_mode: "Markdown" }
			);
			return;
		  }
		  
		  const campaignForDtmf = await getOrCreateCampaign(userId);
		  bot.sendMessage(
			chatId,
			`🔢 *Set DTMF Digit*\n\n` +
			`Current DTMF digit: ${campaignForDtmf.dtmfDigit || '1'}\n\n` +
			`Please enter the DTMF digit (0-9) to track for responses.\n\n` +
			`This digit will be detected when callers press it during the call.`,
			{ parse_mode: "Markdown" }
		  );
		  userStates[userId] = { action: "waiting_dtmf_digit", campaignId: campaignForDtmf.id };
		  break;

      case "call_status":
        const currentCampaign = await getOrCreateCampaign(userId);
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
        const checkCampaign = await getOrCreateCampaign(userId);
        const isConfigured = checkCampaign.sipTrunkId && checkCampaign.callerId;
        
        let leadsMessage = `📁 *Upload Leads File*\n\n` +
          `Please send a TXT file with phone numbers (one per line).\n\n`;
          
        if (user.rateCardId) {
          leadsMessage += `💰 Your balance: $${user.balance}\n`;
          if (isConfigured) {
            leadsMessage += `✅ Campaign is configured and will auto-start after upload.`;
          } else {
            leadsMessage += `⚠️ Campaign configuration incomplete.`;
          }
        } else {
          if (isConfigured) {
            leadsMessage += `✅ Campaign is configured and will auto-start after upload.\n` +
              `• SIP Trunk: ${checkCampaign.sipTrunkId ? 'Set' : 'Not set'}\n` +
              `• Caller ID: ${checkCampaign.callerId ? escapeMarkdown(checkCampaign.callerId) : 'Not set'}`;
          } else {
            leadsMessage += `⚠️ Campaign is NOT fully configured.\n` +
              `Missing: ${!checkCampaign.sipTrunkId ? 'SIP Trunk' : ''} ${!checkCampaign.callerId ? 'Caller ID' : ''}\n` +
              `Leads will be saved but dialing won't start automatically.`;
          }
        }
        
        bot.sendMessage(
          chatId,
          leadsMessage,
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
        if (!permittedUser && user.userType !== 'admin') {
          console.log("❌ Admin access required to set_caller_id!", userId);
          bot.sendMessage(chatId, "❌ Admin access required!");
          return;
        }
        
        const campaignForCallerId = await getOrCreateCampaign(userId);
        const currentCallerId1 = campaignForCallerId.callerId || 'Not set';
        bot.sendMessage(
          chatId,
          `📞 *Set Caller ID*\n\n` +
          `Current Caller ID: ${escapeMarkdown(currentCallerId1)}\n\n` +
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
        if (!permittedUser2 && user.userType !== 'admin') {
          console.log("❌ Admin access required to set_concurrent!", userId);
          bot.sendMessage(chatId, "❌ Admin access required!");
          return;
        }
        const campaign2 = await getOrCreateCampaign(userId);
        bot.sendMessage(
          chatId,
          `⚙️ *Set Concurrent Calls*\n\nCurrent: ${campaign2.concurrentCalls || 30}\nPlease enter the new number of concurrent calls (1-100):`,
          { parse_mode: "Markdown" }
        );
        userStates[userId] = { action: "waiting_concurrent_number", campaignId: campaign2.id };
        break;

      case "upload_ivr":
        const isApprovedUser = user.approvalStatus === 'approved' && user.campaignSettingsComplete;
		const isAdminUser = userId == adminId || user.userType === 'admin';
  
		let permittedUser3 = await Allowed.findOne({ 
            where: { telegramId: userId } 
        });
        
		console.log(`Request from User ${userId} for upload_ivr`);
		console.log(`User approval status: ${user.approvalStatus}, Campaign complete: ${user.campaignSettingsComplete}`);
		console.log(`Is admin: ${isAdminUser}, Is permitted (legacy): ${!!permittedUser3}, Is approved user: ${isApprovedUser}`);
		  
		if (!isAdminUser && !isApprovedUser && !permittedUser3) {
			console.log("❌ Access denied for upload_ivr!", userId);
			bot.sendMessage(chatId, 
			  "❌ *Access Required*\n\n" +
			  "IVR management requires:\n" +
			  "• Account approval\n" +
			  "• Complete campaign setup\n\n" +
			  "Please contact the administrator if you believe this is an error.",
			  { parse_mode: "Markdown" }
			);
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
		  const { isApprovedUser: isApprovedUserIvr, isAdminUser: isAdminUserIvr } = checkUserPermissions(user, userId, adminId);
		  let permittedUserIvr = await Allowed.findOne({ 
			  where: { telegramId: userId } 
		  });
		  
		  if (!isAdminUserIvr && !isApprovedUserIvr && !permittedUserIvr) {
			bot.sendMessage(chatId, 
			  "❌ *Access Required*\n\n" +
			  "IVR management requires:\n" +
			  "• Account approval\n" +
			  "• Complete campaign setup\n\n" +
			  "Please contact the administrator if you believe this is an error.",
			  { parse_mode: "Markdown" }
			);
			return;
		  }

        const ivrType = callbackData.split("_")[1];
        const campaign3 = await getOrCreateCampaign(userId);
        
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
        if (!permittedUser4 && user.userType !== 'admin') {
          console.log("❌ Admin access required to set_sip!", userId);
          bot.sendMessage(chatId, "❌ Admin access required!");
          return;
        }
        
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
          let trunkList = "🌐 *Available SIP Trunks:*\n\n";
          sipTrunks.forEach((trunk, index) => {
            trunkList += `${index + 1}. *${escapeMarkdown(trunk.name)}*\n`;
            trunkList += `   📍 Host: ${escapeMarkdown(trunk.host)}\n`;
            trunkList += `   👤 Username: ${escapeMarkdown(trunk.username || trunk.defaultuser || 'N/A')}\n`;
            if (trunk.description) {
              trunkList += `   📝 ${escapeMarkdown(trunk.description)}\n`;
            }
            trunkList += `   🔌 Status: ${trunk.status ? '✅ Active' : '❌ Inactive'}\n\n`;
          });
          trunkList += "Enter the number of the trunk you want to use:";
          
          const campaign4 = await getOrCreateCampaign(userId);
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
        const campaign5 = await getOrCreateCampaign(userId);
        userStates[userId] = { action: "waiting_new_sip_config", campaignId: campaign5.id };
        break;

      case "set_notifications":
        const campaign6 = await getOrCreateCampaign(userId);
        await campaign6.update({ notificationsChatId: chatId });
        bot.sendMessage(
          chatId,
          `✅ *Notifications Channel Set*\n\nThis chat (${chatId}) will receive all notifications for this campaign.`,
          { parse_mode: "Markdown" }
        );
        break;

      case "permit_user":
        if (user.userType !== 'admin') {
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

      case "check_balance":
		  if (!user.rateCardId) {
			bot.sendMessage(chatId, "💳 No rate card assigned. Contact administrator to enable billing features.");
			return;
		  }
		  
		  try {
			const financial = await billingEngine.getUserFinancialSummary(user.id);
			
			// Get recent call details for this user
			const recentCalls = await CallDetail.findAll({
			  where: { userId: user.id },
			  order: [['createdAt', 'DESC']],
			  limit: 5,
			  include: [
				{ 
				  model: Destination, 
				  as: 'destination',
				  attributes: ['countryName', 'prefix']
				}
			  ]
			});
			
			let message = `💰 *Account Balance*\n\n`;
			message += `💳 Current Balance: $${financial.summary.currentBalance.toFixed(2)}\n`;
			message += `🏦 Credit Limit: $${financial.summary.creditLimit.toFixed(2)}\n`;
			message += `💵 Available Balance: $${financial.summary.availableBalance.toFixed(2)}\n\n`;
			
			message += `📊 *Usage Summary*\n`;
			message += `📞 Total Calls: ${financial.summary.totalCalls}\n`;
			message += `✅ Answered Calls: ${financial.summary.answeredCalls}\n`;
			message += `⏱️ Total Minutes: ${financial.summary.totalMinutes.toFixed(1)}\n`;
			message += `💸 Total Spent: $${financial.summary.totalSpent.toFixed(2)}\n\n`;
			
			if (recentCalls.length > 0) {
			  message += `📋 *Recent Calls*\n`;
			  recentCalls.forEach((call, index) => {
				const status = call.callStatus === 'answered' ? '✅' : '❌';
				const duration = call.callStatus === 'answered' ? `${Math.round(call.billableDuration/60)}min` : 'N/A';
				const cost = call.totalCharge > 0 ? `$${call.totalCharge.toFixed(4)}` : 'Free';
				const destination = call.destination ? call.destination.countryName : 'Unknown';
				
				message += `${index + 1}. ${status} ${call.phoneNumber} (${destination})\n`;
				message += `   ${duration} | ${cost} | ${call.createdAt.toLocaleDateString()}\n`;
			  });
			}
			
			bot.sendMessage(chatId, message, { 
			  parse_mode: 'Markdown',
			  reply_markup: {
				inline_keyboard: [
				  [{ text: '🔄 Refresh', callback_data: 'check_balance' }],
				  [{ text: '📊 Detailed Report', callback_data: 'detailed_report' }],
				  [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
				]
			  }
			});
		  } catch (error) {
			console.error('Balance check error:', error);
			bot.sendMessage(chatId, `❌ Error retrieving balance: ${error.message}`);
		  }
		  break;

		// 3. Add detailed report functionality
		case "detailed_report":
		  if (!user.rateCardId) {
			bot.sendMessage(chatId, "💳 No rate card assigned. Contact administrator.");
			return;
		  }
		  
		  try {
			// Get calls from last 30 days
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
			
			const callDetails = await CallDetail.findAll({
			  where: { 
				userId: user.id,
				createdAt: { [Op.gte]: thirtyDaysAgo }
			  },
			  order: [['createdAt', 'DESC']],
			  limit: 20,
			  include: [
				{ 
				  model: Destination, 
				  as: 'destination',
				  attributes: ['countryName', 'prefix']
				}
			  ]
			});
			
			const transactions = await Transaction.findAll({
			  where: { 
				userId: user.id,
				createdAt: { [Op.gte]: thirtyDaysAgo }
			  },
			  order: [['createdAt', 'DESC']],
			  limit: 10
			});
			
			let message = `📊 *Detailed Report (Last 30 Days)*\n\n`;
			
			// Summary stats
			const totalCalls = callDetails.length;
			const answeredCalls = callDetails.filter(c => c.callStatus === 'answered').length;
			const totalMinutes = callDetails.reduce((sum, c) => sum + (c.billableDuration / 60), 0);
			const totalSpent = callDetails.reduce((sum, c) => sum + parseFloat(c.totalCharge), 0);
			
			message += `📈 *Summary*\n`;
			message += `Calls Made: ${totalCalls}\n`;
			message += `Answered: ${answeredCalls} (${totalCalls > 0 ? ((answeredCalls/totalCalls)*100).toFixed(1) : 0}%)\n`;
			message += `Minutes: ${totalMinutes.toFixed(1)}\n`;
			message += `Amount: $${totalSpent.toFixed(2)}\n\n`;
			
			// Recent transactions
			if (transactions.length > 0) {
			  message += `💳 *Recent Transactions*\n`;
			  transactions.slice(0, 5).forEach((txn, index) => {
				const type = txn.transactionType === 'credit' ? '💰' : '💸';
				const amount = txn.transactionType === 'credit' ? `+$${txn.amount}` : `-$${txn.amount}`;
				message += `${type} ${amount} | ${txn.createdAt.toLocaleDateString()}\n`;
				if (txn.description) {
				  message += `   ${txn.description}\n`;
				}
			  });
			}
			
			bot.sendMessage(chatId, message, { 
			  parse_mode: 'Markdown',
			  reply_markup: {
				inline_keyboard: [
				  [{ text: '💰 Check Balance', callback_data: 'check_balance' }],
				  [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
				]
			  }
			});
		  } catch (error) {
			console.error('Detailed report error:', error);
			bot.sendMessage(chatId, `❌ Error generating report: ${error.message}`);
		  }
		  break;

		// 4. Fix campaign stats to show accurate billing data
		// Fixed campaign stats case with proper data validation and Markdown escaping
case "campaign_stats":
  try {
    const currentCampaign = await getOrCreateCampaign(userId);
    
    // Get billing-based stats if user has rate card
    let callStats = {};
    if (user.rateCardId) {
      // Get stats from call_details table (billing records) with better data validation
      const billingStats = await CallDetail.findAll({
        where: { 
          userId: user.id,
          campaignId: currentCampaign.id
        },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalCalls'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN call_status = 'answered' THEN 1 ELSE 0 END")), 'answeredCalls'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN call_status != 'answered' THEN 1 ELSE 0 END")), 'failedCalls'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN dtmf_pressed IS NOT NULL THEN 1 ELSE 0 END")), 'dtmfResponses'],
          [sequelize.fn('SUM', sequelize.col('billable_duration')), 'totalSeconds'],
          [sequelize.fn('SUM', sequelize.col('total_charge')), 'totalSpent']
        ],
        raw: true
      });
      
      const stats = billingStats[0];
      const totalCalls = parseInt(stats.totalCalls) || 0;
      const totalSeconds = parseFloat(stats.totalSeconds || 0);
      const totalSpent = parseFloat(stats.totalSpent || 0);
      
      // Validate data ranges to prevent unrealistic numbers
      const validatedMinutes = Math.min(totalSeconds / 60, 999999); // Cap at 999,999 minutes
      const validatedSpent = Math.min(totalSpent, 999999); // Cap at $999,999
      
      callStats = {
        total: totalCalls,
        successful: parseInt(stats.answeredCalls) || 0,
        failed: parseInt(stats.failedCalls) || 0,
        dtmf_responses: parseInt(stats.dtmfResponses) || 0,
        total_minutes: validatedMinutes,
        total_spent: validatedSpent
      };
      
      // Log suspicious data for debugging
      if (totalSeconds > 86400 * 30 || totalSpent > 10000) { // More than 30 days of minutes or $10k
        console.warn(`[Stats] Suspicious billing data detected for user ${user.id}: ${totalSeconds}s, $${totalSpent}`);
      }
    } else {
      // Use legacy stats from campaign table
      callStats = {
        total: currentCampaign.totalCalls || 0,
        successful: currentCampaign.successfulCalls || 0,
        failed: currentCampaign.failedCalls || 0,
        dtmf_responses: currentCampaign.dtmfResponses || 0
      };
    }
    
    // Calculate rates with safety checks
    const successRate = callStats.total > 0 ? 
      Math.min(((callStats.successful / callStats.total) * 100), 100).toFixed(1) : '0.0';
    const responseRate = callStats.successful > 0 ? 
      Math.min(((callStats.dtmf_responses / callStats.successful) * 100), 100).toFixed(1) : '0.0';
    
    // Safely escape campaign name and trunk info
    const campaignName = currentCampaign.campaignName ? 
      currentCampaign.campaignName.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&') : 'Unknown Campaign';
    
    let trunkInfo = 'Not configured';
    if (currentCampaign.sipTrunk) {
      const trunkName = currentCampaign.sipTrunk.name ? 
        currentCampaign.sipTrunk.name.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&') : 'Unknown';
      const trunkHost = currentCampaign.sipTrunk.host ? 
        currentCampaign.sipTrunk.host.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&') : 'Unknown';
      
      trunkInfo = `${trunkName} (${trunkHost})`;
      if (!currentCampaign.sipTrunk.status) {
        trunkInfo += ' ⚠️ INACTIVE';
      }
    }
    
    const callerId = currentCampaign.callerId ? 
      currentCampaign.callerId.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&') : 'Not set ⚠️';
    const dialPrefix = currentCampaign.dialPrefix ? 
      currentCampaign.dialPrefix.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&') : 'None';
    
    // Build message with proper escaping
    let message = `📈 *Campaign Statistics*\n\n`;
    message += `*Campaign:* ${campaignName}\n\n`;
    
    message += `📊 *Performance*\n`;
    message += `Total Calls: ${callStats.total}\n`;
    message += `✅ Successful: ${callStats.successful}\n`;
    message += `❌ Failed: ${callStats.failed}\n`;
    message += `🔢 DTMF (${currentCampaign.dtmfDigit || '1'}): ${callStats.dtmf_responses}\n`;
    message += `📈 Success Rate: ${successRate}%\n`;
    message += `📱 Response Rate: ${responseRate}%\n\n`;
    
    // Only show billing info if data is reasonable
    if (user.rateCardId && callStats.total_minutes !== undefined && callStats.total_minutes > 0) {
      const avgCostPerCall = callStats.total > 0 ? (callStats.total_spent / callStats.total) : 0;
      
      message += `💰 *Billing Info*\n`;
      message += `Total Minutes: ${callStats.total_minutes.toFixed(1)}\n`;
      message += `Total Spent: $${callStats.total_spent.toFixed(2)}\n\n`;
    }
    
    message += `⚙️ *Configuration*\n`;
    message += `SIP Trunk: ${trunkInfo}\n`;
    message += `Caller ID: ${callerId}\n`;
    message += `Concurrent: ${currentCampaign.concurrentCalls} calls\n`;
    message += `Dial Prefix: ${dialPrefix}`;
    
    // Validate message length (Telegram has limits)
    if (message.length > 4096) {
      message = message.substring(0, 4000) + '\n\n...message truncated...';
    }
    
    bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Refresh Stats', callback_data: 'campaign_stats' }],
          user.rateCardId ? [{ text: '💰 Check Balance', callback_data: 'check_balance' }] : [],
          [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
        ].filter(row => row.length > 0)
      }
    });
  } catch (error) {
    console.error('Campaign stats error:', error);
    
    // Send a simple fallback message if the main one fails
    bot.sendMessage(chatId, 
      `❌ Error loading detailed stats: ${error.message}\n\n` +
      `📊 Basic Stats:\n` +
      `Campaign calls are being processed. Use /stats for console output or contact admin if issues persist.`,
      { 
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
          ]
        }
      }
    );
  }
  break;

// Also add a debug query to check for data anomalies
case "debug_billing_data":
  if (user.userType !== 'admin') {
    bot.sendMessage(chatId, "❌ Admin access required!");
    return;
  }
  
  try {
    const suspiciousRecords = await CallDetail.findAll({
      where: { 
        [Op.or]: [
          { billable_duration: { [Op.gt]: 3600 } }, // More than 1 hour
          { total_charge: { [Op.gt]: 100 } } // More than $100
        ]
      },
      limit: 10,
      order: [['total_charge', 'DESC']]
    });
    
    let debugMessage = `🔍 *Billing Debug Info*\n\n`;
    debugMessage += `Found ${suspiciousRecords.length} suspicious records:\n\n`;
    
    suspiciousRecords.forEach((record, index) => {
      debugMessage += `${index + 1}. ${record.phoneNumber}\n`;
      debugMessage += `   Duration: ${(record.billableDuration / 60).toFixed(1)}min\n`;
      debugMessage += `   Charge: $${record.totalCharge}\n`;
      debugMessage += `   Status: ${record.callStatus}\n\n`;
    });
    
    bot.sendMessage(chatId, debugMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Debug error: ${error.message}`);
  }
  break;

      case "back_to_menu":
        bot.editMessageText(
          "🤖 *Call Campaign Bot*\n\nSelect an option:",
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            ...getUserMenu(user),
            parse_mode: "Markdown"
          }
        );
        break;
    }
	console.log('########################', callbackData)
	if (callbackData.startsWith('admin_assign_rate_confirm_')) {
	  if (user.userType !== 'admin') {
		bot.sendMessage(chatId, "❌ Admin access required!");
		return;
	  }
	  
	  const parts = callbackData.replace('admin_assign_rate_confirm_', '').split('_');
	  const selectedUserId = parts[0];
	  const rateCardId = parts[1] === 'none' ? null : parseInt(parts[1]);
	  
	  try {
		const selectedUser = await User.findByPk(selectedUserId);
		if (!selectedUser) {
		  bot.sendMessage(chatId, "❌ User not found.");
		  return;
		}
		
		let rateCardName = 'None';
		if (rateCardId) {
		  const rateCard = await RateCard.findByPk(rateCardId);
		  if (!rateCard) {
			bot.sendMessage(chatId, "❌ Rate card not found.");
			return;
		  }
		  rateCardName = rateCard.name;
		}
		
		// Update user's rate card
		await selectedUser.update({ rateCardId });
		
		bot.sendMessage(
		  chatId,
		  `✅ *Rate Card Assignment Updated*\n\n` +
		  `User: ${escapeMarkdown(selectedUser.firstName || selectedUser.username || 'User')}\n` +
		  `Rate Card: ${escapeMarkdown(rateCardName)}\n\n` +
		  `The user can now ${rateCardId ? 'make calls with billing enabled' : 'only use legacy features'}.`,
		  {
			parse_mode: 'Markdown',
			reply_markup: {
			  inline_keyboard: [
				[{ text: '👤 Back to User', callback_data: `admin_manage_user_${selectedUser.id}` }],
				[{ text: '👥 All Users', callback_data: 'admin_users' }],
				[{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
			  ]
			}
		  }
		);
	  } catch (error) {
		console.error('Error assigning rate card:', error);
		bot.sendMessage(chatId, `❌ Error: ${error.message}`);
	  }
	  return;
	}
	
	// Handle individual user management (ADD THIS)
    if (callbackData.startsWith('admin_manage_user_')) {
      if (user.userType !== 'admin') {
        bot.sendMessage(chatId, "❌ Admin access required!");
        return;
      }
      
      const selectedUserId = callbackData.replace('admin_manage_user_', '');
      
      try {
        const selectedUser = await User.findByPk(selectedUserId, {
          include: [{ model: RateCard, as: 'rateCard', include: [{ model: Provider, as: 'provider' }] }]
        });
        
        if (!selectedUser) {
          bot.sendMessage(chatId, "❌ User not found.");
          return;
        }
        
        const rateCardInfo = selectedUser.rateCard ? 
          `${selectedUser.rateCard.name} (${selectedUser.rateCard.provider.name})` : 
          'Not assigned';
        
        bot.sendMessage(
          chatId,
          `👤 *User Management*\n\n` +
          `Name: ${escapeMarkdown(selectedUser.firstName || selectedUser.username || 'User')}\n` +
          `Telegram ID: ${selectedUser.telegramId}\n` +
          `Balance: $${selectedUser.balance}\n` +
          `Credit Limit: $${selectedUser.creditLimit}\n` +
          `Rate Card: ${escapeMarkdown(rateCardInfo)}\n` +
          `Status: ${selectedUser.status}\n\n` +
          `Select an action:`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '💳 Assign Rate Card', callback_data: `admin_assign_rate_${selectedUser.id}` },
                  { text: '💰 Add Credit', callback_data: `admin_add_credit_${selectedUser.id}` }
                ],
				[
				  { text: '📞 Campaign Config', callback_data: `admin_campaign_config_${selectedUser.id}` },
				  { text: '🔄 Change Status', callback_data: `admin_change_status_${selectedUser.id}` }
				],
                [
                  { text: '📊 View Details', callback_data: `admin_user_details_${selectedUser.id}` },
				  { text: '🔙 Back to Users', callback_data: 'admin_users' }
                ],
                [
                  { text: '🏠 Main Menu', callback_data: 'back_to_menu' }
                ]
              ]
            }
          }
        );
      } catch (error) {
        bot.sendMessage(chatId, `❌ Error: ${error.message}`);
      }
      return;
    }

	if (callbackData.startsWith('admin_campaign_config_')) {
	  if (user.userType !== 'admin') {
		bot.sendMessage(chatId, "❌ Admin access required!");
		return;
	  }
	  
	  const selectedUserId = callbackData.replace('admin_campaign_config_', '');
	  
	  try {
		const selectedUser = await User.findByPk(selectedUserId);
		if (!selectedUser) {
		  bot.sendMessage(chatId, "❌ User not found.");
		  return;
		}
		
		// Get user's campaign
		const campaign = await Campaign.findOne({
		  where: { createdBy: selectedUser.telegramId },
		  include: [
			{ model: SipPeer, as: 'sipTrunk' },
			{ model: SipPeer, as: 'callbackTrunk' }
		  ]
		});
		
		if (!campaign) {
		  // Create campaign if it doesn't exist
		  const newCampaign = await Campaign.create({
			botToken: config.telegram_bot_token,
			campaignName: `Campaign for ${selectedUser.firstName || selectedUser.username || 'User'}`,
			createdBy: selectedUser.telegramId,
			concurrentCalls: 30,
			isActive: true
		  });
		  
		  bot.sendMessage(
			chatId,
			`📞 *Campaign Configuration*\n\n` +
			`User: ${escapeMarkdown(selectedUser.firstName || selectedUser.username || 'User')}\n\n` +
			`New campaign created. Configure settings:`,
			{
			  parse_mode: 'Markdown',
			  reply_markup: {
				inline_keyboard: [
				  [
					{ text: '🌐 Set SIP Trunk', callback_data: `admin_set_sip_${selectedUser.id}` },
					{ text: '📞 Set Caller ID', callback_data: `admin_set_callerid_${selectedUser.id}` }
				  ],
				  [
					{ text: '➕ Set Dial Prefix', callback_data: `admin_set_prefix_${selectedUser.id}` },
					{ text: '🔢 Set Concurrent Calls', callback_data: `admin_set_concurrent_${selectedUser.id}` }
				  ],
				  [
					{ text: '🔙 Back to User', callback_data: `admin_manage_user_${selectedUser.id}` }
				  ]
				]
			  }
			}
		  );
		} else {
		  const sipTrunkName = campaign.sipTrunk ? campaign.sipTrunk.name : 'Not set';
		  const callerId = campaign.callerId || 'Not set';
		  const dialPrefix = campaign.dialPrefix || 'None';
		  
		  bot.sendMessage(
			chatId,
			`📞 *Campaign Configuration*\n\n` +
			`User: ${escapeMarkdown(selectedUser.firstName || selectedUser.username || 'User')}\n` +
			`Campaign: ${escapeMarkdown(campaign.campaignName)}\n\n` +
			`*Current Settings:*\n` +
			`🌐 SIP Trunk: ${escapeMarkdown(sipTrunkName)}\n` +
			`📞 Caller ID: ${escapeMarkdown(callerId)}\n` +
			`➕ Dial Prefix: ${escapeMarkdown(dialPrefix)}\n` +
			`🔢 Concurrent Calls: ${campaign.concurrentCalls}\n` +
			`🔢 DTMF Digit: ${campaign.dtmfDigit || '1'}\n\n` +
			`Select setting to modify:`,
			{
			  parse_mode: 'Markdown',
			  reply_markup: {
				inline_keyboard: [
				  [
					{ text: '🌐 Change SIP Trunk', callback_data: `admin_set_sip_${selectedUser.id}` },
					{ text: '📞 Change Caller ID', callback_data: `admin_set_callerid_${selectedUser.id}` }
				  ],
				  [
					{ text: '➕ Change Dial Prefix', callback_data: `admin_set_prefix_${selectedUser.id}` },
					//{ text: '🔢 Change Concurrent Calls', callback_data: `admin_set_concurrent_${selectedUser.id}` }
				  ],
				  //[
					//{ text: '🔢 Change DTMF Digit', callback_data: `admin_set_dtmf_${selectedUser.id}` },
				  //],
				  [
					{ text: '✅ Finish Setup', callback_data: `admin_finish_user_setup_${selectedUser.id}` }
				  ],
				  [
					{ text: '🔙 Back to User', callback_data: `admin_manage_user_${selectedUser.id}` }
				  ]
				]
			  }
			}
		  );
		}
	  } catch (error) {
		console.error('Error in campaign config:', error);
		bot.sendMessage(chatId, `❌ Error: ${error.message}`);
	  }
	  return;
	}

	// Handle finish user setup
	if (callbackData.startsWith('admin_finish_user_setup_')) {
	  if (user.userType !== 'admin') {
		bot.sendMessage(chatId, "❌ Admin access required!");
		return;
	  }
	  
	  const selectedUserId = callbackData.replace('admin_finish_user_setup_', '');
	  
	  try {
		const selectedUser = await User.findByPk(selectedUserId, {
		  include: [
			{ model: SipPeer, as: 'sipTrunk' },
			{ model: SipPeer, as: 'callbackTrunk' },
			{ model: RateCard, as: 'rateCard' }
		  ]
		});
		
		if (!selectedUser) {
		  bot.sendMessage(chatId, "❌ User not found.");
		  return;
		}
		
		// Check campaign configuration
		const campaign = await Campaign.findOne({
		  where: { createdBy: selectedUser.telegramId },
		  include: [
			{ model: SipPeer, as: 'sipTrunk' },
			{ model: SipPeer, as: 'callbackTrunk' }
		  ]
		});
		
		// Update user settings from campaign if exists
		if (campaign) {
		  await selectedUser.update({
			sipTrunkId: campaign.sipTrunkId,
			callbackTrunkId: campaign.callbackTrunkId,
			callerId: campaign.callerId,
			dialPrefix: campaign.dialPrefix,
			concurrentCalls: campaign.concurrentCalls
		  });
		  
		  // Reload user with updated data
		  await selectedUser.reload({
			include: [
			  { model: SipPeer, as: 'sipTrunk' },
			  { model: SipPeer, as: 'callbackTrunk' },
			  { model: RateCard, as: 'rateCard' }
			]
		  });
		}
		
		// Check if setup is complete
		const hasCompleteSettings = !!(
		  selectedUser.sipTrunkId && 
		  selectedUser.callerId && 
		  selectedUser.concurrentCalls
		);
		
		// Update user's approval and settings status
		await selectedUser.update({
		  approvalStatus: 'approved',
		  approvalDate: new Date(),
		  approvedBy: user.telegramId,
		  campaignSettingsComplete: hasCompleteSettings
		});
		
		const settingsStatus = hasCompleteSettings ? '✅ Complete' : '⚠️ Incomplete';
		const missingSettings = [];
		if (!selectedUser.sipTrunkId) missingSettings.push('SIP Trunk');
		if (!selectedUser.callerId) missingSettings.push('Caller ID');
		if (!selectedUser.concurrentCalls) missingSettings.push('Concurrent Calls');
		
		bot.sendMessage(
		  chatId,
		  `🎯 *User Setup Summary*\n\n` +
		  `User: ${escapeMarkdown(selectedUser.firstName || selectedUser.username || 'User')}\n` +
		  `Status: ${settingsStatus}\n\n` +
		  `📋 *Configuration:*\n` +
		  `🌐 SIP Trunk: ${selectedUser.sipTrunk ? escapeMarkdown(selectedUser.sipTrunk.name) : '❌ Not set'}\n` +
		  `📞 Caller ID: ${selectedUser.callerId ? escapeMarkdown(selectedUser.callerId) : '❌ Not set'}\n` +
		  `➕ Dial Prefix: ${selectedUser.dialPrefix ? escapeMarkdown(selectedUser.dialPrefix) : '➖ None'}\n` +
		  `🔢 Concurrent Calls: ${selectedUser.concurrentCalls || '❌ Not set'}\n` +
		  `💳 Rate Card: ${selectedUser.rateCard ? escapeMarkdown(selectedUser.rateCard.name) : '❌ Not assigned'}\n\n` +
		  `${missingSettings.length > 0 ? `⚠️ Missing: ${missingSettings.join(', ')}` : '✅ Setup complete!'}`,
		  {
			parse_mode: 'Markdown',
			reply_markup: {
			  inline_keyboard: [
				[{ text: '👥 All Users', callback_data: 'admin_users' }],
				[{ text: '⏳ Pending Approvals', callback_data: 'admin_pending_approvals' }],
				[{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
			  ]
			}
		  }
		);
		
		// Notify user if setup is complete
		if (hasCompleteSettings) {
		  try {
			await bot.sendMessage(
			  selectedUser.telegramId,
			  `🎉 *Setup Complete!*\n\n` +
			  `Your account is now fully configured and ready to use.\n\n` +
			  `You can now:\n` +
			  `• Upload leads\n` +
			  `• Start campaigns\n` +
			  `• Monitor call statistics\n\n` +
			  `Welcome to the system! Send /start to begin.`,
			  { parse_mode: 'Markdown' }
			);
		  } catch (error) {
			console.log(`Could not notify user ${selectedUser.telegramId}: ${error.message}`);
		  }
		} else {
		  // User still has incomplete settings
		  try {
			await bot.sendMessage(
			  selectedUser.telegramId,
			  `⚠️ *Account Approved - Configuration Incomplete*\n\n` +
			  `Your account has been approved by the administrator, but some configuration is still missing.\n\n` +
			  `Missing: ${missingSettings.join(', ')}\n\n` +
			  `Please contact the administrator to complete your setup.`,
			  { parse_mode: 'Markdown' }
			);
		  } catch (error) {
			console.log(`Could not notify user ${selectedUser.telegramId}: ${error.message}`);
		  }
		}
		
	  } catch (error) {
		console.error('Error finishing user setup:', error);
		bot.sendMessage(chatId, `❌ Error: ${error.message}`);
	  }
	  return;
	}
	
	if (callbackData.startsWith('admin_set_sip_')) {
	  if (user.userType !== 'admin') {
		bot.sendMessage(chatId, "❌ Admin access required!");
		return;
	  }
	  
	  const selectedUserId = callbackData.replace('admin_set_sip_', '');
	  
	  try {
		const sipTrunks = await SipPeer.findAll({
		  where: { category: 'trunk', status: 1 },
		  order: [['name', 'ASC']]
		});
		
		if (sipTrunks.length === 0) {
		  bot.sendMessage(chatId, "❌ No SIP trunks available.");
		  return;
		}
		
		const trunkButtons = sipTrunks.map(trunk => [{
		  text: `${trunk.name} (${trunk.host})`,
		  callback_data: `admin_confirm_sip_${selectedUserId}_${trunk.id}`
		}]);
		
		trunkButtons.push([{ 
		  text: '🔙 Back', 
		  callback_data: `admin_campaign_config_${selectedUserId}` 
		}]);
		
		bot.sendMessage(
		  chatId,
		  `🌐 *Select SIP Trunk*\n\nChoose a SIP trunk for this user:`,
		  {
			parse_mode: 'Markdown',
			reply_markup: {
			  inline_keyboard: trunkButtons
			}
		  }
		);
	  } catch (error) {
		bot.sendMessage(chatId, `❌ Error: ${error.message}`);
	  }
	  return;
	}

	// Handle SIP Trunk confirmation
	if (callbackData.startsWith('admin_confirm_sip_')) {
	  if (user.userType !== 'admin') {
		bot.sendMessage(chatId, "❌ Admin access required!");
		return;
	  }
	  
	  const parts = callbackData.replace('admin_confirm_sip_', '').split('_');
	  const selectedUserId = parts[0];
	  const sipTrunkId = parseInt(parts[1]);
	  
	  try {
		const [selectedUser, sipTrunk] = await Promise.all([
		  User.findByPk(selectedUserId),
		  SipPeer.findByPk(sipTrunkId)
		]);
		
		if (!selectedUser || !sipTrunk) {
		  bot.sendMessage(chatId, "❌ User or SIP trunk not found.");
		  return;
		}
		
		const campaign = await Campaign.findOne({
		  where: { createdBy: selectedUser.telegramId }
		});
		
		if (campaign) {
		  await campaign.update({ sipTrunkId });
		  
		  bot.sendMessage(
			chatId,
			`✅ *SIP Trunk Updated*\n\n` +
			`User: ${escapeMarkdown(selectedUser.firstName || selectedUser.username || 'User')}\n` +
			`SIP Trunk: ${escapeMarkdown(sipTrunk.name)}\n` +
			`Host: ${escapeMarkdown(sipTrunk.host)}`,
			{
			  parse_mode: 'Markdown',
			  reply_markup: {
				inline_keyboard: [
				  [{ text: '📞 Back to Campaign Config', callback_data: `admin_campaign_config_${selectedUser.id}` }]
				]
			  }
			}
		  );
		}
	  } catch (error) {
		bot.sendMessage(chatId, `❌ Error: ${error.message}`);
	  }
	  return;
	}

	// Handle Caller ID setting
	if (callbackData.startsWith('admin_set_callerid_')) {
	  if (user.userType !== 'admin') {
		bot.sendMessage(chatId, "❌ Admin access required!");
		return;
	  }
	  
	  const selectedUserId = callbackData.replace('admin_set_callerid_', '');
	  
	  bot.sendMessage(
		chatId,
		`📞 *Set Caller ID*\n\nEnter the caller ID number for this user:\n\n` +
		`Examples:\n` +
		`• 1234567890\n` +
		`• +11234567890\n` +
		`• (123) 456-7890`,
		{ parse_mode: 'Markdown' }
	  );
	  
	  userStates[userId] = { 
		action: 'admin_setting_callerid',
		selectedUserId: selectedUserId
	  };
	  return;
	}

	// Handle Dial Prefix setting
	if (callbackData.startsWith('admin_set_prefix_')) {
	  if (user.userType !== 'admin') {
		bot.sendMessage(chatId, "❌ Admin access required!");
		return;
	  }
	  
	  const selectedUserId = callbackData.replace('admin_set_prefix_', '');
	  
	  bot.sendMessage(
		chatId,
		`➕ *Set Dial Prefix*\n\nEnter the dial prefix for this user:\n\n` +
		`Examples:\n` +
		`• 9 (for outbound access)\n` +
		`• 011 (for international)\n` +
		`• type none for no prefix`,
		{ parse_mode: 'Markdown' }
	  );
	  
	  userStates[userId] = { 
		action: 'admin_setting_prefix',
		selectedUserId: selectedUserId
	  };
	  return;
	}
	
	if (callbackData.startsWith('admin_set_concurrent_')) {
	  if (user.userType !== 'admin') {
		bot.sendMessage(chatId, "❌ Admin access required!");
		return;
	  }
	  
	  const selectedUserId = callbackData.replace('admin_set_concurrent_', '');
	  
	  bot.sendMessage(
		chatId,
		`➕ *Set Concurrent Calls Limit*\n\nEnter the Calls Count for this user:\n\n` +
		`Examples:\n` +
		`• 10\n` +
		`• Leave empty for no limit`,
		{ parse_mode: 'Markdown' }
	  );
	  
	  userStates[userId] = { 
		action: 'admin_setting_concurrent_calls',
		selectedUserId: selectedUserId
	  };
	  return;
	}
	
    // Handle rate card assignment (ADD THIS)
    if (callbackData.startsWith('admin_assign_rate_')) {
      if (user.userType !== 'admin') {
        bot.sendMessage(chatId, "❌ Admin access required!");
        return;
      }
      
      const selectedUserId = callbackData.replace('admin_assign_rate_', '');
      
      try {
        const [selectedUser, rateCards] = await Promise.all([
          User.findByPk(selectedUserId),
          RateCard.findAll({
            where: { status: 'active' },
            include: [{ model: Provider, as: 'provider' }],
            order: [['name', 'ASC']]
          })
        ]);
        
        if (!selectedUser) {
          bot.sendMessage(chatId, "❌ User not found.");
          return;
        }
        
        if (rateCards.length === 0) {
          bot.sendMessage(chatId, "❌ No active rate cards found. Create one first.");
          return;
        }
        
        let message = `💳 *Assign Rate Card*\n\n` +
          `User: ${escapeMarkdown(selectedUser.firstName || selectedUser.username || 'User')}\n\n` +
          `Select a rate card:\n\n`;
        
        const rateCardButtons = rateCards.map(rc => [{
          text: `${rc.name} (${rc.provider.name})`,
          callback_data: `admin_assign_rate_confirm_${selectedUser.id}_${rc.id}`
        }]);
        
        // Add option to remove rate card
        rateCardButtons.push([{ 
          text: '🚫 Remove Rate Card', 
          callback_data: `admin_assign_rate_confirm_${selectedUser.id}_none` 
        }]);
        
        rateCardButtons.push([{ 
          text: '🔙 Back', 
          callback_data: `admin_manage_user_${selectedUser.id}` 
        }]);
        
        bot.sendMessage(
          chatId,
          message,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: rateCardButtons
            }
          }
        );
      } catch (error) {
        bot.sendMessage(chatId, `❌ Error: ${error.message}`);
      }
      return;
    }

    // Handle rate card assignment confirmation (ADD THIS)
    if (callbackData.startsWith('admin_assign_rate_confirm_')) {
      if (user.userType !== 'admin') {
        bot.sendMessage(chatId, "❌ Admin access required!");
        return;
      }
      
      const parts = callbackData.replace('admin_assign_rate_confirm_', '').split('_');
      const selectedUserId = parts[0];
      const rateCardId = parts[1] === 'none' ? null : parseInt(parts[1]);
      
      try {
        const selectedUser = await User.findByPk(selectedUserId);
        if (!selectedUser) {
          bot.sendMessage(chatId, "❌ User not found.");
          return;
        }
        
        let rateCardName = 'None';
        if (rateCardId) {
          const rateCard = await RateCard.findByPk(rateCardId);
          if (!rateCard) {
            bot.sendMessage(chatId, "❌ Rate card not found.");
            return;
          }
          rateCardName = rateCard.name;
        }
        
        // Update user's rate card
        await selectedUser.update({ rateCardId });
        
        bot.sendMessage(
          chatId,
          `✅ *Rate Card Assignment Updated*\n\n` +
          `User: ${escapeMarkdown(selectedUser.firstName || selectedUser.username || 'User')}\n` +
          `Rate Card: ${escapeMarkdown(rateCardName)}\n\n` +
          `The user can now ${rateCardId ? 'make calls with billing enabled' : 'only use legacy features'}.`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '👤 Back to User', callback_data: `admin_manage_user_${selectedUser.id}` }],
                [{ text: '👥 All Users', callback_data: 'admin_users' }],
                [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
              ]
            }
          }
        );
      } catch (error) {
        console.error('Error assigning rate card:', error);
        bot.sendMessage(chatId, `❌ Error: ${error.message}`);
      }
      return;
    }
	
	// Handle dynamic callbacks for rate card creation and uploads
    if (callbackData.startsWith('admin_create_rate_')) {
      if (user.userType !== 'admin') {
        bot.sendMessage(chatId, "❌ Admin access required!");
        return;
      }
      
      const providerId = callbackData.replace('admin_create_rate_', '');
      
      bot.sendMessage(
        chatId,
        "🏗️ *Create Rate Card*\n\nEnter rate card details in this format:\n\n" +
        "`Name | Description`\n\n" +
        "Example:\n`Premium Rates | High quality routes for premium customers`",
        { parse_mode: 'Markdown' }
      );
      
      userStates[userId] = { 
        action: 'admin_creating_rate_card',
        providerId: parseInt(providerId)
      };
      return;
    }
    
    if (callbackData.startsWith('admin_upload_rates_')) {
      if (user.userType !== 'admin') {
        bot.sendMessage(chatId, "❌ Admin access required!");
        return;
      }
      
      const rateCardId = callbackData.replace('admin_upload_rates_', '');
      
      bot.sendMessage(
        chatId,
        "📋 *Bulk Upload Rates*\n\nSend a CSV file with the following format:\n\n" +
        "`Country Code,Country Name,Prefix,Description,Region,Cost Price,Sell Price,Min Duration,Billing Increment`\n\n" +
        "Example:\n" +
        "`US,United States,1,USA Mobile,North America,0.01,0.02,60,60`\n" +
        "`UK,United Kingdom,44,UK Mobile,Europe,0.015,0.025,60,60`",
        { parse_mode: 'Markdown' }
      );
      
      userStates[userId] = { 
        action: 'admin_uploading_rates',
        rateCardId: parseInt(rateCardId)
      };
      return;
    }
	
	// Handle Add New User callback
	if (callbackData === 'admin_add_user') {
	  if (user.userType !== 'admin') {
		bot.sendMessage(chatId, "❌ Admin access required!");
		return;
	  }
	  
	  bot.sendMessage(
		chatId,
		`➕ *Add New User*\n\n` +
		`Enter user details in this format:\n\n` +
		`\`TELEGRAM_ID | FIRST_NAME | LAST_NAME\`\n\n` +
		`Example:\n` +
		`\`123456789 | John | Doe\`\n\n` +
		`Or just:\n` +
		`\`123456789 | John\`\n\n` +
		`Note: The user will be created with pending approval status and will need admin configuration before they can use the system.`,
		{ parse_mode: 'Markdown' }
	  );
	  
	  userStates[userId] = { 
		action: 'admin_creating_user'
	  };
	  return;
	}
	
	// Handle dynamic callbacks for user credit addition
	if (callbackData.startsWith('admin_add_credit_')) {
	  if (user.userType !== 'admin') {
		bot.sendMessage(chatId, "❌ Admin access required!");
		return;
	  }
	  
	  const selectedUserId = callbackData.replace('admin_add_credit_', '');
	  
	  try {
		const selectedUser = await User.findByPk(selectedUserId);
		if (!selectedUser) {
		  bot.sendMessage(chatId, "❌ User not found.");
		  return;
		}
		
		bot.sendMessage(
		  chatId,
		  `💰 *Add Credit*\n\n` +
		  `Selected User: ${escapeMarkdown(selectedUser.firstName || selectedUser.username || 'User')}\n` +
		  `Telegram ID: ${selectedUser.telegramId}\n` +
		  `Current Balance: $${selectedUser.balance}\n\n` +
		  `Enter the amount to add:\nExample: 50.00`,
		  { parse_mode: 'Markdown' }
		);
		
		userStates[userId] = { 
		  action: 'admin_adding_credit_amount',
		  selectedUserId: selectedUserId
		};
	  } catch (error) {
		bot.sendMessage(chatId, `❌ Error: ${error.message}`);
	  }
	  return;
	}
  });

  // Handle text messages based on user state
  bot.on("text", async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
	let user = await User.findByPk(userId);
	if(!user?.userType){
		user = await User.findOne({where: {telegramId: userId}});
	}
	
    const text = msg.text;
    
    if (text.startsWith("/")) return; // Ignore commands
    
    const userState = userStates[userId];
    if (!userState) return;
	
    switch (userState.action) {
		case "dest_route_waiting_trunk":
		  const destTrunkSelection = parseInt(text);
		  if (isNaN(destTrunkSelection) || destTrunkSelection < 1 || destTrunkSelection > userState.sipTrunks.length) {
			bot.sendMessage(chatId, "❌ Invalid selection. Please enter a valid number.");
			return;
		  }
		  
		  const selectedDestTrunk = userState.sipTrunks[destTrunkSelection - 1];
		  const destinationRouteValue = `trunk/${selectedDestTrunk.name}`;
		  
		  try {
			const userCampaignDestTrunk = await Campaign.findByPk(userState.campaignId);
			await userCampaignDestTrunk.update({ 
			  destinationRoute: destinationRouteValue
			});
			
			// Also update the user's destination route
			await user.update({ 
			  destinationRoute: destinationRouteValue
			});
			
			bot.sendMessage(
			  chatId,
			  `✅ *Destination Route Set Successfully!*\n\n` +
			  `Selected Trunk: ${escapeMarkdown(selectedDestTrunk.name)}\n` +
			  `Host: ${escapeMarkdown(selectedDestTrunk.host)}\n` +
			  `Username: ${escapeMarkdown(selectedDestTrunk.username || selectedDestTrunk.defaultuser || 'N/A')}\n` +
			  `Destination Route: ${escapeMarkdown(destinationRouteValue)}\n\n` +
			  `This route will be used for call destinations.`,
			  { parse_mode: "Markdown", ...getUserMenu(user) }
			);
			
		  } catch (error) {
			console.error('Error updating destination route trunk:', error);
			bot.sendMessage(chatId, `❌ Error updating destination route: ${error.message}`);
		  }
		  
		  delete userStates[userId];
		  break;

		case "dest_route_waiting_agent":
		  const destAgentSelection = parseInt(text);
		  if (isNaN(destAgentSelection) || destAgentSelection < 1 || destAgentSelection > userState.agents.length) {
			bot.sendMessage(chatId, "❌ Invalid selection. Please enter a valid number.");
			return;
		  }
		  
		  const selectedDestAgent = userState.agents[destAgentSelection - 1];
		  
		  // Validate that the agent is still associated with this user
		  /*const validAgent = await validateUserAgent(userId, selectedDestAgent.id);
		  if (!validAgent) {
			bot.sendMessage(
			  chatId,
			  `❌ *Agent No Longer Available*\n\nThe selected agent is no longer associated with your account.\n\nPlease contact the administrator or try again.`,
			  { parse_mode: "Markdown", ...getUserMenu(user) }
			);
			delete userStates[userId];
			return;
		  }*/
		  
		  const destinationRouteAgent = `agent/${selectedDestAgent.name}`;
		  
		  try {
			const userCampaignDestAgent = await Campaign.findByPk(userState.campaignId);
			await userCampaignDestAgent.update({ 
			  destinationRoute: destinationRouteAgent
			});
			
			// Also update the user's destination route
			await user.update({ 
			  destinationRoute: destinationRouteAgent
			});
			
			bot.sendMessage(
			  chatId,
			  `✅ *Destination Route Set Successfully!*\n\n` +
			  `Selected Agent: ${escapeMarkdown(selectedDestAgent.name)}\n` +
			  `Extension: ${escapeMarkdown(selectedDestAgent.defaultuser || selectedDestAgent.username || 'N/A')}\n` +
			  `Category: ${escapeMarkdown(selectedDestAgent.category || 'Agent')}\n` +
			  `Destination Route: ${escapeMarkdown(destinationRouteAgent)}\n\n` +
			  `This route will be used for call destinations.`,
			  { parse_mode: "Markdown", ...getUserMenu(user) }
			);
			
		  } catch (error) {
			console.error('Error updating destination route agent:', error);
			bot.sendMessage(chatId, `❌ Error updating destination route: ${error.message}`);
		  }
		  
		  delete userStates[userId];
		  break;
		  
		case "user_waiting_sip_selection":
		  const userSipSelection = parseInt(text);
		  if (isNaN(userSipSelection) || userSipSelection < 1 || userSipSelection > userState.sipTrunks.length) {
			bot.sendMessage(chatId, "❌ Invalid selection. Please enter a valid number.");
			return;
		  }
		  
		  const selectedUserSipTrunk = userState.sipTrunks[userSipSelection - 1];
		  
		  try {
			const userCampaignSip = await Campaign.findByPk(userState.campaignId);
			await userCampaignSip.update({ sipTrunkId: selectedUserSipTrunk.id });
			
			// Also update the user's SIP trunk for consistency
			await user.update({ sipTrunkId: selectedUserSipTrunk.id });
			
			bot.sendMessage(
			  chatId,
			  `✅ *SIP Trunk Selected Successfully!*\n\n` +
			  `Selected: ${escapeMarkdown(selectedUserSipTrunk.name)}\n` +
			  `Host: ${escapeMarkdown(selectedUserSipTrunk.host)}\n` +
			  `Username: ${escapeMarkdown(selectedUserSipTrunk.username || selectedUserSipTrunk.defaultuser || 'N/A')}\n\n` +
			  `This SIP trunk will be used for all your outbound calls.`,
			  { parse_mode: "Markdown", ...getUserMenu(user) }
			);
			
		  } catch (error) {
			console.error('Error updating user SIP trunk:', error);
			bot.sendMessage(chatId, `❌ Error updating SIP trunk: ${error.message}`);
		  }
		  
		  delete userStates[userId];
		  break;
		  
		case "user_waiting_caller_id":
		  const userCallerIdValidation = validateCallerId(text);
		  if (!userCallerIdValidation.valid) {
			bot.sendMessage(chatId, `❌ ${userCallerIdValidation.message}`);
			return;
		  }
		  
		  const userCampaignCallerId = await Campaign.findByPk(userState.campaignId);
		  await userCampaignCallerId.update({ callerId: userCallerIdValidation.formatted });
		  
		  // Also update the user's caller ID for consistency
		  await user.update({ callerId: userCallerIdValidation.formatted });
		  
		  bot.sendMessage(
			chatId,
			`✅ *Caller ID Set Successfully!*\n\n` +
			`Your Caller ID: ${escapeMarkdown(userCallerIdValidation.formatted)}\n\n` +
			`This number will be displayed to recipients when you make calls.`,
			{ parse_mode: "Markdown", ...getUserMenu(user) }
		  );
		  delete userStates[userId];
		  break;

		case "user_waiting_dial_prefix":
		  let userPrefix = text.trim();
		  
		  // Handle "none" to remove prefix
		  if (userPrefix.toLowerCase() === 'none') {
			userPrefix = '';
		  }
		  
		  // Validate prefix - should only contain digits or be empty
		  if (userPrefix && !/^\d*$/.test(userPrefix)) {
			bot.sendMessage(chatId, "❌ Prefix should only contain numbers or type 'none' to remove.");
			return;
		  }
		  
		  const userCampaignPrefix = await Campaign.findByPk(userState.campaignId);
		  await userCampaignPrefix.update({ dialPrefix: userPrefix });
		  
		  // Also update the user's dial prefix for consistency
		  await user.update({ dialPrefix: userPrefix });
		  
		  bot.sendMessage(
			chatId,
			`✅ *Dial Prefix ${userPrefix ? 'Set' : 'Removed'} Successfully!*\n\n` +
			`${userPrefix ? 
			  `Prefix: ${escapeMarkdown(userPrefix)}\n\nAll numbers will be dialed as: ${escapeMarkdown(userPrefix)} + [phone number]` : 
			  'No prefix will be added to dialed numbers.'
			}`,
			{ parse_mode: "Markdown", ...getUserMenu(user) }
		  );
		  delete userStates[userId];
		  break;
		  
		case "waiting_manual_dial_number":
		  const manualDialNumber = sanitize_phoneNumber(text.trim());
		  if (!manualDialNumber) {
			bot.sendMessage(
			  chatId, 
			  "❌ Invalid phone number format. Please enter a valid phone number.\n\n" +
			  "Accepted formats:\n" +
			  "• 1234567890\n" +
			  "• +1234567890\n" +
			  "• 011234567890\n" +
			  "• (123) 456-7890"
			);
			return;
		  }
		  
		  const campaignForManualDial = await Campaign.findByPk(userState.campaignId, {
			include: [{ model: SipPeer, as: 'sipTrunk' }]
		  });
		  if (user.callerId && !campaignForManualDial.callerId) {
			  await campaignForManualDial.update({ callerId: user.callerId });
			  await campaignForManualDial.reload({ include: [{ model: SipPeer, as: 'sipTrunk' }] });
			}
			if (user.dialPrefix !== undefined && user.dialPrefix !== null && !campaignForManualDial.dialPrefix) {
			  await campaignForManualDial.update({ dialPrefix: user.dialPrefix });
			  await campaignForManualDial.reload({ include: [{ model: SipPeer, as: 'sipTrunk' }] });
			}
		  // Validate campaign has required settings
		  if (!campaignForManualDial.sipTrunk) {
			bot.sendMessage(
			  chatId,
			  `❌ *Manual Dial Failed*\n\nSIP Trunk not found. Please configure your SIP trunk first.`,
			  { parse_mode: "Markdown", ...getUserMenu(user) }
			);
			delete userStates[userId];
			return;
		  }
		  
		  // *** FIX: Ensure campaign has notificationsChatId ***
		  if (!campaignForManualDial.notificationsChatId) {
			await campaignForManualDial.update({ notificationsChatId: chatId });
		  }
		  
		  // Set campaign settings before dialing
		  set_settings({
			notifications_chat_id: chatId,  // *** FIX: Use chatId directly ***
			concurrent_calls: campaignForManualDial.concurrentCalls || 1,
			sip_trunk: campaignForManualDial.sipTrunk,
			caller_id: campaignForManualDial.callerId,
			dial_prefix: campaignForManualDial.dialPrefix || '',
			campaign_id: campaignForManualDial.id,
			dtmf_digit: campaignForManualDial.dtmfDigit || '1',
			ivr_intro_file: campaignForManualDial.ivrIntroFile,
			ivr_outro_file: campaignForManualDial.ivrOutroFile
		  });
		  
		  try {
			// Create a single lead entry and start dialing
			const leadData = [{
			  phoneNumber: manualDialNumber,
			  rawLine: `manual-dial-${manualDialNumber}`
			}];
			
			// Create database entry for this call
			await Call.create({
			  phoneNumber: `+${manualDialNumber}`,
			  rawLine: `manual-dial-${manualDialNumber}`,
			  used: false,
			  campaignId: campaignForManualDial.id,
			  callStatus: 'pending'
			});
			
			bot.sendMessage(
			  chatId,
			  `🚀 *Manual Dial Started*\n\n` +
			  `Dialing: ${escapeMarkdown(manualDialNumber)}\n` +
			  `SIP Trunk: ${escapeMarkdown(campaignForManualDial.sipTrunk.name)}\n` +
			  `Caller ID: ${escapeMarkdown(campaignForManualDial.callerId)}\n` +
			  `Dial Prefix: ${escapeMarkdown(campaignForManualDial.dialPrefix || 'None')}\n\n` +
			  `Call initiated successfully. You'll receive notifications about the call progress.`,
			  { parse_mode: "Markdown", ...getUserMenu(user) }
			);
			
			// Start the calling process using existing infrastructure
			startCallingProcess(leadData, campaignForManualDial, user.telegramId);
			
		  } catch (error) {
			console.error('Manual dial error:', error);
			bot.sendMessage(
			  chatId,
			  `❌ *Manual Dial Failed*\n\nError: ${escapeMarkdown(error.message)}`,
			  { parse_mode: "Markdown", ...getUserMenu(user) }
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
			{ parse_mode: "Markdown", ...getUserMenu(userId) }
		  );
		  delete userStates[userId];
		  break;
		
		case 'admin_setting_callerid':
		  await handleAdminSetCallerId(bot, msg, userStates, userId);
		  break;
		  
		case 'admin_setting_prefix':
		  await handleAdminSetPrefix(bot, msg, userStates, userId);
		  break;
		  
		case 'admin_setting_concurrent_calls':
		  await handleAdminSetConcurrentCalls(bot, msg, userStates, userId);
		  break;
		
		case 'admin_creating_rate_card':
			await handleCreateRateCard(bot, msg, userStates);
			break;
			
		case 'admin_creating_provider':
			await handleCreateProvider(bot, msg, userStates);
			break;
			
		case 'admin_uploading_rates':
			bot.sendMessage(chatId, "📋 Please upload a CSV file with the rate data.");
			break;
		
		case 'admin_creating_user':
		try {
		  const parts = text.split('|').map(part => part.trim());
		  
		  if (parts.length < 2) {
			bot.sendMessage(chatId, "❌ Invalid format. Please use: TELEGRAM_ID | FIRST_NAME | LAST_NAME");
			return;
		  }
		  
		  const [telegramId, firstName, lastName] = parts;
		  
		  // Validate Telegram ID (should be numeric)
		  if (!/^\d+$/.test(telegramId)) {
			bot.sendMessage(chatId, "❌ Invalid Telegram ID. It should be numeric (e.g., 123456789)");
			return;
		  }
		  
		  // Check if user already exists
		  const existingUser = await User.findOne({ where: { telegramId } });
		  if (existingUser) {
			bot.sendMessage(chatId, `❌ User with Telegram ID ${telegramId} already exists.`);
			delete userStates[userId];
			return;
		  }
		  
		  // Create new user with pending approval
		  const newUser = await User.create({
			telegramId,
			firstName: firstName || 'User',
			lastName: lastName || '',
			userType: 'user',
			status: 'active',
			balance: 0,
			approvalStatus: 'pending',
			requestedAt: new Date(),
			createdBy: userId
		  });
		  
		  bot.sendMessage(
			chatId,
			`✅ *User Created Successfully!*\n\n` +
			`Name: ${escapeMarkdown(newUser.firstName)} ${escapeMarkdown(newUser.lastName || '')}\n` +
			`Telegram ID: ${newUser.telegramId}\n` +
			`Status: Pending Approval\n\n` +
			`The user has been created with pending approval status. You can now:\n` +
			`• Configure their campaign settings\n` +
			`• Assign a rate card\n` +
			`• Approve their account\n\n` +
			`Use "⏳ Pending Approvals" to configure this user.`,
			{
			  parse_mode: 'Markdown',
			  reply_markup: {
				inline_keyboard: [
				  [{ text: '⏳ Pending Approvals', callback_data: 'admin_pending_approvals' }],
				  [{ text: '👥 All Users', callback_data: 'admin_users' }],
				  [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
				]
			  }
			}
		  );
		  
		  // Try to notify the new user
		  try {
			await bot.sendMessage(
			  telegramId,
			  `🎉 *Welcome!*\n\n` +
			  `Your account has been created and is pending administrator approval.\n\n` +
			  `Please wait for the administrator to configure your account settings. You'll receive another message when your account is ready to use.\n\n` +
			  `Send /start to check your status at any time.`,
			  { parse_mode: 'Markdown' }
			);
		  } catch (error) {
			console.log(`Could not notify new user ${telegramId}: ${error.message}`);
			// This is normal if the user hasn't started the bot yet
		  }
		  
		  delete userStates[userId];
		  
		} catch (error) {
		  console.error('Error creating user:', error);
		  bot.sendMessage(chatId, `❌ Error creating user: ${error.message}`);
		  delete userStates[userId];
		}
		break;
		case 'admin_adding_credit_amount':
		  await handleAddCreditAmount(bot, msg, userStates, userId);
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
			  { parse_mode: "Markdown", ...getUserMenu(user) }
			);
		  } else {
			bot.sendMessage(chatId, "❌ Callback cancelled.", getUserMenu(user));
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
			{ parse_mode: "Markdown", ...getUserMenu(user) }
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
			{ parse_mode: "Markdown", ...getUserMenu(user) }
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
			{ parse_mode: "Markdown", ...getUserMenu(userId) }
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
          getUserMenu(user)
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
			getUserMenu(user)
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
          getUserMenu(user)
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
            { parse_mode: "Markdown", ...getUserMenu(user) }
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
            bot.sendMessage(chatId, `✅ User ${permitId} permitted!`, getUserMenu(user));
          }
        } catch (error) {
          bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        }
        delete userStates[userId];
        break;
    }
  });

  // Handle bulk rate upload via CSV document
  bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userState = userStates[userId];
    
    if (!userState || userState.action !== 'admin_uploading_rates') {
      return;
    }
    
    const user = await checkUserAccess(userId, chatId, true); // Admin required
    if (!user) return;
    
    try {
      const fileId = msg.document.file_id;
      const fileName = msg.document.file_name;
      
      if (!fileName.toLowerCase().endsWith('.csv')) {
        bot.sendMessage(chatId, "❌ Please upload a CSV file.");
        return;
      }
      
      bot.sendMessage(chatId, "📋 Processing CSV file...");
      
      const fileInfo = await bot.getFile(fileId);
      const fileBuffer = await axios.get(`https://api.telegram.org/file/bot${config.telegram_bot_token}/${fileInfo.file_path}`, {
        responseType: 'arraybuffer'
      });
      
      const csvContent = Buffer.from(fileBuffer.data).toString('utf-8');
      
      // Process CSV and upload rates
      const result = await adminUtilities.bulkUploadRates(userState.rateCardId, csvContent);
      
      bot.sendMessage(
        chatId,
        `✅ *Rates Uploaded Successfully!*\n\n` +
        `Processed: ${result.created} rates\n` +
        `Total in file: ${result.total}\n\n` +
        `${result.message}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💳 Manage Rates', callback_data: 'admin_rates' }],
              [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
            ]
          }
        }
      );
      
      delete userStates[userId];
      
    } catch (error) {
      console.error('Error uploading rates:', error);
      bot.sendMessage(
        chatId,
        `❌ Error uploading rates: ${error.message}\n\n` +
        `Please check your CSV format and try again.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
            ]
          }
        }
      );
      delete userStates[userId];
    }
  });
  
  // Handle file uploads
  bot.on("message", async (msg) => {
	  if (!msg.audio && !msg.document) return;
	  
	  const chatId = msg.chat.id;
	  const userId = msg.from.id;
	  const user = msg.from.id;
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
				{ parse_mode: "Markdown", ...getUserMenu(user) }
			  );
			  delete userStates[userId];
			  break;
		  
		  case 'admin_setting_callerid':
			  await handleAdminSetCallerId(bot, msg, userStates, userId);
			  break;
			  
			case 'admin_setting_prefix':
			  await handleAdminSetPrefix(bot, msg, userStates, userId);
			  break;
		  case 'admin_setting_concurrent_calls':
			  await handleAdminSetConcurrentCalls(bot, msg, userStates, userId);
			  break;
			  
		  case 'admin_creating_rate_card':
			await handleCreateRateCard(bot, msg, userStates);
			break;
			
		  case 'admin_creating_provider':
			await handleCreateProvider(bot, msg, userStates);
			break;
			
		  case 'admin_uploading_rates':
			bot.sendMessage(chatId, "📋 Please upload a CSV file with the rate data.");
			break;
			
		  case 'admin_adding_credit_amount':
			  await handleAddCreditAmount(bot, msg, userStates, userId);
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
				{ parse_mode: "Markdown", ...getUserMenu(user) }
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
			  
			  // FIX: Pass userId for billing context
			  startCallingProcess(unprocessedData, campaign, userId);
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
			  
			  // Get current user for campaign creation
			  const currentUser = await User.findOne({ 
				where: { telegramId: userId.toString() },
				include: [
				  { model: SipPeer, as: 'sipTrunk' },
				  { model: SipPeer, as: 'callbackTrunk' }
				]
			  });
			  
			  if (!currentUser) {
				bot.sendMessage(chatId, "❌ User not found. Please contact administrator.");
				return;
			  }
			  
			  // Get or create campaign with user's settings
			  let currentCampaign = await Campaign.findOne({
				where: { createdBy: currentUser.telegramId },
				include: [
				  { model: SipPeer, as: 'sipTrunk' },
				  { model: SipPeer, as: 'callbackTrunk' }
				]
			  });

			  if (currentCampaign) {
				// Update existing campaign with user's current settings
				await currentCampaign.update({
				  sipTrunkId: currentUser.sipTrunkId,
				  callbackTrunkId: currentUser.callbackTrunkId,
				  callerId: currentUser.callerId,
				  dialPrefix: currentUser.dialPrefix,
				  concurrentCalls: currentUser.concurrentCalls,
				  notificationsChatId: chatId
				});
				
				// Reload with associations
				currentCampaign = await Campaign.findByPk(currentCampaign.id, {
				  include: [
					{ model: SipPeer, as: 'sipTrunk' },
					{ model: SipPeer, as: 'callbackTrunk' }
				  ]
				});
			  } else {
				// Create new campaign with user's settings
				currentCampaign = await Campaign.create({
				  botToken: config.telegram_bot_token,
				  campaignName: `${currentUser.firstName || currentUser.username || 'User'}'s Campaign`,
				  createdBy: currentUser.telegramId,
				  sipTrunkId: currentUser.sipTrunkId,
				  callbackTrunkId: currentUser.callbackTrunkId,
				  callerId: currentUser.callerId,
				  dialPrefix: currentUser.dialPrefix,
				  concurrentCalls: currentUser.concurrentCalls,
				  notificationsChatId: chatId,
				  isActive: true
				});
				
				// Reload with associations
				currentCampaign = await Campaign.findByPk(currentCampaign.id, {
				  include: [
					{ model: SipPeer, as: 'sipTrunk' },
					{ model: SipPeer, as: 'callbackTrunk' }
				  ]
				});
			  }
			  
			  const unprocessedData2 = await filterProcessedNumbers(data2, currentCampaign.id);
			  if (unprocessedData2.length === 0) {
				bot.sendMessage(chatId, "⚠️ All numbers have already been processed.");
				return;
			  }
			  
			  // Check if user can create campaigns (approved + complete settings)
			  if (currentUser.canCreateCampaign() && unprocessedData2.length > 0) {
				// Validate SIP trunk
				const trunkValidation = await validateSipTrunk(currentCampaign.sipTrunkId);
				if (!trunkValidation.valid) {
				  bot.sendMessage(
					chatId,
					`⚠️ *Leads Uploaded but Campaign NOT Started*\n\n` +
					`Total numbers: ${data2.length}\n` +
					`New numbers: ${unprocessedData2.length}\n` +
					`Duplicates: ${data2.length - unprocessedData2.length}\n\n` +
					`❌ SIP Trunk Error: ${escapeMarkdown(trunkValidation.message)}\n\n` +
					`Please contact administrator to fix the SIP trunk configuration.`,
					{ parse_mode: "Markdown", ...getUserMenu(currentUser) }
				  );
				  
				  // Still save the leads for when trunk is fixed
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
				
				// Reset campaign statistics
				await currentCampaign.update({
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
				
				// Auto-start campaign since user has complete settings
				bot.sendMessage(
				  chatId,
				  `✅ *Leads Uploaded & Campaign Auto-Started!*\n\n` +
				  `Total numbers: ${data2.length}\n` +
				  `New numbers: ${unprocessedData2.length}\n` +
				  `Duplicates: ${data2.length - unprocessedData2.length}\n\n` +
				  `🚀 *Auto-Starting Campaign:*\n` +
				  `SIP Trunk: ${escapeMarkdown(currentCampaign.sipTrunk ? currentCampaign.sipTrunk.name : 'N/A')}\n` +
				  `Caller ID: ${escapeMarkdown(currentCampaign.callerId || 'Not set')}\n` +
				  `Concurrent Calls: ${currentCampaign.concurrentCalls}\n` +
				  `Dial Prefix: ${escapeMarkdown(currentCampaign.dialPrefix || 'None')}\n\n` +
				  `Dialing will begin automatically...`,
				  { parse_mode: "Markdown", ...getUserMenu(currentUser) }
				);
				
				set_settings({
				  notifications_chat_id: chatId,
				  concurrent_calls: currentCampaign.concurrentCalls,
				  sip_trunk: currentCampaign.sipTrunk,
				  caller_id: currentCampaign.callerId,
				  dial_prefix: currentCampaign.dialPrefix || '',
				  campaign_id: currentCampaign.id,
				  dtmf_digit: currentCampaign.dtmfDigit || '1',
				  ivr_intro_file: currentCampaign.ivrIntroFile,
				  ivr_outro_file: currentCampaign.ivrOutroFile
				});
				
				startCallingProcess(unprocessedData2, currentCampaign, currentUser.telegramId);
			  } else {
				// User doesn't have complete settings
				const missingSettings = [];
				if (!currentUser.sipTrunkId) missingSettings.push("SIP Trunk");
				if (!currentUser.callerId) missingSettings.push("Caller ID");
				if (!currentUser.concurrentCalls) missingSettings.push("Concurrent Calls");
				if (currentUser.approvalStatus !== 'approved') missingSettings.push("Account Approval");
				
				bot.sendMessage(
				  chatId,
				  `✅ *Leads Uploaded Successfully*\n\n` +
				  `Total numbers: ${data2.length}\n` +
				  `New numbers: ${unprocessedData2.length}\n` +
				  `Duplicates: ${data2.length - unprocessedData2.length}\n\n` +
				  `⚠️ *Campaign NOT Started - Missing Configuration:*\n` +
				  `${missingSettings.map(f => `• ${f}`).join('\n')}\n\n` +
				  `Please contact the administrator to complete your setup.`,
				  { parse_mode: "Markdown", ...getUserMenu(currentUser) }
				);
				
				// Still save the leads for when user is configured
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
				getUserMenu(user)
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
        ...getUserMenu(user),
        parse_mode: "Markdown"
      }
    );
  });
   
   
  // Cost estimation command for users
  bot.onText(/\/estimate (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const phoneNumber = match[1];
    
    const user = await checkUserAccess(userId, chatId);
    if (!user) return;
    
    if (!user.rateCardId) {
      bot.sendMessage(chatId, "❌ No rate card assigned. Contact administrator.");
      return;
    }
    
    try {
      const estimate = await billingEngine.estimateCallCost(user.id, phoneNumber, 1);
      
      bot.sendMessage(
        chatId,
        `💰 *Rate Information*\n\n` +
        `Number: ${escapeMarkdown(phoneNumber)}\n` +
        `Destination: ${escapeMarkdown(estimate.destination.countryName)}\n` +
        `Rate: $${estimate.sellPrice.toFixed(6)} per minute\n` +
        `1 min cost: $${estimate.sellPrice.toFixed(4)}\n` +
        `5 min cost: $${(estimate.sellPrice * 5).toFixed(4)}`,
        { parse_mode: "Markdown" }
      );
      
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
  });
  
  // Balance check command
  bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    const user = await checkUserAccess(userId, chatId);
    if (!user) return;
    
    try {
      const financial = await billingEngine.getUserFinancialSummary(user.id);
      
      bot.sendMessage(
        chatId,
        `💰 *Account Balance*\n\n` +
        `Current Balance: $${financial.summary.currentBalance.toFixed(2)}\n` +
        `Credit Limit: $${financial.summary.creditLimit.toFixed(2)}\n` +
        `Available Balance: $${financial.summary.availableBalance.toFixed(2)}\n\n` +
        `Recent Activity:\n` +
        `Calls This Month: ${financial.summary.totalCalls}\n` +
        `Minutes Used: ${financial.summary.totalMinutes.toFixed(2)}\n` +
        `Amount Spent: $${financial.summary.totalSpent.toFixed(2)}`,
        { parse_mode: "Markdown" }
      );
      
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
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
      { parse_mode: "Markdown", ...getUserMenu(user) }
    );
    
  } catch (error) {
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

};

// Handle rate card creation
  async function handleCreateRateCard(bot, msg, userStates) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text.trim();
    const userState = userStates[userId];
    
    try {
      const parts = text.split('|').map(p => p.trim());
      if (parts.length !== 2) {
        bot.sendMessage(chatId, "❌ Invalid format. Use: `Name | Description`", { parse_mode: 'Markdown' });
        return;
      }
      
      const [name, description] = parts;
      
      if (!name || !description) {
        bot.sendMessage(chatId, "❌ Both name and description are required.");
        return;
      }
      
      const result = await adminUtilities.createRateCard({
        name,
        description,
        providerId: userState.providerId,
        currency: 'USD'
      });
      
      bot.sendMessage(
        chatId,
        `✅ *Rate Card Created Successfully!*\n\n` +
        `Name: ${escapeMarkdown(result.rateCard.name)}\n` +
        `Description: ${escapeMarkdown(result.rateCard.description)}\n` +
        `ID: ${result.rateCard.id}\n\n` +
        `You can now upload rates to this rate card.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 Upload Rates', callback_data: `admin_upload_rates_${result.rateCard.id}` }],
              [{ text: '💳 Manage Rates', callback_data: 'admin_rates' }],
              [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
            ]
          }
        }
      );
      
      delete userStates[userId];
      
    } catch (error) {
      console.error('Error creating rate card:', error);
      bot.sendMessage(chatId, `❌ Error creating rate card: ${error.message}`);
      delete userStates[userId];
    }
  }

  // Handle provider creation
  async function handleCreateProvider(bot, msg, userStates) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text.trim();
    
    try {
      const parts = text.split('|').map(p => p.trim());
      if (parts.length !== 5) {
        bot.sendMessage(
          chatId, 
          "❌ Invalid format. Use:\n`Name | Description | Currency | Billing Increment | Minimum Duration`", 
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      const [name, description, currency, billingIncrement, minimumDuration] = parts;
      
      if (!name || !description || !currency) {
        bot.sendMessage(chatId, "❌ Name, description, and currency are required.");
        return;
      }
      
      const billingInc = parseInt(billingIncrement) || 60;
      const minDuration = parseInt(minimumDuration) || 60;
      
      if (billingInc <= 0 || minDuration <= 0) {
        bot.sendMessage(chatId, "❌ Billing increment and minimum duration must be positive numbers.");
        return;
      }
      
      const result = await adminUtilities.createProvider({
        name,
        description,
        currency: currency.toUpperCase(),
        billingIncrement: billingInc,
        minimumDuration: minDuration
      });
      
      bot.sendMessage(
        chatId,
        `✅ *Provider Created Successfully!*\n\n` +
        `Name: ${escapeMarkdown(result.provider.name)}\n` +
        `Description: ${escapeMarkdown(result.provider.description)}\n` +
        `Currency: ${result.provider.currency}\n` +
        `Billing Increment: ${result.provider.billingIncrement}s\n` +
        `Minimum Duration: ${result.provider.minimumDuration}s\n` +
        `ID: ${result.provider.id}\n\n` +
        `You can now create rate cards for this provider.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏗️ Create Rate Card', callback_data: 'admin_create_rate' }],
              [{ text: '🏢 Manage Providers', callback_data: 'admin_providers' }],
              [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
            ]
          }
        }
      );
      
      delete userStates[userId];
      
    } catch (error) {
      console.error('Error creating provider:', error);
      bot.sendMessage(chatId, `❌ Error creating provider: ${error.message}`);
      delete userStates[userId];
    }
  }

function stopCallingProcess() {
  if (global.callingInterval) {
    clearInterval(global.callingInterval);
    global.callingInterval = null;
  }
  console.log('Calling process stopped');
}

module.exports = { initializeBot, startCallingProcess, stopCallingProcess  };