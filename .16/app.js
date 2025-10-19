// app.js - Updated version

const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const sequelize = require("./config/database");
const compression = require("compression");
const cors = require("cors");
const helmet = require("helmet");

// REMOVED: ScheduledCampaign import - not needed with simplified approach
// REMOVED: campaignScheduler import - using simplified scheduler instead

const indexRouter = require("./routes/index");
const { initializeBot } = require("./telegram_bot");

// Import all models
const Call = require("./models/call");
const Allowed = require("./models/allowed");
const Campaign = require("./models/campaign");
const SipPeer = require("./models/sippeer");

// Import the simplified scheduler
const simpleCampaignScheduler = require("./services/simpleCampaignScheduler");

const app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(cors());
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);

// Initialize database
async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established');
    
    // For existing database, only sync new tables or columns
    // Don't use force: true as it would drop existing tables
    await sequelize.sync({ 
      alter: false  // Set to false for production with existing tables
    });
    
    console.log('Database models synchronized');
    
    // Check if there are any SIP trunks configured
    const sipTrunkCount = await SipPeer.count({ 
      where: { 
        category: 'trunk',
        status: 1 
      } 
    });
    
    if (sipTrunkCount === 0) {
      console.log('⚠️  No active SIP trunks found in database.');
      console.log('   Please configure SIP trunks via:');
      console.log('   1. Telegram bot using /start');
      console.log('   2. Web portal');
      console.log('   3. Direct database insertion');
    } else {
      console.log(`✅ Found ${sipTrunkCount} active SIP trunk(s) in database`);
    }
    
    // Log available SIP trunks for debugging
    const trunks = await SipPeer.findAll({
      where: { category: 'trunk', status: 1 },
      attributes: ['id', 'name', 'host', 'username']
    });
    
    if (trunks.length > 0) {
      console.log('\nAvailable SIP Trunks:');
      trunks.forEach(trunk => {
        console.log(`  - ${trunk.name} (${trunk.host}) - ID: ${trunk.id}`);
      });
    }
    
    // Initialize the simplified campaign scheduler
    console.log('Initializing simplified campaign scheduler...');
    // The bot will be passed to the scheduler when telegram bot is initialized
    
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
}

initializeDatabase();

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

initializeBot();

module.exports = app;
