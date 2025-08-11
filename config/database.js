// 1. First, install MySQL packages
// npm install mysql2 sequelize

// =====================================
// DATABASE CONFIGURATION (config/database.js)
// =====================================
const { Sequelize } = require('sequelize');
const config = require('./index');

const sequelize = new Sequelize(
  config.mysql.database,
  config.mysql.username,
  config.mysql.password,
  {
    host: config.mysql.host,
    dialect: 'mysql',
    logging: false, // Set to console.log to see SQL queries
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

module.exports = sequelize;
