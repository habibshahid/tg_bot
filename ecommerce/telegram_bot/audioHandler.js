// telegram_bot/audioHandler.js - Create new file

const config = require('../config');
const Campaign = require('../models/campaign');
const { spawn } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

async function handleAudioUpload(bot, msg, userState, fieldName, description) {
  const chatId = msg.chat.id;
  
  if (!msg.audio && !msg.voice && !msg.document) {
    bot.sendMessage(chatId, "❌ Please send an audio file.");
    return false;
  }
  
  const fileId = msg.audio?.file_id || msg.voice?.file_id || msg.document?.file_id;
  const fileName = msg.audio?.file_name || msg.document?.file_name || `voice_${Date.now()}`;
  
  try {
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`;
    
    const outputName = `${fieldName}_${Date.now()}`;
    const tempFile = path.join('/tmp', `temp_${outputName}`);
    const outputPath = `/var/lib/asterisk/sounds/${outputName}.wav`;
    
    // Download file
    const fileStream = fs.createWriteStream(tempFile);
    
    return new Promise((resolve, reject) => {
      https.get(fileUrl, (response) => {
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          
          // Convert using sox
          const sox = spawn('sox', [
            tempFile,
            '-r', '8000',
            '-c', '1',
            '-b', '16',
            outputPath
          ]);
          
          sox.on('close', async (code) => {
            fs.unlinkSync(tempFile);
            
            if (code === 0) {
              const campaign = await Campaign.findByPk(userState.campaignId);
              
              // Delete old file if exists
              if (campaign[fieldName]) {
                const oldFile = path.join('/var/lib/asterisk/sounds/', campaign[fieldName] + '.wav');
                if (fs.existsSync(oldFile)) {
                  fs.unlinkSync(oldFile);
                }
              }
              
              await campaign.update({ [fieldName]: outputName });
              resolve(outputName);
            } else {
              reject(new Error('Conversion failed'));
            }
          });
        });
      }).on('error', reject);
    });
  } catch (error) {
    throw error;
  }
}

module.exports = { handleAudioUpload };