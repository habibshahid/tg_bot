// models/transaction.js - FIXED VERSION (remove associations from here)
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id'
  },
  transactionType: {
    type: DataTypes.ENUM('credit', 'debit', 'refund', 'adjustment'),
    allowNull: false,
    field: 'transaction_type'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false,
    validate: {
      notNull: { msg: 'Amount is required' }
    }
  },
  balanceBefore: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false,
    field: 'balance_before'
  },
  balanceAfter: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false,
    field: 'balance_after'
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  reference: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'External reference like call ID, payment ID, etc'
  },
  callDetailId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'call_detail_id',
    comment: 'Reference to call_details table if transaction is for a call'
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
  }
}, {
  tableName: 'transactions',
  timestamps: true,
  updatedAt: false,
  underscored: true
});

// CallDetail model
const CallDetail = sequelize.define('CallDetail', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id'
  },
  campaignId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'campaign_id'
  },
  callId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'call_id',
    comment: 'Asterisk call ID'
  },
  phoneNumber: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'phone_number'
  },
  destinationId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'destination_id'
  },
  rateCardId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'rate_card_id'
  },
  callStarted: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'call_started'
  },
  callAnswered: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'call_answered'
  },
  callEnded: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'call_ended'
  },
  callDuration: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'call_duration',
    comment: 'Total call duration in seconds'
  },
  billableDuration: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'billable_duration',
    comment: 'Billable duration after rounding'
  },
  callStatus: {
    type: DataTypes.ENUM('pending', 'answered', 'busy', 'no_answer', 'failed', 'cancelled'),
    defaultValue: 'pending',
    field: 'call_status'
  },
  hangupCause: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'hangup_cause'
  },
  dtmfPressed: {
    type: DataTypes.STRING(10),
    allowNull: true,
    field: 'dtmf_pressed'
  },
  costPrice: {
    type: DataTypes.DECIMAL(10, 6),
    defaultValue: 0,
    field: 'cost_price',
    comment: 'Cost price per minute at time of call'
  },
  sellPrice: {
    type: DataTypes.DECIMAL(10, 6),
    defaultValue: 0,
    field: 'sell_price',
    comment: 'Sell price per minute at time of call'
  },
  totalCost: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0,
    field: 'total_cost',
    comment: 'Total cost for this call'
  },
  totalCharge: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0,
    field: 'total_charge',
    comment: 'Total charge to customer'
  },
  profit: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0,
    comment: 'Profit from this call'
  },
  sipTrunkId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'sip_trunk_id'
  },
  callerId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'caller_id'
  },
  processed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether billing has been processed'
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
  tableName: 'call_details',
  timestamps: true,
  underscored: true
});

module.exports = { Transaction, CallDetail };