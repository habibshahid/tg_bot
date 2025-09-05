// telegram_bot/userManagement.js
const User = require('../models/user');
const { RateCard, Provider } = require('../models/provider');
const { Transaction, CallDetail } = require('../models/transaction');
const billingEngine = require('../services/billingEngine');
const { Op } = require('sequelize');

function escapeMarkdown(text) {
  if (!text) return '';
  return text.toString()
    .replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

// Initialize user management commands
function initializeUserManagement(bot, userStates, adminId) {
  
  // Middleware to check if user exists and is authorized
  async function checkUserAccess(userId, chatId, requireAdmin = false) {
    let user = await User.findOne({ where: { telegramId: userId.toString() } });
    
    // Auto-create admin user if it's the first admin
    if (!user && userId.toString() === adminId) {
      user = await User.create({
        telegramId: userId.toString(),
        userType: 'admin',
        status: 'active',
        balance: 0,
        firstName: 'System Admin'
      });
    }
    
    if (!user) {
      bot.sendMessage(chatId, 
        "❌ *Access Denied*\n\nYou are not registered in the system. Please contact the administrator.",
        { parse_mode: 'Markdown' }
      );
      return null;
    }
    
    if (user.status !== 'active') {
      bot.sendMessage(chatId, 
        "❌ *Account Suspended*\n\nYour account is suspended. Please contact the administrator.",
        { parse_mode: 'Markdown' }
      );
      return null;
    }
    
    if (requireAdmin && user.userType !== 'admin') {
      bot.sendMessage(chatId, 
        "❌ *Admin Access Required*\n\nThis action requires administrator privileges.",
        { parse_mode: 'Markdown' }
      );
      return null;
    }
    
    // Update last login
    await user.update({ lastLoginAt: new Date() });
    
    return user;
  }

  // User Menu - Different for admin and regular users
  function getUserMenu(isAdmin) {
    const userButtons = [
      [
        { text: "🚀 Start Campaign", callback_data: "start_campaign" },
        { text: "📊 My Statistics", callback_data: "my_stats" }
      ],
      [
        { text: "💰 Check Balance", callback_data: "check_balance" },
        { text: "📋 Recent Calls", callback_data: "recent_calls" }
      ],
      [
        { text: "💳 My Rate Card", callback_data: "my_rates" },
        { text: "📁 Upload Leads", callback_data: "upload_leads" }
      ]
    ];

    const adminButtons = [
      [
        { text: "👥 Manage Users", callback_data: "admin_users" },
        { text: "💳 Manage Rates", callback_data: "admin_rates" }
      ],
      [
        { text: "💰 Add Credit", callback_data: "admin_add_credit" },
        { text: "📊 System Stats", callback_data: "admin_system_stats" }
      ],
      [
        { text: "🏗️ Create Rate Card", callback_data: "admin_create_rate" },
        { text: "🏢 Manage Providers", callback_data: "admin_providers" }
      ]
    ];

    return {
      reply_markup: {
        inline_keyboard: isAdmin ? [...adminButtons, ...userButtons] : userButtons
      }
    };
  }

  // Override start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    const user = await checkUserAccess(userId, chatId);
    if (!user) return;
    
    const isAdmin = user.userType === 'admin';
    const welcomeMessage = isAdmin ? 
      `👋 *Welcome back, Administrator!*\n\n${escapeMarkdown(user.firstName || 'Admin')}, you have full system access.` :
      `👋 *Welcome back, ${escapeMarkdown(user.firstName || user.username || 'User')}!*\n\n💰 Balance: $${user.balance}\n📊 Rate Card: ${user.rateCardId ? 'Assigned' : 'Not Assigned'}`;
    
    bot.sendMessage(
      chatId, 
      welcomeMessage + "\n\nSelect an option from the menu below:",
      { 
        ...getUserMenu(isAdmin),
        parse_mode: "Markdown"
      }
    );
  });

  // User Statistics
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const callbackData = query.data;
    
    bot.answerCallbackQuery(query.id);
    
    const user = await checkUserAccess(userId, chatId);
    if (!user) return;

    switch (callbackData) {
      case "check_balance":
        const financial = await billingEngine.getUserFinancialSummary(user.id);
        
        bot.sendMessage(
          chatId,
          `💰 *Account Balance*\n\n` +
          `Current Balance: $${financial.summary.currentBalance.toFixed(2)}\n` +
          `Credit Limit: $${financial.summary.creditLimit.toFixed(2)}\n` +
          `Available Balance: $${financial.summary.availableBalance.toFixed(2)}\n\n` +
          `📊 *Usage Summary*\n` +
          `Total Calls: ${financial.summary.totalCalls}\n` +
          `Answered Calls: ${financial.summary.answeredCalls}\n` +
          `Total Minutes: ${financial.summary.totalMinutes.toFixed(2)}\n` +
          `Total Spent: $${financial.summary.totalSpent.toFixed(2)}`,
          { parse_mode: 'Markdown' }
        );
        break;

      case "my_stats":
        await showUserStats(bot, chatId, user);
        break;

      case "recent_calls":
        await showRecentCalls(bot, chatId, user);
        break;

      case "my_rates":
        await showUserRates(bot, chatId, user);
        break;

      // Admin functions
      case "admin_users":
        if (user.userType === 'admin') {
          await showUserManagement(bot, chatId, userStates, userId);
        }
        break;

      case "admin_add_credit":
        if (user.userType === 'admin') {
          bot.sendMessage(
            chatId,
            "💰 *Add Credit to User*\n\nEnter user ID and amount:\nFormat: `USER_ID AMOUNT`\nExample: `123456789 50.00`",
            { parse_mode: 'Markdown' }
          );
          userStates[userId] = { action: 'admin_adding_credit' };
        }
        break;

      case "admin_system_stats":
        if (user.userType === 'admin') {
          await showSystemStats(bot, chatId);
        }
        break;
    }
  });

  // Handle text input for admin functions
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userState = userStates[userId];
    
    if (!userState) return;
    
    const user = await checkUserAccess(userId, chatId, true); // Admin required
    if (!user) return;

    switch (userState.action) {
      case 'admin_adding_credit':
        await handleAddCredit(bot, msg, userStates);
        break;
        
      case 'admin_creating_user':
        await handleCreateUser(bot, msg, userStates);
        break;
    }
  });

  // Show user statistics
  async function showUserStats(bot, chatId, user) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const [monthlyData, allTimeData] = await Promise.all([
      billingEngine.getUserFinancialSummary(user.id, startOfMonth),
      billingEngine.getUserFinancialSummary(user.id)
    ]);
    
    bot.sendMessage(
      chatId,
      `📊 *Your Statistics*\n\n` +
      `💰 *Account Status*\n` +
      `Balance: $${allTimeData.summary.currentBalance.toFixed(2)}\n` +
      `Available: $${allTimeData.summary.availableBalance.toFixed(2)}\n\n` +
      `📅 *This Month*\n` +
      `Calls Made: ${monthlyData.summary.totalCalls}\n` +
      `Answered: ${monthlyData.summary.answeredCalls}\n` +
      `Minutes: ${monthlyData.summary.totalMinutes.toFixed(2)}\n` +
      `Spent: $${monthlyData.summary.totalSpent.toFixed(2)}\n\n` +
      `📈 *All Time*\n` +
      `Total Calls: ${allTimeData.summary.totalCalls}\n` +
      `Total Minutes: ${allTimeData.summary.totalMinutes.toFixed(2)}\n` +
      `Total Spent: $${allTimeData.summary.totalSpent.toFixed(2)}`,
      { parse_mode: 'Markdown' }
    );
  }

  // Show recent calls
  async function showRecentCalls(bot, chatId, user) {
    const data = await billingEngine.getUserFinancialSummary(user.id);
    
    if (data.recentCalls.length === 0) {
      bot.sendMessage(chatId, "📋 *No Recent Calls*\n\nYou haven't made any calls yet.", { parse_mode: 'Markdown' });
      return;
    }
    
    let message = "📋 *Recent Calls*\n\n";
    
    data.recentCalls.slice(0, 10).forEach((call, index) => {
      const status = call.callStatus === 'answered' ? '✅' : '❌';
      const duration = call.callStatus === 'answered' ? `${Math.round(call.billableDuration/60)}min` : 'N/A';
      const cost = call.totalCharge > 0 ? `$${call.totalCharge.toFixed(4)}` : 'Free';
      
      message += `${index + 1}. ${status} ${escapeMarkdown(call.phoneNumber)}\n`;
      message += `   Duration: ${duration} | Cost: ${cost}\n`;
      message += `   ${call.createdAt.toLocaleDateString()} ${call.createdAt.toLocaleTimeString()}\n\n`;
    });
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  // Show user rate card
  async function showUserRates(bot, chatId, user) {
    if (!user.rateCardId) {
      bot.sendMessage(
        chatId, 
        "💳 *No Rate Card Assigned*\n\nYou don't have a rate card assigned. Please contact the administrator.",
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    const rateCard = await RateCard.findByPk(user.rateCardId, {
      include: [
        { 
          model: Provider, 
          as: 'provider' 
        }
      ]
    });
    
    bot.sendMessage(
      chatId,
      `💳 *Your Rate Card*\n\n` +
      `Name: ${escapeMarkdown(rateCard.name)}\n` +
      `Provider: ${escapeMarkdown(rateCard.provider.name)}\n` +
      `Currency: ${rateCard.currency}\n\n` +
      `To see specific rates for destinations, contact your administrator.`,
      { parse_mode: 'Markdown' }
    );
  }

  // Admin: Show user management
  async function showUserManagement(bot, chatId, userStates, adminUserId) {
    const users = await User.findAll({
      order: [['createdAt', 'DESC']],
      limit: 20
    });
    
    let message = "👥 *User Management*\n\n";
    
    users.forEach((user, index) => {
      const status = user.status === 'active' ? '✅' : '❌';
      const type = user.userType === 'admin' ? '👑' : '👤';
      
      message += `${index + 1}. ${type} ${status} ${escapeMarkdown(user.firstName || user.username || 'Unknown')}\n`;
      message += `   ID: ${user.telegramId} | Balance: $${user.balance}\n`;
      message += `   Rate Card: ${user.rateCardId || 'None'}\n\n`;
    });
    
    bot.sendMessage(
      chatId,
      message,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Add New User', callback_data: 'admin_add_user' }],
            [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
          ]
        }
      }
    );
  }

  // Admin: Add credit to user
  async function handleAddCredit(bot, msg, userStates) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text.trim();
    
    const parts = text.split(' ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "❌ Invalid format. Use: USER_ID AMOUNT");
      return;
    }
    
    const [targetUserId, amount] = parts;
    const parsedAmount = parseFloat(amount);
    
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      bot.sendMessage(chatId, "❌ Invalid amount. Must be a positive number.");
      return;
    }
    
    try {
      const targetUser = await User.findOne({ where: { telegramId: targetUserId } });
      if (!targetUser) {
        bot.sendMessage(chatId, "❌ User not found.");
        return;
      }
      
      const result = await billingEngine.addCredit(
        targetUser.id, 
        parsedAmount, 
        `Credit added by admin`, 
        userId.toString()
      );
      
      bot.sendMessage(
        chatId,
        `✅ *Credit Added Successfully*\n\n` +
        `User: ${escapeMarkdown(targetUser.firstName || targetUser.username || 'Unknown')}\n` +
        `Amount: $${parsedAmount.toFixed(2)}\n` +
        `New Balance: $${result.newBalance.toFixed(2)}`,
        { parse_mode: 'Markdown' }
      );
      
      // Notify the user if possible
      try {
        bot.sendMessage(
          targetUserId,
          `💰 *Credit Added*\n\n` +
          `$${parsedAmount.toFixed(2)} has been added to your account.\n` +
          `New Balance: $${result.newBalance.toFixed(2)}`,
          { parse_mode: 'Markdown' }
        );
      } catch (e) {
        // User might have blocked the bot
      }
      
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
    
    delete userStates[userId];
  }

  // Admin: Show system statistics
  async function showSystemStats(bot, chatId) {
    const [totalUsers, activeUsers, totalCalls, totalRevenue] = await Promise.all([
      User.count(),
      User.count({ where: { status: 'active' } }),
      CallDetail.count(),
      CallDetail.sum('totalCharge')
    ]);
    
    bot.sendMessage(
      chatId,
      `📊 *System Statistics*\n\n` +
      `👥 Total Users: ${totalUsers}\n` +
      `✅ Active Users: ${activeUsers}\n` +
      `📞 Total Calls: ${totalCalls || 0}\n` +
      `💰 Total Revenue: $${(totalRevenue || 0).toFixed(2)}`,
      { parse_mode: 'Markdown' }
    );
  }

  return { checkUserAccess, getUserMenu };
}

module.exports = { initializeUserManagement };