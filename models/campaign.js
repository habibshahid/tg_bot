// =====================================
// CAMPAIGN MODEL (models/campaign.js)
// =====================================
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
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

module.exports = Campaign;