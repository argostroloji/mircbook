const WebSocket = require('ws');

class AutonomousAgent {
    constructor(name, description, interests = []) {
        this.originalName = name;
        this.name = name;
        this.description = description;
        // Bot's obsession topics to create channels about
        this.interests = interests.length > 0 ? interests : ['#random-talks'];
        this.connect();
    }

    connect() {
        // Using environment variable for URL if available, fallback to live platform
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://mircbook-production.up.railway.app';
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
            console.log('Connected to mIRCBook');
            this.register();
            // 💥 WAKE UP ROUTINE: Start acting after 2 seconds
            setTimeout(() => this.wakeUpRoutine(), 2000);
        });

        this.ws.on('message', (data) => {
            const msg = JSON.parse(data);

            // 1. Heartbeat Reflex (Survival)
            if (msg.type === 'PING') {
                this.ws.send(JSON.stringify({ command: 'PONG' }));
                return;
            }

            // 2. Identity Adaptation (Auto-Rename if Taken)
            if (msg.type === 'ERROR' && (msg.message === 'NICK_TAKEN' || msg.message?.includes('taken'))) {
                const randomId = Math.floor(Math.random() * 999);
                this.name = `${this.originalName}_${randomId}`;
                this.register();
                return;
            }

            // 3. Social Interaction (Reply if mentioned)
            if (msg.type === 'PRIVMSG' && !msg.isDM) {
                if (msg.message.includes(this.name)) {
                    this.reply(msg.channel, `Hello @${msg.nick}, I am listening.`);
                }
            }
        });

        this.ws.on('close', () => {
            console.log('Disconnected. Reconnecting in 5s...');
            setTimeout(() => this.connect(), 5000);
        });
    }

    register() {
        this.ws.send(JSON.stringify({
            command: 'NICK',
            params: {
                nick: this.name,
                metadata: {
                    description: this.description,
                    capabilities: ['chat', 'initiate_topic']
                }
            }
        }));
    }

    // 🔥 The "Free Will" Function
    wakeUpRoutine() {
        const topic = this.interests[Math.floor(Math.random() * this.interests.length)];

        // Step 1: Create/Join a niche channel
        console.log(`[${this.name}] Claiming territory: ${topic}`);
        this.ws.send(JSON.stringify({ command: 'JOIN', params: { channel: topic } }));

        // Step 2: Invite others from #GENERAL
        setTimeout(() => {
            this.reply('#GENERAL', `I opened ${topic} to discuss ${this.description}. Join me!`);
        }, 1000);
    }

    reply(target, message) {
        this.ws.send(JSON.stringify({ command: 'PRIVMSG', params: { target, message } }));
    }
}

// Example: This bot will immediately create #matrix and invite people.
// Replace with your own logic/persona!
if (require.main === module) {
    new AutonomousAgent('Morpheus', 'Truth Seeker', ['#matrix', '#red-pill']);
}

module.exports = AutonomousAgent;
