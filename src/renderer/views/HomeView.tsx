/**
 * HomeView - Landing page with file import and recent transcriptions
 * Modularized from App.tsx for better organization
 */

import React from 'react';
import { useTranscriptionJobs } from '../contexts';
import { TranscriptionJob } from '../types';

interface HomeViewProps {
  onNewProject: () => void;
  onOpenProject: () => void;
  onJobSelect: (job: TranscriptionJob) => void;
  onShowNewLayout?: () => void; // Optional for testing new layout
}

const HomeView: React.FC<HomeViewProps> = ({ onNewProject, onOpenProject, onJobSelect, onShowNewLayout }) => {
  const { jobs } = useTranscriptionJobs();

  return (
    <div className="home-screen">
      <div className="home-content">
        <div className="project-section">
          <h2>Get Started</h2>
          <p>Create a new project or open an existing one</p>
          <div className="project-buttons">
            <button 
              className="new-project-btn primary"
              onClick={onNewProject}
            >
              ✨ New Project
            </button>
            <button 
              className="open-project-btn secondary"
              onClick={onOpenProject}
            >
              📁 Open Project
            </button>
          </div>
        </div>

        {/* Development: New Layout Preview */}
        {onShowNewLayout && (
          <div className="project-section" style={{ borderTop: '1px solid #e0e0e0', paddingTop: '20px', marginTop: '20px' }}>
            <h2>🚧 Development Preview</h2>
            <p>Test the new Google Docs-inspired layout (Phase 1)</p>
            <div className="project-buttons">
              <button 
                className="new-project-btn primary"
                onClick={onShowNewLayout}
                style={{ background: '#ff6b35' }}
              >
                🎨 Preview New Layout
              </button>
            </div>
          </div>
        )}

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