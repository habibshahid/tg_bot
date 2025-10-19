// services/simpleCampaignScheduler.js - Updated with timezone support

const cron = require('node-cron');
const moment = require('moment-timezone');
const { Op } = require('sequelize');
const Campaign = require('../models/campaign');
const Call = require('../models/call');
const SipPeer = require('../models/sippeer');
const { set_settings } = require('../utils/settings');

class SimpleCampaignScheduler {
  constructor() {
    this.bot = null;
  }

  initialize(bot) {
    this.bot = bot;
    this.startScheduler();
    console.log('Timezone-aware Campaign Scheduler initialized');
    console.log('Server timezone:', moment.tz.guess());
  }

  startScheduler() {
    // Check every minute for campaigns to start/stop
    cron.schedule('* * * * *', async () => {
      await this.checkScheduledCampaigns();
    });

    console.log('Campaign scheduler cron job started');
  }

  async checkScheduledCampaigns() {
	  // Use server's local time for comparison
	  const nowServer = moment(); // This is in server's local timezone
	  
	  try {
		// Find campaigns that should start
		// The scheduledStart is stored in server's timezone
		const campaignsToStart = await Campaign.findAll({
		  where: {
			campaignStatus: 'scheduled',
			scheduledStart: { [Op.lte]: nowServer.toDate() }
		  },
		  include: [{ model: SipPeer, as: 'sipTrunk' }]
		});

		for (const campaign of campaignsToStart) {
		  // Display time in user's original timezone for logging
		  const userTz = campaign.timezone || moment.tz.guess();
		  const startTimeInUserTz = moment(campaign.scheduledStart).tz(userTz);
		  console.log(`Starting campaign "${campaign.campaignName}" - scheduled for ${startTimeInUserTz.format('YYYY-MM-DD HH:mm z')}`);
		  await this.startScheduledCampaign(campaign);
		}

		// Find campaigns that should stop
		const campaignsToStop = await Campaign.findAll({
		  where: {
			campaignStatus: 'running',
			scheduledEnd: { 
			  [Op.lte]: nowServer.toDate(),
			  [Op.ne]: null 
			}
		  }
		});

		for (const campaign of campaignsToStop) {
		  const userTz = campaign.timezone || moment.tz.guess();
		  const endTimeInUserTz = moment(campaign.scheduledEnd).tz(userTz);
		  console.log(`Stopping campaign "${campaign.campaignName}" - end time ${endTimeInUserTz.format('YYYY-MM-DD HH:mm z')}`);
		  await this.stopScheduledCampaign(campaign);
		}
	  } catch (error) {
		console.error('Error in checkScheduledCampaigns:', error);
	  }
	}

  async startScheduledCampaign(campaign) {
    try {
      const startTimeInTz = moment.utc(campaign.scheduledStart).tz(campaign.timezone || 'UTC');
      console.log(`Starting scheduled campaign: ${campaign.campaignName} (ID: ${campaign.id})`);
      console.log(`Campaign timezone: ${campaign.timezone || 'UTC'}`);
      console.log(`Start time (${campaign.timezone}): ${startTimeInTz.format('YYYY-MM-DD HH:mm z')}`);
      
      // Update status to running
      await campaign.update({ 
        campaignStatus: 'running',
        // Reset counters
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        voicemailCalls: 0,
        dtmfResponses: 0,
        callCounter: 0
      });

      // Set campaign settings
      set_settings({
        notifications_chat_id: campaign.notificationsChatId,
        concurrent_calls: campaign.concurrentCalls,
        sip_trunk: campaign.sipTrunk,
        caller_id: campaign.callerId,
        dial_prefix: campaign.dialPrefix || '',
        campaign_id: campaign.id,
        dtmf_digit: campaign.dtmfDigit,
        ivr_intro_file: campaign.ivrIntroFile,
        ivr_outro_file: campaign.ivrOutroFile
      });

      // Clear old numbers and add new ones
      await Call.destroy({
        where: { 
          campaignId: campaign.id,
          used: false
        }
      });

      // Add numbers from the stored list
      const numbers = campaign.numbersList || [];
      const callsToAdd = [];
      
      for (const entry of numbers) {
        callsToAdd.push({
          phoneNumber: entry.phoneNumber,
          rawLine: entry.rawLine || entry.phoneNumber,
          used: false,
          campaignId: campaign.id
        });
      }

      if (callsToAdd.length > 0) {
        await Call.bulkCreate(callsToAdd);
      }

      // Clear pressed numbers tracking
      const { ami } = require("../asterisk/instance");
      ami.emit('clear_pressed_numbers');

      // Start the calling process
      const { startCallingProcess } = require('../telegram_bot');
      startCallingProcess(callsToAdd.map(c => ({
        phoneNumber: c.phoneNumber,
        rawLine: c.rawLine
      })), campaign);

	
      // Send notification with timezone info
      if (this.bot && campaign.notificationsChatId) {
        const displayTime = moment.utc(campaign.scheduledStart).tz(campaign.timezone || 'UTC');
        await this.bot.sendMessage(
          campaign.notificationsChatId,
          `🚀 *Scheduled Campaign Started*\n\n` +
          `Campaign: ${this.escapeMarkdown(campaign.campaignName)}\n` +
          `Numbers: ${callsToAdd.length}\n` +
          `Timezone: ${campaign.timezone || 'UTC'}\n` +
          `Started: ${displayTime.format('YYYY-MM-DD HH:mm z')}`,
          { parse_mode: 'Markdown' }
        );
      }

      console.log(`Successfully started campaign: ${campaign.campaignName}`);
    } catch (error) {
      console.error(`Error starting scheduled campaign ${campaign.id}:`, error);
      
      await campaign.update({ 
        campaignStatus: 'cancelled'
      });
    }
  }

  async stopScheduledCampaign(campaign) {
    try {
      const endTimeInTz = moment.utc(campaign.scheduledEnd).tz(campaign.timezone || 'UTC');
      console.log(`Stopping scheduled campaign: ${campaign.campaignName}`);
      console.log(`End time (${campaign.timezone}): ${endTimeInTz.format('YYYY-MM-DD HH:mm z')}`);

      // Update status
      await campaign.update({ 
        campaignStatus: 'completed'
      });

      // Stop the dialing process
      const { stopCallingProcess } = require('../telegram_bot');
      stopCallingProcess();

      // Send notification with timezone info
      if (this.bot && campaign.notificationsChatId) {
        await this.bot.sendMessage(
          campaign.notificationsChatId,
          `✅ *Campaign Completed*\n\n` +
          `Campaign: ${this.escapeMarkdown(campaign.campaignName)}\n` +
          `Timezone: ${campaign.timezone || 'UTC'}\n` +
          `Ended: ${endTimeInTz.format('YYYY-MM-DD HH:mm z')}\n` +
          `Total Calls: ${campaign.totalCalls}\n` +
          `Successful: ${campaign.successfulCalls}\n` +
          `Failed: ${campaign.failedCalls}\n` +
          `DTMF Responses: ${campaign.dtmfResponses}`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      console.error(`Error stopping campaign ${campaign.id}:`, error);
    }
  }

  escapeMarkdown(text) {
    if (!text) return '';
    return text.toString().replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }
}

module.exports = new SimpleCampaignScheduler();