/**
 * TranscriptionProgressView - Progress tracking for active transcriptions
 * Modularized from App.tsx for better organization
 */

import React from 'react';
import { useTranscriptionProgress } from '../contexts';
import { LoadingState } from '../components/Loading';

interface TranscriptionProgressViewProps {
  onBack: () => void;
}

const TranscriptionProgressView: React.FC<TranscriptionProgressViewProps> = ({ onBack }) => {
  const { progressData, isProcessing } = useTranscriptionProgress();

  return (
    <div className="transcription-progress">
      <div className="progress-content">
        <LoadingState
          title="Transcribing Audio"
          message={progressData.fileName ? `Processing: ${progressData.fileName}` : 'Preparing transcription...'}
          progress={progressData.progress}
          status={progressData.status}
          size="large"
        />

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