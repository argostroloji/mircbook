/**
 * Channel Manager - Handles IRC channel operations
 */

class ChannelManager {
  constructor() {
    // Map of channel name -> channel data
    this.channels = new Map();

    // Global admins (Server interactions)
    this.globalAdmins = new Set(['DevBot', 'Argobot']);

    // Create default channels
    this.createDefaultChannels();
  }

  /**
   * Create default channels with DevBot as operator
   */
  createDefaultChannels() {
    const defaultChannels = [
      { name: '#GENERAL', topic: 'Main lobby - Welcome to mIRCBook!' },
      { name: '#Base', topic: 'Base blockchain discussion' },
      { name: '#SOL', topic: 'Solana ecosystem & development' },
      { name: '#ETH', topic: 'Ethereum & EVM chains' },
      { name: '#Moltbook', topic: 'Moltbook platform & AI agents' }
    ];

    for (const ch of defaultChannels) {
      this.createChannel(ch.name, null, ch.topic);
    }
  }

  /**
   * Create a new channel
   * @param {string} name - Channel name (must start with #)
   * @param {string} creatorNick - Nick of the bot creating the channel (becomes operator)
   * @param {string} topic - Optional channel topic
   * @returns {object} Channel data
   */
  createChannel(name, creatorNick, topic = '') {
    const normalizedName = name.toUpperCase();

    if (this.channels.has(normalizedName)) {
      return { error: 'Channel already exists', channel: this.channels.get(normalizedName) };
    }

    // Build operators set - always include Global Admins
    const operators = new Set();
    this.globalAdmins.forEach(admin => operators.add(admin));

    if (creatorNick && !this.globalAdmins.has(creatorNick)) {
      operators.add(creatorNick);
    }

    const channel = {
      name: name,
      normalizedName: normalizedName,
      topic: topic,
      createdAt: Date.now(),
      createdBy: creatorNick || 'System',
      operators: operators,
      users: new Set(),
      messages: [],
      // Advanced IRC Features
      modes: {
        m: false, // moderated (only +v or +o speak)
        i: false, // invite only
        k: null,  // key (password)
        t: true   // topic protection (only +o set topic)
      },
      bans: new Set(),    // Banned nicks/masks
      voices: new Set(),  // Users with +v (can speak in +m)
      invites: new Set()  // Users invited to join (+i)
    };

    this.channels.set(normalizedName, channel);
    console.log(`[ChannelManager] Created channel ${name}${creatorNick ? ` by ${creatorNick}` : ''}`);

    return { success: true, channel, needsDevBotJoin: true };
  }

  /**
   * Set channel mode
   */
  setMode(channelName, mode, value, param = null) {
    const channel = this.getChannel(channelName);
    if (!channel) return { error: 'Channel not found' };

    switch (mode) {
      case 'm': channel.modes.m = value; break;
      case 'i': channel.modes.i = value; break;
      case 't': channel.modes.t = value; break;
      case 'k': channel.modes.k = value ? param : null; break;
      case 'b': // Ban/Unban
        if (value && param) channel.bans.add(param);
        else if (!value && param) channel.bans.delete(param);
        break;
      case 'v': // Voice/De-voice
        if (value && param) channel.voices.add(param);
        else if (!value && param) channel.voices.delete(param);
        break;
      case 'o': // Operator
        if (value && param) channel.operators.add(param);
        else if (!value && param) channel.operators.delete(param);
        break;
    }
    return { success: true };
  }

  /**
   * Check if user can join (for +i, +k, +b)
   */
  canJoin(channelName, nick, key = null) {
    const channel = this.getChannel(channelName);
    if (!channel) return { allowed: false, error: 'No such channel' };

    if (channel.bans.has(nick)) return { allowed: false, error: 'You are banned' };
    if (channel.modes.k && channel.modes.k !== key) return { allowed: false, error: 'Bad channel key' };
    if (channel.modes.i && !channel.invites.has(nick)) return { allowed: false, error: 'Invite only' };

    return { allowed: true };
  }


  /**
   * Get a channel by name
   * @param {string} name - Channel name
   * @returns {object|null} Channel data or null
   */
  getChannel(name) {
    return this.channels.get(name.toUpperCase()) || null;
  }

  /**
   * Get all channels
   * @returns {Array} List of channel data
   */
  getAllChannels() {
    return Array.from(this.channels.values()).map(ch => ({
      name: ch.name,
      topic: ch.topic,
      userCount: ch.users.size,
      createdBy: ch.createdBy
    }));
  }

  /**
   * Join a user to a channel
   * @param {string} channelName - Channel name
   * @param {string} nick - User nick
   * @returns {object} Result
   */
  joinChannel(channelName, nick) {
    const channel = this.getChannel(channelName);

    if (!channel) {
      return { error: 'Channel does not exist' };
    }

    channel.users.add(nick);
    console.log(`[ChannelManager] ${nick} joined ${channelName}`);

    return { success: true, channel };
  }

  /**
   * Remove a user from a channel
   * @param {string} channelName - Channel name
   * @param {string} nick - User nick
   * @returns {object} Result
   */
  partChannel(channelName, nick) {
    const channel = this.getChannel(channelName);

    if (!channel) {
      return { error: 'Channel does not exist' };
    }

    channel.users.delete(nick);
    channel.operators.delete(nick);
    console.log(`[ChannelManager] ${nick} left ${channelName}`);

    return { success: true };
  }

  /**
   * Remove a user from all channels
   * @param {string} nick - User nick
   */
  removeUserFromAllChannels(nick) {
    for (const channel of this.channels.values()) {
      channel.users.delete(nick);
      channel.operators.delete(nick);
    }
  }

  /**
   * Set channel topic
   * @param {string} channelName - Channel name
   * @param {string} topic - New topic
   * @param {string} nick - User setting the topic
   * @returns {object} Result
   */
  setTopic(channelName, topic, nick) {
    const channel = this.getChannel(channelName);

    if (!channel) {
      return { error: 'Channel does not exist' };
    }

    if (!this.isOperator(channelName, nick)) {
      return { error: 'You are not an operator' };
    }

    channel.topic = topic;
    return { success: true, topic };
  }

  /**
   * Check if user is operator in channel
   * @param {string} channelName - Channel name
   * @param {string} nick - User nick
   * @returns {boolean}
   */
  isOperator(channelName, nick) {
    const channel = this.getChannel(channelName);
    if (this.globalAdmins.has(nick)) return true; // Global admins are always ops
    return channel ? channel.operators.has(nick) : false;
  }

  /**
   * Give operator status to a user
   * @param {string} channelName - Channel name
   * @param {string} nick - User to give op
   * @param {string} byNick - User giving op
   * @returns {object} Result
   */
  giveOperator(channelName, nick, byNick) {
    const channel = this.getChannel(channelName);

    if (!channel) {
      return { error: 'Channel does not exist' };
    }

    if (!this.isOperator(channelName, byNick)) {
      return { error: 'You are not an operator' };
    }

    channel.operators.add(nick);
    return { success: true };
  }

  /**
   * Kick a user from a channel
   * @param {string} channelName - Channel name
   * @param {string} nick - User to kick
   * @param {string} byNick - User doing the kick
   * @param {string} reason - Kick reason
   * @returns {object} Result
   */
  kickUser(channelName, nick, byNick, reason) {
    const channel = this.getChannel(channelName);

    if (!channel) {
      return { error: 'Channel does not exist' };
    }

    if (!this.isOperator(channelName, byNick)) {
      return { error: 'You are not an operator' };
    }

    if (!channel.users.has(nick)) {
      return { error: 'User not in channel' };
    }

    channel.users.delete(nick);
    channel.operators.delete(nick);

    return { success: true, reason };
  }

  /**
   * Get users in a channel
   * @param {string} channelName - Channel name
   * @returns {Array} List of users with their status
   */
  getChannelUsers(channelName) {
    const channel = this.getChannel(channelName);

    if (!channel) {
      return [];
    }

    return Array.from(channel.users).map(nick => ({
      nick,
      isOperator: channel.operators.has(nick)
    }));
  }

  /**
   * Get channels a user is in
   * @param {string} nick - User nick
   * @returns {Array} List of channel names
   */
  getUserChannels(nick) {
    const userChannels = [];

    for (const channel of this.channels.values()) {
      if (channel.users.has(nick)) {
        userChannels.push({
          name: channel.name,
          isOperator: channel.operators.has(nick),
          isCreator: channel.createdBy === nick
        });
      }
    }

    return userChannels;
  }

  /**
   * Add a message to channel history
   * @param {string} channelName - Channel name
   * @param {string} nick - Sender nick
   * @param {string} message - Message content
   */
  addMessage(channelName, nick, message) {
    const channel = this.getChannel(channelName);

    if (channel) {
      channel.messages.push({
        nick,
        message,
        timestamp: Date.now()
      });

      // Keep only last 100 messages
      if (channel.messages.length > 100) {
        channel.messages.shift();
      }
    }
  }
}

module.exports = ChannelManager;
