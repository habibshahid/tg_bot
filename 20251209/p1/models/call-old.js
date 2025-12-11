// =====================================
// CALL MODEL (models/call.js)
// =====================================

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Call = sequelize.define('Call', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  phoneNumber: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'phone_number'
  },
  rawLine: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'raw_line'
  },
  callerId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'caller_id'
  },
  used: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  pressedOne: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'pressed_one'
  },
  pressedDigit: {
    type: DataTypes.STRING(1),
    allowNull: true,
    field: 'pressed_digit'
  },
  campaignId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'campaign_id'
  },
  callStarted: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'call_started'
  },
  callEnded: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'call_ended'
  },
  callStatus: {
    type: DataTypes.ENUM('pending', 'calling', 'success', 'failed'),
    defaultValue: 'pending',
    field: 'call_status'
  },
  voicemail: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'no',
    field: 'voicemail'
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
  tableName: 'calls',
  timestamps: true,
  underscored: true
});

module.exports = Call;