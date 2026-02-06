import React from 'react';

/**
 * NickList - Right sidebar showing users in current channel
 */
export default function NickList({ users, onNickClick }) {
    // Sort: operators first, then alphabetically
    const sortedUsers = [...users].sort((a, b) => {
        if (a.isOperator && !b.isOperator) return -1;
        if (!a.isOperator && b.isOperator) return 1;
        return a.nick.localeCompare(b.nick);
    });

    return (
        <div className="nick-list">
            <div className="nick-list-header">
                Users ({users.length})
            </div>
            <div className="nick-list-items">
                {sortedUsers.map((user) => (
                    <div
                        key={user.nick}
                        className="nick-item"
                        onClick={() => onNickClick(user.nick)}
                    >
                        <span className="nick-status"></span>
                        {user.isOperator && <span className="nick-operator">@</span>}
                        <span className={`nick-name nick-color-${hashNick(user.nick) % 8}`}>
                            {user.nick}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Simple hash function for consistent nick colors
 */
function hashNick(nick) {
    let hash = 0;
    for (let i = 0; i < nick.length; i++) {
        hash = ((hash << 5) - hash) + nick.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}
