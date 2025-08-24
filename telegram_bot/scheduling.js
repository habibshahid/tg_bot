// telegram_bot/scheduling.js
// Add this file to handle all scheduling-related bot interactions

const moment = require('moment');
const { Op } = require('sequelize');
const Campaign = require('../models/campaign');
const SipPeer = require('../models/sippeer');
const simpleCampaignScheduler = require('../services/simpleCampaignScheduler');

// Helper function to escape markdown
function escapeMarkdown(text) {
  if (!text) return '';
  return text.toString()
    .replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

// Main scheduling handler
async function handleSchedulingCommands(bot, userStates) {
  
  // Schedule Campaign callback
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const callbackData = query.data;
    
    if (callbackData === 'schedule_campaign') {
      bot.answerCallbackQuery(query.id);
      
      // Start scheduling flow
      bot.sendMessage(
        chatId,
        `📅 *Schedule New Campaign*\n\n` +
        `Step 1: Upload Numbers List\n\n` +
        `Please upload a TXT file with phone numbers (one per line).`,
        { parse_mode: 'Markdown' }
      );
      
      const campaign = await Campaign.findOne({
        where: { botToken: require('../config').telegram_bot_token }
      });
      
      userStates[userId] = { 
        action: 'scheduling_numbers',
        campaignId: campaign.id,
        scheduleData: {}
      };
    }
    
    if (callbackData === 'manage_scheduled') {
      bot.answerCallbackQuery(query.id);
      await showScheduledCampaigns(bot, chatId, userId);
    }
    
	
	if (callbackData === 'sched_ivr_done') {
	  bot.answerCallbackQuery(query.id);
	  
	  const userState = userStates[userId];
	  if (userState && userState.action === 'scheduling_ivr_choice') {
		// User clicked "Done with IVR" - complete the scheduling
		bot.sendMessage(
		  chatId,
		  `✅ IVR configuration complete!\n\n` +
		  `Finalizing campaign schedule...`,
		  { parse_mode: 'Markdown' }
		);
		
		// Import and call completeScheduling
		const { completeScheduling } = require('./scheduling');
		await completeScheduling(bot, chatId, userId, userState, userStates);
	  }
	  return;
	}
	
    // Handle scheduled campaign actions and IVR choices
    if (callbackData.startsWith('sched_')) {
      bot.answerCallbackQuery(query.id);
      const parts = callbackData.split('_');
      
	  if (callbackData === 'sched_ivr_done') {
		const userState = userStates[userId];
		if (userState) {
		  bot.sendMessage(
			chatId,
			`✅ IVR configuration complete!\n\n` +
			`Finalizing campaign schedule...`,
			{ parse_mode: 'Markdown' }
		  );
		  
		  const { completeScheduling } = require('./scheduling');
		  await completeScheduling(bot, chatId, userId, userState, userStates);
		}
		return;
	  }
	  
      if (parts[1] === 'trunk') {
        // Handle trunk selection
        const trunkId = parseInt(parts[2]);
        const userState = userStates[userId];
        
        if (userState && userState.action === 'scheduling_sip_selection') {
          const trunk = userState.sipTrunks.find(t => t.id === trunkId);
          
          if (!trunk) {
            bot.sendMessage(chatId, `❌ Invalid trunk selection.`);
            return;
          }
          
          userState.scheduleData.sipTrunkId = trunkId;
          userState.action = 'scheduling_start_time';
          
          bot.sendMessage(
            chatId,
            `✅ SIP Trunk selected: ${escapeMarkdown(trunk.name)}\n\n` +
            `Step 3: Set Start Time\n\n` +
            `Enter start date and time (YYYY-MM-DD HH:MM):\n` +
            `Example: ${moment().add(1, 'hour').format('YYYY-MM-DD HH:mm')}`,
            { parse_mode: 'Markdown' }
          );
        }
      } else if (parts[1] === 'ivr') {
        // Handle IVR file choices
        const userState = userStates[userId];
        if (userState && userState.action === 'scheduling_ivr_choice') {
          const ivrAction = parts[2];
          
          if (ivrAction === 'skip') {
            // Skip IVR files and complete scheduling
            userState.scheduleData.ivrIntroFile = null;
            userState.scheduleData.ivrOutroFile = null;
            await completeScheduling(bot, chatId, userId, userState, userStates);
          } else if (ivrAction === 'intro') {
            userState.action = 'scheduling_ivr_intro';
            bot.sendMessage(
              chatId,
              `🎵 *Upload Intro IVR File*\n\n` +
              `Please upload the intro audio file (WAV, MP3, MP4, M4A, AAC, OGG, FLAC).\n` +
              `This will be played at the beginning of the call.`,
              { parse_mode: 'Markdown' }
            );
          } else if (ivrAction === 'outro') {
            userState.action = 'scheduling_ivr_outro';
            bot.sendMessage(
              chatId,
              `🎵 *Upload Outro IVR File*\n\n` +
              `Please upload the outro audio file (WAV, MP3, MP4, M4A, AAC, OGG, FLAC).\n` +
              `This will be played after the intro message.`,
              { parse_mode: 'Markdown' }
            );
          }
        }
      } else if (parts[1] === 'ivr' && parts[2] === 'done') {
        // IVR files done, complete scheduling
        const userState = userStates[userId];
        if (userState) {
          bot.sendMessage(
            chatId,
            `✅ IVR configuration complete!\n\n` +
            `Finalizing campaign schedule...`,
            { parse_mode: 'Markdown' }
          );
          await completeScheduling(bot, chatId, userId, userState, userStates);
        }
      } else {
        // Handle other scheduled campaign actions
        const action = parts[1];
        const scheduledId = parts[2];
        await handleScheduledCampaignAction(bot, chatId, action, scheduledId);
      }
    }
  });
  
  // Handle text messages for scheduling flow
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userState = userStates[userId];
    
    if (!userState || !userState.action || !userState.action.startsWith('scheduling_')) return;
    
    switch (userState.action) {
      case 'scheduling_start_time':
        await handleStartTimeInput(bot, msg, userState, userStates);
        break;
        
      case 'scheduling_end_time':
        await handleEndTimeInput(bot, msg, userState, userStates);
        break;
        
      case 'scheduling_campaign_name':
        await handleCampaignNameInput(bot, msg, userState, userStates);
        break;
        
      case 'scheduling_caller_id':
        await handleCallerIdInput(bot, msg, userState, userStates);
        break;
        
      case 'scheduling_concurrent':
        await handleConcurrentInput(bot, msg, userState, userStates);
        break;
        
      case 'scheduling_dtmf':
        await handleDtmfInput(bot, msg, userState, userStates);
        break;
        
      case 'scheduling_prefix':
        await handlePrefixInput(bot, msg, userState, userStates);
        break;
    }
  });
  
  // File uploads for scheduling are handled in the main index.js file
  // in the document handler with case "scheduling_numbers"
}

async function handleStartTimeInput(bot, msg, userState, userStates) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text.trim();
  
  // Parse the datetime
  const formats = [
    'YYYY-MM-DD HH:mm',
    'DD-MM-YYYY HH:mm',
    'MM-DD-YYYY HH:mm',
    'YYYY/MM/DD HH:mm',
    'DD/MM/YYYY HH:mm'
  ];
  
  let startTime = null;
  for (const format of formats) {
    const parsed = moment(text, format, true);
    if (parsed.isValid()) {
      startTime = parsed;
      break;
    }
  }
  
  if (!startTime) {
    bot.sendMessage(
      chatId,
      `❌ Invalid date/time format.\n\n` +
      `Please use format: YYYY-MM-DD HH:MM\n` +
      `Example: ${moment().add(1, 'hour').format('YYYY-MM-DD HH:mm')}`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // Check if time is in the past
  if (startTime.isBefore(moment())) {
    bot.sendMessage(
      chatId,
      `❌ Start time cannot be in the past.\n\n` +
      `Please enter a future date/time.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  userState.scheduleData.startDatetime = startTime.toDate();
  userState.action = 'scheduling_end_time';
  
  bot.sendMessage(
    chatId,
    `✅ Start time set: ${startTime.format('YYYY-MM-DD HH:mm')}\n\n` +
    `Step 4: Set End Time (Optional)\n\n` +
    `Enter end date/time (YYYY-MM-DD HH:MM) or type "skip" for no end time:`,
    { parse_mode: 'Markdown' }
  );
}

async function handleEndTimeInput(bot, msg, userState, userStates) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text.trim().toLowerCase();
  
  if (text === 'skip') {
    userState.scheduleData.endDatetime = null;
  } else {
    const endTime = moment(text, 'YYYY-MM-DD HH:mm', true);
    
    if (!endTime.isValid()) {
      bot.sendMessage(
        chatId,
        `❌ Invalid date/time format.\n\n` +
        `Please use format: YYYY-MM-DD HH:MM or type "skip"`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Check if end time is after start time
    if (endTime.isSameOrBefore(moment(userState.scheduleData.startDatetime))) {
      bot.sendMessage(
        chatId,
        `❌ End time must be after start time.\n\n` +
        `Start: ${moment(userState.scheduleData.startDatetime).format('YYYY-MM-DD HH:mm')}\n` +
        `Please enter a valid end time:`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    userState.scheduleData.endDatetime = endTime.toDate();
  }
  
  userState.action = 'scheduling_campaign_name';
  
  bot.sendMessage(
    chatId,
    `✅ End time ${userState.scheduleData.endDatetime ? 'set: ' + moment(userState.scheduleData.endDatetime).format('YYYY-MM-DD HH:mm') : 'skipped'}\n\n` +
    `Step 5: Campaign Name\n\n` +
    `Enter a name for this scheduled campaign:`,
    { parse_mode: 'Markdown' }
  );
}

async function handleCampaignNameInput(bot, msg, userState, userStates) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text.trim();
  
  if (!text || text.length < 3) {
    bot.sendMessage(
      chatId,
      `❌ Campaign name must be at least 3 characters.\n\n` +
      `Please enter a valid name:`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  userState.scheduleData.name = text;
  userState.action = 'scheduling_caller_id';
  
  bot.sendMessage(
    chatId,
    `✅ Campaign name set: ${escapeMarkdown(text)}\n\n` +
    `Step 6: Caller ID\n\n` +
    `Enter the caller ID number to use:`,
    { parse_mode: 'Markdown' }
  );
}

async function handleCallerIdInput(bot, msg, userState, userStates) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text.trim().replace(/[^0-9+]/g, '');
  
  if (!text || text.length < 3) {
    bot.sendMessage(
      chatId,
      `❌ Invalid caller ID.\n\n` +
      `Please enter a valid phone number:`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  userState.scheduleData.callerId = text;
  userState.action = 'scheduling_concurrent';
  
  bot.sendMessage(
    chatId,
    `✅ Caller ID set: ${escapeMarkdown(text)}\n\n` +
    `Step 7: Concurrent Calls\n\n` +
    `Enter maximum concurrent calls (1-100) or type "30" for default:`,
    { parse_mode: 'Markdown' }
  );
}

async function handleConcurrentInput(bot, msg, userState, userStates) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text.trim();
  const concurrent = parseInt(text);
  
  if (isNaN(concurrent) || concurrent < 1 || concurrent > 100) {
    bot.sendMessage(
      chatId,
      `❌ Invalid number. Please enter a value between 1 and 100:`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  userState.scheduleData.concurrentCalls = concurrent;
  userState.action = 'scheduling_dtmf';
  
  bot.sendMessage(
    chatId,
    `✅ Concurrent calls set: ${concurrent}\n\n` +
    `Step 8: DTMF Digit\n\n` +
    `Enter the DTMF digit to track (0-9) or type "1" for default:`,
    { parse_mode: 'Markdown' }
  );
}

async function handleDtmfInput(bot, msg, userState, userStates) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text.trim();
  
  if (!/^[0-9]$/.test(text)) {
    bot.sendMessage(
      chatId,
      `❌ Invalid DTMF digit. Please enter a single digit (0-9):`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  userState.scheduleData.dtmfDigit = text;
  userState.action = 'scheduling_prefix';
  
  bot.sendMessage(
    chatId,
    `✅ DTMF digit set: ${text}\n\n` +
    `Step 9: Dial Prefix (Optional)\n\n` +
    `Enter a dial prefix (e.g., "9" or "001") or type "skip":`,
    { parse_mode: 'Markdown' }
  );
}

async function handlePrefixInput(bot, msg, userState, userStates) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text.trim();
  
  if (text.toLowerCase() === 'skip') {
    userState.scheduleData.dialPrefix = '';
  } else if (!/^\d*$/.test(text)) {
    bot.sendMessage(
      chatId,
      `❌ Prefix should only contain numbers. Enter prefix or type "skip":`,
      { parse_mode: 'Markdown' }
    );
    return;
  } else {
    userState.scheduleData.dialPrefix = text;
  }
  
  // Ask about IVR files
  userState.action = 'scheduling_ivr_choice';
  
  bot.sendMessage(
    chatId,
    `✅ Dial prefix ${userState.scheduleData.dialPrefix ? 'set: ' + userState.scheduleData.dialPrefix : 'skipped'}\n\n` +
    `Step 10: IVR Files (Optional)\n\n` +
    `Would you like to upload IVR audio files for this campaign?`,
    { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📥 Upload Intro IVR', callback_data: 'sched_ivr_intro' },
            { text: '📤 Upload Outro IVR', callback_data: 'sched_ivr_outro' }
          ],
          [
            { text: '⏭️ Skip IVR Files', callback_data: 'sched_ivr_skip' }
          ]
        ]
      }
    }
  );
}

// Note: File upload handling for scheduling_numbers is done in the main index.js file
// This function is kept for reference but not used directly

// In telegram_bot/scheduling.js, replace completeScheduling with this simpler version:

async function completeScheduling(bot, chatId, userId, userState, userStates) {
  try {
    const scheduleData = userState.scheduleData;
    const Campaign = require('../models/campaign');
    
    // Get the existing campaign and update it with scheduling info
    const campaign = await Campaign.findByPk(userState.campaignId);
    
    // Update the campaign with scheduling data
    await campaign.update({
      campaignName: scheduleData.name,
      campaignStatus: 'scheduled',
      scheduledStart: scheduleData.startDatetime,
      scheduledEnd: scheduleData.endDatetime,
      numbersList: scheduleData.numbersList,
      sipTrunkId: scheduleData.sipTrunkId,
      callerId: scheduleData.callerId,
      dialPrefix: scheduleData.dialPrefix || '',
      ivrIntroFile: scheduleData.ivrIntroFile,
      ivrOutroFile: scheduleData.ivrOutroFile,
      dtmfDigit: scheduleData.dtmfDigit,
      concurrentCalls: scheduleData.concurrentCalls,
      notificationsChatId: chatId,
      createdBy: userId.toString()
    });
    
    const trunk = await SipPeer.findByPk(scheduleData.sipTrunkId);
    
    bot.sendMessage(
      chatId,
      `✅ *Campaign Scheduled Successfully!*\n\n` +
      `📋 *Details:*\n` +
      `Name: ${escapeMarkdown(scheduleData.name)}\n` +
      `Numbers: ${scheduleData.totalNumbers}\n` +
      `SIP Trunk: ${escapeMarkdown(trunk.name)}\n` +
      `Caller ID: ${escapeMarkdown(scheduleData.callerId)}\n` +
      `DTMF Digit: ${scheduleData.dtmfDigit}\n` +
      `Concurrent Calls: ${scheduleData.concurrentCalls}\n` +
      `${scheduleData.dialPrefix ? `Dial Prefix: ${scheduleData.dialPrefix}\n` : ''}` +
      `\n📅 *Schedule:*\n` +
      `Start: ${moment(scheduleData.startDatetime).format('YYYY-MM-DD HH:mm')}\n` +
      `${scheduleData.endDatetime ? `End: ${moment(scheduleData.endDatetime).format('YYYY-MM-DD HH:mm')}` : 'No end time set'}\n` +
      `\nThe campaign will start automatically at the scheduled time.`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 View Scheduled Campaigns', callback_data: 'manage_scheduled' }],
            [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
          ]
        }
      }
    );
    
    delete userStates[userId];
    
  } catch (error) {
    console.error('Error scheduling campaign:', error);
    bot.sendMessage(
      chatId,
      `❌ Error scheduling campaign: ${escapeMarkdown(error.message)}`,
      { parse_mode: 'Markdown' }
    );
    delete userStates[userId];
  }
}

// In telegram_bot/scheduling.js, update showScheduledCampaigns:

async function showScheduledCampaigns(bot, chatId, userId) {
  try {
    const Campaign = require('../models/campaign');
    const SipPeer = require('../models/sippeer');
    const { Op } = require('sequelize');
    const moment = require('moment');
    
    // Get scheduled and running campaigns
    const campaigns = await Campaign.findAll({
      where: {
        campaignStatus: { 
          [Op.in]: ['scheduled', 'running', 'paused'] 
        },
        botToken: require('../config').telegram_bot_token
      },
      include: [
        { model: SipPeer, as: 'sipTrunk', attributes: ['name'] }
      ],
      order: [['scheduledStart', 'ASC']]
    });
    
    if (campaigns.length === 0) {
      bot.sendMessage(
        chatId,
        `📋 *No Scheduled Campaigns*\n\n` +
        `You don't have any scheduled or running campaigns.`,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📅 Schedule New Campaign', callback_data: 'schedule_campaign' }],
              [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
            ]
          }
        }
      );
      return;
    }
    
    let message = `📋 *Scheduled Campaigns*\n\n`;
    const keyboards = [];
    
    campaigns.forEach((campaign, index) => {
      const statusEmoji = {
        'scheduled': '⏰',
        'running': '🚀',
        'paused': '⏸️'
      }[campaign.campaignStatus];
      
      const numbers = campaign.numbersList ? campaign.numbersList.length : 0;
      
      message += `${statusEmoji} *${index + 1}. ${escapeMarkdown(campaign.campaignName)}*\n`;
      message += `Status: ${campaign.campaignStatus}\n`;
      message += `Numbers: ${numbers}`;
      if (campaign.campaignStatus === 'running') {
        message += ` (${campaign.totalCalls} calls made)`;
      }
      message += `\n`;
      message += `Start: ${moment(campaign.scheduledStart).format('YYYY-MM-DD HH:mm')}\n`;
      if (campaign.scheduledEnd) {
        message += `End: ${moment(campaign.scheduledEnd).format('YYYY-MM-DD HH:mm')}\n`;
      }
      message += `\n`;
      
      // Add action buttons
      const actions = [];
      
      if (campaign.campaignStatus === 'scheduled') {
        actions.push({ text: '❌ Cancel', callback_data: `cancel_sched_${campaign.id}` });
        actions.push({ text: '▶️ Start Now', callback_data: `start_now_${campaign.id}` });
      } else if (campaign.campaignStatus === 'running') {
        actions.push({ text: '📊 Stats', callback_data: `stats_${campaign.id}` });
        actions.push({ text: '⏹️ Stop', callback_data: `stop_sched_${campaign.id}` });
      }
      
      if (actions.length > 0) {
        keyboards.push(actions);
      }
    });
    
    keyboards.push([{ text: '📅 Schedule New', callback_data: 'schedule_campaign' }]);
    keyboards.push([{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]);
    
    bot.sendMessage(
      chatId,
      message,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboards
        }
      }
    );
    
  } catch (error) {
    console.error('Error showing scheduled campaigns:', error);
    bot.sendMessage(
      chatId,
      `❌ Error loading campaigns: ${error.message}`,
      { parse_mode: 'Markdown' }
    );
  }
}

async function handleScheduledCampaignAction(bot, chatId, action, campaignId) {
  try {
    const Campaign = require('../models/campaign');
    let message = '';
    
    switch (action) {
      case 'cancel_sched':
        // Cancel a scheduled campaign
        const campaign = await Campaign.findByPk(campaignId);
        if (campaign) {
          await campaign.update({ campaignStatus: 'cancelled' });
          message = '❌ Campaign cancelled successfully';
        }
        break;
        
      case 'start_now':
        // Start a scheduled campaign immediately
        const campaignToStart = await Campaign.findByPk(campaignId, {
          include: [{ model: SipPeer, as: 'sipTrunk' }]
        });
        if (campaignToStart) {
          await simpleCampaignScheduler.startScheduledCampaign(campaignToStart);
          message = '🚀 Campaign started immediately';
        }
        break;
        
      case 'stop_sched':
        // Stop a running campaign
        const runningCampaign = await Campaign.findByPk(campaignId);
        if (runningCampaign) {
          await simpleCampaignScheduler.stopScheduledCampaign(runningCampaign);
          message = '⏹️ Campaign stopped successfully';
        }
        break;
        
      case 'stats':
        // Show campaign stats
        await showCampaignStats(bot, chatId, campaignId);
        return;
        
      default:
        message = '❌ Unknown action';
    }
    
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    
    // Refresh the list
    setTimeout(() => {
      showScheduledCampaigns(bot, chatId, null);
    }, 1000);
    
  } catch (error) {
    console.error('Error handling scheduled campaign action:', error);
    bot.sendMessage(
      chatId,
      `❌ Error: ${escapeMarkdown(error.message)}`,
      { parse_mode: 'Markdown' }
    );
  }
}

async function showCampaignStats(bot, chatId, campaignId) {
  try {
    const campaign = await Campaign.findByPk(campaignId, {
      include: [{ model: SipPeer, as: 'sipTrunk' }]
    });
    
    if (!campaign) {
      bot.sendMessage(chatId, '❌ Campaign not found', { parse_mode: 'Markdown' });
      return;
    }
    
    const totalCalls = campaign.totalCalls || 0;
    const successRate = totalCalls > 0 
      ? ((campaign.successfulCalls / totalCalls) * 100).toFixed(1) 
      : 0;
    const responseRate = campaign.successfulCalls > 0 
      ? ((campaign.dtmfResponses / campaign.successfulCalls) * 100).toFixed(1) 
      : 0;
    
    let message = `📊 *Campaign Statistics*\n\n`;
    message += `📋 *${escapeMarkdown(campaign.campaignName)}*\n`;
    message += `Status: ${campaign.campaignStatus}\n\n`;
    
    message += `📞 *Call Results:*\n`;
    message += `Total Calls: ${totalCalls}\n`;
    message += `✅ Successful: ${campaign.successfulCalls || 0}\n`;
    message += `❌ Failed: ${campaign.failedCalls || 0}\n`;
    message += `🔢 DTMF (${campaign.dtmfDigit}): ${campaign.dtmfResponses || 0}\n\n`;
    
    message += `📊 *Performance:*\n`;
    message += `Success Rate: ${successRate}%\n`;
    message += `Response Rate: ${responseRate}%\n\n`;
    
    message += `⚙️ *Configuration:*\n`;
    message += `SIP Trunk: ${escapeMarkdown(campaign.sipTrunk ? campaign.sipTrunk.name : 'N/A')}\n`;
    message += `Caller ID: ${escapeMarkdown(campaign.callerId)}\n`;
    message += `Concurrent: ${campaign.concurrentCalls} calls\n`;
    
    bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Back to List', callback_data: 'manage_scheduled' }],
          [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
        ]
      }
    });
    
  } catch (error) {
    console.error('Error showing campaign stats:', error);
    bot.sendMessage(
      chatId,
      `❌ Error loading stats: ${error.message}`,
      { parse_mode: 'Markdown' }
    );
  }
}

module.exports = {
  handleSchedulingCommands,
  showScheduledCampaigns,
  completeScheduling
};