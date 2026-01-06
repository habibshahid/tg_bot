// =====================================
// ALLOWED MODEL (models/allowed.js)
// =====================================
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Allowed = sequelize.define('Allowed', {
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
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  }
}, {
  tableName: 'allowed_users',
  timestamps: true,
  updatedAt: false,
  underscored: true
});

module.exports = Allowed;