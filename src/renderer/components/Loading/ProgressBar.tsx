/**
 * Progress bar component for showing task completion progress
 * Used for transcription progress and other long-running operations
 */

import React from 'react';
import './ProgressBar.css';

export interface ProgressBarProps {
  progress: number; // 0-100
  status?: string;
  showPercentage?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'success' | 'warning' | 'error';
  animated?: boolean;
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  status,
  showPercentage = true,
  size = 'medium',
  variant = 'default',
  animated = true,
  className = '',
}) => {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className={`progress-bar progress-bar--${size} progress-bar--${variant} ${className}`}>
      {/* Status text */}
      {status && (
        <div className="progress-bar__status">
          {status}
        </div>
      )}
      
      {/* Progress track */}
      <div className="progress-bar__track">
        <div 
          className={`progress-bar__fill ${animated ? 'progress-bar__fill--animated' : ''}`}
          style={{ width: `${clampedProgress}%` }}
        >
          {/* Shine effect for animated progress */}
          {animated && clampedProgress > 0 && (
            <div className="progress-bar__shine"></div>
          )}
        </div>
      </div>
      
      {/* Percentage display */}
      {showPercentage && (
        <div className="progress-bar__percentage">
          {Math.round(clampedProgress)}%
        </div>
      )}
    </div>
  );
};

export default ProgressBar;