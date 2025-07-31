import React, { useState } from 'react';

interface Paragraph {
  id: string;
  speakerId: string;
  startTime: number;
  endTime: number;
  text: string;
  segments: any[];
}

interface CleanTranscriptDisplayProps {
  paragraphs: Paragraph[];
  speakerNames: { [key: string]: string };
  onSpeakerNameEdit: (speakerId: string, newName: string) => void;
  currentTime: number;
  onTimeSeek: (time: number) => void;
}

const CleanTranscriptDisplay: React.FC<CleanTranscriptDisplayProps> = ({
  paragraphs,
  speakerNames,
  onSpeakerNameEdit,
  currentTime,
  onTimeSeek
}) => {
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  const handleSpeakerClick = (speakerId: string, currentName: string) => {
    setEditingSpeaker(speakerId);
    setTempName(currentName);
  };

  const handleSpeakerSave = (speakerId: string) => {
    if (tempName.trim()) {
      onSpeakerNameEdit(speakerId, tempName.trim());
    }
    setEditingSpeaker(null);
    setTempName('');
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderWordsWithHighlighting = (paragraph: Paragraph) => {
    // Check if we have word-level data in the segments
    const hasWordData = paragraph.segments.some(segment => segment.words && segment.words.length > 0);
    
    if (!hasWordData) {
      // Fallback to paragraph text if no word data
      return paragraph.text;
    }
    
    // Render individual words with highlighting
    return paragraph.segments.map((segment, segmentIndex) => {
      if (!segment.words || segment.words.length === 0) {
        return <span key={segmentIndex}>{segment.text}</span>;
      }
      
      return segment.words.map((word: any, wordIndex: number) => {
        const isCurrentWord = currentTime >= word.start && currentTime <= word.end;
        const key = `${segmentIndex}-${wordIndex}`;
        
        return (
          <span key={key}>
            <span
              className={`word ${isCurrentWord ? 'current-word' : ''}`}
              onClick={() => onTimeSeek(word.start)}
              style={{ cursor: 'pointer' }}
              title={`${word.start.toFixed(1)}s - ${word.end.toFixed(1)}s`}
            >
              {word.word}
            </span>
            {wordIndex < segment.words.length - 1 && ' '}
          </span>
        );
      });
    });
  };

  return (
    <div className="clean-transcript-display">
      <div className="transcript-content">
        {paragraphs.map(paragraph => {
          const speakerName = speakerNames[paragraph.speakerId] || 
                            `Speaker ${paragraph.speakerId.replace('SPEAKER_', '')}`;
          const isActive = currentTime >= paragraph.startTime && currentTime <= paragraph.endTime;
          
          return (
            <div 
              key={paragraph.id} 
              className={`transcript-paragraph ${isActive ? 'active' : ''}`}
              onClick={() => onTimeSeek(paragraph.startTime)}
            >
              <div className="paragraph-header">
                {editingSpeaker === paragraph.speakerId ? (
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={() => handleSpeakerSave(paragraph.speakerId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSpeakerSave(paragraph.speakerId);
                      } else if (e.key === 'Escape') {
                        setEditingSpeaker(null);
                      }
                    }}
                    className="speaker-name-input"
                    autoFocus
                  />
                ) : (
                  <span 
                    className="speaker-name clickable"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpeakerClick(paragraph.speakerId, speakerName);
                    }}
                  >
                    {speakerName}
                  </span>
                )}
                <span className="paragraph-timestamp">
                  {formatTime(paragraph.startTime)}
                </span>
              </div>
              
              <div className="paragraph-text">
                {renderWordsWithHighlighting(paragraph)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CleanTranscriptDisplay;