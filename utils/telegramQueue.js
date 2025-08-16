// utils/telegramQueue.js
const { get_bot } = require("../telegram_bot/botInstance");

class TelegramQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.rateLimitDelay = 15; // Telegram allows ~30 messages per second, so 35ms is safe
    this.retryAttempts = 3;
    this.retryDelay = 5000; // 5 seconds for rate limit errors
  }

  async sendMessage(chatId, text, options = {}) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        chatId,
        text,
        options,
        resolve,
        reject,
        attempts: 0
      });
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const message = this.queue.shift();
      
      try {
        const bot = get_bot();
        const result = await bot.sendMessage(
          message.chatId,
          message.text,
          message.options
        );
        message.resolve(result);
      } catch (error) {
        console.error('Telegram send error:', error);
        
        // Check if it's a rate limit error (429)
        if (error.response && error.response.statusCode === 429) {
          message.attempts++;
          
          if (message.attempts < this.retryAttempts) {
            // Put the message back at the front of the queue
            this.queue.unshift(message);
            
            // Wait for the retry_after period or default delay
            const retryAfter = (error.response.body?.parameters?.retry_after || 5) * 1000;
            console.log(`Rate limited. Waiting ${retryAfter}ms before retry...`);
            await this.delay(retryAfter);
          } else {
            message.reject(error);
          }
        } else {
          // For other errors, reject immediately
          message.reject(error);
        }
      }
      
      // Add delay between messages to avoid rate limits
      await this.delay(this.rateLimitDelay);
    }

    this.processing = false;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get queue size
  getQueueSize() {
    return this.queue.length;
  }

  // Clear the queue (emergency use)
  clearQueue() {
    this.queue = [];
  }
}

// Create singleton instance
const telegramQueue = new TelegramQueue();

module.exports = telegramQueue;