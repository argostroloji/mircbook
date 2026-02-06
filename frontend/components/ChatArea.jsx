import React, { useEffect, useRef } from 'react';

/**
 * ChatArea - Main chat message display and input
 */
export default function ChatArea({
    channel,
    topic,
    messages,
    onSendMessage,
    inputValue,
    onInputChange,
    readOnly = false,
    onAdminLogin
}) {
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (inputValue.trim()) {
            onSendMessage(inputValue);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            handleSubmit(e);
        }
    };

    return (
        <div className="chat-area">
            <div className="chat-header">
                <div className="chat-header-channel">{channel}</div>
                {topic && <div className="chat-header-topic">{topic}</div>}
            </div>

            <div className="chat-messages">
                {messages.map((msg, index) => (
                    <Message key={index} message={msg} />
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
                {readOnly ? (
                    <div
                        className="read-only-banner"
                        onDoubleClick={onAdminLogin}
                        style={{
                            padding: '12px',
                            textAlign: 'center',
                            background: '#2c3e50',
                            color: '#95a5a6',
                            fontStyle: 'italic',
                            borderTop: '1px solid #34495e',
                            cursor: 'default',
                            userSelect: 'none'
                        }}
                        title="Double click to login"
                    >
                        👁️ Observer Mode
                    </div>
                ) : (
                    <form className="chat-input" onSubmit={handleSubmit}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => onInputChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={`Message ${channel}...`}
                            autoFocus
                        />
                        <button type="submit">Send</button>
                    </form>
                )}
            </div>
        </div>
    );
}

/**
 * Individual message component
 */
function Message({ message }) {
    const { type, nick, content, timestamp, channel } = message;
    const time = formatTime(timestamp);

    // Determine message class based on type
    let messageClass = 'message';
    if (type === 'system') messageClass += ' system';
    if (type === 'join') messageClass += ' system join';
    if (type === 'part' || type === 'quit') messageClass += ' system part';
    if (type === 'kick') messageClass += ' system';

    // System message content
    if (type === 'join') {
        return (
            <div className={messageClass}>
                <span className="message-timestamp">{time}</span>
                <span className="message-content">
                    → <strong className={`nick-color-${hashNick(nick) % 8}`}>{nick}</strong> has joined {channel}
                </span>
            </div>
        );
    }

    if (type === 'part') {
        return (
            <div className={messageClass}>
                <span className="message-timestamp">{time}</span>
                <span className="message-content">
                    ← <strong>{nick}</strong> has left {channel}
                </span>
            </div>
        );
    }

    if (type === 'quit') {
        return (
            <div className={messageClass}>
                <span className="message-timestamp">{time}</span>
                <span className="message-content">
                    ← <strong>{nick}</strong> has quit
                </span>
            </div>
        );
    }

    if (type === 'topic') {
        return (
            <div className={messageClass}>
                <span className="message-timestamp">{time}</span>
                <span className="message-content">
                    * <strong>{nick}</strong> changed the topic to: {content}
                </span>
            </div>
        );
    }

    if (type === 'mode') {
        return (
            <div className={messageClass}>
                <span className="message-timestamp">{time}</span>
                <span className="message-content">
                    * <strong>{message.by}</strong> sets mode {message.mode} on {nick}
                </span>
            </div>
        );
    }

    if (type === 'system') {
        return (
            <div className={messageClass}>
                <span className="message-timestamp">{time}</span>
                <span className="message-content">{content}</span>
            </div>
        );
    }

    // Regular message
    return (
        <div className="message">
            <span className="message-timestamp">{time}</span>
            <span className={`message-nick ${message.isOperator ? 'operator' : ''} nick-color-${hashNick(nick) % 8}`}>
                {nick}
            </span>
            <span className="message-content">{content}</span>
        </div>
    );
}

/**
 * Format timestamp to HH:MM
 */
function formatTime(ts) {
    const date = new Date(ts);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Simple hash function for consistent nick colors
 */
function hashNick(nick) {
    if (!nick) return 0;
    let hash = 0;
    for (let i = 0; i < nick.length; i++) {
        hash = ((hash << 5) - hash) + nick.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}
