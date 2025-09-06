// =====================================
// CAMPAIGN MODEL (models/campaign.js)
// =====================================
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const SipPeer = require('./sippeer');

const Campaign = sequelize.define('Campaign', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  botToken: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    field: 'bot_token'
  },
  campaignName: {
    type: DataTypes.STRING(100),
    defaultValue: 'Default Campaign',
    field: 'campaign_name'
  },
  sipTrunkId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'sip_trunk_id'
  },
  callbackTrunkId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'callback_trunk_id',
    references: {
      model: 'sippeers',
      key: 'id'
    }
  },
  callbackTrunkNumber: {
	type: DataTypes.STRING(50),
	allowNull: true,
	field: 'callback_trunk_number'
  },
  concurrentCalls: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
    field: 'concurrent_calls'
  },
  callerId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'caller_id'
  },
  dialPrefix: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'dial_prefix',
    defaultValue: ''
  },
  notificationsChatId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'notifications_chat_id'
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
  totalCalls: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_calls'
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
  callCounter: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'call_counter'
  },
  destinationRoute: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'destination_route'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  createdBy: {
    type: DataTypes.STRING(100),
    defaultValue: 0,
    field: 'created_by'
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
  tableName: 'campaigns',
  timestamps: true,
  underscored: true
});

Campaign.belongsTo(SipPeer, {
  as: 'sipTrunk',
  foreignKey: 'sipTrunkId'
});

// ADD THIS NEW ASSOCIATION:
Campaign.belongsTo(SipPeer, {
  as: 'callbackTrunk',
  foreignKey: 'callbackTrunkId'
});

module.exports = Campaign;