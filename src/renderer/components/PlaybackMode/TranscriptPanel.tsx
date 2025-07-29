import React, { useEffect, useRef, useState } from 'react';
import ContextMenu from './ContextMenu';

interface TranscriptPanelProps {
  segments: any[];
  currentTime: number;
  currentWordIndex: number;
  onWordClick: (timestamp: number) => void;
  selectedSegments: number[];
  onSegmentSelect: (segments: number[]) => void;
  speakerNames?: { [key: string]: string };
  selectedClipId?: string | null;
  onSelectClip?: (clipId: string) => void;
  onCreateNewClip?: (wordIndex: number) => boolean;
  onAddNewSpeaker?: (wordIndex: number, speakerName: string) => boolean;
}

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  segments,
  currentTime,
  currentWordIndex,
  onWordClick,
  selectedSegments,
  onSegmentSelect,
  speakerNames,
  selectedClipId,
  onSelectClip,
  onCreateNewClip,
  onAddNewSpeaker
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    wordData: null as any
  });

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const activeLine = activeLineRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeLine.getBoundingClientRect();
      
      if (activeRect.top < containerRect.top || activeRect.bottom > containerRect.bottom) {
        activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentTime]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isLineActive = (segment: any): boolean => {
    return currentTime >= segment.start && currentTime <= segment.end;
  };

  const handleLineClick = (segment: any) => {
    onWordClick(segment.start);
  };

  const handleSegmentSelect = (segmentIndex: number, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Multi-select
      const newSelection = selectedSegments.includes(segmentIndex)
        ? selectedSegments.filter(i => i !== segmentIndex)
        : [...selectedSegments, segmentIndex];
      onSegmentSelect(newSelection);
    } else {
      // Single select
      onSegmentSelect([segmentIndex]);
    }
  };

  // Context menu handlers
  const handleWordRightClick = (
    event: React.MouseEvent, 
    word: any, 
    wordIndex: number, 
    segmentIndex: number
  ) => {
    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      wordData: {
        word,
        wordIndex,
        segmentIndex,
        timestamp: word.start || segments[segmentIndex].start
      }
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      wordData: null
    });
  };

  // Context menu actions
  const contextMenuItems = [
    {
      label: "Select Clip",
      icon: "🎯",
      action: () => {
        if (contextMenu.wordData && onSelectClip) {
          // Generate clip ID based on segment index for now
          const clipId = `clip-${contextMenu.wordData.segmentIndex}`;
          onSelectClip(clipId);
          
          // Visual highlight for the selected clip
          const currentLine = document.querySelector(`.transcript-line:nth-child(${contextMenu.wordData.segmentIndex + 1})`);
          if (currentLine) {
            // Remove previous selections
            document.querySelectorAll('.transcript-line.clip-selected').forEach(el => {
              el.classList.remove('clip-selected');
            });
            
            // Add selection styling
            currentLine.classList.add('clip-selected');
            
            // Select all text in the clip for copying
            const transcriptText = currentLine.querySelector('.transcript-text');
            if (transcriptText) {
              const range = document.createRange();
              const selection = window.getSelection();
              range.selectNodeContents(transcriptText);
              selection?.removeAllRanges();
              selection?.addRange(range);
            }
          }
        }
      }
    },
    {
      label: "Create New Clip",
      icon: "📄",
      action: () => {
        if (contextMenu.wordData && onCreateNewClip) {
          const wordIndex = contextMenu.wordData.wordIndex;
          const success = onCreateNewClip(wordIndex);
          
          if (success) {
            console.log(`Created new clip at word index ${wordIndex}`);
            // Force re-render by updating a state that causes segments to re-process
            // The clips will automatically update due to the useMemo dependency on segments
          } else {
            console.log(`Failed to create clip at word index ${wordIndex}`);
          }
        }
      }
    },
    {
      label: "Add New Speaker Label",
      icon: "👤",
      action: () => {
        if (contextMenu.wordData && onAddNewSpeaker) {
          // For now, prompt with a simple prompt
          const speakerName = prompt("Enter new speaker name:");
          if (speakerName && speakerName.trim()) {
            const wordIndex = contextMenu.wordData.wordIndex;
            const success = onAddNewSpeaker(wordIndex, speakerName.trim());
            
            if (success) {
              console.log(`Added new speaker "${speakerName.trim()}" at word index ${wordIndex}`);
            } else {
              console.log(`Failed to add speaker "${speakerName.trim()}" at word index ${wordIndex}`);
            }
          }
        }
      }
    }
  ];

  // Calculate stats
  const totalDuration = segments.length > 0 ? segments[segments.length - 1].end : 0;
  const speakerCount = new Set(segments.map(s => s.speaker).filter(Boolean)).size;
  const wordCount = segments.reduce((count, segment) => {
    return count + (segment.words?.length || segment.text.split(' ').length);
  }, 0);

  return (
    <div className="transcript-panel">
      <div className="transcript-header">
        <div className="transcript-stats">
          <span>
            <span>⏱️</span>
            {formatTime(totalDuration)}
          </span>
          <span>
            <span>👥</span>
            {speakerCount} speakers
          </span>
          <span>
            <span>📝</span>
            {wordCount} words
          </span>
          <span>
            <span>🎯</span>
            {segments.length} segments
          </span>
        </div>
      </div>
      
      <div className="transcript-content" ref={containerRef}>
        {segments.map((segment, segmentIndex) => {
          const isActive = isLineActive(segment);
          const isSelected = selectedSegments.includes(segmentIndex);
          
          return (
            <div
              key={segmentIndex}
              ref={isActive ? activeLineRef : null}
              className={`transcript-line ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={(e) => handleSegmentSelect(segmentIndex, e)}
            >
              <div className="speaker-header">
                <div className="transcript-timestamp">
                  {formatTime(segment.start)}
                </div>
                <div className="transcript-speaker">
                  • {speakerNames?.[segment.speaker] || segment.speaker || 'Unknown'}
                </div>
              </div>
              
              <div className="transcript-text">
                {segment.words ? (
                  // Render word-by-word if available
                  (() => {
                    let runningWordIndex = 0;
                    // Calculate the starting index for this segment
                    for (let i = 0; i < segmentIndex; i++) {
                      if (segments[i].words) {
                        runningWordIndex += segments[i].words.length;
                      } else {
                        runningWordIndex += 1;
                      }
                    }
                    
                    return segment.words.map((word: any, wordIndex: number) => {
                      const globalWordIndex = runningWordIndex + wordIndex;
                      const isCurrent = currentWordIndex === globalWordIndex;
                      
                      return (
                        <span
                          key={wordIndex}
                          className={`word ${isCurrent ? 'current' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onWordClick(word.start);
                          }}
                          onContextMenu={(e) => handleWordRightClick(e, word, globalWordIndex, segmentIndex)}
                          title={`${word.start.toFixed(1)}s - ${word.end.toFixed(1)}s`}
                        >
                          {word.word}
                          {wordIndex < segment.words.length - 1 ? ' ' : ''}
                        </span>
                      );
                    });
                  })()
                ) : (
                  // Fallback to full text if no word-level data
                  <span 
                    className="word"
                    onClick={(e) => {
                      e.stopPropagation();
                      onWordClick(segment.start);
                    }}
                    onContextMenu={(e) => handleWordRightClick(e, { word: segment.text, start: segment.start }, 0, segmentIndex)}
                  >
                    {segment.text}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        
        {segments.length === 0 && (
          <div className="loading">
            No transcript data available
          </div>
        )}
      </div>
      
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        items={contextMenuItems}
        onClose={handleContextMenuClose}
        visible={contextMenu.visible}
      />
    </div>
  );
};

export default TranscriptPanel;