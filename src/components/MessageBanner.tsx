import React from 'react';

interface MessageBannerProps {
  message: string;
  type?: 'info' | 'warning' | 'success' | 'error';
}

const MessageBanner: React.FC<MessageBannerProps> = ({ message, type = 'info' }) => {
  console.log('MessageBanner render:', { message, type });
  if (!message) return null;

  const getBannerStyles = () => {
    switch (type) {
      case 'warning':
        return 'bg-yellow-500 text-yellow-900';
      case 'success':
        return 'bg-green-500 text-green-900';
      case 'error':
        return 'bg-red-500 text-red-900';
      default:
        return 'bg-blue-500 text-blue-900';
    }
  };

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${getBannerStyles()} py-2 overflow-hidden`}>
      <div className="animate-marquee whitespace-nowrap">
        <span className="inline-block px-4 font-medium text-sm">
          {message}
        </span>
        <span className="inline-block px-4 font-medium text-sm">
          {message}
        </span>
        <span className="inline-block px-4 font-medium text-sm">
          {message}
        </span>
        <span className="inline-block px-4 font-medium text-sm">
          {message}
        </span>
        <span className="inline-block px-4 font-medium text-sm">
          {message}
        </span>
        <span className="inline-block px-4 font-medium text-sm">
          {message}
        </span>
        <span className="inline-block px-4 font-medium text-sm">
          {message}
        </span>
        <span className="inline-block px-4 font-medium text-sm">
          {message}
        </span>
        <span className="inline-block px-4 font-medium text-sm">
          {message}
        </span>
        <span className="inline-block px-4 font-medium text-sm">
          {message}
        </span>
      </div>
    </div>
  );
};

export default MessageBanner;
