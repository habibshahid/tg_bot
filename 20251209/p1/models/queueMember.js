// =====================================
// QUEUE MEMBER MODEL (models/queueMember.js)
// =====================================
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const QueueMember = sequelize.define('QueueMember', {
  uniqueid: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  membername: {
    type: DataTypes.STRING(40),
    allowNull: true
  },
  queue_name: {
    type: DataTypes.STRING(128),
    allowNull: true
  },
  interface: {
    type: DataTypes.STRING(128),
    allowNull: true
  },
  penalty: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  paused: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'queue_members',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['queue_name', 'interface'],
      name: 'queue_interface'
    }
  ]
});

module.exports = QueueMember;