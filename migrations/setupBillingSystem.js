// migrations/setupBillingSystem.js
const sequelize = require('../config/database');
const User = require('../models/user');
const { Provider, RateCard, Destination, Rate } = require('../models/provider');
const { Transaction, CallDetail } = require('../models/transaction');
const adminUtilities = require('../utils/adminUtilities');

async function setupBillingSystem() {
  console.log('🚀 Setting up billing system database...');
  
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Sync all models
    await sequelize.sync({ alter: true });
    console.log('✅ Database models synchronized');
    
    // Check if sample data already exists
    const existingProviders = await Provider.count();
    
    if (existingProviders === 0) {
      console.log('📊 Creating sample data...');
      await createSampleData();
    } else {
      console.log('📊 Sample data already exists, skipping...');
    }
    
    // Verify associations
    await verifyAssociations();
    
    console.log('🎉 Billing system setup completed successfully!');
    
    // Print setup summary
    await printSetupSummary();
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

async function createSampleData() {
  console.log('  Creating sample providers...');
  
  // Create sample providers
  const provider1 = await adminUtilities.createProvider({
    name: 'Global Telecom Provider',
    description: 'Primary wholesale provider for international destinations',
    currency: 'USD',
    billingIncrement: 60,
    minimumDuration: 60
  });
  
  const provider2 = await adminUtilities.createProvider({
    name: 'Local Carrier',
    description: 'Local carrier for domestic calls',
    currency: 'USD',
    billingIncrement: 30,
    minimumDuration: 30
  });
  
  console.log('  Creating sample rate cards...');
  
  // Create sample rate cards
  const rateCard1 = await adminUtilities.createRateCard({
    name: 'Standard Rates',
    description: 'Standard rates for all customers',
    providerId: provider1.provider.id,
    currency: 'USD'
  });
  
  const rateCard2 = await adminUtilities.createRateCard({
    name: 'Premium Rates',
    description: 'Premium rates for high-volume customers',
    providerId: provider1.provider.id,
    currency: 'USD'
  });
  
  console.log('  Creating sample destinations...');
  
  // Create sample destinations
  const destinationsCSV = `Country Code,Country Name,Prefix,Description,Region
US,United States,1,USA Mobile & Fixed,North America
CA,Canada,1,Canada All Networks,North America
GB,United Kingdom,44,UK All Networks,Europe
DE,Germany,49,Germany All Networks,Europe
FR,France,33,France All Networks,Europe
PK,Pakistan,92,Pakistan All Networks,Asia
IN,India,91,India All Networks,Asia
CN,China,86,China All Networks,Asia
AU,Australia,61,Australia All Networks,Oceania
BR,Brazil,55,Brazil All Networks,South America
MX,Mexico,52,Mexico All Networks,North America
JP,Japan,81,Japan All Networks,Asia
IT,Italy,39,Italy All Networks,Europe
ES,Spain,34,Spain All Networks,Europe
NL,Netherlands,31,Netherlands All Networks,Europe`;
  
  await adminUtilities.bulkUploadDestinations(destinationsCSV);
  
  console.log('  Creating sample rates...');
  
  // Create sample rates for standard rate card
  const standardRatesCSV = `Prefix,Cost Price,Sell Price,Minimum Duration,Billing Increment
1,0.005,0.01,60,60
44,0.01,0.02,60,60
49,0.008,0.015,60,60
33,0.009,0.018,60,60
92,0.02,0.035,60,60
91,0.015,0.025,60,60
86,0.012,0.022,60,60
61,0.01,0.02,60,60
55,0.015,0.025,60,60
52,0.008,0.015,60,60
81,0.02,0.035,60,60
39,0.01,0.018,60,60
34,0.009,0.016,60,60
31,0.008,0.015,60,60`;
  
  await adminUtilities.bulkUploadRates(rateCard1.rateCard.id, standardRatesCSV);
  
  // Create sample rates for premium rate card (lower prices)
  const premiumRatesCSV = `Prefix,Cost Price,Sell Price,Minimum Duration,Billing Increment
1,0.005,0.008,60,60
44,0.01,0.015,60,60
49,0.008,0.012,60,60
33,0.009,0.014,60,60
92,0.02,0.028,60,60
91,0.015,0.02,60,60
86,0.012,0.018,60,60
61,0.01,0.015,60,60
55,0.015,0.02,60,60
52,0.008,0.012,60,60
81,0.02,0.028,60,60
39,0.01,0.014,60,60
34,0.009,0.013,60,60
31,0.008,0.012,60,60`;
  
  await adminUtilities.bulkUploadRates(rateCard2.rateCard.id, premiumRatesCSV);
  
  console.log('✅ Sample data created successfully');
}

async function verifyAssociations() {
  console.log('  Verifying database associations...');
  
  // Test associations
  const rateCard = await RateCard.findOne({
    include: [
      { model: Provider, as: 'provider' },
      { 
        model: Rate, 
        as: 'rates',
        include: [{ model: Destination, as: 'destination' }],
        limit: 1
      }
    ]
  });
  
  if (rateCard && rateCard.provider && rateCard.rates.length > 0) {
    console.log('✅ Database associations verified');
  } else {
    throw new Error('Database associations not working correctly');
  }
}

async function printSetupSummary() {
  console.log('\n📋 BILLING SYSTEM SETUP SUMMARY');
  console.log('================================');
  
  const [
    providerCount,
    rateCardCount,
    destinationCount,
    rateCount,
    userCount
  ] = await Promise.all([
    Provider.count(),
    RateCard.count(),
    Destination.count(),
    Rate.count(),
    User.count()
  ]);
  
  console.log(`📊 Providers: ${providerCount}`);
  console.log(`💳 Rate Cards: ${rateCardCount}`);
  console.log(`🌍 Destinations: ${destinationCount}`);
  console.log(`💰 Rates: ${rateCount}`);
  console.log(`👥 Users: ${userCount}`);
  
  console.log('\n🔧 NEXT STEPS:');
  console.log('1. Update config/index.js with your database credentials');
  console.log('2. Set CREATOR_TELEGRAM_ID in config to your Telegram ID');
  console.log('3. Start the bot: npm start');
  console.log('4. Send /start to the bot to create your admin account');
  console.log('5. Use admin functions to add users and assign rate cards');
  
  console.log('\n📖 ADMIN COMMANDS:');
  console.log('• Create User: Use "Manage Users" -> "Add New User"');
  console.log('• Add Credit: Use "Add Credit" option');
  console.log('• View Stats: Use "System Stats" option');
  console.log('• Assign Rate Card: Use user management functions');
  
  console.log('\n💡 USER WORKFLOW:');
  console.log('1. Admin creates user with Telegram ID');
  console.log('2. Admin assigns rate card to user');
  console.log('3. Admin adds initial balance');
  console.log('4. User can start making campaigns');
  console.log('5. Calls are automatically billed per minute');
  
  console.log('\n🔍 RATE EXAMPLES:');
  const sampleRates = await Rate.findAll({
    include: [{ model: Destination, as: 'destination' }],
    limit: 5
  });
  
  sampleRates.forEach(rate => {
    console.log(`📞 ${rate.destination.countryName} (+${rate.destination.prefix}): $${rate.sellPrice}/min`);
  });
}

// Create sample admin user
async function createSampleAdmin(telegramId) {
  console.log(`👑 Creating admin user with Telegram ID: ${telegramId}`);
  
  try {
    const existingUser = await User.findOne({ 
      where: { telegramId: telegramId.toString() } 
    });
    
    if (existingUser) {
      console.log('✅ Admin user already exists');
      return existingUser;
    }
    
    const adminUser = await User.create({
      telegramId: telegramId.toString(),
      userType: 'admin',
      status: 'active',
      balance: 1000, // Give admin some balance for testing
      firstName: 'System Administrator',
      username: 'admin',
      creditLimit: 10000
    });
    
    console.log('✅ Admin user created successfully');
    return adminUser;
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  }
}

// Run migration
if (require.main === module) {
  setupBillingSystem()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = {
  setupBillingSystem,
  createSampleAdmin
};