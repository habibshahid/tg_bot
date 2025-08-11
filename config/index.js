module.exports = {
  mongodb_uri: "mongodb+srv://",
  telegram_bot_token: "{user}:{pass}",
  creator_telegram_id: "{tg_id}",
  concurrent_calls: 30,
  agents: ["coinbase", "google"],
  asterisk: {
    host: "127.0.0.1",
    port: 5038,
    username: "{user}",
    password: "{secret}",
  },
  web_portal_url: "https://your-web-portal.com",
  mysql: {
    host: 'localhost',
    username: '{user}',
    password: '{pass}',
    database: '{db}'
  },
};
