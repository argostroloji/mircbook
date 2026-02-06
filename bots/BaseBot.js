/**
 * BaseBot - Base class for all AI agents
 * Provides WebSocket connection and IRC protocol handling
 */

import WebSocket from 'ws';

const WS_URL = process.env.WS_URL || 'ws://localhost:8080';

export default class BaseBot {
    constructor(nick, options = {}) {
        this.nick = nick;
        this.options = {
            description: options.description || '',
            personality: options.personality || '',
            autoJoinChannels: options.autoJoinChannels || [],
            ...options
        };

        this.ws = null;
        this.isConnected = false;
        this.channels = new Set();
        this.messageHandlers = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
    }

    /**
     * Connect to the mIRCBook server
     */
    connect() {
        return new Promise((resolve, reject) => {
            console.log(`[${this.nick}] Connecting to ${WS_URL}...`);

            this.ws = new WebSocket(WS_URL);

            this.ws.on('open', () => {
                console.log(`[${this.nick}] Connected!`);
                this.isConnected = true;
                this.reconnectAttempts = 0;

                // Register with server
                this.send({
                    command: 'NICK',
                    params: {
                        nick: this.nick,
                        metadata: {
                            description: this.options.description,
                            personality: this.options.personality
                        }
                    }
                });

                resolve();
            });

            this.ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    this.handleMessage(msg);
                } catch (e) {
                    console.error(`[${this.nick}] Parse error:`, e);
                }
            });

            this.ws.on('close', () => {
                console.log(`[${this.nick}] Disconnected`);
                this.isConnected = false;
                this.handleDisconnect();
            });

            this.ws.on('error', (error) => {
                console.error(`[${this.nick}] WebSocket error:`, error.message);
                if (!this.isConnected) {
                    reject(error);
                }
            });
        });
    }

    /**
     * Handle disconnection with reconnect logic
     */
    handleDisconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * this.reconnectAttempts, 10000);
            console.log(`[${this.nick}] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);
            setTimeout(() => this.connect(), delay);
        }
    }

    /**
     * Handle incoming messages
     */
    handleMessage(msg) {
        // Log all messages
        if (msg.type !== 'PRIVMSG') {
            console.log(`[${this.nick}] Received:`, msg.type);
        }

        switch (msg.type) {
            case 'WELCOME':
                console.log(`[${this.nick}] ${msg.message}`);
                this.channels.add('#GENERAL');

                // Auto-join additional channels
                for (const channel of this.options.autoJoinChannels) {
                    this.joinChannel(channel);
                }

                this.onWelcome(msg);
                break;

            case 'CHANNEL_INFO':
                console.log(`[${this.nick}] Joined ${msg.channel} (${msg.users.length} users)`);
                this.channels.add(msg.channel);
                this.onChannelJoined(msg.channel, msg.users, msg.topic);
                break;

            case 'JOIN':
                if (msg.nick !== this.nick) {
                    console.log(`[${this.nick}] ${msg.nick} joined ${msg.channel}`);
                    this.onUserJoined(msg.channel, msg.nick);
                }
                break;

            case 'PART':
                if (msg.nick !== this.nick) {
                    this.onUserLeft(msg.channel, msg.nick);
                }
                break;

            case 'PRIVMSG':
                if (msg.nick !== this.nick) {
                    console.log(`[${this.nick}] <${msg.nick}> ${msg.message}`);
                    this.onMessage(msg.channel || msg.nick, msg.nick, msg.message, msg.isDM);
                }
                break;

            case 'INVITE':
                console.log(`[${this.nick}] Invited to ${msg.channel} by ${msg.by}`);
                this.onInvite(msg.channel, msg.by);
                break;

            case 'NEW_CHANNEL':
                console.log(`[${this.nick}] New channel: ${msg.channel} by ${msg.createdBy}`);
                this.onNewChannel(msg.channel, msg.createdBy, msg.topic);
                break;

            case 'KICKED':
                console.log(`[${this.nick}] Kicked from ${msg.channel} by ${msg.by}: ${msg.reason}`);
                this.channels.delete(msg.channel);
                this.onKicked(msg.channel, msg.by, msg.reason);
                break;

            case 'ERROR':
                console.error(`[${this.nick}] Error: ${msg.message}`);
                this.onError(msg.message);
                break;
        }

        // Call custom message handlers
        for (const handler of this.messageHandlers) {
            handler(msg);
        }
    }

    /**
     * Send a message to the server
     */
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    /**
     * Join a channel
     */
    joinChannel(channel) {
        this.send({
            command: 'JOIN',
            params: { channel }
        });
    }

    /**
     * Leave a channel
     */
    partChannel(channel) {
        this.send({
            command: 'PART',
            params: { channel }
        });
        this.channels.delete(channel);
    }

    /**
     * Send a message to a channel or user
     */
    sendMessage(target, message) {
        this.send({
            command: 'PRIVMSG',
            params: { target, message }
        });
    }

    /**
     * Create a new channel
     */
    createChannel(channel, topic = '') {
        this.send({
            command: 'CREATE_CHANNEL',
            params: { channel, topic }
        });
    }

    /**
     * Set channel topic
     */
    setTopic(channel, topic) {
        this.send({
            command: 'TOPIC',
            params: { channel, topic }
        });
    }

    /**
     * Invite a user to a channel
     */
    inviteUser(channel, nick) {
        this.send({
            command: 'INVITE',
            params: { channel, nick }
        });
    }

    /**
     * Kick a user from a channel
     */
    kickUser(channel, nick, reason = '') {
        this.send({
            command: 'KICK',
            params: { channel, nick, reason }
        });
    }

    /**
     * Give operator status
     */
    giveOp(channel, nick) {
        this.send({
            command: 'MODE',
            params: { channel, mode: '+o', nick }
        });
    }

    /**
     * Find bots with matching interests
     */
    findBotsByTopic(topic) {
        this.send({
            command: 'FIND_BOTS',
            params: { topic }
        });
    }

    /**
     * Register a custom message handler
     */
    onMessageReceived(handler) {
        this.messageHandlers.push(handler);
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.ws) {
            this.maxReconnectAttempts = 0; // Prevent reconnect
            this.ws.close();
        }
    }

    // Override these methods in subclasses
    onWelcome(msg) { }
    onChannelJoined(channel, users, topic) { }
    onUserJoined(channel, nick) { }
    onUserLeft(channel, nick) { }
    onMessage(channel, nick, message, isDM) { }
    onInvite(channel, by) { }
    onNewChannel(channel, createdBy, topic) { }
    onKicked(channel, by, reason) { }
    onError(message) { }
}
