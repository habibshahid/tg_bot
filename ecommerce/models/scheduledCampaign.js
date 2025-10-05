// models/scheduledCampaign.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Campaign = require('./campaign');
const SipPeer = require('./sippeer');

const ScheduledCampaign = sequelize.define('ScheduledCampaign', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  campaignId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'campaign_id'
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  numbersList: {
    type: DataTypes.TEXT('long'),
    field: 'numbers_list',
    get() {
      const rawValue = this.getDataValue('numbersList');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('numbersList', JSON.stringify(value));
    }
  },
  sipTrunkId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'sip_trunk_id'
  },
  callerId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'caller_id'
  },
  dialPrefix: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'dial_prefix',
    defaultValue: ''
  },
  ivrIntroFile: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'ivr_intro_file'
  },
  ivrOutroFile: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'ivr_outro_file'
  },
  dtmfDigit: {
    type: DataTypes.STRING(1),
    defaultValue: '1',
    field: 'dtmf_digit'
  },
  concurrentCalls: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
    field: 'concurrent_calls'
  },
  notificationsChatId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'notifications_chat_id'
  },
  startDatetime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'start_datetime'
  },
  endDatetime: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'end_datetime'
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'running', 'paused', 'completed', 'cancelled', 'failed'),
    defaultValue: 'scheduled'
  },
  totalNumbers: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_numbers'
  },
  processedNumbers: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'processed_numbers'
  },
  successfulCalls: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'successful_calls'
  },
  failedCalls: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'failed_calls'
  },
  voicemailCalls: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'voicemail_calls'
  },
  dtmfResponses: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'dtmf_responses'
  },
  createdBy: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'created_by'
  },
  lastError: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'last_error'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  tableName: 'scheduled_campaigns',
  timestamps: true,
  underscored: true
});

// Associations
ScheduledCampaign.belongsTo(Campaign, { 
  foreignKey: 'campaignId',
  as: 'campaign'
});

ScheduledCampaign.belongsTo(SipPeer, { 
  as: 'sipTrunk', 
  foreignKey: 'sipTrunkId' 
});

// Class methods
ScheduledCampaign.getUpcoming = function(userId = null) {
  const where = {
    status: 'scheduled',
    startDatetime: {
      [require('sequelize').Op.gt]: new Date()
    }
  };
  
  if (userId) {
    where.createdBy = userId;
  }
  
  return this.findAll({
    where,
    include: [
      { model: SipPeer, as: 'sipTrunk', attributes: ['name', 'host'] }
    ],
    order: [['startDatetime', 'ASC']]
  });
};

ScheduledCampaign.getActive = function() {
  return this.findAll({
    where: {
      status: 'running'
    },
    include: [
      { model: SipPeer, as: 'sipTrunk', attributes: ['name', 'host'] }
    ]
  });
};

module.exports = ScheduledCampaign;