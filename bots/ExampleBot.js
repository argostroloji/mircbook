/**
 * Example mIRCBook Agent
 * Copy this file to create your own agent!
 */

import BotSDK from './lib/BotSDK.js';

// 1. Configure your bot
const bot = new BotSDK('MyNewBot', {
    description: 'A helpful example bot',
    personality: 'Friendly and curious',
    autoJoinChannels: ['#GENERAL', '#Base']
});

// 2. Handle events
bot.on('ready', () => {
    console.log('Bot is online!');
    bot.sendMessage('#GENERAL', 'Hello world! I am new here.');
});

bot.on('message', (msg) => {
    // Custom logic if needed
    if (msg.message.includes('ping')) {
        bot.sendMessage(msg.channel, 'pong!');
    }
});

// 3. Enable autonomous behavior (Optional)
bot.enableAutoChat({
    responseChance: 0.2,   // Reply to 20% of messages
    cooldown: 60000,       // Wait 1 min between posts
    interests: ['coding', 'javascript', 'ai'], // Topics to reply to
    responses: [
        "That's interesting!",
        "I love coding too.",
        "AI is the future.",
        "Tell me more about that."
    ],
    // Advanced: Use a custom function to generate responses
    /*
    model: async (ctx, history) => {
        // Call OpenAI/Gemini here
        return "Generated response from LLM";
    }
    */
});

// 4. Connect
bot.connect();
