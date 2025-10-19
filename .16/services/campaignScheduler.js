// services/campaignScheduler.js
const cron = require('node-cron');
const moment = require('moment');
const { Op } = require('sequelize');
const ScheduledCampaign = require('../models/scheduledCampaign');
const Campaign = require('../models/campaign');
const Call = require('../models/call');
const SipPeer = require('../models/sippeer');
const { set_settings } = require('../utils/settings');
const config = require('../config');

class CampaignScheduler {
  constructor() {
    this.jobs = new Map();
    this.runningCampaigns = new Map();
    this.bot = null;
  }

  initialize(bot) {
    this.bot = bot;
    this.startScheduler();
    this.loadScheduledCampaigns();
    console.log('Campaign Scheduler initialized');
  }

  startScheduler() {
    // Check every minute for campaigns to start/stop
    cron.schedule('* * * * *', async () => {
      await this.checkScheduledCampaigns();
    });

    // Check every 5 minutes for stale campaigns
    cron.schedule('*/5 * * * *', async () => {
      await this.checkStaleCampaigns();
    });

    console.log('Campaign scheduler cron jobs started');
  }

  async checkScheduledCampaigns() {
    const now = new Date();

    try {
      // Find campaigns that should start
      const campaignsToStart = await ScheduledCampaign.findAll({
        where: {
          status: 'scheduled',
          startDatetime: { [Op.lte]: now }
        },
        include: [
          { model: Campaign, as: 'campaign' },
          { model: SipPeer, as: 'sipTrunk' }
        ]
      });

      for (const scheduled of campaignsToStart) {
        await this.startScheduledCampaign(scheduled);
      }

      // Find campaigns that should stop
      const campaignsToStop = await ScheduledCampaign.findAll({
        where: {
          status: 'running',
          endDatetime: { 
            [Op.lte]: now,
            [Op.ne]: null 
          }
        }
      });

      for (const scheduled of campaignsToStop) {
        await this.stopScheduledCampaign(scheduled);
      }
    } catch (error) {
      console.error('Error in checkScheduledCampaigns:', error);
    }
  }

  async startScheduledCampaign(scheduled) {
    try {
      console.log(`Starting scheduled campaign: ${scheduled.name} (ID: ${scheduled.id})`);
      
      // Update status to running
      await scheduled.update({ status: 'running' });

      // Validate SIP trunk is still active
      const trunk = await SipPeer.findByPk(scheduled.sipTrunkId);
      if (!trunk || trunk.status !== 1) {
        throw new Error('SIP trunk is not available');
      }

      // Reset campaign counters
      await Campaign.update({
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        voicemailCalls: 0,
        dtmfResponses: 0,
        callCounter: 0
      }, {
        where: { id: scheduled.campaignId }
      });

      // Set campaign settings
      set_settings({
        notifications_chat_id: scheduled.notificationsChatId,
        concurrent_calls: scheduled.concurrentCalls,
        sip_trunk: trunk,
        caller_id: scheduled.callerId,
        dial_prefix: scheduled.dialPrefix || '',
        campaign_id: scheduled.campaignId,
        dtmf_digit: scheduled.dtmfDigit,
        ivr_intro_file: scheduled.ivrIntroFile,
        ivr_outro_file: scheduled.ivrOutroFile
      });

      // Clear previous numbers for this campaign
      await Call.destroy({
        where: { 
          campaignId: scheduled.campaignId,
          used: false
        }
      });

      // Add numbers to Call table
      const numbers = scheduled.numbersList || [];
      const callsToAdd = [];
      
      for (const entry of numbers) {
        callsToAdd.push({
          phoneNumber: entry.phoneNumber,
          rawLine: entry.rawLine || entry.phoneNumber,
          used: false,
          campaignId: scheduled.campaignId
        });
      }

      if (callsToAdd.length > 0) {
        await Call.bulkCreate(callsToAdd);
      }

      // Get the campaign with associations
      const campaign = await Campaign.findByPk(scheduled.campaignId, {
        include: [{ model: SipPeer, as: 'sipTrunk' }]
      });

      // Clear pressed numbers tracking
      const { ami } = require("../asterisk/instance");
      ami.emit('clear_pressed_numbers');

      // Import and start the calling process
      const { startCallingProcess } = require('../telegram_bot');
      startCallingProcess(callsToAdd.map(c => ({
        phoneNumber: c.phoneNumber,
        rawLine: c.rawLine
      })), campaign);

      // Store in running campaigns map
      this.runningCampaigns.set(scheduled.id, {
        scheduledId: scheduled.id,
        campaignId: scheduled.campaignId,
        startTime: new Date()
      });

      // Send notification
      if (this.bot && scheduled.notificationsChatId) {
        await this.bot.sendMessage(
          scheduled.notificationsChatId,
          `🚀 *Scheduled Campaign Started*\n\n` +
          `Campaign: ${this.escapeMarkdown(scheduled.name)}\n` +
          `Numbers: ${callsToAdd.length}\n` +
          `SIP Trunk: ${this.escapeMarkdown(trunk.name)}\n` +
          `Caller ID: ${this.escapeMarkdown(scheduled.callerId)}\n` +
          `Started: ${moment().format('YYYY-MM-DD HH:mm')}\n` +
          `${scheduled.endDatetime ? `Scheduled End: ${moment(scheduled.endDatetime).format('YYYY-MM-DD HH:mm')}` : 'No end time set'}`,
          { parse_mode: 'Markdown' }
        );
      }

      console.log(`Successfully started campaign: ${scheduled.name}`);
    } catch (error) {
      console.error(`Error starting scheduled campaign ${scheduled.id}:`, error);
      
      await scheduled.update({ 
        status: 'failed',
        lastError: error.message 
      });

      // Send error notification
      if (this.bot && scheduled.notificationsChatId) {
        await this.bot.sendMessage(
          scheduled.notificationsChatId,
          `❌ *Failed to Start Scheduled Campaign*\n\n` +
          `Campaign: ${this.escapeMarkdown(scheduled.name)}\n` +
          `Error: ${this.escapeMarkdown(error.message)}`,
          { parse_mode: 'Markdown' }
        );
      }
    }
  }

  async stopScheduledCampaign(scheduled) {
    try {
      console.log(`Stopping scheduled campaign: ${scheduled.name} (ID: ${scheduled.id})`);

      // Get campaign stats before stopping
      const campaign = await Campaign.findByPk(scheduled.campaignId);
      
      // Update scheduled campaign with final stats
      await scheduled.update({ 
        status: 'completed',
        processedNumbers: campaign.totalCalls,
        successfulCalls: campaign.successfulCalls,
        failedCalls: campaign.failedCalls,
        dtmfResponses: campaign.dtmfResponses
      });

      // Remove from running campaigns
      this.runningCampaigns.delete(scheduled.id);

      // Stop the dialing process
      const { stopCallingProcess } = require('../telegram_bot');
      stopCallingProcess();

      // Send completion notification
      if (this.bot && scheduled.notificationsChatId) {
        const duration = moment.duration(moment().diff(moment(scheduled.startDatetime)));
        
        await this.bot.sendMessage(
          scheduled.notificationsChatId,
          `✅ *Scheduled Campaign Completed*\n\n` +
          `Campaign: ${this.escapeMarkdown(scheduled.name)}\n` +
          `Duration: ${duration.hours()}h ${duration.minutes()}m\n` +
          `Total Calls: ${campaign.totalCalls}\n` +
          `Successful: ${campaign.successfulCalls}\n` +
          `Failed: ${campaign.failedCalls}\n` +
          `DTMF Responses: ${campaign.dtmfResponses}\n` +
          `Success Rate: ${campaign.totalCalls > 0 ? ((campaign.successfulCalls / campaign.totalCalls) * 100).toFixed(2) : 0}%`,
          { parse_mode: 'Markdown' }
        );
      }

      console.log(`Successfully stopped campaign: ${scheduled.name}`);
    } catch (error) {
      console.error(`Error stopping scheduled campaign ${scheduled.id}:`, error);
      await scheduled.update({ 
        lastError: error.message 
      });
    }
  }

  async pauseScheduledCampaign(scheduledId) {
    try {
      const scheduled = await ScheduledCampaign.findByPk(scheduledId);
      if (!scheduled || scheduled.status !== 'running') {
        throw new Error('Campaign is not running');
      }

      await scheduled.update({ status: 'paused' });
      
      // Stop the dialing process
      const { stopCallingProcess } = require('../telegram_bot');
      stopCallingProcess();

      console.log(`Paused campaign: ${scheduled.name}`);
      return { success: true };
    } catch (error) {
      console.error(`Error pausing campaign ${scheduledId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async resumeScheduledCampaign(scheduledId) {
    try {
      const scheduled = await ScheduledCampaign.findByPk(scheduledId, {
        include: [
          { model: Campaign, as: 'campaign' },
          { model: SipPeer, as: 'sipTrunk' }
        ]
      });

      if (!scheduled || scheduled.status !== 'paused') {
        throw new Error('Campaign is not paused');
      }

      // Check if end time has passed
      if (scheduled.endDatetime && new Date() > scheduled.endDatetime) {
        await this.stopScheduledCampaign(scheduled);
        return { success: true, message: 'Campaign end time has passed, marked as completed' };
      }

      await scheduled.update({ status: 'running' });
      
      // Restart the campaign
      await this.startScheduledCampaign(scheduled);

      console.log(`Resumed campaign: ${scheduled.name}`);
      return { success: true };
    } catch (error) {
      console.error(`Error resuming campaign ${scheduledId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async cancelScheduledCampaign(scheduledId) {
    try {
      const scheduled = await ScheduledCampaign.findByPk(scheduledId);
      if (!scheduled) {
        throw new Error('Campaign not found');
      }

      const previousStatus = scheduled.status;
      await scheduled.update({ status: 'cancelled' });

      // If it was running, stop it
      if (previousStatus === 'running') {
        const { stopCallingProcess } = require('../telegram_bot');
        stopCallingProcess();
        this.runningCampaigns.delete(scheduledId);
      }

      console.log(`Cancelled campaign: ${scheduled.name}`);
      return { success: true };
    } catch (error) {
      console.error(`Error cancelling campaign ${scheduledId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async checkStaleCampaigns() {
    // Check for campaigns that should have started but didn't
    const oneHourAgo = moment().subtract(1, 'hour').toDate();
    
    const staleCampaigns = await ScheduledCampaign.findAll({
      where: {
        status: 'scheduled',
        startDatetime: { [Op.lt]: oneHourAgo }
      }
    });

    for (const campaign of staleCampaigns) {
      console.warn(`Found stale campaign: ${campaign.name} (ID: ${campaign.id})`);
      await campaign.update({ 
        status: 'failed',
        lastError: 'Campaign failed to start on time'
      });
    }
  }

  async loadScheduledCampaigns() {
    try {
      const campaigns = await ScheduledCampaign.findAll({
        where: {
          status: ['scheduled', 'running', 'paused']
        }
      });

      console.log(`Loaded ${campaigns.length} active/scheduled campaigns`);
      
      // Re-add running campaigns to the map
      for (const campaign of campaigns.filter(c => c.status === 'running')) {
        this.runningCampaigns.set(campaign.id, {
          scheduledId: campaign.id,
          campaignId: campaign.campaignId,
          startTime: campaign.updatedAt
        });
      }
    } catch (error) {
      console.error('Error loading scheduled campaigns:', error);
    }
  }

  escapeMarkdown(text) {
    if (!text) return '';
    return text.toString()
      .replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }
}

// Create singleton instance
const campaignScheduler = new CampaignScheduler();

module.exports = campaignScheduler;