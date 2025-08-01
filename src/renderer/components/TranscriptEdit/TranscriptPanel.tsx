import React, { useEffect, useRef, useState } from 'react';
import ContextMenu from './ContextMenu';

interface CursorPosition {
  segmentIndex: number;
  wordIndex: number;
  position: 'before' | 'after';
}

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
  editingSpeakerId?: string | null;
  tempSpeakerName?: string;
  onSpeakerEditStart?: (speakerId: string, currentName: string) => void;
  onSpeakerEditSave?: (speakerId: string) => void;
  onSpeakerEditCancel?: () => void;
  onSpeakerNameChange?: (name: string) => void;
  onWordEdit?: (segmentIndex: number, wordIndex: number, originalWord: string, newWord: string) => void;
  onWordInsert?: (segmentIndex: number, wordIndex: number, newWordText: string) => void;
  onParagraphBreak?: (breakData: {
    segmentIndex: number;
    wordIndex: number;
    position: 'before' | 'after';
    timestamp: number;
  }) => void;
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
  onAddNewSpeaker,
  editingSpeakerId,
  tempSpeakerName,
  onSpeakerEditStart,
  onSpeakerEditSave,
  onSpeakerEditCancel,
  onSpeakerNameChange,
  onWordEdit,
  onWordInsert,
  onParagraphBreak,
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

  // Word editing state
  const [editingWord, setEditingWord] = useState<{segmentIndex: number, wordIndex: number} | null>(null);
  const [tempWordText, setTempWordText] = useState('');
  const [insertingWord, setInsertingWord] = useState<{segmentIndex: number, afterWordIndex: number} | null>(null);
  const [newWordText, setNewWordText] = useState('');

  // Text cursor state
  const [cursorPosition, setCursorPosition] = useState<CursorPosition | null>(null);
  const [showCursor, setShowCursor] = useState(false);

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

  // Cursor blinking effect
  useEffect(() => {
    if (cursorPosition) {
      setShowCursor(true);
      const interval = setInterval(() => {
        setShowCursor(prev => !prev);
      }, 500);
      return () => clearInterval(interval);
    } else {
      setShowCursor(false);
    }
  }, [cursorPosition]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!cursorPosition) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          moveCursorLeft();
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveCursorRight();
          break;
        case 'ArrowUp':
          e.preventDefault();
          moveCursorUp();
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveCursorDown();
          break;
        case 'Enter':
          e.preventDefault();
          handleParagraphBreak();
          break;
        case 'Backspace':
        case 'Delete':
          e.preventDefault();
          console.log('Use double-click to edit words');
          break;
        default:
          // Disable typing - only allow word editing via double-click
          if (e.key.length === 1) {
            e.preventDefault();
            console.log('Use double-click to edit words');
          }
          break;
      }
    };

    if (cursorPosition) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [cursorPosition, segments]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cursor movement functions
  const moveCursorLeft = () => {
    if (!cursorPosition) return;
    
    const { segmentIndex, wordIndex, position } = cursorPosition;
    
    if (position === 'after') {
      // Move to before current word
      setCursorPosition({ segmentIndex, wordIndex, position: 'before' });
    } else if (wordIndex > 0) {
      // Move to after previous word
      setCursorPosition({ segmentIndex, wordIndex: wordIndex - 1, position: 'after' });
    } else if (segmentIndex > 0) {
      // Move to end of previous segment
      const prevSegment = segments[segmentIndex - 1];
      const lastWordIndex = Math.max(0, (prevSegment.words?.length || 1) - 1);
      setCursorPosition({ 
        segmentIndex: segmentIndex - 1, 
        wordIndex: lastWordIndex, 
        position: 'after' 
      });
    }
  };

  const moveCursorRight = () => {
    if (!cursorPosition) return;
    
    const { segmentIndex, wordIndex, position } = cursorPosition;
    const currentSegment = segments[segmentIndex];
    
    if (position === 'before') {
      // Move to after current word
      setCursorPosition({ segmentIndex, wordIndex, position: 'after' });
    } else if (wordIndex < (currentSegment.words?.length || 0) - 1) {
      // Move to before next word
      setCursorPosition({ segmentIndex, wordIndex: wordIndex + 1, position: 'before' });
    } else if (segmentIndex < segments.length - 1) {
      // Move to beginning of next segment
      setCursorPosition({ segmentIndex: segmentIndex + 1, wordIndex: 0, position: 'before' });
    }
  };

  const moveCursorUp = () => {
    // Move cursor to approximately same position in previous segment
    if (!cursorPosition || cursorPosition.segmentIndex === 0) return;
    
    const prevSegmentIndex = cursorPosition.segmentIndex - 1;
    const prevSegment = segments[prevSegmentIndex];
    const maxWordIndex = Math.max(0, (prevSegment.words?.length || 1) - 1);
    
    setCursorPosition({
      segmentIndex: prevSegmentIndex,
      wordIndex: Math.min(cursorPosition.wordIndex, maxWordIndex),
      position: cursorPosition.position
    });
  };

  const moveCursorDown = () => {
    // Move cursor to approximately same position in next segment
    if (!cursorPosition || cursorPosition.segmentIndex === segments.length - 1) return;
    
    const nextSegmentIndex = cursorPosition.segmentIndex + 1;
    const nextSegment = segments[nextSegmentIndex];
    const maxWordIndex = Math.max(0, (nextSegment.words?.length || 1) - 1);
    
    setCursorPosition({
      segmentIndex: nextSegmentIndex,
      wordIndex: Math.min(cursorPosition.wordIndex, maxWordIndex),
      position: cursorPosition.position
    });
  };

  const handleParagraphBreak = () => {
    if (!cursorPosition || !onParagraphBreak) return;
    
    const { segmentIndex, wordIndex, position } = cursorPosition;
    
    // Create paragraph break at cursor position
    onParagraphBreak({
      segmentIndex,
      wordIndex,
      position,
      timestamp: Date.now()
    });
  };

  const handleWordClick = (segmentIndex: number, wordIndex: number, word: any) => {
    // Set cursor position when clicking on a word
    setCursorPosition({ segmentIndex, wordIndex, position: 'before' });
    
    // Also handle audio seeking
    onWordClick(word.start);
  };

  const handleTextClick = (e: React.MouseEvent, segmentIndex: number, wordIndex: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const elementWidth = rect.width;
    
    // Determine if click was closer to start or end of word
    const position = clickX < elementWidth / 2 ? 'before' : 'after';
    
    setCursorPosition({ segmentIndex, wordIndex, position });
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

  // Word editing handlers
  const handleWordDoubleClick = (segmentIndex: number, wordIndex: number, word: any) => {
    setEditingWord({ segmentIndex, wordIndex });
    setTempWordText(word.word);
  };

  const handleWordEditSave = () => {
    if (editingWord && tempWordText.trim() && onWordEdit) {
      const originalWord = segments[editingWord.segmentIndex]?.words?.[editingWord.wordIndex]?.word;
      if (originalWord !== tempWordText.trim()) {
        onWordEdit(editingWord.segmentIndex, editingWord.wordIndex, originalWord, tempWordText.trim());
      }
    }
    setEditingWord(null);
    setTempWordText('');
  };

  const handleWordEditCancel = () => {
    setEditingWord(null);
    setTempWordText('');
  };

  const handleNewWordSave = () => {
    if (insertingWord && newWordText.trim() && onWordInsert) {
      onWordInsert(insertingWord.segmentIndex, insertingWord.afterWordIndex + 1, newWordText.trim());
    }
    setInsertingWord(null);
    setNewWordText('');
  };

  const handleNewWordCancel = () => {
    setInsertingWord(null);
    setNewWordText('');
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
      label: "New Word",
      icon: "✏️",
      action: () => {
        if (contextMenu.wordData) {
          setInsertingWord({ 
            segmentIndex: contextMenu.wordData.segmentIndex, 
            afterWordIndex: contextMenu.wordData.wordIndex 
          });
        }
      }
    },
    {
      label: "Assign Speaker",
      icon: "👤",
      isSubmenu: true,
      submenu: [
        ...(Object.entries(speakerNames || {}).map(([id, name]) => ({
          label: name,
          action: () => {
            if (contextMenu.wordData && onAddNewSpeaker) {
              const wordIndex = contextMenu.wordData.wordIndex;
              onAddNewSpeaker(wordIndex, name);
            }
          }
        }))),
        { isSeparator: true },
        {
          label: "Add New Speaker...",
          action: () => {
            if (contextMenu.wordData && onAddNewSpeaker) {
              const speakerName = prompt("Enter new speaker name:");
              if (speakerName && speakerName.trim()) {
                const wordIndex = contextMenu.wordData.wordIndex;
                onAddNewSpeaker(wordIndex, speakerName.trim());
              }
            }
          }
        }
      ]
    }
  ];

  // Calculate stats
  const totalDuration = segments.length > 0 ? segments[segments.length - 1].end : 0;
  const speakerCount = new Set(segments.map(s => s.speaker).filter(Boolean)).size;
  const wordCount = segments.reduce((count, segment) => {
    return count + (segment.words?.length || segment.text.split(' ').length);
  }, 0);

  return (
    <div className="transcript-panel" tabIndex={0}>
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
          const isEditing = editingSpeakerId === segment.speaker;

          return (
            <div
              key={segmentIndex}
              ref={isActive ? activeLineRef : null}
              className={`transcript-line ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={(e) => handleSegmentSelect(segmentIndex, e)}
            >
              {/* Paragraph break indicator */}
              {segment.paragraphBreak && (
                <div className="paragraph-break"></div>
              )}
              
              <div className="speaker-header">
                <div className="transcript-timestamp">
                  {formatTime(segment.start)}
                </div>
                <div className="transcript-speaker">
                  • {isEditing && onSpeakerEditSave ? (
                    <input
                      className="speaker-name-input-inline"
                      value={tempSpeakerName}
                      onChange={(e) => onSpeakerNameChange?.(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onSpeakerEditSave(segment.speaker);
                        if (e.key === 'Escape') onSpeakerEditCancel?.();
                      }}
                      onBlur={() => onSpeakerEditSave(segment.speaker)}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="speaker-name-clickable"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSpeakerEditStart?.(segment.speaker, speakerNames?.[segment.speaker] || '');
                      }}
                    >
                      {speakerNames?.[segment.speaker] || segment.speaker || 'Unknown'}
                    </span>
                  )}
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
                      const isEditing = editingWord?.segmentIndex === segmentIndex && 
                                       editingWord?.wordIndex === wordIndex;
                      
                      const isCurrentWord = cursorPosition?.segmentIndex === segmentIndex && 
                                           cursorPosition?.wordIndex === wordIndex;
                      
                      return (
                        <React.Fragment key={wordIndex}>
                          {/* Insert new word field if needed */}
                          {insertingWord?.segmentIndex === segmentIndex && 
                           insertingWord?.afterWordIndex === wordIndex - 1 && (
                            <input
                              type="text"
                              value={newWordText}
                              onChange={(e) => setNewWordText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleNewWordSave();
                                } else if (e.key === 'Escape') {
                                  handleNewWordCancel();
                                }
                              }}
                              onBlur={handleNewWordSave}
                              className="new-word-input"
                              placeholder="New word..."
                              autoFocus
                            />
                          )}
                          
                          {/* Word display or edit field */}
                          {isEditing ? (
                            <input
                              type="text"
                              value={tempWordText}
                              onChange={(e) => setTempWordText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleWordEditSave();
                                } else if (e.key === 'Escape') {
                                  handleWordEditCancel();
                                }
                              }}
                              onBlur={handleWordEditSave}
                              className="word-edit-input"
                              autoFocus
                            />
                          ) : (
                            <span
                              className={`word ${isCurrent ? 'current' : ''} ${isCurrentWord ? 'cursor-active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTextClick(e, segmentIndex, wordIndex);
                                handleWordClick(segmentIndex, wordIndex, word);
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleWordDoubleClick(segmentIndex, wordIndex, word);
                              }}
                              onContextMenu={(e) => handleWordRightClick(e, word, globalWordIndex, segmentIndex)}
                              title={`${word.start.toFixed(1)}s - ${word.end.toFixed(1)}s | Double-click to edit, right-click for options`}
                            >
                              {/* Cursor before word */}
                              {isCurrentWord && cursorPosition?.position === 'before' && (
                                <span className={`text-cursor ${showCursor ? 'visible' : 'hidden'}`}>|</span>
                              )}
                              
                              {word.word}
                              
                              {/* Cursor after word */}
                              {isCurrentWord && cursorPosition?.position === 'after' && (
                                <span className={`text-cursor ${showCursor ? 'visible' : 'hidden'}`}>|</span>
                              )}
                            </span>
                          )}
                          
                          {/* Add space after word if not editing and not last word */}
                          {!isEditing && wordIndex < segment.words.length - 1 && ' '}
                        </React.Fragment>
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