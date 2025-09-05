/**
 * SpeakerIdentificationView - Speaker naming and identification workflow
 * Modularized from App.tsx for better organization
 */

import React from 'react';
import SpeakerIdentification from '../components/SpeakerIdentification/SpeakerIdentification';
import { useSelectedJob } from '../contexts';

interface SpeakerIdentificationViewProps {
  onComplete: (result: { speakerNames: { [key: string]: string }, speakerMerges?: { [key: string]: string } }) => void;
  onSkip: () => void;
}

const SpeakerIdentificationView: React.FC<SpeakerIdentificationViewProps> = ({ 
  onComplete, 
  onSkip 
}) => {
  const { selectedJob } = useSelectedJob();

  if (!selectedJob) {
    return (
      <div className="speaker-identification-view">
        <div className="error-content">
          <h2>No Transcription Selected</h2>
          <p>Please select a completed transcription to identify speakers.</p>
          <button className="back-btn secondary" onClick={onSkip}>
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (selectedJob.status !== 'completed' || !selectedJob.result) {
    return (
      <div className="speaker-identification-view">
        <div className="error-content">
          <h2>Transcription Not Ready</h2>
          <p>The selected transcription is not completed yet. Please wait for transcription to finish.</p>
          <div className="job-status">
            <strong>Status:</strong> {selectedJob.status}
            {selectedJob.status === 'processing' && (
              <span> ({selectedJob.progress}% complete)</span>
            )}
          </div>
          <button className="back-btn secondary" onClick={onSkip}>
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="speaker-identification-view">
      <SpeakerIdentification
        transcriptionJob={selectedJob}
        onComplete={onComplete}
        onSkip={onSkip}
      />
    </div>
  );
};

export default SpeakerIdentificationView;