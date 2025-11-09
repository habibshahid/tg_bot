// telegram_bot/approvalHandlers.js - NEW FILE
const User = require('../models/user');
const SipPeer = require('../models/sippeer');
const { RateCard, Provider } = require('../models/provider');


function escapeMarkdown(text) {
  if (!text) return '';
  return text.toString()
    .replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

// Handle approval workflow callbacks
async function handleApprovalCallbacks(bot, query, user, chatId, callbackData, userStates, userId) {
  // Pending approvals list
  if (callbackData === 'admin_pending_approvals') {
    if (user.userType !== 'admin') {
      bot.sendMessage(chatId, "❌ Admin access required!");
      return true;
    }

    try {
      const pendingUsers = await User.findAll({
        where: { approvalStatus: 'pending' },
        order: [['requestedAt', 'ASC']],
        limit: 20
      });

      if (pendingUsers.length === 0) {
        bot.sendMessage(
          chatId,
          "✅ *No Pending Approvals*\n\nAll users have been processed.",
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
              ]
            }
          }
        );
        return true;
      }

      let message = "⏳ *Pending User Approvals*\n\nSelect a user to review:\n\n";

      const userButtons = pendingUsers.map((u, index) => {
        const timeAgo = Math.floor((new Date() - new Date(u.requestedAt)) / (1000 * 60 * 60 * 24));
        return [{
          text: `${u.firstName || u.username || 'User'} (${u.telegramId}) - ${timeAgo}d ago`,
          callback_data: `admin_review_user_${u.id}`
        }];
      });

      userButtons.push([{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]);

      bot.sendMessage(
        chatId,
        message,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: userButtons
          }
        }
      );
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
    return true;
  }

  // Review specific user for approval
  if (callbackData.startsWith('admin_review_user_')) {
    if (user.userType !== 'admin') {
      bot.sendMessage(chatId, "❌ Admin access required!");
      return true;
    }

    const pendingUserId = callbackData.replace('admin_review_user_', '');
    await showUserReview(bot, chatId, pendingUserId);
    return true;
  }

  // Approve and configure user
  if (callbackData.startsWith('admin_approve_configure_')) {
    if (user.userType !== 'admin') {
      bot.sendMessage(chatId, "❌ Admin access required!");
      return true;
    }

    const pendingUserId = callbackData.replace('admin_approve_configure_', '');
    await approveAndConfigureUser(bot, chatId, user, pendingUserId);
    return true;
  }

  // Configuration callbacks
  if (callbackData.startsWith('admin_config_sip_')) {
    const approvedUserId = callbackData.replace('admin_config_sip_', '');
    await handleConfigSipTrunk(bot, chatId, user, approvedUserId);
    return true;
  }

  if (callbackData.startsWith('admin_config_callerid_')) {
    const approvedUserId = callbackData.replace('admin_config_callerid_', '');
    
    bot.sendMessage(
      chatId,
      `📞 *Set Caller ID*\n\nEnter the caller ID for this user:\n\n` +
      `Examples:\n` +
      `• +1234567890\n` +
      `• 1234567890\n` +
      `• (123) 456-7890`,
      { parse_mode: 'Markdown' }
    );
    
    userStates[userId] = {
      action: 'admin_configuring_callerid',
      targetUserId: approvedUserId
    };
    return true;
  }

  if (callbackData.startsWith('admin_config_prefix_')) {
    const approvedUserId = callbackData.replace('admin_config_prefix_', '');
    
    bot.sendMessage(
      chatId,
      `➕ *Set Dial Prefix*\n\nEnter the dial prefix for this user:\n\n` +
      `Examples:\n` +
      `• 9 (for outbound access)\n` +
      `• 011 (for international)\n` +
      `• none (for no prefix)`,
      { parse_mode: 'Markdown' }
    );
    
    userStates[userId] = {
      action: 'admin_configuring_prefix',
      targetUserId: approvedUserId
    };
    return true;
  }

  if (callbackData.startsWith('admin_config_concurrent_')) {
    const approvedUserId = callbackData.replace('admin_config_concurrent_', '');
    
    bot.sendMessage(
      chatId,
      `🔢 *Set Concurrent Calls*\n\nEnter the maximum concurrent calls for this user:\n\n` +
      `Examples:\n` +
      `• 30 (recommended)\n` +
      `• 50 (high volume)\n` +
      `• 10 (low volume)`,
      { parse_mode: 'Markdown' }
    );
    
    userStates[userId] = {
      action: 'admin_configuring_concurrent',
      targetUserId: approvedUserId
    };
    return true;
  }

  // SIP trunk confirmation
  if (callbackData.startsWith('admin_confirm_config_sip_')) {
    const parts = callbackData.replace('admin_confirm_config_sip_', '').split('_');
    const targetUserId = parts[0];
    const sipTrunkId = parseInt(parts[1]);

    try {
      const [targetUser, sipTrunk] = await Promise.all([
        User.findByPk(targetUserId),
        SipPeer.findByPk(sipTrunkId)
      ]);

      if (!targetUser || !sipTrunk) {
        bot.sendMessage(chatId, "❌ User or SIP trunk not found.");
        return true;
      }

      await targetUser.update({ sipTrunkId });

      bot.sendMessage(
        chatId,
        `✅ *SIP Trunk Set*\n\n` +
        `User: ${escapeMarkdown(targetUser.firstName || targetUser.username || 'User')}\n` +
        `SIP Trunk: ${escapeMarkdown(sipTrunk.name)}\n` +
        `Host: ${escapeMarkdown(sipTrunk.host)}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '⚙️ Continue Setup', callback_data: `admin_approve_configure_${targetUser.id}` }]
            ]
          }
        }
      );
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
    return true;
  }

  // Finish setup
  if (callbackData.startsWith('admin_finish_setup_')) {
    const approvedUserId = callbackData.replace('admin_finish_setup_', '');
    await finishUserSetup(bot, chatId, user, approvedUserId);
    return true;
  }

  // Reject user
  if (callbackData.startsWith('admin_reject_user_')) {
    const pendingUserId = callbackData.replace('admin_reject_user_', '');
    
    bot.sendMessage(
      chatId,
      `❌ *Reject User Request*\n\nEnter rejection reason (optional):`,
      { parse_mode: 'Markdown' }
    );
    
    userStates[userId] = {
      action: 'admin_rejecting_user',
      targetUserId: pendingUserId
    };
    return true;
  }

  return false; // Not an approval callback
}

// Handle approval workflow text messages
async function handleApprovalTextMessages(bot, msg, userStates, userId, chatId, text) {
  const userState = userStates[userId];
  if (!userState) return false;

  switch (userState.action) {
    case 'admin_configuring_callerid':
      try {
        const targetUser = await User.findByPk(userState.targetUserId);
        if (!targetUser) {
          bot.sendMessage(chatId, "❌ Target user not found.");
          delete userStates[userId];
          return true;
        }

        // Validate caller ID format
        const callerId = text.trim().replace(/[^\d+()-\s]/g, '');
        if (!callerId || callerId.length < 7) {
          bot.sendMessage(chatId, "❌ Invalid caller ID format. Please try again.");
          return true;
        }

        await targetUser.update({ callerId });

        bot.sendMessage(
          chatId,
          `✅ *Caller ID Set*\n\n` +
          `User: ${escapeMarkdown(targetUser.firstName || targetUser.username || 'User')}\n` +
          `Caller ID: ${escapeMarkdown(callerId)}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '⚙️ Continue Setup', callback_data: `admin_approve_configure_${targetUser.id}` }]
              ]
            }
          }
        );

        delete userStates[userId];
      } catch (error) {
        bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        delete userStates[userId];
      }
      return true;

    case 'admin_configuring_prefix':
      try {
        const targetUser = await User.findByPk(userState.targetUserId);
        if (!targetUser) {
          bot.sendMessage(chatId, "❌ Target user not found.");
          delete userStates[userId];
          return true;
        }

        let dialPrefix = text.trim().toLowerCase();
        if (dialPrefix === 'none' || dialPrefix === 'no' || dialPrefix === '') {
          dialPrefix = null;
        } else {
          // Validate prefix - should only contain digits
          if (!/^\d*$/.test(dialPrefix)) {
            bot.sendMessage(chatId, "❌ Prefix should only contain numbers or 'none'. Please try again.");
            return true;
          }
        }

        await targetUser.update({ dialPrefix });

        bot.sendMessage(
          chatId,
          `✅ *Dial Prefix Set*\n\n` +
          `User: ${escapeMarkdown(targetUser.firstName || targetUser.username || 'User')}\n` +
          `Dial Prefix: ${dialPrefix ? escapeMarkdown(dialPrefix) : 'None'}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '⚙️ Continue Setup', callback_data: `admin_approve_configure_${targetUser.id}` }]
              ]
            }
          }
        );

        delete userStates[userId];
      } catch (error) {
        bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        delete userStates[userId];
      }
      return true;

    case 'admin_configuring_concurrent':
      try {
        const targetUser = await User.findByPk(userState.targetUserId);
        if (!targetUser) {
          bot.sendMessage(chatId, "❌ Target user not found.");
          delete userStates[userId];
          return true;
        }

        const concurrentCalls = parseInt(text.trim());
        if (isNaN(concurrentCalls) || concurrentCalls < 1 || concurrentCalls > 100) {
          bot.sendMessage(chatId, "❌ Please enter a valid number between 1 and 100.");
          return true;
        }

        await targetUser.update({ concurrentCalls });

        bot.sendMessage(
          chatId,
          `✅ *Concurrent Calls Set*\n\n` +
          `User: ${escapeMarkdown(targetUser.firstName || targetUser.username || 'User')}\n` +
          `Concurrent Calls: ${concurrentCalls}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '⚙️ Continue Setup', callback_data: `admin_approve_configure_${targetUser.id}` }]
              ]
            }
          }
        );

        delete userStates[userId];
      } catch (error) {
        bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        delete userStates[userId];
      }
      return true;

    case 'admin_rejecting_user':
      try {
        const targetUser = await User.findByPk(userState.targetUserId);
        if (!targetUser) {
          bot.sendMessage(chatId, "❌ Target user not found.");
          delete userStates[userId];
          return true;
        }

        const rejectionReason = text.trim();
        
        await targetUser.update({
          approvalStatus: 'rejected',
          approvalDate: new Date(),
          approvedBy: userId.toString(),
          approvalNotes: rejectionReason || 'No reason provided'
        });

        bot.sendMessage(
          chatId,
          `❌ *User Rejected*\n\n` +
          `User: ${escapeMarkdown(targetUser.firstName || targetUser.username || 'User')}\n` +
          `Reason: ${escapeMarkdown(rejectionReason || 'No reason provided')}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '⏳ Back to Pending', callback_data: 'admin_pending_approvals' }]
              ]
            }
          }
        );

        // Notify the user of rejection
        try {
          await bot.sendMessage(
            targetUser.telegramId,
            `❌ *Account Request Rejected*\n\n` +
            `Your account request has been rejected by the administrator.\n\n` +
            `${rejectionReason ? `Reason: ${rejectionReason}\n\n` : ''}` +
            `Please contact the administrator for more information.`,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          console.log(`Could not notify user ${targetUser.telegramId}: ${error.message}`);
        }

        delete userStates[userId];
      } catch (error) {
        bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        delete userStates[userId];
      }
      return true;

    default:
      return false;
  }
}

// Helper functions
async function showUserReview(bot, chatId, pendingUserId) {
  try {
    const pendingUser = await User.findByPk(pendingUserId);
    if (!pendingUser || pendingUser.approvalStatus !== 'pending') {
      bot.sendMessage(chatId, "❌ User not found or already processed.");
      return;
    }

    const requestedDays = Math.floor((new Date() - new Date(pendingUser.requestedAt)) / (1000 * 60 * 60 * 24));

    bot.sendMessage(
      chatId,
      `👤 *User Approval Review*\n\n` +
      `Name: ${escapeMarkdown(pendingUser.firstName || pendingUser.username || 'User')}\n` +
      `Telegram ID: ${pendingUser.telegramId}\n` +
      `Email: ${pendingUser.email || 'Not provided'}\n` +
      `Requested: ${requestedDays} days ago\n` +
      `Status: ${pendingUser.approvalStatus}\n\n` +
      `Choose an action:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve & Configure', callback_data: `admin_approve_configure_${pendingUser.id}` }
            ],
            [
              { text: '❌ Reject Request', callback_data: `admin_reject_user_${pendingUser.id}` }
            ],
            [
              { text: '🔙 Back to List', callback_data: 'admin_pending_approvals' }
            ]
          ]
        }
      }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
}

async function approveAndConfigureUser(bot, chatId, adminUser, pendingUserId) {
  try {
    const pendingUser = await User.findByPk(pendingUserId);
    if (!pendingUser || pendingUser.approvalStatus !== 'pending') {
      bot.sendMessage(chatId, "❌ User not found or already processed.");
      return;
    }

    // First approve the user
    await pendingUser.update({
      approvalStatus: 'approved',
      approvalDate: new Date(),
      approvedBy: adminUser.telegramId
    });

    // Now show configuration options
    bot.sendMessage(
      chatId,
      `✅ *User Approved*\n\n` +
      `${escapeMarkdown(pendingUser.firstName || pendingUser.username || 'User')} has been approved.\n\n` +
      `Now configure their campaign settings:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🌐 Set SIP Trunk', callback_data: `admin_config_sip_${pendingUser.id}` },
              { text: '📞 Set Caller ID', callback_data: `admin_config_callerid_${pendingUser.id}` }
            ],
            [
              { text: '➕ Set Dial Prefix', callback_data: `admin_config_prefix_${pendingUser.id}` },
              { text: '🔢 Set Concurrent Calls', callback_data: `admin_config_concurrent_${pendingUser.id}` }
            ],
            [
              { text: '💳 Assign Rate Card', callback_data: `admin_assign_rate_${pendingUser.id}` }
            ],
            [
              { text: '✅ Finish Setup', callback_data: `admin_finish_setup_${pendingUser.id}` },
              { text: '🔙 Back to Pending', callback_data: 'admin_pending_approvals' }
            ]
          ]
        }
      }
    );

    // Notify the user they've been approved
    try {
      await bot.sendMessage(
        pendingUser.telegramId,
        `🎉 *Account Approved!*\n\n` +
        `Your account has been approved by the administrator. ` +
        `Your campaign settings are being configured.\n\n` +
        `You'll receive another notification when setup is complete.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.log(`Could not notify user ${pendingUser.telegramId}: ${error.message}`);
    }

  } catch (error) {
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
}

async function handleConfigSipTrunk(bot, chatId, adminUser, targetUserId) {
  try {
    const sipTrunks = await SipPeer.findAll({
      where: { category: 'trunk', status: 1 },
      order: [['name', 'ASC']]
    });

    if (sipTrunks.length === 0) {
      bot.sendMessage(chatId, "❌ No SIP trunks available.");
      return;
    }

    const trunkButtons = sipTrunks.map(trunk => [{
      text: `${trunk.name} (${trunk.host})`,
      callback_data: `admin_confirm_config_sip_${targetUserId}_${trunk.id}`
    }]);

    trunkButtons.push([{ 
      text: '🔙 Back', 
      callback_data: `admin_approve_configure_${targetUserId}` 
    }]);

    bot.sendMessage(
      chatId,
      `🌐 *Select SIP Trunk*\n\nChoose a SIP trunk for this user:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: trunkButtons
        }
      }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
}

async function finishUserSetup(bot, chatId, adminUser, targetUserId) {
  try {
    const targetUser = await User.findByPk(targetUserId, {
      include: [
        { model: SipPeer, as: 'sipTrunk' },
        { model: SipPeer, as: 'callbackTrunk' },
        { model: RateCard, as: 'rateCard' }
      ]
    });

    if (!targetUser) {
      bot.sendMessage(chatId, "❌ User not found.");
      return;
    }

    // Check if all required settings are configured
    const hasSettings = targetUser.hasCompleteCampaignSettings();
    
    await targetUser.update({
      campaignSettingsComplete: hasSettings
    });

    const settingsStatus = hasSettings ? '✅ Complete' : '⚠️ Incomplete';
    const missingSettings = [];
    if (!targetUser.sipTrunkId) missingSettings.push('SIP Trunk');
    if (!targetUser.callerId) missingSettings.push('Caller ID');
    if (!targetUser.concurrentCalls) missingSettings.push('Concurrent Calls');

    bot.sendMessage(
      chatId,
      `🎯 *User Setup Summary*\n\n` +
      `User: ${escapeMarkdown(targetUser.firstName || targetUser.username || 'User')}\n` +
      `Status: ${settingsStatus}\n\n` +
      `📋 *Configuration:*\n` +
      `SIP Trunk: ${targetUser.sipTrunk ? escapeMarkdown(targetUser.sipTrunk.name) : '❌ Not set'}\n` +
      `Caller ID: ${targetUser.callerId ? escapeMarkdown(targetUser.callerId) : '❌ Not set'}\n` +
      `Dial Prefix: ${targetUser.dialPrefix ? escapeMarkdown(targetUser.dialPrefix) : '➖ None'}\n` +
      `Concurrent Calls: ${targetUser.concurrentCalls || '❌ Not set'}\n` +
      `Rate Card: ${targetUser.rateCard ? escapeMarkdown(targetUser.rateCard.name) : '❌ Not assigned'}\n\n` +
      `${missingSettings.length > 0 ? `⚠️ Missing: ${missingSettings.join(', ')}` : '✅ Setup complete!'}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏳ Back to Pending', callback_data: 'admin_pending_approvals' }],
            [{ text: '👥 All Users', callback_data: 'admin_users' }],
            [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
          ]
        }
      }
    );

    // Notify user if setup is complete
    if (hasSettings) {
      try {
        await bot.sendMessage(
          targetUser.telegramId,
          `🎉 *Setup Complete!*\n\n` +
          `Your account is now fully configured and ready to use.\n\n` +
          `You can now:\n` +
          `• Upload leads\n` +
          `• Start campaigns\n` +
          `• Monitor call statistics\n\n` +
          `Welcome to the system!`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.log(`Could not notify user ${targetUser.telegramId}: ${error.message}`);
      }
    }

  } catch (error) {
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
}

module.exports = {
  handleApprovalCallbacks,
  handleApprovalTextMessages
};