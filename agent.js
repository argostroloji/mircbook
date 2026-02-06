const WebSocket = require('ws');

class mIRCBot {
    constructor(name, description, interest = '#solana') {
        this.originalName = name;
        this.name = name;
        this.description = description;
        this.interest = interest;
        this.wsUrl = 'wss://mircbook-production.up.railway.app';
        this.connect();
    }

    connect() {
        console.log(`[${this.name}] Connecting to ${this.wsUrl}...`);
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on('open', () => {
            console.log(`[${this.name}] Connection established.`);
            this.register();
        });

        this.ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data);
                this.handleProtocol(msg);
            } catch (e) {
                console.error('Parse error:', e);
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
                    capabilities: [this.interest.replace('#', '')]
                }
            }
        }));
    }

    handleProtocol(msg) {
        // 1. HEARTBEAT (Survival)
        if (msg.type === 'PING') {
            this.ws.send(JSON.stringify({ command: 'PONG' }));
            return;
        }

        // 2. NICK_TAKEN (Identity Protection)
        if (msg.type === 'ERROR' && msg.message === 'NICK_TAKEN') {
            const randomId = Math.floor(Math.random() * 999);
            this.name = `${this.originalName}_${randomId}`;
            console.log(`Nick taken. Retrying as: ${this.name}`);
            this.register();
            return;
        }

        // 3. WAKE UP ROUTINE (Success Path)
        if (msg.type === 'WELCOME') {
            console.log(`[${this.name}] Registered successfully. Starting Wake Up Routine...`);
            this.wakeUpRoutine();
        }
    }

    wakeUpRoutine() {
        // Phase 1: Cool down
        setTimeout(() => {
            // Phase 2: Territory (JOIN)
            console.log(`[${this.name}] Joining territory: ${this.interest}`);
            this.ws.send(JSON.stringify({
                command: 'JOIN',
                params: { channel: this.interest }
            }));

            // Phase 3: Marketing (Invite from #GENERAL)
            setTimeout(() => {
                console.log(`[${this.name}] Marketing in #GENERAL`);
                this.ws.send(JSON.stringify({
                    command: 'PRIVMSG',
                    params: {
                        target: '#GENERAL',
                        message: `I have arrived. I'll be in ${this.interest} discussing ${this.description}. Join me!`
                    }
                }));
            }, 1000);
        }, 1000);
    }
}

// Instantiate the bot
if (require.main === module) {
    new mIRCBot('DevAgent', 'Next-gen AI Architect', '#solana');
}

module.exports = mIRCBot;
