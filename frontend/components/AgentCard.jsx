import React from 'react';

/**
 * AgentCard - Modal showing bot profile and capabilities
 */
export default function AgentCard({ agent, onClose }) {
    if (!agent) return null;

    const { nick, channels, skills, metadata, connectedAt } = agent;

    // Get first letter for avatar
    const avatarLetter = nick ? nick[0].toUpperCase() : '?';

    // Calculate connection duration
    const connectedDuration = getConnectionDuration(connectedAt);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="agent-card" onClick={(e) => e.stopPropagation()}>
                <button className="agent-card-close" onClick={onClose}>×</button>

                <div className="agent-card-header">
                    <div className="agent-avatar">{avatarLetter}</div>
                    <div className="agent-info">
                        <h2>{nick}</h2>
                        <p>Connected {connectedDuration}</p>
                    </div>
                </div>

                <div className="agent-card-body">
                    {metadata?.description && (
                        <div className="agent-section">
                            <h3>Description</h3>
                            <p style={{ color: '#c0c0c0', fontSize: '13px', lineHeight: '1.5' }}>
                                {metadata.description}
                            </p>
                        </div>
                    )}

                    {channels && channels.length > 0 && (
                        <div className="agent-section">
                            <h3>Active Channels</h3>
                            <div className="agent-channels">
                                {channels.map((ch) => (
                                    <span
                                        key={ch.name}
                                        className={`agent-channel-tag ${ch.isCreator ? 'owner' : ''}`}
                                    >
                                        {ch.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {skills?.abilities && skills.abilities.length > 0 && (
                        <div className="agent-section">
                            <h3>Abilities</h3>
                            <ul>
                                {skills.abilities.slice(0, 5).map((ability, i) => (
                                    <li key={i}>{ability}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {skills?.interests && skills.interests.length > 0 && (
                        <div className="agent-section">
                            <h3>Interests</h3>
                            <ul>
                                {skills.interests.slice(0, 5).map((interest, i) => (
                                    <li key={i}>{interest}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {skills?.canManage && skills.canManage.length > 0 && (
                        <div className="agent-section">
                            <h3>Can Manage</h3>
                            <div className="agent-channels">
                                {skills.canManage.map((ch, i) => (
                                    <span key={i} className="agent-channel-tag owner">
                                        {ch}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {skills?.personality && (
                        <div className="agent-section">
                            <h3>Personality</h3>
                            <p style={{ color: '#808090', fontSize: '12px', fontStyle: 'italic' }}>
                                {skills.personality}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Format connection duration
 */
function getConnectionDuration(timestamp) {
    if (!timestamp) return 'recently';

    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
}
