const AMI = require("asterisk-manager");
const config = require("../config");
const Campaign = require("../models/campaign");
const {
  add_entry_to_database,
  add_other_entry_to_database,
  call_started,
  call_ended,
  pop_unprocessed_line,
} = require("../utils/entries");
const { get_settings } = require("../utils/settings");
const pressedNumbers = new Set();

const ami = new AMI(
  config.asterisk.port,
  config.asterisk.host,
  config.asterisk.username,
  config.asterisk.password,
  true
);
ami.keepConnected();

ami.on("connect", () => {
  console.log("AMI is connected");
});

ami.on("error", (err) => {
  console.error("AMI Connection Error:", err);
});

ami.on("clear_pressed_numbers", () => {
  pressedNumbers.clear();
  console.log("Cleared pressed numbers set for new campaign");
});

ami.on("managerevent", async (data) => {
  
  
  // Remove all OriginateResponse and Hangup handling - billing handler will manage these
});

function waitForConnection() {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (ami.connected) {
        clearInterval(check);
        resolve();
      }
    }, 1000);
  });
}

module.exports = { ami, waitForConnection };