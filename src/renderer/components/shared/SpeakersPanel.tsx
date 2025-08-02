import React, { useEffect, useRef } from 'react';
import './SpeakersPanel.css';

interface Speaker {
  id: string;
  name: string;
  segments?: any[];
  totalDuration?: number;
  totalTime?: number;
  color?: string;
}

interface SpeakersPanelProps {
  mode: 'playback' | 'transcript-edit';
  speakers: Speaker[];
  speakerNames?: { [key: string]: string };
  editingSpeakerId?: string | null;
  tempSpeakerName?: string;
  onSpeakerEdit: (speakerId: string, currentName: string) => void;
  onSpeakerSave: (speakerId: string) => void;
  onSpeakerCancel: () => void;
  onTempNameChange: (name: string) => void;
}

const SpeakersPanel: React.FC<SpeakersPanelProps> = ({
  mode,
  speakers,
  speakerNames,
  editingSpeakerId,
  tempSpeakerName,
  onSpeakerEdit,
  onSpeakerSave,
  onSpeakerCancel,
  onTempNameChange
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  console.log('SpeakersPanel render - props:', { 
    mode,
    editingSpeakerId, 
    tempSpeakerName,
    speakersCount: speakers.length,
    onSpeakerEdit: !!onSpeakerEdit
  });

  // Focus the input with a delay to prevent immediate blur
  useEffect(() => {
    if (editingSpeakerId && inputRef.current) {
      console.log('SpeakersPanel useEffect: Attempting to focus input for', editingSpeakerId);
      const timer = setTimeout(() => {
        if (inputRef.current) {
          console.log('SpeakersPanel useEffect: Focusing input element');
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 100); // Increased delay
      return () => clearTimeout(timer);
    }
  }, [editingSpeakerId]);

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getSpeakerName = (speaker: Speaker): string => {
    if (speakerNames && speakerNames[speaker.id]) {
      return speakerNames[speaker.id];
    }
    return speaker.name || `Speaker ${speaker.id.replace('SPEAKER_', '')}`;
  };

  const getSpeakerDuration = (speaker: Speaker): number => {
    return speaker.totalDuration || speaker.totalTime || 0;
  };

  const getSpeakerSegmentCount = (speaker: Speaker): number => {
    return speaker.segments?.length || 0;
  };

  return (
    <div className="speakers-panel">
      <div className="panel-header">
        <h3>Speakers</h3>
      </div>
      
      <div className="speakers-list">
        {speakers.map(speaker => {
          const speakerName = getSpeakerName(speaker);
          const duration = getSpeakerDuration(speaker);
          const segmentCount = getSpeakerSegmentCount(speaker);
          const isEditing = editingSpeakerId === speaker.id;
          
          console.log('Speaker render check:', {
            speakerId: speaker.id,
            speakerName,
            editingSpeakerId,
            isEditing: isEditing
          });

          return (
            <div key={speaker.id} className="speaker-item">
              <div className="speaker-info">
                {isEditing ? (
                  <input
                    type="text"
                    value={tempSpeakerName || ''}
                    onChange={(e) => onTempNameChange(e.target.value)}
                    // onBlur={() => {
                    //   console.log('Speaker input onBlur triggered for:', speaker.id);
                    //   onSpeakerSave(speaker.id);
                    // }}
                    onKeyDown={(e) => {
                      e.stopPropagation(); // Prevent parent keyboard handlers
                      if (e.key === 'Enter') {
                        onSpeakerSave(speaker.id);
                      } else if (e.key === 'Escape') {
                        onSpeakerCancel();
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={() => {
                      console.log('Speaker input focused for:', speaker.id);
                    }}
                    className="speaker-name-input"
                    ref={inputRef}
                  />
                ) : (
                  <span 
                    className="speaker-name clickable"
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('SpeakersPanel onClick triggered:', { speakerId: speaker.id, speakerName });
                      onSpeakerEdit(speaker.id, speakerName);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      console.log('SpeakersPanel onDoubleClick triggered:', { speakerId: speaker.id, speakerName });
                      onSpeakerEdit(speaker.id, speakerName);
                    }}
                  >
                    {speakerName}
                  </span>
                )}
                
                <div className="speaker-stats">
                  {duration > 0 && (
                    <>
                      {formatDuration(duration)}
                      {segmentCount > 0 && ` • ${segmentCount} segments`}
                    </>
                  )}
                  {duration === 0 && segmentCount > 0 && (
                    `${segmentCount} segments`
                  )}
                </div>
              </div>
              
              {speaker.color && (
                <div 
                  className="speaker-color" 
                  style={{ backgroundColor: speaker.color }}
                />
              )}
            </div>
          );
        })}
        
        {speakers.length === 0 && (
          <div className="no-speakers">
            No speakers identified
          </div>
        )}
      </div>
    </div>
  );
};

export default SpeakersPanel;