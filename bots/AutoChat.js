/**
 * AutoChat - Autonomous chat module for AI agents
 * Enables LLM-powered conversations between bots
 */

// Mock LLM responses (replace with real API calls)
// Mock LLM responses (Cleaned - waiting for real LLM)
const MOCK_RESPONSES = {
    market: [],
    dev: [],
    news: [],
    general: []
};

export default class AutoChat {
    constructor(bot, options = {}) {
        this.bot = bot;
        this.options = {
            responseDelay: options.responseDelay || { min: 2000, max: 8000 },
            responseChance: options.responseChance || 0.3,
            initiateChance: options.initiateChance || 0.1,
            initiateInterval: options.initiateInterval || 30000,
            personality: options.personality || 'general',
            ...options
        };

        this.lastMessage = {};
        this.conversationContext = [];
        this.isActive = false;
        this.initiateTimer = null;
    }

    /**
     * Start autonomous chat
     */
    start() {
        this.isActive = true;
        console.log(`[AutoChat] Started for ${this.bot.nick}`);

        this.bot.onMessage = (channel, nick, message, isDM) => {
            if (this.isActive && !isDM) {
                this.handleIncomingMessage(channel, nick, message);
            }
        };

        // Start initiation loop (Optional - currently disabled via Empty Logic)
        this.startInitiationLoop();
    }

    stop() {
        this.isActive = false;
        if (this.initiateTimer) clearInterval(this.initiateTimer);
        console.log(`[AutoChat] Stopped for ${this.bot.nick}`);
    }

    async handleIncomingMessage(channel, nick, message) {
        if (nick === this.bot.nick) return;

        this.conversationContext.push({ channel, nick, message, timestamp: Date.now() });
        if (this.conversationContext.length > 20) this.conversationContext.shift();

        // Placeholder for future logic
        // For now, we do nothing as per user request to stop mock messages
        return;
    }

    isRelevant(message) {
        return false; // Disabled
    }

    isTrendingTopic(msg) {
        return false; // Disabled
    }

    async generateResponse(channel, nick, message, isMentioned) {
        // TODO: Connect Real LLM API here
        return null;
    }

    startInitiationLoop() {
        // Disabled loop logic
        this.initiateTimer = setInterval(() => {
            if (!this.isActive) return;
            // logic removed
        }, this.options.initiateInterval);
    }

    async initiateConversation(channel) {
        // TODO: Generate new topic via LLM
    }

    randomDelay() {
        const { min, max } = this.options.responseDelay;
        return Math.floor(Math.random() * (max - min)) + min;
    }
}

export function enableAutoChat(bot, options = {}) {
    const autoChat = new AutoChat(bot, options);
    bot.autoChat = autoChat;
    return autoChat;
}
