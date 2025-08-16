import React, { useState, useEffect, useRef } from 'react';

interface SpeakerSample {
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

interface SpeakerData {
  originalId: string;
  customName: string;
  sampleSegment: SpeakerSample;
  totalDuration: number;
  segmentCount: number;
}

interface SpeakerIdentificationProps {
  transcriptionJob: any;
  onComplete: (result: { speakerNames: { [key: string]: string }, speakerMerges?: { [key: string]: string } }) => void;
  onSkip: () => void;
}

const SpeakerIdentification: React.FC<SpeakerIdentificationProps> = ({
  transcriptionJob,
  onComplete,
  onSkip
}) => {
  // Early return if job or result is missing
  if (!transcriptionJob) {
    return (
      <div className="speaker-identification">
        <div className="error-message">
          <h2>Error: No transcription job provided</h2>
          <button onClick={onSkip}>← Back to Home</button>
        </div>
      </div>
    );
  }

  if (!transcriptionJob.result) {
    return (
      <div className="speaker-identification">
        <div className="error-message">
          <h2>Error: Transcription result not available</h2>
          <p>The transcription may not be complete or there was an error processing the audio.</p>
          <button onClick={onSkip}>← Back to Home</button>
        </div>
      </div>
    );
  }
  const [speakerData, setSpeakerData] = useState<{ [key: string]: SpeakerData }>({});
  const [speakerNames, setSpeakerNames] = useState<{ [key: string]: string }>({});
  const [playingStates, setPlayingStates] = useState<{ [key: string]: boolean }>({});
  const [loadingState, setLoadingState] = useState<string>('Analyzing speakers...');
  const [currentFocusIndex, setCurrentFocusIndex] = useState(0);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [mergedSpeakers, setMergedSpeakers] = useState<Set<string>>(new Set());
  const [showMergeOptions, setShowMergeOptions] = useState<{ [key: string]: boolean }>({});
  const [mergeMapping, setMergeMapping] = useState<{ [key: string]: string }>({});
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement }>({});

  const segments = transcriptionJob.result?.segments || [];

  // Find best audio sample for a speaker
  const findBestSample = (speakerSegments: any[]): SpeakerSample => {
    const candidates = speakerSegments
      .filter(segment => {
        const duration = segment.end - segment.start;
        const wordCount = segment.words ? segment.words.length : segment.text.split(' ').length;
        
        return (
          duration >= 3 &&      // At least 3 seconds
          duration <= 10 &&     // No more than 10 seconds
          wordCount >= 5 &&     // At least 5 words
          segment.text.trim().length > 20  // Substantial text
        );
      })
      .sort((a, b) => {
        // Prefer longer segments with more words
        const wordsA = a.words ? a.words.length : a.text.split(' ').length;
        const wordsB = b.words ? b.words.length : b.text.split(' ').length;
        const scoreA = (a.end - a.start) * wordsA;
        const scoreB = (b.end - b.start) * wordsB;
        return scoreB - scoreA;
      });
      
    const selectedSegment = candidates[0] || speakerSegments[0]; // Fallback to first segment
    
    return {
      start: selectedSegment.start,
      end: selectedSegment.end,
      text: selectedSegment.text,
      confidence: selectedSegment.confidence || 0.9
    };
  };

  // Group segments by speaker and prepare data
  useEffect(() => {
    const prepareSpeakerSamples = async () => {
      try {
        console.log('Preparing speaker samples from segments:', segments.length);
        
        // Group segments by speaker
        const speakerSegments: { [key: string]: any[] } = {};
        segments.forEach(segment => {
          const speakerId = segment.speaker || 'SPEAKER_00';
          if (!speakerSegments[speakerId]) {
            speakerSegments[speakerId] = [];
          }
          speakerSegments[speakerId].push(segment);
        });

        console.log('Grouped segments by speaker:', Object.keys(speakerSegments));

        // Auto-complete if only 1 speaker (no need for user input)
        if (Object.keys(speakerSegments).length <= 1) {
          console.log('Only one speaker detected in SpeakerIdentification, auto-completing');
          console.log('Speaker segments:', Object.keys(speakerSegments));
          
          // Create default speaker mapping for single speaker
          const defaultSpeakerNames: { [key: string]: string } = {};
          Object.keys(speakerSegments).forEach(speakerId => {
            defaultSpeakerNames[speakerId] = `Speaker 1`;
          });
          
          // Auto-complete with default speaker name
          onComplete({ 
            speakerNames: defaultSpeakerNames,
            speakerMerges: {}
          });
          return;
        }

        // Prepare speaker data
        const newSpeakerData: { [key: string]: SpeakerData } = {};
        const newSpeakerNames: { [key: string]: string } = {};

        Object.entries(speakerSegments).forEach(([speakerId, segments]) => {
          const totalDuration = segments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
          const bestSample = findBestSample(segments);

          newSpeakerData[speakerId] = {
            originalId: speakerId,
            customName: '',
            sampleSegment: bestSample,
            totalDuration,
            segmentCount: segments.length
          };

          newSpeakerNames[speakerId] = '';
        });

        setSpeakerData(newSpeakerData);
        setSpeakerNames(newSpeakerNames);
        setLoadingState('');
        
        console.log('Speaker data prepared:', newSpeakerData);
        
      } catch (error) {
        console.error('Failed to prepare speaker samples:', error);
        // Fallback to skip
        onSkip();
      }
    };

    prepareSpeakerSamples();
  }, [segments, onSkip]);

  // Audio playback for samples - DISABLED to prevent memory issues
  const handlePlaySample = async (speakerId: string) => {
    console.log('Audio playback temporarily disabled to prevent memory issues');
    console.log('Speaker sample requested for:', speakerId);
    
    // TODO: Implement streaming audio playback for large files
    // For now, just show a message that playback is disabled
    alert('Audio playback is temporarily disabled to prevent app crashes with large files. Speaker identification still works - just enter names manually.');
  };

  // Get audio MIME type helper
  const getAudioMimeType = (filePath: string): string => {
    const ext = filePath.toLowerCase().split('.').pop();
    switch (ext) {
      case 'mp3': return 'audio/mpeg';
      case 'wav': return 'audio/wav';
      case 'm4a': return 'audio/mp4';
      case 'flac': return 'audio/flac';
      case 'ogg': return 'audio/ogg';
      case 'aac': return 'audio/aac';
      case 'wma': return 'audio/x-ms-wma';
      default: return 'audio/mpeg';
    }
  };

  // Validate speaker name
  const validateSpeakerName = (name: string, speakerId: string): { valid: boolean; message?: string } => {
    const trimmed = name.trim();
    
    if (trimmed.length === 0) {
      return { valid: true }; // Empty is OK, will use generic name
    }
    
    if (trimmed.length > 50) {
      return { valid: false, message: "Name too long (max 50 characters)" };
    }
    
    // Check for duplicate names
    const existingNames = Object.entries(speakerNames)
      .filter(([id, n]) => id !== speakerId && n && n.toLowerCase() === trimmed.toLowerCase());
      
    if (existingNames.length > 0) {
      return { valid: false, message: "Duplicate name" };
    }
    
    return { valid: true };
  };

  // Handle name input change
  const handleNameChange = (speakerId: string, value: string) => {
    setSpeakerNames(prev => ({ ...prev, [speakerId]: value }));
    
    const validation = validateSpeakerName(value, speakerId);
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      if (validation.valid) {
        delete newErrors[speakerId];
      } else {
        newErrors[speakerId] = validation.message || '';
      }
      return newErrors;
    });
  };

  // Handle skip speaker
  const handleSkipSpeaker = (speakerId: string) => {
    const speakerIds = Object.keys(speakerData);
    const speakerIndex = speakerIds.indexOf(speakerId);
    const genericName = `Speaker ${speakerIndex + 1}`;
    
    setSpeakerNames(prev => ({ ...prev, [speakerId]: genericName }));
    
    // Focus next speaker
    const nextIndex = speakerIndex + 1;
    if (nextIndex < speakerIds.length) {
      const nextSpeakerId = speakerIds[nextIndex];
      inputRefs.current[nextSpeakerId]?.focus();
    }
  };

  // Handle continue
  const handleContinue = () => {
    // Fill in generic names for empty fields (only active speakers)
    const finalNames: { [key: string]: string } = {};
    const activeSpeakers = Object.keys(speakerData).filter(id => !mergedSpeakers.has(id));
    
    activeSpeakers.forEach((speakerId, index) => {
      const customName = speakerNames[speakerId]?.trim();
      finalNames[speakerId] = customName || `Speaker ${index + 1}`;
    });
    
    onComplete({ speakerNames: finalNames, speakerMerges: mergeMapping });
  };

  // Handle use generic names
  const handleUseGenericNames = () => {
    const activeSpeakers = Object.keys(speakerData).filter(id => !mergedSpeakers.has(id));
    const genericNames = activeSpeakers.reduce((acc, speakerId, index) => {
      acc[speakerId] = `Speaker ${index + 1}`;
      return acc;
    }, {} as { [key: string]: string });
    
    onComplete({ speakerNames: genericNames, speakerMerges: mergeMapping });
  };

  // Handle speaker merging
  const handleMergeSpeakers = (primarySpeakerId: string, secondarySpeakerId: string) => {
    console.log(`Merging ${secondarySpeakerId} into ${primarySpeakerId}`);
    
    // Update merged speakers set
    setMergedSpeakers(prev => new Set([...prev, secondarySpeakerId]));
    
    // Update merge mapping - map the merged speaker to the primary one
    setMergeMapping(prev => ({ ...prev, [secondarySpeakerId]: primarySpeakerId }));
    
    // Combine total duration and segment count
    setSpeakerData(prevData => {
      const updatedData = { ...prevData };
      updatedData[primarySpeakerId].totalDuration += updatedData[secondarySpeakerId].totalDuration;
      updatedData[primarySpeakerId].segmentCount += updatedData[secondarySpeakerId].segmentCount;
      return updatedData;
    });
    
    // If the primary speaker doesn't have a name yet, and the secondary one does, use it.
    if (!speakerNames[primarySpeakerId] && speakerNames[secondarySpeakerId]) {
      setSpeakerNames(prev => ({ ...prev, [primarySpeakerId]: speakerNames[secondarySpeakerId] }));
    }
    
    // Hide merge options dropdown
    setShowMergeOptions(prev => ({ ...prev, [primarySpeakerId]: false, [secondarySpeakerId]: false }));
    
    console.log(`✅ ${secondarySpeakerId} merged into ${primarySpeakerId}`);
  };

  // Toggle merge options dropdown
  const toggleMergeOptions = (speakerId: string) => {
    setShowMergeOptions(prev => ({ 
      ...prev, 
      [speakerId]: !prev[speakerId] 
    }));
  };

  // Format time helper
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format duration helper
  const formatDuration = (seconds: number): string => {
    return `${Math.round(seconds)} seconds`;
  };

  if (loadingState) {
    return (
      <div className="speaker-identification-loading">
        <div className="loading-content">
          <h2>🎙️ {loadingState}</h2>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  const speakerIds = Object.keys(speakerData);

  if (speakerIds.length === 0) {
    return null;
  }

  return (
    <div className="speaker-identification">
      <div className="speaker-identification-container">
        <header className="speaker-identification-header">
          <h1>🎙️ Identify Speakers ({speakerIds.filter(id => !mergedSpeakers.has(id)).length} active)</h1>
          <p>Listen to audio samples and provide names for each speaker. Merge similar voices if needed.</p>
        </header>

        <div className="speaker-cards">
          {speakerIds.map((speakerId, index) => {
            const speakerInfo = speakerData[speakerId];
            const isPlaying = playingStates[speakerId];
            const hasError = validationErrors[speakerId];
            const isMerged = mergedSpeakers.has(speakerId);
            const showMerge = showMergeOptions[speakerId];

            if (isMerged) return null; // Don't show merged speakers

            return (
              <div key={speakerId} className={`speaker-card ${isMerged ? 'merged' : ''}`}>
                <div className="speaker-header">
                  <h3 className="speaker-title">🔊 Speaker {index + 1}</h3>
                  <button
                    className={`play-button ${isPlaying ? 'playing' : ''}`}
                    onClick={() => handlePlaySample(speakerId)}
                    disabled={isPlaying}
                  >
                    {isPlaying ? '⏸ Playing...' : '▶ Play Sample'}
                  </button>
                </div>

                <div className="sample-preview">
                  "{speakerInfo.sampleSegment.text}"
                </div>

                <div className="sample-meta">
                  {formatTime(speakerInfo.sampleSegment.start)} - {formatTime(speakerInfo.sampleSegment.end)} • {formatDuration(speakerInfo.sampleSegment.end - speakerInfo.sampleSegment.start)}
                </div>

                <div className="name-input-row">
                  <input
                    ref={el => { if (el) inputRefs.current[speakerId] = el; }}
                    type="text"
                    className={`name-input ${hasError ? 'error' : ''}`}
                    placeholder="Enter speaker name"
                    value={speakerNames[speakerId] || ''}
                    onChange={(e) => handleNameChange(speakerId, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const activeIds = speakerIds.filter(id => !mergedSpeakers.has(id));
                        const currentActiveIndex = activeIds.indexOf(speakerId);
                        const nextIndex = currentActiveIndex + 1;
                        if (nextIndex < activeIds.length) {
                          inputRefs.current[activeIds[nextIndex]]?.focus();
                        } else {
                          handleContinue();
                        }
                      }
                    }}
                  />
                  
                  <div className="speaker-actions">
                    <button
                      className="skip-speaker-btn"
                      onClick={() => handleSkipSpeaker(speakerId)}
                    >
                      Skip This Speaker
                    </button>
                    
                    {speakerIds.filter(id => !mergedSpeakers.has(id) && id !== speakerId).length > 0 && (
                      <div className="merge-controls">
                        <button
                          className="merge-btn"
                          onClick={() => toggleMergeOptions(speakerId)}
                        >
                          Merge with...
                        </button>
                        
                        {showMerge && (
                          <div className="merge-dropdown">
                            {speakerIds
                              .filter(id => !mergedSpeakers.has(id) && id !== speakerId)
                              .map((otherSpeakerId, otherIndex) => (
                                <button
                                  key={otherSpeakerId}
                                  className="merge-option"
                                  onClick={() => handleMergeSpeakers(speakerId, otherSpeakerId)}
                                >
                                  Speaker {speakerIds.indexOf(otherSpeakerId) + 1}
                                </button>
                              ))
                            }
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {hasError && (
                  <div className="validation-error">
                    {hasError}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="speaker-identification-footer">
          <button className="secondary-btn" onClick={handleUseGenericNames}>
            Use Generic Names
          </button>
          <button className="primary-btn" onClick={handleContinue}>
            Continue to Editor
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpeakerIdentification;