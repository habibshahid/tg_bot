// asterisk/billingCallHandler.js
const { get_bot } = require("../telegram_bot/botInstance");
const { sanitize_phoneNumber } = require("../utils/sanitization");
const { get_settings } = require("../utils/settings");
const { ami } = require("./instance");
const Campaign = require("../models/campaign");
const User = require("../models/user");
const { CallDetail } = require("../models/transaction");
const billingEngine = require("../services/billingEngine");

// Store active calls for billing tracking
const activeCalls = new Map();

// Pre-call validation and billing check
async function validateCallAndBalance(phoneNumber, settings) {
  if (!settings.user_id) {
    throw new Error('No user ID in settings');
  }

  try {
    // Estimate call cost (assuming 5 minute max call)
    const estimate = await billingEngine.estimateCallCost(settings.user_id, phoneNumber, 5);
    
    // Check if user has sufficient balance
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
      canProceed: true
    };
    
  } catch (error) {
    console.error('Call validation error:', error);
    throw error;
  }
}

// Enhanced call initiation with billing
module.exports = async (entry) => {
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
    const trunkName = sipTrunk ? sipTrunk.name : 'main';
    let callerId = settings.caller_id || number;
    const dialPrefix = settings.dial_prefix || '';
    const dialedNumber = dialPrefix + number;
    
    // ANI rotation logic (existing code)
    if (settings.campaign_id && callerId && callerId.length >= 4) {
      const campaign = await Campaign.findByPk(settings.campaign_id);
      if (campaign) {
        await campaign.increment('callCounter');
        await campaign.increment('totalCalls');
        
        if (campaign.callCounter % 100 === 0) {
          const randomLast4 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
          callerId = callerId.substring(0, callerId.length - 4) + randomLast4;
          console.log(`ANI Rotation: Original ${settings.caller_id} -> New ${callerId} (Call #${campaign.callCounter})`);
        }
      }
    }

    console.log(`[Billing] Making call to ${number}:`);
    console.log(`  User ID: ${settings.user_id}`);
    console.log(`  Estimated cost: $${validation.estimate.estimatedCost.toFixed(4)}`);
    console.log(`  Available balance: $${validation.balanceCheck.availableBalance.toFixed(2)}`);
    console.log(`  Destination: ${validation.estimate.destination.countryName}`);
    console.log(`  Rate: $${validation.estimate.sellPrice.toFixed(6)}/min`);
    
    // Store call start time and details for billing
    activeCalls.set(actionId, {
      callId: actionId,
      userId: settings.user_id,
      campaignId: settings.campaign_id,
      phoneNumber: `+${number}`,
      callStarted: new Date(),
      callAnswered: null,
      callEnded: null,
      sipTrunkId: sipTrunk?.id,
      callerId: callerId,
      estimatedCost: validation.estimate.estimatedCost,
      ratePerMinute: validation.estimate.sellPrice
    });

    const variables = {
      callId: actionId,
      TRUNK_NAME: trunkName,
      CAMPAIGN_ID: String(settings.campaign_id || 'default'),
      CAMPAIGN_CALLERID: callerId,
      DTMF_DIGIT: settings.dtmf_digit || '1',
      DESTINATION: number,
      USER_ID: settings.user_id,
      BILLING_RATE: validation.estimate.sellPrice
    };

    // Add IVR files if they exist
    if (settings.ivr_intro_file) {
      variables.__CAMPAIGN_INTRO = settings.ivr_intro_file;
    }
    if (settings.ivr_outro_file) {
      variables.__CAMPAIGN_OUTRO = settings.ivr_outro_file;
    }
    
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
          } catch (billingError) {
            console.error('Billing error for failed call:', billingError);
          }
          
          // Update campaign failed calls counter
          if (settings.campaign_id) {
            Campaign.increment('failedCalls', { where: { id: settings.campaign_id } });
          }
          
          const bot = get_bot();
          bot.sendMessage(
            settings?.notifications_chat_id,
            `❌ *Call Failed*\n\n` +
            `Number: ${number}\n` +
            `Error: ${err.message}\n` +
            `Trunk: ${trunkName}\n` +
            `Estimated Cost: $${validation.estimate.estimatedCost.toFixed(4)}`,
            { parse_mode: "Markdown" }
          );
          
          // Continue with next call
          const { pop_unprocessed_line } = require("../utils/entries");
          require("./call")(pop_unprocessed_line());
        } else {
          console.log("Originate Response:", res);
          
          const bot = get_bot();
          bot.sendMessage(
            settings?.notifications_chat_id,
            `📞 *Call Initiated*\n\n` +
            `Number: ${number}\n` +
            `Destination: ${validation.estimate.destination.countryName}\n` +
            `Rate: $${validation.estimate.sellPrice.toFixed(6)}/min\n` +
            `Max Cost (5min): $${validation.estimate.estimatedCost.toFixed(4)}`,
            { parse_mode: "Markdown" }
          );
        }
      }
    );

  } catch (error) {
    console.error('Call validation/billing error:', error);
    
    // Update failed calls counter
    if (settings.campaign_id) {
      Campaign.increment('failedCalls', { where: { id: settings.campaign_id } });
    }
    
    const bot = get_bot();
    bot.sendMessage(
      settings?.notifications_chat_id,
      `❌ *Call Blocked*\n\n` +
      `Number: ${number}\n` +
      `Reason: ${error.message}`,
      { parse_mode: "Markdown" }
    );
    
    // Continue with next call
    const { pop_unprocessed_line } = require("../utils/entries");
    require("./call")(pop_unprocessed_line());
  }
};

// Enhanced AMI event handlers for billing
function setupBillingEventHandlers() {
  const { ami } = require("./instance");
  const { get_settings } = require("../utils/settings");
  
  ami.on("managerevent", async (data) => {
    const settings = get_settings();
    
    // Handle call answered
    if (data?.event === 'OriginateResponse' && data.response === 'Success') {
      const callId = data.actionid;
      const activeCall = activeCalls.get(callId);
      
      if (activeCall) {
        activeCall.callAnswered = new Date();
        console.log(`[Billing] Call answered: ${callId}`);
        
        // Update campaign successful calls counter
        if (settings.campaign_id) {
          Campaign.increment('successfulCalls', { where: { id: settings.campaign_id } });
        }
      }
    }
    
    // Handle call hangup
    if (data?.event === "Hangup") {
      const callId = data.actionid || `call-${data.exten}-*`; // Try to match by pattern
      
      // Find active call by phone number if actionid not available
      let activeCall = null;
      if (callId.includes('*')) {
        for (const [id, call] of activeCalls.entries()) {
          if (call.phoneNumber.includes(data.exten)) {
            activeCall = call;
            activeCalls.delete(id);
            break;
          }
        }
      } else {
        activeCall = activeCalls.get(callId);
        activeCalls.delete(callId);
      }
      
      if (activeCall) {
        const callEndTime = new Date();
        const callDuration = activeCall.callAnswered ? 
          Math.floor((callEndTime - activeCall.callAnswered) / 1000) : 0;
        
        console.log(`[Billing] Call ended: ${activeCall.phoneNumber}, Duration: ${callDuration}s`);
        
        // Process billing
        try {
          const billingData = {
            userId: activeCall.userId,
            phoneNumber: activeCall.phoneNumber,
            callDuration: callDuration,
            callStatus: activeCall.callAnswered ? 'answered' : 'no_answer',
            campaignId: activeCall.campaignId,
            callId: activeCall.callId,
            callStarted: activeCall.callStarted,
            callAnswered: activeCall.callAnswered,
            callEnded: callEndTime,
            hangupCause: data["cause-txt"] || 'NORMAL_CLEARING',
            sipTrunkId: activeCall.sipTrunkId,
            callerId: activeCall.callerId
          };
          
          const billingResult = await billingEngine.processCallBilling(billingData);
          
          if (billingResult.success && billingResult.charges.totalCharge > 0) {
            const bot = get_bot();
            bot.sendMessage(
              settings?.notifications_chat_id,
              `💰 *Call Completed & Billed*\n\n` +
              `Number: ${activeCall.phoneNumber}\n` +
              `Duration: ${Math.round(billingResult.callDetail.billableDuration/60)} minutes\n` +
              `Cost: $${billingResult.charges.totalCharge.toFixed(4)}\n` +
              `New Balance: $${billingResult.newBalance.toFixed(2)}`,
              { parse_mode: "Markdown" }
            );
          }
          
        } catch (billingError) {
          console.error('Billing processing error:', billingError);
          
          const bot = get_bot();
          bot.sendMessage(
            settings?.notifications_chat_id,
            `⚠️ *Billing Error*\n\n` +
            `Call to ${activeCall.phoneNumber} completed but billing failed.\n` +
            `Error: ${billingError.message}`,
            { parse_mode: "Markdown" }
          );
        }
        
        // Continue with next call
        const { pop_unprocessed_line } = require("../utils/entries");
        require("../asterisk/call")(pop_unprocessed_line());
      }
    }
    
    // Handle DTMF events (existing logic with user context)
    if (data?.event == "DTMFEnd") {
      const settings = get_settings();
      const dtmfDigit = settings.dtmf_digit || '1';
      
      if (data?.digit == dtmfDigit) {
        // Update campaign DTMF responses counter
        if (settings.campaign_id) {
          Campaign.increment('dtmfResponses', { where: { id: settings.campaign_id } });
        }
        
        // Add DTMF response to call detail if exists
        try {
          const callDetail = await CallDetail.findOne({
            where: {
              phoneNumber: `+${data?.exten}`,
              userId: settings.user_id,
              processed: false
            },
            order: [['createdAt', 'DESC']]
          });
          
          if (callDetail) {
            await callDetail.update({ dtmfPressed: data?.digit });
          }
        } catch (error) {
          console.error('Error updating DTMF in call detail:', error);
        }
        
        const bot = get_bot();
        bot.sendMessage(
          settings.notifications_chat_id,
          `✅ *DTMF Response*\n\n${data?.exten} pressed ${dtmfDigit}`,
          { parse_mode: "Markdown" }
        );
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

module.exports = {
  setupBillingEventHandlers,
  getActiveCalls,
  clearActiveCalls
};