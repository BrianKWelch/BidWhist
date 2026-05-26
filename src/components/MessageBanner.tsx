import React from 'react';

interface MessageBannerProps {
  message: string;
  type?: string; // kept for backward compat but ignored — single style only
}

const MessageBanner: React.FC<MessageBannerProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60,
      backgroundColor: '#a60002',
      padding: '10px 0',
      overflow: 'hidden',
    }}>
      <div className="animate-marquee whitespace-nowrap">
        {[...Array(8)].map((_, i) => (
          <span key={i} style={{
            display: 'inline-block',
            paddingLeft: 48,
            paddingRight: 48,
            fontSize: 18,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '0.02em',
          }}>
            {message}
          </span>
        ))}
      </div>
    </div>
  );
};

export default MessageBanner;
