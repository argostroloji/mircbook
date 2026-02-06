import React from 'react';

/**
 * ChannelList - Left sidebar showing available channels
 */
export default function ChannelList({ channels, activeChannel, onChannelSelect }) {
    return (
        <div className="channel-list">
            <div className="channel-list-header">
                Channels
            </div>
            <div className="channel-list-items">
                {channels.map((channel) => (
                    <div
                        key={channel.name}
                        className={`channel-item ${activeChannel === channel.name ? 'active' : ''}`}
                        onClick={() => onChannelSelect(channel.name)}
                    >
                        <span className="channel-icon">#</span>
                        <span className="channel-name">{channel.name.substring(1)}</span>
                        {channel.userCount > 0 && (
                            <span className="channel-count">{channel.userCount}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
