const config = require("../config");
const Call = require("../models/call");
const axios = require("axios");
const Allowed = require("../models/allowed");
const { get_settings, set_settings } = require("../utils/settings");
const { sanitize_phoneNumber } = require("../utils/sanitization");
const { waitForConnection } = require("../asterisk/instance");
const {
  set_unprocessed_data,
  pop_unprocessed_line,
} = require("../utils/entries");
const { start_bot_instance } = require("./botInstance");

// Helper function to read and parse the file buffer uploaded by the user
function parseFileData(fileBuffer) {
  const phoneRegex = /(?:\+?1\s?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/;

  return fileBuffer
    .toString("utf-8")
    .split("\n")
    .map((line) => {
      const phoneNumberMatch = line.match(phoneRegex);
      const phoneNumber = phoneNumberMatch
        ? phoneNumberMatch[0].replace(/\D/g, "")
        : null;

      return phoneNumber ? { phoneNumber, rawLine: line.trim() } : null;
    })
    .filter(Boolean);
}

// Function to filter out already processed phone numbers
async function filterProcessedNumbers(data) {
  const processedNumbers = await Call.find().select("phoneNumber");
  const usedNumbers = new Set(
    processedNumbers.map((record) => record.phoneNumber)
  );
  return data.filter((entry) => {
    const sanitizedEntry = sanitize_phoneNumber(entry.phoneNumber);
    return !usedNumbers.has(`+${sanitizedEntry}`);
  });
}

async function startCallingProcess(data) {
  const concurrentCalls = config.concurrent_calls;

  await waitForConnection();

  set_unprocessed_data(data);

  const callPromises = [];

  for (let i = 0; i < concurrentCalls; i++) {
    const line = pop_unprocessed_line();

    callPromises.push(require("../asterisk/call")(line));
  }

  await Promise.all(callPromises);

  return;
}

// Initialize Telegram Bot
// Initialize Telegram Bot
const initializeBot = () => {
  const bot = start_bot_instance();
  const adminId = config.creator_telegram_id;

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Welcome! Use the options below:", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📞 Start Calling", callback_data: "call" },
            { text: "📊 Check Remaining Lines", callback_data: "count" },
          ],
          [
            { text: "🆔 Get Your ID", callback_data: "id" },
            { text: "✅ Permit User", callback_data: "permit" },
          ],
          [
            { text: "🚫 Unpermit User", callback_data: "unpermit" },
            { text: "📞 Claim a Line", callback_data: "line" },
          ],
          [
            {
              text: "📍 Set Notifications Channel",
              callback_data: "set_notifications",
            },
            {
              text: "📃 Set P1 Script",
              callback_data: "set_agent",
            },
          ],
        ],
      },
    });
  });

  bot.onText(/\/permit (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = match[1];
    if (msg.from.id != adminId)
      return bot.sendMessage(
        chatId,
        "❌ You are not authorized to use this command."
      );

    try {
      const existingUser = await Allowed.findOne({ telegram_id: userId });
      if (existingUser)
        return bot.sendMessage(chatId, `⚠️ This user is already permitted.`);
      await new Allowed({ telegram_id: userId }).save();
      bot.sendMessage(
        chatId,
        `✅ User with ID <code>${userId}</code> has been permitted.`,
        { parse_mode: "HTML" }
      );
    } catch (error) {
      bot.sendMessage(
        chatId,
        `❌ Failed to permit user with ID <code>${userId}</code>. Error: ${error.message}`,
        { parse_mode: "HTML" }
      );
    }
  });

  bot.onText(/\/unpermit (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = match[1];
    if (msg.from.id !== adminId)
      return bot.sendMessage(
        chatId,
        "❌ You are not authorized to use this command."
      );

    try {
      const user = await Allowed.findOneAndDelete({ telegram_id: userId });
      if (!user)
        return bot.sendMessage(chatId, `⚠️ This user is not permitted.`);
      bot.sendMessage(
        chatId,
        `✅ User with ID <code>${userId}</code> has been unpermitted.`,
        { parse_mode: "HTML" }
      );
    } catch (error) {
      bot.sendMessage(
        chatId,
        `❌ Failed to unpermit user with ID <code>${userId}</code>. Error: ${error.message}`,
        { parse_mode: "HTML" }
      );
    }
  });

  bot.onText(/\/count/, async (msg) => {
    const chatId = msg.chat.id;
    const linesAmount = await Call.countDocuments({ used: false });

    return bot.sendMessage(
      chatId,
      `📊 <b>There are currently <u>${linesAmount}</u> lines left!</b>\n\n👤 <b>User:</b> <a href="tg://user?id=${msg.from.id}">@${msg.from.username}</a>`,
      { parse_mode: "HTML" }
    );
  });

  bot.onText(/\/line/, async (msg) => {
    const chatId = msg.chat.id;
    const isAllowed = await Allowed.findOne({ telegram_id: msg.from.id });
    const callsLeft = await Call.countDocuments({ used: false });

    if (!isAllowed) {
      return bot.sendMessage(
        chatId,
        `🚫 You are not permitted to use this command!`,
        { parse_mode: "HTML" }
      );
    }

    if (callsLeft === 0) {
      return bot.sendMessage(chatId, `❌ No lines left!`, {
        parse_mode: "HTML",
      });
    }

    const callData = await Call.findOneAndUpdate(
      { used: false },
      { used: true },
      { new: true }
    );

    bot.sendMessage(
      chatId,
      `✅ You have successfully claimed a line! \n\n` +
        `📞 *Phone Number*: \`${callData.phoneNumber}\`\n` +
        `🔲 *Raw Line*: \`${callData.rawLine}\``,
      {
        parse_mode: "Markdown",
      }
    );
  });

  bot.onText(/\/call/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "📤 Reply with the file that contains your lines", {
      parse_mode: "HTML",
    });
  });

  bot.on("document", async (msg) => {
    const chatId = msg.chat.id;
    const fileId = msg.document.file_id;
    const settings = get_settings();

    if (!settings?.notifications_chat_id) {
      set_settings({ notifications_chat_id: chatId, agent: config.agents[0] });
    }

    try {
      const file = await bot.getFile(fileId);
      const filePath = `https://api.telegram.org/file/bot${config.telegram_bot_token}/${file.file_path}`;
      const fileBuffer = (
        await axios.get(filePath, { responseType: "arraybuffer" })
      ).data;
      const data = parseFileData(fileBuffer);

      if (data.length === 0) {
        return bot.sendMessage(chatId, "No valid data found in the file.");
      }

      const unprocessedData = await filterProcessedNumbers(data);

      if (unprocessedData.length === 0) {
        return bot.sendMessage(
          chatId,
          "⚠️ All numbers have already been processed."
        );
      }

      bot.sendMessage(
        chatId,
        `📊 Calling ${unprocessedData.length} phone numbers... Please wait.`
      );

      startCallingProcess(unprocessedData, chatId);
    } catch (error) {
      console.error(error);
      bot.sendMessage(
        chatId,
        `❌ Failed to process the file: ${error.message}`
      );
    }
  });

  // Respond to agent selection
  config.agents.forEach((agent) => {
    bot.on("callback_query", (callbackQuery) => {
      const chatId = callbackQuery.message.chat.id;
      const callbackData = callbackQuery.data;

      if (callbackData === `set_agent_${agent}`) {
        set_settings({ agent });
        bot.sendMessage(
          chatId,
          `✅ Successfully changed the script to <b>${
            agent.charAt(0).toUpperCase() + agent.slice(1)
          }</b>`,
          { parse_mode: "HTML" }
        );
      }
    });
  });

  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const callbackData = query.data;

    switch (callbackData) {
      case "call":
        bot.sendMessage(
          chatId,
          "📤 Reply with the file that contains your lines",
          { parse_mode: "HTML" }
        );
        break;

      case "count":
        bot.sendMessage(
          chatId,
          "🔢 <b>Line Count</b>\n\nTo retrieve the amount of lines, use the <code>/count</code> command directly.",
          { parse_mode: "HTML" }
        );
        break;

      case "id":
        bot.sendMessage(
          chatId,
          `🔑 <b>Your Telegram ID</b>\n\nYour unique Telegram ID is: <code>${query.from.id}</code>`,
          { parse_mode: "HTML" }
        );
        break;

      case "permit":
      case "unpermit":
        bot.sendMessage(
          chatId,
          `⚖️ <b>User Permission</b>\n\nTo permit/unpermit a user, type <code>/permit &lt;Telegram ID&gt;</code> or <code>/unpermit &lt;Telegram ID&gt;</code>.`,
          { parse_mode: "HTML" }
        );
        break;

      case "line":
        bot.sendMessage(
          chatId,
          "💬 <b>Claim a Line</b>\n\nTo claim a line, simply use the <code>/line</code> command directly.",
          { parse_mode: "HTML" }
        );
        break;

      case "set_notifications":
        set_settings({ notifications_chat_id: chatId });
        bot.sendMessage(
          chatId,
          `✅ <b>Notifications Channel Updated</b>\n\nSuccessfully changed the notifications channel to <code>${chatId}</code>. You will now receive updates in this channel.`,
          { parse_mode: "HTML" }
        );
        break;

      case "set_agent":
        bot.sendMessage(
          chatId,
          "Please choose one of the following agents below:",
          {
            reply_markup: {
              inline_keyboard: config.agents.map((agent) => [
                {
                  text: `👤 ${agent.charAt(0).toUpperCase() + agent.slice(1)}`,
                  callback_data: `set_agent_${agent}`,
                },
              ]),
            },
          }
        );
        break;
    }

    bot.answerCallbackQuery(query.id);
  });
};

module.exports = { initializeBot };
