// models/user.js
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
  underscored: true
});

module.exports = User;