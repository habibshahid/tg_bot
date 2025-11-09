// asterisk/billingCallHandler.js
const { get_bot } = require("../telegram_bot/botInstance");
const { sanitize_phoneNumber } = require("../utils/sanitization");
const { get_settings } = require("../utils/settings");
const { ami } = require("./instance");
const Campaign = require("../models/campaign");
const User = require("../models/user");

const {
  add_entry_to_database,
  add_other_entry_to_database,
  call_started,
  call_ended,
  pop_unprocessed_line,
} = require("../utils/entries");
const pressedNumbers = new Set();

// Store active calls for billing tracking
const activeCalls = new Map();

// Import billing engine with error handling
let billingEngine;
try {
  billingEngine = require("../services/billingEngine");
  console.log('[Billing] Billing engine loaded successfully');
} catch (error) {
  console.error('[Billing] Error loading billing engine:', error);
}

// Pre-call validation and billing check
async function validateCallAndBalance(phoneNumber, settings) {
  if (!settings.user_id) {
    throw new Error('No user ID in settings');
  }

  try {
    const user = await User.findByPk(settings.user_id);
    if (!user) {
      throw new Error('User not found');
    }

    // If user has no rate card, skip balance validation but allow call
    if (!user.rateCardId) {
      console.log(`[System] User ${user.telegramId} has no rate card - call will proceed without billing`);
      return {
        estimate: { sellPrice: 0, estimatedCost: 0 },
        balanceCheck: { hasSufficientBalance: true, availableBalance: 0 },
        canProceed: true,
        billingEnabled: false
      };
    }

    // User has rate card - do full validation
    if (!billingEngine || typeof billingEngine.estimateCallCost !== 'function') {
      throw new Error('Billing engine not available');
    }
    
    const estimate = await billingEngine.estimateCallCost(settings.user_id, phoneNumber, 5);
    
    if (!estimate.success) {
      throw new Error(estimate.userFriendlyMessage || estimate.error);
    }
    
    const balanceCheck = await billingEngine.checkSufficientBalance(
      settings.user_id, 
      estimate.estimatedCost
    );
    
    if (!balanceCheck.hasSufficientBalance) {
      throw new Error(
        `Insufficient balance. Required: $${estimate.estimatedCost.toFixed(4)}, ` +
        `Available: $${balanceCheck.availableBalance.toFixed(2)}`
      );
    }
    
    return {
      estimate,
      balanceCheck,
      canProceed: true,
      billingEnabled: true
    };
    
  } catch (error) {
    console.error('Call validation error:', error);
    throw error;
  }
}

// Enhanced call initiation with billing
async function makeBillingCall(entry) {
  if (!entry) {
    return;
  }

  const number = sanitize_phoneNumber(entry?.phoneNumber);
  const settings = get_settings();
  
  if (!settings.user_id) {
    console.error('No user ID in settings - cannot make calls without user context');
    return;
  }

  try {
    // Validate call and check balance before making the call
    const validation = await validateCallAndBalance(number, settings);
    
    const actionId = `call-${number}-${Date.now()}`;
    const sipTrunk = settings.sip_trunk;
    const trunkName = sipTrunk ? sipTrunk.name : 'test_trunk';
    const callerId = settings.caller_id || '1234567890';
    const dialPrefix = settings.dial_prefix || '';
    const dialedNumber = dialPrefix + number;
    
    console.log(`[Billing] Initiating call to ${number} (User: ${settings.user_id}, Billing: ${validation.billingEnabled})`);
    
    // Store call info for billing tracking
    activeCalls.set(actionId, {
      callId: actionId,
      userId: settings.user_id,
      phoneNumber: `+${number}`,
      callStarted: new Date(),
      callAnswered: null,
      campaignId: settings.campaign_id,
      sipTrunkId: sipTrunk?.id,
      callerId: callerId,
      estimatedRate: validation.estimate.sellPrice || 0,
      billingEnabled: validation.billingEnabled
    });

    // Set variables for Asterisk
    const variables = {
      callId: actionId,
      TRUNK_NAME: trunkName,
      CAMPAIGN_ID: String(settings.campaign_id || 'default'),
      CAMPAIGN_CALLERID: callerId,
      DTMF_DIGIT: settings.dtmf_digit || '1',
      DESTINATION: number,
      USER_ID: settings.user_id,
      BILLING_RATE: validation.estimate.sellPrice || 0
    };

	const campaignDetails = await Campaign.findOne({
      where: {
        id: settings.campaign_id
      }
    });
	
	const userDetails = await User.findOne({
      where: {
        id: settings.user_id
      }
    });

    // Add IVR files if they exist
    if (settings.ivr_intro_file) {
      variables.__CAMPAIGN_INTRO = settings.ivr_intro_file;
    }
    if (settings.ivr_outro_file) {
      variables.__CAMPAIGN_OUTRO = settings.ivr_outro_file;
    }
    
	if (!userDetails.destinationRoute && !campaignDetails.destinationRoute) {
      console.log('Destination Route not set');
    }
	else if (userDetails.destinationRoute && !campaignDetails.destinationRoute) {
		variables.__DESTINATION_ROUTE = userDetails.destinationRoute;
	}
	else if (!userDetails.destinationRoute && campaignDetails.destinationRoute) {
		variables.__DESTINATION_ROUTE = campaignDetails.destinationRoute;
	}
	else if (userDetails.destinationRoute && campaignDetails.destinationRoute) {
		variables.__DESTINATION_ROUTE = campaignDetails.destinationRoute;
	}
	
	variables.__DTMF_DIGIT = settings.dtmf_digit || '1';
	variables.__DESTINATION_NUMBER = number;
	variables.__SPOOL_ID = actionId
	
	console.log(userDetails.destinationRoute, campaignDetails.destinationRoute, {
        action: "Originate",
        channel: `SIP/${trunkName}/${dialedNumber}`,
        context: `outbound-${settings?.agent || "coinbase"}`,
        exten: number,
        priority: 1,
        actionid: actionId,
        variable: Object.entries(variables).map(([key, value]) => `${key}=${value}`),
        CallerID: callerId,
        async: true,
      })
	  
    ami.action(
      {
        action: "Originate",
        channel: `SIP/${trunkName}/${dialedNumber}`,
        context: `outbound-${settings?.agent || "coinbase"}`,
        exten: number,
        priority: 1,
        actionid: actionId,
        variable: Object.entries(variables).map(([key, value]) => `${key}=${value}`),
        CallerID: callerId,
        async: true,
      },
      async (err, res) => {
        if (err) {
          console.error("Originate Error:", err);
          
          // Remove from active calls
          activeCalls.delete(actionId);
          
          // Create failed call record
          try {
            if (billingEngine && typeof billingEngine.processCallBilling === 'function') {
              await billingEngine.processCallBilling({
                userId: settings.user_id,
                phoneNumber: `+${number}`,
                callDuration: 0,
                callStatus: 'failed',
                campaignId: settings.campaign_id,
                callId: actionId,
                callStarted: new Date(),
                callAnswered: null,
                callEnded: new Date(),
                hangupCause: err.message || 'ORIGINATE_FAILED',
                sipTrunkId: sipTrunk?.id,
                callerId: callerId
              });
            }
          } catch (billingError) {
            console.error('Error creating failed call record:', billingError);
          }
          
          const bot = get_bot();
          if (bot && settings?.notifications_chat_id) {
            bot.sendMessage(
              settings.notifications_chat_id,
              `❌ *Call Failed*\n\n📞 ${number}\n❌ ${err.message}`,
              { parse_mode: "Markdown" }
            );
          }
          
          // Continue with next call
          const { pop_unprocessed_line } = require("../utils/entries");
          const nextLine = pop_unprocessed_line();
          if (nextLine) {
            makeBillingCall(nextLine);
          }
        } else {
          console.log(`[Billing] Originate Response: ${res.response} for ${number}`);
        }
      }
    );

  } catch (error) {
    console.error(`[Billing] Call initiation failed for ${number}:`, error);
    
    const bot = get_bot();
    if (bot && settings?.notifications_chat_id) {
      bot.sendMessage(
        settings.notifications_chat_id,
        `❌ *Call Failed*\n\n📞 ${number}\nReason: ${error.message}`,
        { parse_mode: "Markdown" }
      );
    }
    
    // Continue with next call
    const { pop_unprocessed_line } = require("../utils/entries");
    const nextLine = pop_unprocessed_line();
    if (nextLine) {
      makeBillingCall(nextLine);
    }
  }
}

// Track if event handlers are already set up to prevent duplicates
let eventHandlersSetup = false;

// Enhanced AMI event handlers for billing
function setupBillingEventHandlers() {
  if (eventHandlersSetup) {
    console.log('[Billing] Event handlers already set up, skipping');
    return;
  }
  
  console.log('[Billing] Setting up billing event handlers');
  eventHandlersSetup = true;
  
  ami.on("managerevent", async (data) => {
    const settings = get_settings();
    
	  const dtmfDigit = settings.dtmf_digit || '1';
	  
	  // ONLY handle DTMF events - billing handler will handle all call events
	  if (data?.event == "DTMFEnd") {
		let phoneDtmf;
		if(data.exten == 'autoDialerCall'){
			phoneDtmf = data.accountcode.split('-')[4];
		}
		else if(data.exten == 'ivrConference'){
			return true;
		}
		else{
			phoneDtmf = data.exten
		}
		if (!pressedNumbers.has(phoneDtmf)) {
		  console.log(`+${phoneDtmf} has pressed ${data?.digit}`);
		  pressedNumbers.add(phoneDtmf);
		  
		  if(data?.digit == dtmfDigit){
			add_entry_to_database(phoneDtmf, data?.digit);
		  }
		  else{
			add_other_entry_to_database(phoneDtmf, data?.digit);
		  }
		  
		  let activeCall = null;
			let callId = null;
			
			// Find active call by phone number
			for (const [id, call] of activeCalls.entries()) {
			  // Remove the + from stored phone number for comparison
			  const storedNumber = call.phoneNumber.replace(/^\+/, '');
			  if (storedNumber === phoneDtmf) {
				activeCall = call;
				callId = id;
				console.log(`[Billing Debug] Found matching active call: ${callId}`);
				break;
			  }
			}
			
			if (activeCall && callId) {
				activeCall.dtmfPressed = data?.digit || '';
			}
		  // Update DTMF responses counter
		  if (settings.campaign_id) {
			Campaign.increment('dtmfResponses', { where: { id: settings.campaign_id } });
		  }
		} else {
		  console.log(`+${phoneDtmf} has already pressed ${dtmfDigit}, ignoring duplicate`);
		}
	  }
	  
    // Add debug logging with action filtering
    if (data?.actionid && data.actionid.startsWith('call-')) {
      console.log(`[Billing Debug] Event: ${data.event}, ActionID: ${data.actionid}, Response: ${data.response || 'N/A'}`);
    }
    
    // Handle call originate response - ONLY for billing calls
    if (data?.event === 'OriginateResponse' && data.actionid && data.actionid.startsWith('call-')) {
      const callId = data.actionid;
      const activeCall = activeCalls.get(callId);
      
      if (activeCall) {
        if (data.response === 'Success') {
          console.log(`[Billing] Call originated successfully: ${activeCall.phoneNumber}`);
		  activeCall.callAnswered = new Date();
		  if (settings.campaign_id) {
			  Campaign.increment('successfulCalls', { where: { id: settings.campaign_id } });
			  Campaign.increment('totalCalls', { where: { id: settings.campaign_id } });
			  console.log(`[Billing] Updated campaign ${settings.campaign_id} - successful calls incremented`);
			}
        } else {
          console.log(`[Billing] Call failed to originate: ${activeCall.phoneNumber}, Reason: ${data.reason}`);
          activeCalls.delete(callId);
          if (settings.campaign_id) {
			
			  Campaign.increment('failedCalls', { where: { id: settings.campaign_id } });
			  Campaign.increment('totalCalls', { where: { id: settings.campaign_id } });
			  console.log(`[Billing] Updated campaign ${settings.campaign_id} - failed calls incremented`);
			
			// Note: successful calls already incremented when call was answered
		  }
          // Process as failed call
          try {
            if (billingEngine && typeof billingEngine.processCallBilling === 'function') {
              await billingEngine.processCallBilling({
                userId: activeCall.userId,
                phoneNumber: activeCall.phoneNumber,
                callDuration: 0,
                callStatus: 'failed',
                campaignId: activeCall.campaignId,
                callId: callId,
                callStarted: activeCall.callStarted,
                callAnswered: null,
                callEnded: new Date(),
                hangupCause: data.reason || 'ORIGINATE_FAILED',
                sipTrunkId: activeCall.sipTrunkId,
                callerId: activeCall.callerId,
				dtmfPressed: (activeCall.dtmfPressed) ? activeCall.dtmfPressed : ''
              });
            }
          } catch (error) {
            console.error('Error processing failed call billing:', error);
          }
          
          // Continue with next call
          const { pop_unprocessed_line } = require("../utils/entries");
          const nextLine = pop_unprocessed_line();
          if (nextLine) {
            makeBillingCall(nextLine);
          }
        }
      }
    }
    
    // Handle call answer detection using Newstate event
    if (data?.event === 'Newstate' && data.channelstate === '6') {
	  // Channel state 6 = Up (answered)
	  let phoneNumber;
		if(data.exten == 'autoDialerCall'){
			phoneNumber = data.accountcode.split('-')[4];
		}
		else if(data.exten == 'ivrConference'){
			return true;
		}
		else{
			phoneNumber = data.exten
		}
	  if (phoneNumber) {
		console.log(`[Billing Debug] Call answered for extension: ${phoneNumber}`);
		
		for (const [callId, activeCall] of activeCalls.entries()) {
		  // Remove the + from stored phone number for comparison
		  const storedNumber = activeCall.phoneNumber.replace(/^\+/, '');
		  if (storedNumber === phoneNumber && !activeCall.callAnswered) {
			activeCall.callAnswered = new Date();
			console.log(`[Billing] Call answered: ${activeCall.phoneNumber} at ${activeCall.callAnswered.toISOString()}`);
			
			// Update campaign successful calls counter
			if (settings.campaign_id) {
			  Campaign.increment('successfulCalls', { where: { id: settings.campaign_id } });
			}
			break;
		  }
		}
	  }
	}
    
    // Handle call hangup with proper billing - ONLY for billing calls
    if (data?.event === "Hangup") {
	  // The phone number is in data.exten, not in the channel name
		let phoneNumber;
		if(data.exten == 'autoDialerCall'){
			phoneNumber = data.accountcode.split('-')[4];
		}
		else if(data.exten == 'ivrConference'){
			return true;
		}
		else{
			phoneNumber = data.exten
		}
	  
	  
	  if (phoneNumber) {
		console.log(`[Billing Debug] Hangup detected for extension: ${phoneNumber}, Channel: ${data.channel}`);
		
		let activeCall = null;
		let callId = null;
		
		// Find active call by phone number
		for (const [id, call] of activeCalls.entries()) {
		  // Remove the + from stored phone number for comparison
		  const storedNumber = call.phoneNumber.replace(/^\+/, '');
		  if (storedNumber === phoneNumber) {
			activeCall = call;
			callId = id;
			console.log(`[Billing Debug] Found matching active call: ${callId}`);
			break;
		  }
		}
		
		if (activeCall && callId) {
		  activeCalls.delete(callId);
		  
		  const callEndTime = new Date();
		  const callDuration = activeCall.callAnswered ? 
			Math.floor((callEndTime - activeCall.callAnswered) / 1000) : 0;
		  
		  const callStatus = activeCall.callAnswered ? 'answered' : 'no_answer';
		  
		  console.log(`[Billing] Call ended: ${activeCall.phoneNumber}, Status: ${callStatus}, Duration: ${callDuration}s, Hangup: ${data["cause-txt"]}`);
		  
		  // Process billing
		  try {
			if (billingEngine && typeof billingEngine.processCallBilling === 'function') {
			  const billingData = {
				userId: activeCall.userId,
				phoneNumber: activeCall.phoneNumber,
				callDuration: callDuration,
				callStatus: callStatus,
				campaignId: activeCall.campaignId,
				callId: callId,
				callStarted: activeCall.callStarted,
				callAnswered: activeCall.callAnswered,
				callEnded: callEndTime,
				hangupCause: data["cause-txt"] || 'NORMAL_CLEARING',
				sipTrunkId: activeCall.sipTrunkId,
				callerId: activeCall.callerId,
				dtmfPressed: (activeCall.dtmfPressed) ? activeCall.dtmfPressed : ''
			  };
			  
			  console.log(`[Billing Debug] Processing billing for call: ${JSON.stringify({
				phoneNumber: activeCall.phoneNumber,
				duration: callDuration,
				status: callStatus,
				answered: activeCall.callAnswered
			  })}`);
			  
			  const billingResult = await billingEngine.processCallBilling(billingData);
			  
			  if (billingResult.success) {
				if (billingResult.charges.totalCharge > 0) {
				  const bot = get_bot();
				  if (bot && settings?.notifications_chat_id) {
					bot.sendMessage(
					  settings.notifications_chat_id,
					  `💰 *Call Billed*\n\n` +
					  `📞 ${activeCall.phoneNumber}\n` +
					  `⏱️ ${Math.round(billingResult.callDetail.billableDuration/60)} min\n` +
					  `💵 $${billingResult.charges.totalCharge.toFixed(4)}\n` +
					  `💳 Balance: $${billingResult.newBalance.toFixed(2)}`,
					  { parse_mode: "Markdown" }
					);
				  }
				  console.log(`[Billing] SUCCESS: Charged $${billingResult.charges.totalCharge.toFixed(4)} for ${Math.round(billingResult.callDetail.billableDuration/60)} minutes`);
				} else {
				  console.log(`[Billing] No charge for ${callStatus} call to ${activeCall.phoneNumber}`);
				}
			  } else {
				console.warn(`[Billing] Billing processing failed: ${billingResult.reason || 'Unknown error'}`);
			  }
			} else {
			  console.error('Cannot process billing - billingEngine not available');
			}
			
		  } catch (billingError) {
			console.error('[Billing] Error processing call billing:', billingError);
		  }
		  
		  // Continue with next call
		  const { pop_unprocessed_line } = require("../utils/entries");
		  const nextLine = pop_unprocessed_line();
		  if (nextLine) {
			makeBillingCall(nextLine);
		  }
		} else {
		  console.log(`[Billing Debug] No active call found for hangup extension: ${phoneNumber}`);
		  console.log(`[Billing Debug] Current active calls:`, Array.from(activeCalls.keys()));
		}
	  } else {
		console.log(`[Billing Debug] Hangup event has no extension field`);
	  }
	}
  });
}

// Get active calls for monitoring
function getActiveCalls() {
  return Array.from(activeCalls.values());
}

// Clear active calls (for system reset)
function clearActiveCalls() {
  activeCalls.clear();
}

// Export the main function and utility functions
module.exports = makeBillingCall;
module.exports.setupBillingEventHandlers = setupBillingEventHandlers;
module.exports.getActiveCalls = getActiveCalls;
module.exports.clearActiveCalls = clearActiveCalls;