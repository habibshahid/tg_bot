// =====================================
// QUEUE MODEL (models/queue.js)
// =====================================
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Queue = sequelize.define('Queue', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  musiconhold: {
    type: DataTypes.STRING(128),
    allowNull: true
  },
  announce: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  context: {
    type: DataTypes.STRING(128),
    allowNull: true
  },
  timeout: {
    type: DataTypes.INTEGER,
    defaultValue: 25
  },
  monitor_join: {
    type: DataTypes.TINYINT,
    defaultValue: 1
  },
  monitor_format: {
    type: DataTypes.STRING(128),
    defaultValue: 'wav'
  },
  queue_youarenext: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  queue_thereare: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  queue_callswaiting: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  queue_holdtime: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  queue_minutes: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  queue_seconds: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  queue_lessthan: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  queue_thankyou: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  queue_reporthold: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  announce_frequency: {
    type: DataTypes.INTEGER,
    defaultValue: 20
  },
  announce_round_seconds: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  announce_holdtime: {
    type: DataTypes.STRING(128),
    allowNull: true
  },
  retry: {
    type: DataTypes.INTEGER,
    defaultValue: 5
  },
  wrapuptime: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  maxlen: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  servicelevel: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  strategy: {
    type: DataTypes.STRING(128),
    defaultValue: 'roundrobin'
  },
  joinempty: {
    type: DataTypes.STRING(128),
    defaultValue: 'yes'
  },
  leavewhenempty: {
    type: DataTypes.STRING(128),
    defaultValue: 'no'
  },
  eventmemberstatus: {
    type: DataTypes.TINYINT,
    defaultValue: 1
  },
  eventwhencalled: {
    type: DataTypes.TINYINT,
    defaultValue: 1
  },
  reportholdtime: {
    type: DataTypes.TINYINT,
    defaultValue: 0
  },
  memberdelay: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  weight: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  timeoutrestart: {
    type: DataTypes.TINYINT,
    allowNull: true
  },
  periodic_announce: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  periodic_announce_frequency: {
    type: DataTypes.INTEGER,
    defaultValue: 60
  },
  ringinuse: {
    type: DataTypes.TINYINT,
    defaultValue: 0
  },
  setinterfacevar: {
    type: DataTypes.TINYINT,
    defaultValue: 1
  },
  setqueueentryvar: {
    type: DataTypes.TINYINT,
    defaultValue: 1
  },
  setqueuevar: {
    type: DataTypes.TINYINT,
    defaultValue: 1
  },
  autopause: {
    type: DataTypes.TINYINT,
    defaultValue: 0
  },
  autofill: {
    type: DataTypes.STRING(3),
    defaultValue: 'yes'
  },
  keepstats: {
    type: DataTypes.STRING(3),
    defaultValue: 'yes'
  }
}, {
  tableName: 'queues',
  timestamps: false
});

module.exports = Queue;