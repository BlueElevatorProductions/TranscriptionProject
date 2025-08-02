import React, { useState, memo } from 'react';

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

// Word component that doesn't re-render for highlighting
interface WordProps {
  word: any;
  onTimeSeek: (time: number) => void;
}

const Word: React.FC<WordProps> = ({ word, onTimeSeek }) => {
  const ref = React.useRef<HTMLSpanElement>(null);
  
  // Store word data on DOM element for direct access
  React.useEffect(() => {
    if (ref.current) {
      (ref.current as any).__wordData = word;
    }
  }, [word]);
  
  return (
    <span
      ref={ref}
      className="word"
      onClick={() => onTimeSeek(word.start)}
      style={{ cursor: 'pointer' }}
      title={`${word.start.toFixed(1)}s - ${word.end.toFixed(1)}s`}
    >
      {word.word}
    </span>
  );
};

const CleanTranscriptDisplay: React.FC<CleanTranscriptDisplayProps> = ({
  paragraphs,
  speakerNames,
  onSpeakerNameEdit,
  currentTime,
  onTimeSeek
}) => {
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // Debug: Log timing data for the first few words on component mount
  React.useEffect(() => {
    if (paragraphs.length > 0) {
      console.log('🔍 TRANSCRIPT TIMING DEBUG - First few words:');
      let wordCount = 0;
      const debugWords = ['art', 'believers', 'group'];
      
      for (const paragraph of paragraphs) {
        for (const segment of paragraph.segments) {
          if (segment.words) {
            for (const word of segment.words) {
              wordCount++;
              const wordText = word.word.toLowerCase().replace(/[.,!?]/g, '');
              
              // Log first 20 words or any debug words
              if (wordCount <= 20 || debugWords.includes(wordText)) {
                console.log(`Word ${wordCount}: "${word.word}" (${wordText}) -> ${word.start.toFixed(3)}s - ${word.end.toFixed(3)}s (duration: ${(word.end - word.start).toFixed(3)}s)`);
              }
              
              if (wordCount > 50 && !debugWords.includes(wordText)) break; // Don't log too many
            }
          }
        }
      }
    }
  }, [paragraphs]);
  
  // Use direct DOM manipulation instead of React re-rendering for highlighting
  React.useEffect(() => {
    if (!containerRef.current) return;
    
    // Remove all existing highlights
    const currentWords = containerRef.current.querySelectorAll('.word.current-word');
    currentWords.forEach(word => word.classList.remove('current-word'));
    
    // Debug: Log timing for specific problem words
    const debugWords = ['art', 'believers', 'group'];
    let foundAnyWord = false;
    let debugInfo = [];
    
    // Find and highlight the current word using direct DOM query
    const allWords = containerRef.current.querySelectorAll('.word');
    for (const wordElement of allWords) {
      const wordData = (wordElement as any).__wordData;
      if (wordData) {
        const wordText = wordData.word.toLowerCase().replace(/[.,!?]/g, ''); // Clean up punctuation
        
        // Debug specific words
        if (debugWords.includes(wordText)) {
          const wordDuration = wordData.end - wordData.start;
          const effectiveEnd = wordDuration <= 0 ? wordData.start + 0.1 : wordData.end;
          
          debugInfo.push({
            word: wordText,
            currentTime: (currentTime || 0).toFixed(3),
            start: wordData.start.toFixed(3),
            end: wordData.end.toFixed(3),
            effectiveEnd: effectiveEnd.toFixed(3),
            duration: wordDuration.toFixed(3),
            shouldHighlight: (currentTime || 0) >= wordData.start && (currentTime || 0) < effectiveEnd,
            timeDiff: ((currentTime || 0) - wordData.start).toFixed(3)
          });
        }
        
        // Fix zero-duration words by using a minimum duration threshold
        const wordDuration = wordData.end - wordData.start;
        const effectiveEnd = wordDuration <= 0 ? wordData.start + 0.1 : wordData.end; // Minimum 100ms duration
        
        if ((currentTime || 0) >= wordData.start && (currentTime || 0) < effectiveEnd) {
          wordElement.classList.add('current-word');
          foundAnyWord = true;
          
          // Extra logging when highlighting problem words
          if (debugWords.includes(wordText)) {
            console.log(`🎯 HIGHLIGHTING: "${wordText}" at time ${(currentTime || 0).toFixed(3)} (${wordData.start.toFixed(3)}-${effectiveEnd.toFixed(3)}) [original: ${wordData.end.toFixed(3)}]`);
          }
          break; // Only highlight one word at a time
        }
      }
    }
    
    // Log debug info for problem words every few updates
    if (debugInfo.length > 0 && Math.random() < 0.1) { // 10% sampling to reduce noise
      console.log(`📊 DEBUG WORDS at time ${(currentTime || 0).toFixed(3)}:`, debugInfo);
    }
    
    // Log when no word is highlighted but we're in the problematic range
    if (!foundAnyWord && (currentTime || 0) > 1 && (currentTime || 0) < 20) { // Rough range for the first sentences
      console.log(`⚠️  NO WORD HIGHLIGHTED at time ${(currentTime || 0).toFixed(3)}`);
    }
  }, [currentTime]);

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
    
    // Render individual words with simple inline highlighting check (Swift app approach)
    return paragraph.segments.map((segment, segmentIndex) => {
      if (!segment.words || segment.words.length === 0) {
        return <span key={segmentIndex}>{segment.text}</span>;
      }
      
      return segment.words.map((word: any, wordIndex: number) => {
        const key = `${segmentIndex}-${wordIndex}`;
        
        return (
          <span key={key}>
            <Word
              word={word}
              onTimeSeek={onTimeSeek}
            />
            {wordIndex < segment.words.length - 1 && ' '}
          </span>
        );
      });
    });
  };

  return (
    <div className="clean-transcript-display" ref={containerRef}>
      <div className="transcript-content">
        {paragraphs.map(paragraph => {
          const speakerName = speakerNames[paragraph.speakerId] || 
                            `Speaker ${paragraph.speakerId.replace('SPEAKER_', '')}`;
          const isActive = (currentTime || 0) >= paragraph.startTime && (currentTime || 0) <= paragraph.endTime;
          
          return (
            <div 
              key={paragraph.id} 
              className={`transcript-paragraph ${isActive ? 'active' : ''}`}
              onClick={() => onTimeSeek(paragraph.startTime)}
            >
              {/* Paragraph break indicator - check if any segment has paragraphBreak */}
              {paragraph.segments?.some((segment: any) => segment.paragraphBreak) && (
                <div className="paragraph-break"></div>
              )}
              
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

// Remove complex memoization - let React handle it naturally with 10fps updates
export default CleanTranscriptDisplay;