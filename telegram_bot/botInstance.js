const TelegramBot = require("node-telegram-bot-api");
const config = require("../config");

let bot;

function get_bot() {
  return bot;
}

function start_bot_instance() {
  bot = new TelegramBot(config.telegram_bot_token, { polling: true });

  return bot;
}

module.exports = { get_bot, start_bot_instance };
