/**
 * Loading state component for full-screen or section loading
 * Combines spinner, text, and optional progress information
 */

import React from 'react';
import LoadingSpinner from './LoadingSpinner';
import ProgressBar from './ProgressBar';
import './LoadingState.css';

export interface LoadingStateProps {
  title?: string;
  message?: string;
  progress?: number; // If provided, shows progress bar instead of spinner
  status?: string;
  size?: 'small' | 'medium' | 'large';
  overlay?: boolean; // If true, shows as overlay
  className?: string;
}

const LoadingState: React.FC<LoadingStateProps> = ({
  title = 'Loading',
  message,
  progress,
  status,
  size = 'medium',
  overlay = false,
  className = '',
}) => {
  const hasProgress = typeof progress === 'number';

  return (
    <div className={`loading-state ${overlay ? 'loading-state--overlay' : ''} loading-state--${size} ${className}`}>
      <div className="loading-state__content">
        {/* Title */}
        <h3 className="loading-state__title">
          {title}
        </h3>

        {/* Progress indicator */}
        <div className="loading-state__indicator">
          {hasProgress ? (
            <ProgressBar
              progress={progress}
              status={status}
              size={size}
              animated={true}
            />
          ) : (
            <LoadingSpinner
              size={size}
              text={status}
              showText={!!status}
            />
          )}
        </div>

        {/* Message */}
        {message && (
          <p className="loading-state__message">
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default LoadingState;