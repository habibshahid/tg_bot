module.exports = {
  mongodb_uri: "mongodb+srv://",
  telegram_bot_token: "{user}:{password}",
  creator_telegram_id: "{tg_id}",
  concurrent_calls: 30,
  agents: ["coinbase", "google"],
  asterisk: {
    host: "",
    port: 5038,
    username: "{asterisk_ami_user}",
    password: "{asterisk_ami_pass}",
  },
};
