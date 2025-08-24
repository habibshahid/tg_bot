// telegram_bot/scheduling.js
// Add this file to handle all scheduling-related bot interactions
const moment = require('moment-timezone');
const { Op } = require('sequelize');
const Campaign = require('../models/campaign');
const SipPeer = require('../models/sippeer');
const simpleCampaignScheduler = require('../services/simpleCampaignScheduler');

const COMMON_TIMEZONES = [
  { name: '🌍 UTC (London Winter)', value: 'UTC', offset: '+00:00' },
  { name: '🇷🇴 Romania (EEST)', value: 'Europe/Bucharest', offset: '+03:00' },
  { name: '🇵🇰 Pakistan (Karachi)', value: 'Asia/Karachi', offset: '+05:00' },
  { name: '🇦🇪 Dubai (GST)', value: 'Asia/Dubai', offset: '+04:00' },
  { name: '🇮🇳 India (IST)', value: 'Asia/Kolkata', offset: '+05:30' },
  { name: '🇬🇧 London (BST)', value: 'Europe/London', offset: '+01:00' },
  { name: '🇩🇪 Germany (CEST)', value: 'Europe/Berlin', offset: '+02:00' },
  { name: '🇺🇸 Eastern (EDT)', value: 'America/New_York', offset: '-04:00' },
  { name: '🇺🇸 Central (CDT)', value: 'America/Chicago', offset: '-05:00' },
  { name: '🇺🇸 Mountain (MDT)', value: 'America/Denver', offset: '-06:00' },
  { name: '🇺🇸 Pacific (PDT)', value: 'America/Los_Angeles', offset: '-07:00' },
  { name: '🇸🇬 Singapore', value: 'Asia/Singapore', offset: '+08:00' },
  { name: '🇦🇺 Sydney', value: 'Australia/Sydney', offset: '+10:00' }
];

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
    
	if (callbackData.startsWith('tz_')) {
	  bot.answerCallbackQuery(query.id);
	  const userState = userStates[userId];
	  
	  if (userState && userState.action === 'scheduling_timezone') {
		const timezone = callbackData.substring(3);
		
		if (timezone === 'custom') {
		  // Handle custom timezone input
		  bot.sendMessage(
			chatId,
			`📝 *Enter Custom Timezone*\n\n` +
			`Please enter a valid timezone identifier.\n\n` +
			`Examples:\n` +
			`• Asia/Karachi (Pakistan)\n` +
			`• Europe/Bucharest (Romania/EEST)\n` +
			`• America/New_York\n` +
			`• Europe/London\n` +
			`• Asia/Dubai\n\n` +
			`You can find a full list at:\n` +
			`https://en.wikipedia.org/wiki/List_of_tz_database_time_zones`,
			{ parse_mode: 'Markdown' }
		  );
		  userState.action = 'scheduling_timezone_custom';
		} else {
		  // Validate and set timezone
		  if (moment.tz.zone(timezone)) {
			userState.scheduleData.timezone = timezone;
			
			// NOW interpret the times in the selected timezone
			// Parse the string times AS IF they are in the selected timezone
			const startInSelectedTz = moment.tz(
			  userState.scheduleData.startDatetimeString,
			  'YYYY-MM-DD HH:mm',
			  timezone
			);
			
			let endInSelectedTz = null;
			if (userState.scheduleData.endDatetimeString) {
			  endInSelectedTz = moment.tz(
				userState.scheduleData.endDatetimeString,
				'YYYY-MM-DD HH:mm',
				timezone
			  );
			}
			
			// Convert to UTC for storage
			const startUTC = startInSelectedTz.clone().utc();
			const endUTC = endInSelectedTz ? endInSelectedTz.clone().utc() : null;
			
			// Store the UTC times
			userState.scheduleData.startDatetimeUTC = startUTC.toDate();
			userState.scheduleData.endDatetimeUTC = endUTC ? endUTC.toDate() : null;
			
			// Also store the original times for reference
			userState.scheduleData.startDatetime = startInSelectedTz.toDate();
			userState.scheduleData.endDatetime = endInSelectedTz ? endInSelectedTz.toDate() : null;
			
			// Get server info
			const serverInfo = getServerTimezoneInfo();
			
			// Calculate server local time for display
			const serverNow = moment();
			const startInServerTime = startUTC.clone().utcOffset(serverNow.utcOffset());
			const endInServerTime = endUTC ? endUTC.clone().utcOffset(serverNow.utcOffset()) : null;
			
			// Show comprehensive timezone information
			let confirmMsg = `✅ *Timezone Configuration*\n\n`;
			
			confirmMsg += `🌍 *Selected Timezone: ${timezone}*\n`;
			confirmMsg += `Your campaign times:\n`;
			confirmMsg += `Start: ${startInSelectedTz.format('YYYY-MM-DD HH:mm')} ${startInSelectedTz.format('z')}\n`;
			if (endInSelectedTz) {
			  confirmMsg += `End: ${endInSelectedTz.format('YYYY-MM-DD HH:mm')} ${endInSelectedTz.format('z')}\n`;
			}
			
			confirmMsg += `\n⏰ *UTC Times (for reference):*\n`;
			confirmMsg += `Start: ${startUTC.format('YYYY-MM-DD HH:mm')} UTC\n`;
			if (endUTC) {
			  confirmMsg += `End: ${endUTC.format('YYYY-MM-DD HH:mm')} UTC\n`;
			}
			
			confirmMsg += `\n🖥️ *Server Information:*\n`;
			confirmMsg += `Current Server Time: ${serverInfo.currentTime}\n`;
			confirmMsg += `Server UTC Offset: ${serverInfo.offset}\n`;
			confirmMsg += `Campaign will start at (server time):\n`;
			confirmMsg += `${startInServerTime.format('YYYY-MM-DD HH:mm')}\n`;
			if (endInServerTime) {
			  confirmMsg += `Campaign will end at (server time):\n`;
			  confirmMsg += `${endInServerTime.format('YYYY-MM-DD HH:mm')}\n`;
			}
			
			// Calculate time until start
			const now = moment();
			const timeUntilStart = moment.duration(startUTC.diff(now));
			if (timeUntilStart.asMinutes() > 0) {
			  const days = Math.floor(timeUntilStart.asDays());
			  const hours = timeUntilStart.hours();
			  const minutes = timeUntilStart.minutes();
			  confirmMsg += `\n⏳ *Campaign starts in:*\n`;
			  if (days > 0) {
				confirmMsg += `${days} days, ${hours} hours, ${minutes} minutes`;
			  } else {
				confirmMsg += `${hours} hours, ${minutes} minutes`;
			  }
			}
			
			bot.sendMessage(chatId, confirmMsg, { parse_mode: 'Markdown' });
			
			// Move to campaign name
			userState.action = 'scheduling_campaign_name';
			
			setTimeout(() => {
			  bot.sendMessage(
				chatId,
				`Step 6: Campaign Name\n\n` +
				`Enter a name for this scheduled campaign:`,
				{ parse_mode: 'Markdown' }
			  );
			}, 1500);
		  } else {
			bot.sendMessage(chatId, `❌ Invalid timezone: ${timezone}`);
		  }
		}
	  }
	}

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
	
    if (callbackData.startsWith('cancel_sched_') || 
		callbackData.startsWith('start_now_') || 
		callbackData.startsWith('stop_sched_') || 
		callbackData.startsWith('stats_')) {
	  
	  bot.answerCallbackQuery(query.id);
	  
	  const parts = callbackData.split('_');
	  let action, campaignId;
	  
	  if (callbackData.startsWith('cancel_sched_')) {
		action = 'cancel_sched';
		campaignId = parts[2];
	  } else if (callbackData.startsWith('start_now_')) {
		action = 'start_now';
		campaignId = parts[2];
	  } else if (callbackData.startsWith('stop_sched_')) {
		action = 'stop_sched';
		campaignId = parts[2];
	  } else if (callbackData.startsWith('stats_')) {
		action = 'stats';
		campaignId = parts[1];
	  }
	  
	  await handleScheduledCampaignAction(bot, chatId, action, campaignId);
	  return;
	}

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
	  
	  case 'scheduling_timezone_custom':
		await handleCustomTimezoneInput(bot, msg, userState, userStates);
		break;
    }
  });
  
  // File uploads for scheduling are handled in the main index.js file
  // in the document handler with case "scheduling_numbers"
}

async function handleCustomTimezoneInput(bot, msg, userState, userStates) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const timezone = msg.text.trim();
  
  // Validate timezone
  if (!moment.tz.zone(timezone)) {
    bot.sendMessage(
      chatId,
      `❌ Invalid timezone: "${timezone}"\n\n` +
      `Please enter a valid timezone identifier.\n` +
      `Example: Asia/Karachi, Europe/Bucharest, America/New_York`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  userState.scheduleData.timezone = timezone;
  
  // Get server info
  const serverInfo = getServerTimezoneInfo();
  
  // Create moment objects in the selected timezone
  const startInSelectedTz = moment.tz(
    moment(userState.scheduleData.startDatetime).format('YYYY-MM-DD HH:mm'),
    'YYYY-MM-DD HH:mm',
    timezone
  );
  
  let endInSelectedTz = null;
  if (userState.scheduleData.endDatetime) {
    endInSelectedTz = moment.tz(
      moment(userState.scheduleData.endDatetime).format('YYYY-MM-DD HH:mm'),
      'YYYY-MM-DD HH:mm',
      timezone
    );
  }
  
  // Convert to UTC for storage
  const startUTC = startInSelectedTz.clone().utc();
  const endUTC = endInSelectedTz ? endInSelectedTz.clone().utc() : null;
  
  userState.scheduleData.startDatetimeUTC = startUTC.toDate();
  userState.scheduleData.endDatetimeUTC = endUTC ? endUTC.toDate() : null;
  
  // Calculate server local time
  const serverNow = moment();
  const startInServerTime = startUTC.clone().utcOffset(serverNow.utcOffset());
  const endInServerTime = endUTC ? endUTC.clone().utcOffset(serverNow.utcOffset()) : null;
  
  // Show comprehensive timezone information
  let confirmMsg = `✅ *Timezone Configuration*\n\n`;
  
  confirmMsg += `🌍 *Selected Timezone: ${timezone}*\n`;
  confirmMsg += `Your campaign times:\n`;
  confirmMsg += `Start: ${startInSelectedTz.format('YYYY-MM-DD HH:mm')} ${startInSelectedTz.format('z')}\n`;
  if (endInSelectedTz) {
    confirmMsg += `End: ${endInSelectedTz.format('YYYY-MM-DD HH:mm')} ${endInSelectedTz.format('z')}\n`;
  }
  
  confirmMsg += `\n⏰ *UTC Times (for reference):*\n`;
  confirmMsg += `Start: ${startUTC.format('YYYY-MM-DD HH:mm')} UTC\n`;
  if (endUTC) {
    confirmMsg += `End: ${endUTC.format('YYYY-MM-DD HH:mm')} UTC\n`;
  }
  
  confirmMsg += `\n🖥️ *Server Information:*\n`;
  confirmMsg += `Current Server Time: ${serverInfo.currentTime}\n`;
  confirmMsg += `Server UTC Offset: ${serverInfo.offset}\n`;
  confirmMsg += `Campaign will start at (server time):\n`;
  confirmMsg += `${startInServerTime.format('YYYY-MM-DD HH:mm')}\n`;
  if (endInServerTime) {
    confirmMsg += `Campaign will end at (server time):\n`;
    confirmMsg += `${endInServerTime.format('YYYY-MM-DD HH:mm')}\n`;
  }
  
  // Calculate time until start
  const now = moment();
  const timeUntilStart = moment.duration(startUTC.diff(now));
  if (timeUntilStart.asMinutes() > 0) {
    const days = Math.floor(timeUntilStart.asDays());
    const hours = timeUntilStart.hours();
    const minutes = timeUntilStart.minutes();
    confirmMsg += `\n⏳ *Campaign starts in:*\n`;
    if (days > 0) {
      confirmMsg += `${days} days, ${hours} hours, ${minutes} minutes`;
    } else {
      confirmMsg += `${hours} hours, ${minutes} minutes`;
    }
  } else {
    confirmMsg += `\n⚠️ *Note: Start time is in the past!*`;
  }
  
  bot.sendMessage(chatId, confirmMsg, { parse_mode: 'Markdown' });
  
  // Move to campaign name
  userState.action = 'scheduling_campaign_name';
  
  setTimeout(() => {
    bot.sendMessage(
      chatId,
      `Step 6: Campaign Name\n\n` +
      `Enter a name for this scheduled campaign:`,
      { parse_mode: 'Markdown' }
    );
  }, 1500);
}

async function handleStartTimeInput(bot, msg, userState, userStates) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text.trim();
  
  // Parse the datetime WITHOUT timezone interpretation
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
  
  // IMPORTANT: Store just the string, not a Date object
  // This avoids any timezone interpretation at this stage
  userState.scheduleData.startDatetimeString = text;
  userState.action = 'scheduling_end_time';
  
  bot.sendMessage(
    chatId,
    `✅ Start time set: ${text}\n\n` +
    `Step 4: Set End Time (Optional)\n\n` +
    `Enter end date/time (YYYY-MM-DD HH:MM) or type "skip" for no end time:`,
    { parse_mode: 'Markdown' }
  );
}

// ========== FIX 2: Update handleEndTimeInput similarly ==========
async function handleEndTimeInput(bot, msg, userState, userStates) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text.trim().toLowerCase();
  
  if (text === 'skip') {
    userState.scheduleData.endDatetimeString = null;
  } else {
    // Parse to validate format only
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
    
    // Store as string
    userState.scheduleData.endDatetimeString = text;
  }
  
  // Move to timezone selection
  userState.action = 'scheduling_timezone';
  
  // Create inline keyboard for timezone selection
  const keyboard = {
    inline_keyboard: [
      ...COMMON_TIMEZONES.map(tz => [{
        text: tz.name,
        callback_data: `tz_${tz.value}`
      }]),
      [{ text: '📝 Enter Custom Timezone', callback_data: 'tz_custom' }]
    ]
  };
  
  bot.sendMessage(
    chatId,
    `✅ Times set!\n\n` +
    `⏰ *Step 5: Select Timezone*\n\n` +
    `Your scheduled times:\n` +
    `Start: ${userState.scheduleData.startDatetimeString}\n` +
    `${userState.scheduleData.endDatetimeString ? `End: ${userState.scheduleData.endDatetimeString}` : 'No end time'}\n\n` +
    `In which timezone are these times?`,
    { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }
  );
}

async function completeScheduling(bot, chatId, userId, userState, userStates) {
  try {
    const scheduleData = userState.scheduleData;
    const Campaign = require('../models/campaign');
    
    // Get the existing campaign and update it with scheduling info
    const campaign = await Campaign.findByPk(userState.campaignId);
    
    // Update the campaign with scheduling data
    // USE THE UTC TIMES that were calculated when timezone was selected
    await campaign.update({
      campaignName: scheduleData.name,
      campaignStatus: 'scheduled',
      scheduledStart: scheduleData.startDatetimeUTC,  // Use UTC time
      scheduledEnd: scheduleData.endDatetimeUTC,      // Use UTC time
      timezone: scheduleData.timezone,                // Store the user's timezone
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
    
    // Display confirmation in user's timezone
    const startInUserTz = moment.utc(scheduleData.startDatetimeUTC).tz(scheduleData.timezone);
    const endInUserTz = scheduleData.endDatetimeUTC ? 
      moment.utc(scheduleData.endDatetimeUTC).tz(scheduleData.timezone) : null;
    
    bot.sendMessage(
      chatId,
      `✅ *Campaign Scheduled Successfully!*\n\n` +
      `📌 *Campaign Name:* ${escapeMarkdown(scheduleData.name)}\n` +
      `🌍 *Timezone:* ${scheduleData.timezone}\n` +
      `⏰ *Start Time:* ${startInUserTz.format('YYYY-MM-DD HH:mm z')}\n` +
      `${endInUserTz ? `⏱️ *End Time:* ${endInUserTz.format('YYYY-MM-DD HH:mm z')}\n` : ''}` +
      `📞 *Numbers:* ${scheduleData.numbersList.length}\n` +
      `🔊 *SIP Trunk:* ${escapeMarkdown(trunk.name)}\n` +
      `📱 *Caller ID:* ${scheduleData.callerId}\n` +
      `⚡ *Concurrent Calls:* ${scheduleData.concurrentCalls}\n` +
      `${scheduleData.dtmfDigit ? `🔢 *DTMF Digit:* ${scheduleData.dtmfDigit}\n` : ''}` +
      `${scheduleData.dialPrefix ? `➕ *Dial Prefix:* ${scheduleData.dialPrefix}\n` : ''}` +
      `\n📊 Campaign will start automatically at the scheduled time.`,
      { parse_mode: 'Markdown' }
    );
    
    // Clear user state
    delete userStates[userId];
    
  } catch (error) {
    console.error('Error completing scheduling:', error);
    bot.sendMessage(
      chatId,
      `❌ Error scheduling campaign: ${error.message}`,
      { parse_mode: 'Markdown' }
    );
  }
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

function getServerTimezoneInfo() {
  const serverTime = moment();
  const serverTz = moment.tz.guess(); // This might not be accurate
  
  // Get actual system timezone from environment or use offset
  const systemTz = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  
  // Get offset in hours
  const offsetMinutes = serverTime.utcOffset();
  const offsetHours = offsetMinutes / 60;
  const offsetString = serverTime.format('Z'); // Like +03:00
  
  return {
    timezone: systemTz,
    offset: offsetString,
    offsetHours: offsetHours,
    currentTime: serverTime.format('YYYY-MM-DD HH:mm:ss'),
    currentTimeUTC: moment.utc().format('YYYY-MM-DD HH:mm:ss')
  };
}

async function showScheduledCampaigns(bot, chatId, userId) {
  try {
    const Campaign = require('../models/campaign');
    const SipPeer = require('../models/sippeer');
    const { Op } = require('sequelize');
    const moment = require('moment-timezone');
    
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
              [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
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
      const timezone = campaign.timezone || 'UTC';
      
      // Convert UTC times to campaign timezone for display
      const startTimeDisplay = moment.utc(campaign.scheduledStart).tz(timezone);
      const endTimeDisplay = campaign.scheduledEnd ? moment.utc(campaign.scheduledEnd).tz(timezone) : null;
      
      message += `${statusEmoji} *${index + 1}. ${escapeMarkdown(campaign.campaignName)}*\n`;
      message += `Status: ${campaign.campaignStatus}\n`;
      message += `Timezone: ${timezone}\n`;
      message += `Numbers: ${numbers}`;
      if (campaign.campaignStatus === 'running') {
        message += ` (${campaign.totalCalls} calls made)`;
      }
      message += `\n`;
      message += `Start: ${startTimeDisplay.format('YYYY-MM-DD HH:mm z')}\n`;
      if (endTimeDisplay) {
        message += `End: ${endTimeDisplay.format('YYYY-MM-DD HH:mm z')}\n`;
      }
      
      // Show countdown for scheduled campaigns
      if (campaign.campaignStatus === 'scheduled') {
        const now = moment();
        const timeUntilStart = moment.duration(startTimeDisplay.diff(now));
        if (timeUntilStart.asMinutes() > 0) {
          const hours = Math.floor(timeUntilStart.asHours());
          const minutes = timeUntilStart.minutes();
          message += `⏳ Starts in: ${hours}h ${minutes}m\n`;
        }
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
    keyboards.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);
    
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