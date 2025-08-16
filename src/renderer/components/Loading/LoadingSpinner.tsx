/**
 * Loading spinner component with customizable size and text
 * Used throughout the app for loading states
 */

import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  showText?: boolean;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  text = 'Loading...',
  showText = true,
  className = '',
}) => {
  return (
    <div className={`loading-spinner loading-spinner--${size} ${className}`}>
      <div className="loading-spinner__circle">
        <div className="loading-spinner__inner"></div>
      </div>
      {showText && (
        <div className="loading-spinner__text">
          {text}
        </div>
      )}
    </div>
  );
};

export default LoadingSpinner;