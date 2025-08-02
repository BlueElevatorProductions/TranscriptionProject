/**
 * TranscriptionProgressView - Progress tracking for active transcriptions
 * Modularized from App.tsx for better organization
 */

import React from 'react';
import { useTranscriptionProgress } from '../contexts';

interface TranscriptionProgressViewProps {
  onBack: () => void;
}

const TranscriptionProgressView: React.FC<TranscriptionProgressViewProps> = ({ onBack }) => {
  const { progressData, isProcessing } = useTranscriptionProgress();

  return (
    <div className="transcription-progress">
      <div className="progress-content">
        <h2>Transcribing Audio</h2>
        
        <div className="progress-info">
          <h3>{progressData.fileName || 'Processing...'}</h3>
          <p className="status-text">{progressData.status}</p>
          
          <div className="progress-bar-large">
            <div 
              className="progress-fill" 
              style={{ width: `${progressData.progress}%` }}
            ></div>
          </div>
          
          <div className="progress-details">
            <span className="progress-percentage">
              {Math.round(progressData.progress)}% complete
            </span>
            
            {isProcessing && (
              <div className="processing-indicator">
                <div className="spinner"></div>
                <span>Processing...</span>
              </div>
            )}
          </div>
        </div>

        <div className="progress-actions">
          <button 
            className="back-btn secondary"
            onClick={onBack}
          >
            ← Back to Home
          </button>
        </div>

        {progressData.progress === 0 && isProcessing && (
          <div className="progress-tips">
            <h4>Processing your audio file</h4>
            <ul>
              <li>Large files may take several minutes to transcribe</li>
              <li>Cloud transcription provides word-level timestamps</li>
              <li>You can continue using other features while processing</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptionProgressView;