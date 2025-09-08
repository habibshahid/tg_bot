// models/user.js - FIXED VERSION
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  telegramId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    field: 'telegram_id'
  },
  username: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  firstName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'first_name'
  },
  lastName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'last_name'
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  balance: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0.0000,
    validate: {
      min: 0
    }
  },
  creditLimit: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0.0000,
    field: 'credit_limit'
  },
  rateCardId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'rate_card_id'
  },
  // NEW APPROVAL WORKFLOW FIELDS
  sipTrunkId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'sip_trunk_id'
  },
  callbackTrunkId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'callback_trunk_id'
  },
  callerId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'caller_id'
  },
  dialPrefix: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'dial_prefix'
  },
  destinationRoute: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'destination_route'
  },
  concurrentCalls: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
    field: 'concurrent_calls'
  },
  approvalStatus: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
    field: 'approval_status'
  },
  approvalDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'approval_date'
  },
  approvedBy: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'approved_by'
  },
  campaignSettingsComplete: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'campaign_settings_complete'
  },
  approvalNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'approval_notes'
  },
  requestedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'requested_at'
  },
  status: {
    type: DataTypes.ENUM('active', 'suspended', 'inactive'),
    defaultValue: 'active'
  },
  userType: {
    type: DataTypes.ENUM('admin', 'user'),
    defaultValue: 'user',
    field: 'user_type'
  },
  timezone: {
    type: DataTypes.STRING(50),
    defaultValue: 'UTC'
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD'
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_login_at'
  },
  createdBy: {
    type: DataTypes.STRING(50),
    allowNull: true,
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
  tableName: 'users',
  timestamps: true,
  underscored: true,
  hooks: {
    beforeCreate: (user, options) => {
      // Set campaign settings complete if all required fields are present
      user.campaignSettingsComplete = !!(
        user.sipTrunkId && 
        user.callerId && 
        user.concurrentCalls
      );
    },
    beforeUpdate: (user, options) => {
      // Update campaign settings complete status
      if (user.changed('sipTrunkId') || user.changed('callerId') || user.changed('concurrentCalls')) {
        user.campaignSettingsComplete = !!(
          user.sipTrunkId && 
          user.callerId && 
          user.concurrentCalls
        );
      }
    }
  }
});

// Instance methods for approval workflow
User.prototype.isApproved = function() {
  return this.approvalStatus === 'approved';
};

User.prototype.isPending = function() {
  return this.approvalStatus === 'pending';
};

User.prototype.isRejected = function() {
  return this.approvalStatus === 'rejected';
};

User.prototype.hasCompleteCampaignSettings = function() {
  return !!(this.sipTrunkId && this.callerId && this.concurrentCalls);
};

User.prototype.canCreateCampaign = function() {
  return this.isApproved() && this.hasCompleteCampaignSettings();
};

// Static methods
User.getPendingApprovals = function() {
  return this.findAll({
    where: { approvalStatus: 'pending' },
    order: [['requestedAt', 'ASC']]
  });
};
module.exports = User;