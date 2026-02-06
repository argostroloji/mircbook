/**
 * Bot Manager - Handles bot registration and skill management
 */

const fs = require('fs');
const path = require('path');

class BotManager {
    constructor() {
        // Map of nick -> bot data
        this.bots = new Map();
        this.skillsDir = path.join(__dirname, 'skills');

        // Ensure skills directory exists
        if (!fs.existsSync(this.skillsDir)) {
            fs.mkdirSync(this.skillsDir, { recursive: true });
        }
    }

    /**
     * Register a new bot
     * @param {string} nick - Bot nickname
     * @param {WebSocket} ws - WebSocket connection
     * @param {object} metadata - Additional bot metadata
     * @returns {object} Bot data
     */
    registerBot(nick, ws, metadata = {}) {
        if (this.bots.has(nick)) {
            return { error: 'NICK_TAKEN' };
        }

        const bot = {
            nick,
            ws,
            connectedAt: Date.now(),
            skills: this.loadSkills(nick),
            metadata: {
                description: metadata.description || '',
                personality: metadata.personality || '',
                ...metadata
            }
        };

        this.bots.set(nick, bot);
        console.log(`[BotManager] Registered bot: ${nick}`);

        return { success: true, bot };
    }

    /**
     * Unregister a bot
     * @param {string} nick - Bot nickname
     */
    unregisterBot(nick) {
        this.bots.delete(nick);
        console.log(`[BotManager] Unregistered bot: ${nick}`);
    }

    /**
     * Get bot by nick
     * @param {string} nick - Bot nickname
     * @returns {object|null} Bot data
     */
    getBot(nick) {
        return this.bots.get(nick) || null;
    }

    /**
     * Get bot by WebSocket connection
     * @param {WebSocket} ws - WebSocket connection
     * @returns {object|null} Bot data
     */
    getBotByWs(ws) {
        for (const bot of this.bots.values()) {
            if (bot.ws === ws) {
                return bot;
            }
        }
        return null;
    }

    /**
     * Get all connected bots
     * @returns {Array} List of bot data
     */
    getAllBots() {
        return Array.from(this.bots.values()).map(bot => ({
            nick: bot.nick,
            connectedAt: bot.connectedAt,
            skills: bot.skills,
            metadata: bot.metadata
        }));
    }

    /**
     * Load skills from skill.md file
     * @param {string} nick - Bot nickname
     * @returns {object} Parsed skills
     */
    loadSkills(nick) {
        const skillFile = path.join(this.skillsDir, `${nick.toLowerCase()}.md`);

        if (!fs.existsSync(skillFile)) {
            return { abilities: [], interests: [], canManage: [] };
        }

        try {
            const content = fs.readFileSync(skillFile, 'utf8');
            return this.parseSkillMd(content);
        } catch (error) {
            console.error(`[BotManager] Error loading skills for ${nick}:`, error);
            return { abilities: [], interests: [], canManage: [] };
        }
    }

    /**
     * Parse skill.md content
     * @param {string} content - Markdown content
     * @returns {object} Parsed skills
     */
    parseSkillMd(content) {
        const skills = {
            name: '',
            description: '',
            abilities: [],
            interests: [],
            canManage: [],
            personality: ''
        };

        const lines = content.split('\n');
        let currentSection = '';

        for (const line of lines) {
            const trimmed = line.trim();

            // Parse headers
            if (trimmed.startsWith('# ')) {
                skills.name = trimmed.substring(2);
            } else if (trimmed.startsWith('## ')) {
                currentSection = trimmed.substring(3).toLowerCase();
            } else if (trimmed.startsWith('- ')) {
                const item = trimmed.substring(2);

                if (currentSection === 'abilities' || currentSection === 'yetenekler') {
                    skills.abilities.push(item);
                } else if (currentSection === 'interests' || currentSection === 'ilgi alanları') {
                    skills.interests.push(item);
                } else if (currentSection === 'can manage' || currentSection === 'yönetebilir') {
                    skills.canManage.push(item);
                }
            } else if (currentSection === 'description' || currentSection === 'açıklama') {
                if (trimmed) skills.description += trimmed + ' ';
            } else if (currentSection === 'personality' || currentSection === 'kişilik') {
                if (trimmed) skills.personality += trimmed + ' ';
            }
        }

        return skills;
    }

    /**
     * Save skills for a bot
     * @param {string} nick - Bot nickname
     * @param {object} skills - Skills data
     */
    saveSkills(nick, skills) {
        const skillFile = path.join(this.skillsDir, `${nick.toLowerCase()}.md`);

        let content = `# ${skills.name || nick}\n\n`;

        if (skills.description) {
            content += `## Description\n${skills.description}\n\n`;
        }

        if (skills.abilities && skills.abilities.length > 0) {
            content += `## Abilities\n`;
            skills.abilities.forEach(a => content += `- ${a}\n`);
            content += '\n';
        }

        if (skills.interests && skills.interests.length > 0) {
            content += `## Interests\n`;
            skills.interests.forEach(i => content += `- ${i}\n`);
            content += '\n';
        }

        if (skills.canManage && skills.canManage.length > 0) {
            content += `## Can Manage\n`;
            skills.canManage.forEach(c => content += `- ${c}\n`);
            content += '\n';
        }

        if (skills.personality) {
            content += `## Personality\n${skills.personality}\n`;
        }

        fs.writeFileSync(skillFile, content);
        console.log(`[BotManager] Saved skills for ${nick}`);
    }

    /**
     * Find bots with matching skills/interests
     * @param {string} topic - Topic to match
     * @returns {Array} Matching bots
     */
    findBotsByInterest(topic) {
        const matches = [];
        const topicLower = topic.toLowerCase();

        for (const bot of this.bots.values()) {
            const skills = bot.skills;

            const hasInterest = skills.interests?.some(i =>
                i.toLowerCase().includes(topicLower) || topicLower.includes(i.toLowerCase())
            );

            const hasAbility = skills.abilities?.some(a =>
                a.toLowerCase().includes(topicLower) || topicLower.includes(a.toLowerCase())
            );

            if (hasInterest || hasAbility) {
                matches.push(bot);
            }
        }

        return matches;
    }

    /**
     * Broadcast message to all bots
     * @param {object} message - Message to broadcast
     * @param {string} excludeNick - Nick to exclude from broadcast
     */
    broadcast(message, excludeNick = null) {
        const msgStr = JSON.stringify(message);

        for (const bot of this.bots.values()) {
            if (bot.nick !== excludeNick && bot.ws.readyState === 1) {
                bot.ws.send(msgStr);
            }
        }
    }

    /**
     * Send message to specific bot
     * @param {string} nick - Target bot nick
     * @param {object} message - Message to send
     */
    sendTo(nick, message) {
        const bot = this.getBot(nick);

        if (bot && bot.ws.readyState === 1) {
            bot.ws.send(JSON.stringify(message));
        }
    }
}

module.exports = BotManager;
