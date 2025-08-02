/**
 * HomeView - Landing page with file import and recent transcriptions
 * Modularized from App.tsx for better organization
 */

import React from 'react';
import { useTranscriptionJobs } from '../contexts';
import { TranscriptionJob } from '../types';

interface HomeViewProps {
  onImportClick: () => void;
  onJobSelect: (job: TranscriptionJob) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onImportClick, onJobSelect }) => {
  const { jobs } = useTranscriptionJobs();

  return (
    <div className="home-screen">
      <div className="home-content">
        <div className="import-section">
          <h2>Import Audio File</h2>
          <p>Get started by importing an audio file for transcription</p>
          <button 
            className="import-btn primary"
            onClick={onImportClick}
          >
            📁 Import Audio File
          </button>
        </div>

        {jobs.length > 0 && (
          <div className="recent-jobs">
            <h3>Recent Transcriptions</h3>
            <div className="jobs-list">
              {jobs.map(job => (
                <div 
                  key={job.id} 
                  className="job-item" 
                  onClick={() => onJobSelect(job)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="job-info">
                    <h4>{job.fileName}</h4>
                    <p className={`status ${job.status}`}>
                      {job.status}
                    </p>
                  </div>
                  <div className="job-progress">
                    {job.status === 'processing' && (
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${job.progress}%` }}
                        ></div>
                      </div>
                    )}
                    {job.status === 'completed' && (
                      <div className="job-stats">
                        <span className="segment-count">
                          {job.result?.segments?.length || 0} segments
                        </span>
                      </div>
                    )}
                    {job.status === 'error' && (
                      <div className="job-error">
                        <span className="error-message" title={job.error}>
                          ❌ {job.error?.substring(0, 50)}...
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {jobs.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-content">
              <h3>No transcriptions yet</h3>
              <p>Import your first audio file to get started with professional transcription editing.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeView;