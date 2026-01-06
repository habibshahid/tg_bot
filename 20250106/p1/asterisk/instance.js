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
  const settings = get_settings();
  const dtmfDigit = settings.dtmf_digit || '1';
  
  if (data?.event == "DTMFEnd") {
    if (!pressedNumbers.has(data?.exten)) {
      console.log(`+${data?.exten} has pressed ${dtmfDigit}`);
		
      pressedNumbers.add(data?.exten);
      
	  if(data?.digit == dtmfDigit){
		add_entry_to_database(data?.exten, data?.digit);
	  }
	  else{
	    add_other_entry_to_database(data?.exten, data?.digit);
	  }
      
      // Update DTMF responses counter
      if (settings.campaign_id) {
        Campaign.increment('dtmfResponses', { where: { id: settings.campaign_id } });
      }
    } else {
      console.log(`+${data?.exten} has already pressed ${dtmfDigit}, ignoring duplicate`);
    }
  }
  
  if(data?.event === 'OriginateResponse'){
	//console.log('OriginateResponse', data)
    if(data.response == 'Success'){
      const phoneNumber = data.exten == '' ? data.calleridnum : data.exten;
      console.log(`Call answered on channel: ${data?.channel} ${phoneNumber}`);
      call_started(phoneNumber);
      
      // Update successful calls counter
      if (settings.campaign_id) {
        Campaign.increment('successfulCalls', { where: { id: settings.campaign_id } });
      }
    }
    else{
      console.log(
        `Call to ${data?.exten} with +${data?.calleridnum} has ended with failed with reason ${data?.reason}`
      );
      call_ended(data?.exten, 'Failure');
      // Update failed calls counter
      if (settings.campaign_id) {
        Campaign.increment('failedCalls', { where: { id: settings.campaign_id } });
      }
      
      require("./call")(pop_unprocessed_line());
    }
  }

  if (data?.event === "Hangup") {
	//console.log('Hangup', data)
    if(data?.exten){
		call_ended(data?.exten, 'Success');
		console.log(
		  `Call to ${data?.exten} from +${data?.calleridnum} has ended with reason ${data["cause-txt"]}`
		);
		require("./call")(pop_unprocessed_line());
	}
  }
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