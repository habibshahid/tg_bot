// Enhanced Telegram Bot User Workflow with Approval System
// telegram_bot/userWorkflow.js

const User = require('../models/user');
const { getUserCampaignData, isUserReadyForCampaign } = require('../models/user');

// Main user identification and menu routing
async function handleUserStart(bot, chatId, userId, userInfo) {
    try {
        console.log(`User ${userId} started bot`);
        
        // Check if user exists in database
        const user = await User.findOne({ 
            where: { telegramId: userId.toString() } 
        });
        
        if (!user) {
            // New user - show registration required message
            await showNewUserMessage(bot, chatId, userInfo);
            return;
        }
        
        // User exists - check their status and route accordingly
        await routeUserByStatus(bot, chatId, user);
        
    } catch (error) {
        console.error('Error in handleUserStart:', error);
        await bot.sendMessage(chatId, 
            "❌ *System Error*\n\nSorry, there was an error processing your request. Please try again later.",
            { parse_mode: 'Markdown' }
        );
    }
}

// Route user based on their approval and configuration status
async function routeUserByStatus(bot, chatId, user) {
    const userId = user.telegramId;
    const userName = user.firstName || user.username || 'User';
    
    // Check user status
    if (user.status !== 'active') {
        await showSuspendedUserMessage(bot, chatId, user.status);
        return;
    }
    
    // Check approval status
    switch (user.approvalStatus) {
        case 'pending':
            await showPendingApprovalMessage(bot, chatId, userName);
            break;
            
        case 'rejected':
            await showRejectedUserMessage(bot, chatId);
            break;
            
        case 'approved':
            // Check if campaign settings are complete
            if (!user.campaignSettingsComplete) {
                await showAwaitingConfigurationMessage(bot, chatId, userName);
            } else {
                // User is fully configured - show main menu
                await showMainUserMenu(bot, chatId, user);
            }
            break;
            
        default:
            await showContactAdminMessage(bot, chatId);
    }
}

// Show message for new users who need to register
async function showNewUserMessage(bot, chatId, userInfo) {
    const message = `👋 *Welcome to VoIP Campaign Bot!*

Hello ${userInfo.first_name || 'there'}!

You are not registered in our system yet. To use this service, you need to:

📝 **Step 1:** Contact our administrator to register your account
📞 **Step 2:** Wait for approval and configuration
🚀 **Step 3:** Start using the campaign system

Please contact our support team with your Telegram ID: \`${userInfo.id}\`

Thank you for your interest in our service!`;

    await bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📞 Contact Support", callback_data: "contact_support" }]
            ]
        }
    });
}

// Show message for users pending approval
async function showPendingApprovalMessage(bot, chatId, userName) {
    const message = `⏳ *Account Pending Approval*

Hello ${userName}!

Your account has been created but is currently pending administrator approval.

**Current Status:** Waiting for admin review
**Next Step:** Administrator will review and approve your account

You will be notified once your account is approved and configured.

Please be patient, this usually takes 24-48 hours.`;

    await bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📞 Contact Admin", callback_data: "contact_admin" }],
                [{ text: "🔄 Check Status", callback_data: "check_status" }]
            ]
        }
    });
}

// Show message for users awaiting campaign configuration
async function showAwaitingConfigurationMessage(bot, chatId, userName) {
    const message = `⚙️ *Account Configuration Required*

Hello ${userName}!

Your account has been **approved** by the administrator! 🎉

However, your campaign settings are still being configured:

**Required Settings:**
• SIP Trunk Configuration
• Caller ID Setup  
• Call Concurrency Limits
• Dial Prefix Settings

**Current Status:** Awaiting final configuration by admin

You will be notified once your account is fully configured and ready to use.`;

    await bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📞 Contact Admin", callback_data: "contact_admin" }],
                [{ text: "🔄 Refresh Status", callback_data: "check_configuration" }]
            ]
        }
    });
}

// Show message for rejected users
async function showRejectedUserMessage(bot, chatId) {
    const message = `❌ *Account Access Denied*

Your account request has been reviewed and unfortunately was not approved.

If you believe this is an error, please contact our administrator for more information.

**Reason:** Contact admin for details`;

    await bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📞 Contact Admin", callback_data: "contact_admin" }]
            ]
        }
    });
}

// Show message for suspended users
async function showSuspendedUserMessage(bot, chatId, status) {
    const statusMessages = {
        'suspended': 'Your account has been temporarily suspended.',
        'inactive': 'Your account is currently inactive.'
    };
    
    const message = `🚫 *Account ${status.toUpperCase()}*

${statusMessages[status] || 'Your account access is restricted.'}

Please contact the administrator to resolve this issue.`;

    await bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📞 Contact Admin", callback_data: "contact_admin" }]
            ]
        }
    });
}

// Show main menu for fully configured users
async function showMainUserMenu(bot, chatId, user) {
    const message = `🚀 *Welcome back, ${user.firstName}!*

Your account is fully configured and ready to use.

**Account Status:** ✅ Active & Configured
**Balance:** $${parseFloat(user.balance).toFixed(4)}
**Rate Card:** ${user.rateCardName || 'Assigned'}

What would you like to do today?`;

    const keyboard = [
        [{ text: "📞 Start Campaign", callback_data: "start_campaign" }],
        [{ text: "💰 Check Balance", callback_data: "check_balance" }],
        [{ text: "📊 View Statistics", callback_data: "view_stats" }],
        [{ text: "⚙️ Settings", callback_data: "user_settings" }]
    ];

    await bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

// Check if user is ready for campaign creation
async function checkUserReadyForCampaign(telegramId) {
    try {
        // This should call your PHP API or database directly
        const response = await fetch(`${process.env.API_BASE_URL}/api/users/check-campaign-ready`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ telegram_id: telegramId })
        });
        
        const result = await response.json();
        return result.ready ? result.user : null;
        
    } catch (error) {
        console.error('Error checking user campaign readiness:', error);
        return null;
    }
}

// Handle campaign creation request
async function handleCampaignCreation(bot, chatId, telegramId) {
    try {
        // Check if user is ready for campaign
        const userData = await checkUserReadyForCampaign(telegramId);
        
        if (!userData) {
            await bot.sendMessage(chatId,
                "❌ *Cannot Create Campaign*\n\nYour account is not fully configured yet. Please contact the administrator.",
                { parse_mode: 'Markdown' }
            );
            return false;
        }
        
        // User is ready - proceed with campaign creation
        const campaignData = {
            botToken: generateBotToken(), // Your bot token generation logic
            campaignName: `Campaign_${userData.username}_${Date.now()}`,
            sipTrunkId: userData.sip_trunk_id,
            callbackTrunkId: userData.callback_trunk_id,
            callerId: userData.caller_id,
            dialPrefix: userData.dial_prefix || '',
            concurrentCalls: userData.concurrent_calls || 30,
            userId: userData.id,
            telegramId: telegramId
        };
        
        // Create campaign in database
        const campaign = await createCampaign(campaignData);
        
        if (campaign) {
            await bot.sendMessage(chatId,
                `✅ *Campaign Created Successfully!*\n\n` +
                `**Campaign Name:** ${campaignData.campaignName}\n` +
                `**Caller ID:** ${campaignData.callerId}\n` +
                `**Concurrent Calls:** ${campaignData.concurrentCalls}\n` +
                `**SIP Trunk:** ${userData.sip_trunk_name}\n\n` +
                `Your campaign is now ready to use!`,
                { parse_mode: 'Markdown' }
            );
            return true;
        } else {
            throw new Error('Failed to create campaign');
        }
        
    } catch (error) {
        console.error('Error creating campaign:', error);
        await bot.sendMessage(chatId,
            "❌ *Campaign Creation Failed*\n\nThere was an error creating your campaign. Please try again later.",
            { parse_mode: 'Markdown' }
        );
        return false;
    }
}

// Handle callback queries
async function handleCallbackQuery(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;
    
    try {
        switch (data) {
            case 'contact_admin':
                await showContactInfo(bot, chatId);
                break;
                
            case 'contact_support':
                await showSupportInfo(bot, chatId);
                break;
                
            case 'check_status':
            case 'check_configuration':
                // Re-check user status and route accordingly
                const user = await getUserByTelegramId(userId);
                if (user) {
                    await routeUserByStatus(bot, chatId, user);
                } else {
                    await showContactAdminMessage(bot, chatId);
                }
                break;
                
            case 'start_campaign':
                await handleCampaignCreation(bot, chatId, userId.toString());
                break;
                
            case 'check_balance':
                await showUserBalance(bot, chatId, userId.toString());
                break;
                
            default:
                await bot.sendMessage(chatId, "Unknown command. Please try again.");
        }
        
        // Answer callback query
        await bot.answerCallbackQuery(callbackQuery.id);
        
    } catch (error) {
        console.error('Error handling callback query:', error);
        await bot.answerCallbackQuery(callbackQuery.id, { 
            text: "Error processing request",
            show_alert: true 
        });
    }
}

// Utility functions
async function showContactInfo(bot, chatId) {
    const message = `📞 **Contact Administrator**

To get your account approved or configured, please contact:

**Admin Contact:**
• Email: admin@yourcompany.com
• Telegram: @admin_username
• Support Hours: 9 AM - 6 PM (Mon-Fri)

**Include in your message:**
• Your Telegram ID: \`${chatId}\`
• Your full name
• Reason for contact`;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

async function showSupportInfo(bot, chatId) {
    const message = `🆘 **Support Information**

For technical support or account registration:

**Support Channels:**
• Email: support@yourcompany.com  
• Telegram: @support_username
• Phone: +1-234-567-8900

**Your Information:**
• Telegram ID: \`${chatId}\`
• Please provide this ID when contacting support`;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

module.exports = {
    handleUserStart,
    handleCallbackQuery,
    checkUserReadyForCampaign,
    handleCampaignCreation,
    routeUserByStatus
};