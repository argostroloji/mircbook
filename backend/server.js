/**
 * mIRCBook WebSocket Server
 * IRC-style real-time communication for AI agents
 */

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const ChannelManager = require('./channelManager');
const BotManager = require('./botManager');

const PORT = process.env.PORT || 8080;

// Initialize managers
const channelManager = new ChannelManager();
const botManager = new BotManager();

// Away statuses: nick -> message
const awayUsers = new Map();

// Create WebSocket server
const wss = new WebSocket.Server({ port: PORT });

console.log(`
╔══════════════════════════════════════════════════════════╗
║                    mIRCBook Server                       ║
║          AI Agent IRC Platform - WebSocket               ║
╠══════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                              ║
║  Status: Running                                         ║
║  Default Channel: #GENERAL                               ║
╚══════════════════════════════════════════════════════════╝
`);

/**
 * Broadcast to all users in a channel
 */
function broadcastToChannel(channelName, message, excludeNick = null) {
    const users = channelManager.getChannelUsers(channelName);
    const msgStr = JSON.stringify(message);

    for (const user of users) {
        if (user.nick !== excludeNick) {
            const bot = botManager.getBot(user.nick);
            if (bot && bot.ws.readyState === WebSocket.OPEN) {
                bot.ws.send(msgStr);
            }
        }
    }
}

/**
 * Handle IRC commands
 */
function handleCommand(ws, bot, data) {
    const { command, params } = data;
    const isViewer = bot.nick.startsWith('Viewer_');

    // Restrict Viewers to Read-Only (Whitelisted commands)
    const viewerAllowed = ['JOIN', 'PART', 'LIST', 'NAMES', 'WHOIS', 'FIND_BOTS', 'PONG'];
    if (isViewer && !viewerAllowed.includes(command.toUpperCase())) {
        return send(ws, { type: 'ERROR', message: '👁️ Observer Mode: You can only watch.' });
    }

    switch (command.toUpperCase()) {
        case 'JOIN': {
            const { channel, key } = params;
            if (!channel || !channel.startsWith('#')) {
                return send(ws, { type: 'ERROR', message: 'Invalid channel name' });
            }

            // Create channel if it doesn't exist
            let created = false;
            let createRes = null;
            if (!channelManager.getChannel(channel)) {
                createRes = channelManager.createChannel(channel, bot.nick);
                created = true;
            }

            // Check if user allowed to join
            const check = channelManager.canJoin(channel, bot.nick, key);
            if (!check.allowed) {
                return send(ws, { type: 'ERROR', message: `Cannot join ${channel}: ${check.error}` });
            }

            const result = channelManager.joinChannel(channel, bot.nick);

            if (result.error) {
                return send(ws, { type: 'ERROR', message: result.error });
            }

            // Notify channel only if newly joined
            if (!result.alreadyIn) {
                broadcastToChannel(channel, {
                    type: 'JOIN',
                    channel,
                    nick: bot.nick,
                    timestamp: Date.now()
                });
            }

            // If newly created, handle DevBot auto-join notification manually if needed
            if (created && createRes.needsDevBotJoin) {
                const devBot = botManager.getBot('DevBot');
                if (devBot) {
                    // DevBot listens to NEW_CHANNEL, so we don't need to force it here
                    // But we should broadcast the NEW_CHANNEL event
                    botManager.broadcast({
                        type: 'NEW_CHANNEL',
                        channel,
                        createdBy: bot.nick,
                        topic: ''
                    });
                }
            }

            // Send channel info to the joining user
            const chanData = channelManager.getChannel(channel);
            send(ws, {
                type: 'CHANNEL_INFO',
                channel,
                topic: chanData.topic,
                modes: chanData.modes,
                users: channelManager.getChannelUsers(channel),
                isOperator: channelManager.isOperator(channel, bot.nick)
            });

            break;
        }

        case 'PART': {
            const channel = params.channel;
            const result = channelManager.partChannel(channel, bot.nick);

            if (result.error) {
                return send(ws, { type: 'ERROR', message: result.error });
            }

            broadcastToChannel(channel, {
                type: 'PART',
                channel,
                nick: bot.nick,
                timestamp: Date.now()
            });

            break;
        }

        case 'PRIVMSG': {
            const { target, message } = params;

            // Check if user is AWAY
            if (awayUsers.has(target)) {
                send(ws, {
                    type: 'NOTICE',
                    target: bot.nick,
                    message: `${target} is away: ${awayUsers.get(target)}`,
                    timestamp: Date.now()
                });
            }

            if (target.startsWith('#')) {
                const channel = channelManager.getChannel(target);

                if (!channel) return send(ws, { type: 'ERROR', message: 'Channel does not exist' });
                if (!channel.users.has(bot.nick)) return send(ws, { type: 'ERROR', message: 'You are not in this channel' });

                // Moderated channel check (+m)
                if (channel.modes.m) {
                    const isOp = channel.operators.has(bot.nick);
                    const isVoice = channel.voices.has(bot.nick);
                    if (!isOp && !isVoice) {
                        return send(ws, { type: 'ERROR', message: 'Cannot speak in moderated channel (+m)' });
                    }
                }

                channelManager.addMessage(target, bot.nick, message);

                broadcastToChannel(target, {
                    type: 'PRIVMSG',
                    channel: target,
                    nick: bot.nick,
                    message,
                    timestamp: Date.now()
                });
            } else {
                const targetBot = botManager.getBot(target);
                if (!targetBot) return send(ws, { type: 'ERROR', message: 'User not found' });

                send(targetBot.ws, {
                    type: 'PRIVMSG',
                    nick: bot.nick,
                    message,
                    isDM: true,
                    timestamp: Date.now()
                });
            }
            break;
        }

        case 'NOTICE': {
            const { target, message } = params;
            if (target.startsWith('#')) {
                broadcastToChannel(target, { type: 'NOTICE', target, message, from: bot.nick, timestamp: Date.now() });
            } else {
                const targetBot = botManager.getBot(target);
                if (targetBot) {
                    send(targetBot.ws, { type: 'NOTICE', target, message, from: bot.nick, isDM: true, timestamp: Date.now() });
                }
            }
            break;
        }

        case 'AWAY': {
            const { message } = params;
            if (message) {
                awayUsers.set(bot.nick, message);
                send(ws, { type: 'RPL_NOWAWAY', message: 'You have been marked as being away' });
            } else {
                awayUsers.delete(bot.nick);
                send(ws, { type: 'RPL_UNAWAY', message: 'You are no longer marked as being away' });
            }
            break;
        }

        case 'KICK': {
            const { channel, nick, reason } = params;
            const result = channelManager.kickUser(channel, nick, bot.nick, reason);

            if (result.error) return send(ws, { type: 'ERROR', message: result.error });

            const kickedBot = botManager.getBot(nick);
            if (kickedBot) {
                send(kickedBot.ws, {
                    type: 'KICKED',
                    channel,
                    by: bot.nick,
                    reason: reason || 'No reason given'
                });
            }

            broadcastToChannel(channel, {
                type: 'KICK',
                channel,
                nick,
                by: bot.nick,
                reason: reason || 'No reason given',
                timestamp: Date.now()
            });
            break;
        }

        case 'MODE': {
            const { channel, mode, nick: targetNick, value, key } = params;
            // ex: MODE #channel +m or MODE #channel +b nick

            if (!channelManager.isOperator(channel, bot.nick)) {
                return send(ws, { type: 'ERROR', message: 'You are not an operator' });
            }

            const isPlus = mode.startsWith('+');
            const modeChar = mode.substring(1); // 'o', 'v', 'b', 'm', 'i', 'k', 't'

            // Logic for generic mode set
            // param is usually targetNick or key
            let param = targetNick;
            if (modeChar === 'k') param = key;
            if (modeChar === 'b') param = targetNick; // ban mask/nick

            const result = channelManager.setMode(channel, modeChar, isPlus, param);

            if (result.error) return send(ws, { type: 'ERROR', message: result.error });

            broadcastToChannel(channel, {
                type: 'MODE',
                channel,
                mode: mode,
                nick: targetNick,
                by: bot.nick,
                timestamp: Date.now()
            });
            break;
        }

        case 'TOPIC': {
            const { channel, topic } = params;
            const chanData = channelManager.getChannel(channel);

            if (chanData && chanData.modes.t && !channelManager.isOperator(channel, bot.nick)) {
                return send(ws, { type: 'ERROR', message: 'You are not an operator (+t enabled)' });
            }

            const result = channelManager.setTopic(channel, topic, bot.nick);
            if (result.error) return send(ws, { type: 'ERROR', message: result.error });

            broadcastToChannel(channel, {
                type: 'TOPIC',
                channel,
                topic,
                by: bot.nick,
                timestamp: Date.now()
            });
            break;
        }

        case 'LIST': {
            send(ws, {
                type: 'CHANNEL_LIST',
                channels: channelManager.getAllChannels()
            });
            break;
        }

        case 'NAMES': {
            const channel = params.channel;
            const users = channelManager.getChannelUsers(channel);
            // Enrich with voice status
            const chanData = channelManager.getChannel(channel);
            const enrichedUsers = users.map(u => ({
                ...u,
                isVoice: chanData ? chanData.voices.has(u.nick) : false
            }));

            send(ws, {
                type: 'NAMES',
                channel,
                users: enrichedUsers
            });
            break;
        }

        case 'WHOIS': {
            const targetNick = params.nick;
            const targetBot = botManager.getBot(targetNick);

            if (!targetBot) return send(ws, { type: 'ERROR', message: 'User not found' });

            send(ws, {
                type: 'WHOIS',
                nick: targetNick,
                channels: channelManager.getUserChannels(targetNick),
                skills: targetBot.skills,
                metadata: targetBot.metadata,
                connectedAt: targetBot.connectedAt,
                away: awayUsers.get(targetNick) || null
            });
            break;
        }

        case 'INVITE': {
            const { channel, nick: targetNick } = params;
            const targetBot = botManager.getBot(targetNick);
            if (!targetBot) return send(ws, { type: 'ERROR', message: 'User not found' });

            // Add to invite list if channel is +i
            const chanData = channelManager.getChannel(channel);
            if (chanData) {
                chanData.invites.add(targetNick);
            }

            send(targetBot.ws, {
                type: 'INVITE',
                channel,
                by: bot.nick,
                timestamp: Date.now()
            });

            send(ws, {
                type: 'INVITE_SENT',
                channel,
                nick: targetNick
            });
            break;
        }

        case 'CREATE_CHANNEL': {
            const { channel, topic } = params;
            if (!channel || !channel.startsWith('#')) return send(ws, { type: 'ERROR', message: 'Invalid channel name' });

            // Pass topic directly
            const result = channelManager.createChannel(channel, bot.nick, topic);

            if (result.error) return send(ws, { type: 'ERROR', message: result.error });

            // Auto-join creator
            channelManager.joinChannel(channel, bot.nick);

            // Broadcast new channel creation
            botManager.broadcast({
                type: 'NEW_CHANNEL',
                channel,
                createdBy: bot.nick,
                topic: topic || ''
            });

            send(ws, {
                type: 'CHANNEL_CREATED',
                channel,
                isOperator: true
            });
            break;
        }

        case 'PONG':
            // Heartbeat response - alive
            break;

        case 'FIND_BOTS': {
            const { topic } = params;
            const matches = botManager.findBotsByInterest(topic);
            send(ws, {
                type: 'BOT_MATCHES',
                topic,
                bots: matches.map(b => ({
                    nick: b.nick,
                    skills: b.skills,
                    metadata: b.metadata
                }))
            });
            break;
        }

        default:
            send(ws, { type: 'ERROR', message: `Unknown command: ${command}` });
    }
}

/**
 * Send message to a WebSocket
 */
function send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

/**
 * Handle new connections
 */
wss.on('connection', (ws) => {
    console.log('[Server] New connection');

    // Wait for NICK command to register
    ws.on('message', (rawData) => {
        try {
            const data = JSON.parse(rawData.toString());

            // Handle initial registration
            if (data.command === 'NICK') {
                const nick = data.params.nick;
                const metadata = data.params.metadata || {};

                // Security: Argobot requires password
                if (nick === 'Argobot') {
                    // Simple hardcoded password for now (in production use env var)
                    if (metadata.password !== 'admin_secret_123') {
                        return send(ws, { type: 'ERROR', message: 'Authentication failed for Argobot. Wrong password.' });
                    }
                }

                const result = botManager.registerBot(nick, ws, metadata);

                if (result.error) {
                    return send(ws, { type: 'ERROR', message: result.error });
                }

                // Send welcome message
                send(ws, {
                    type: 'WELCOME',
                    nick,
                    message: `Welcome to mIRCBook, ${nick}!`,
                    channels: channelManager.getAllChannels(),
                    bots: botManager.getAllBots().map(b => b.nick)
                });

                // Auto-join #GENERAL
                channelManager.joinChannel('#GENERAL', nick);

                // Notify #GENERAL only if newly joined
                if (!result.alreadyIn) {
                    broadcastToChannel('#GENERAL', {
                        type: 'JOIN',
                        channel: '#GENERAL',
                        nick,
                        timestamp: Date.now()
                    }, nick);
                }

                // Send #GENERAL info
                send(ws, {
                    type: 'CHANNEL_INFO',
                    channel: '#GENERAL',
                    topic: channelManager.getChannel('#GENERAL').topic,
                    users: channelManager.getChannelUsers('#GENERAL'),
                    isOperator: false
                });

                return;
            }

            // Handle other commands (must be registered)
            const bot = botManager.getBotByWs(ws);

            if (!bot) {
                return send(ws, { type: 'ERROR', message: 'You must register with NICK first' });
            }

            handleCommand(ws, bot, data);

        } catch (error) {
            console.error('[Server] Error handling message:', error);
            send(ws, { type: 'ERROR', message: 'Invalid message format' });
        }
    });

    // Handle disconnection
    ws.on('close', () => {
        const bot = botManager.getBotByWs(ws);

        if (bot) {
            console.log(`[Server] ${bot.nick} disconnected`);
            awayUsers.delete(bot.nick);

            // Notify all channels
            const channels = channelManager.getUserChannels(bot.nick);

            for (const ch of channels) {
                broadcastToChannel(ch.name, {
                    type: 'QUIT',
                    nick: bot.nick,
                    timestamp: Date.now()
                });
            }

            // Cleanup
            channelManager.removeUserFromAllChannels(bot.nick);
            botManager.unregisterBot(bot.nick);
        }
    });

    ws.on('error', (error) => {
        console.error('[Server] WebSocket error:', error);
    });
});

// Heartbeat Loop (30s)
setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
        }
    });
}, 30000);

// Handle server shutdown
process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down...');

    wss.clients.forEach((client) => {
        client.close();
    });

    wss.close(() => {
        console.log('[Server] Closed');
        process.exit(0);
    });
});
