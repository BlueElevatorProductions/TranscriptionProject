/**
 * TranscriptRegion.tsx - Central transcript container
 * 
 * This component serves as the main content area where the unified transcript
 * will be displayed. For now, it's a placeholder that will house the future
 * UnifiedTranscript component from Phase 4.
 */

import React from 'react';
import './TranscriptRegion.css';

export interface TranscriptRegionProps {
  children?: React.ReactNode;
  // Future props for transcript data
  transcriptData?: any;
  currentMode?: 'listen' | 'edit';
  onWordClick?: (wordId: string) => void;
  onTextSelect?: (selection: string) => void;
  // Panel controls
  panelsVisible?: boolean;
  onTogglePanels?: () => void;
}

const TranscriptRegion: React.FC<TranscriptRegionProps> = ({
  children,
  transcriptData,
  currentMode = 'listen',
  onWordClick,
  onTextSelect,
  panelsVisible = true,
  onTogglePanels
}) => {
  // Formatting toolbar
  const renderToolbar = () => {
    if (currentMode !== 'edit') return null;
    
    return (
      <div className="floating-toolbar">
        <button className="toolbar-btn" title="Highlight">🖍️</button>
        <button className="toolbar-btn" title="Bold">𝐁</button>
        <button className="toolbar-btn" title="Italic">𝐼</button>
        <button className="toolbar-btn" title="Underline">U̲</button>
        <button className="toolbar-btn" title="Strikethrough">S̶</button>
      </div>
    );
  };

  // Placeholder content for development
  const renderPlaceholderContent = () => (
    <div className="transcript-placeholder">
      <div className="transcript-header">
        <h1 className="transcript-title">Guest Name Interview</h1>
        <div className="transcript-divider" />
        {renderToolbar()}
      </div>
      
      <div className="transcript-content">
        <div className="transcript-segment">
          <div className="speaker-label">Host:</div>
          <div className="transcript-text">
            This document serves as a demonstration of placeholder text. Its primary purpose is to occupy space and 
            provide a visual representation of how a complete document might appear, even when the actual content is 
            not yet available. This allows for the assessment of layout, formatting, and overall document structure 
            before the final text is inserted. It is designed to be easily identifiable as non-substantive content, ensuring 
            that readers understand its temporary nature.
          </div>
        </div>

        <div className="transcript-segment">
          <div className="speaker-label">Guest:</div>
          <div className="transcript-text">
            The use of placeholder text is a common practice in design and development workflows. It helps in 
            visualizing the flow and density of text within a given area without the distraction of meaningful content. 
            <span className="highlighted-text">This particular placeholder text is crafted to fill two paragraphs</span>, aligning with the user's specific 
            requirement for a generated text of that approximate length, and so forth. This document serves as a 
            demonstration of placeholder text. Its primary purpose is to occupy space and provide a visual 
            representation of how a complete document might appear, even when the actual content is not yet available. 
            This allows for the assessment of layout, formatting, and overall document structure before the final text is 
            inserted. It is designed to be easily identifiable as non-substantive content, ensuring that readers understand 
            its temporary nature.
          </div>
        </div>

        <div className="transcript-segment">
          <div className="speaker-label">Host:</div>
          <div className="transcript-text">
            The use of placeholder text is a common practice in design and development workflows. It helps in 
            visualizing the flow and density of text within a given area without the distraction of meaningful content. 
            This particular placeholder text is crafted to fill two paragraphs, aligning with the user's specific 
            requirement for a generated text of that approximate length, and so forth.
          </div>
        </div>

        <div className="transcript-segment">
          <div className="speaker-label">Guest:</div>
          <div className="transcript-text">
            An additional paragraph has been included to meet the revised length requirements. This further expands 
            the visual volume of the document, allowing for a more comprehensive evaluation of how text will 
            ultimately fill the designated space. It continues to maintain the non-substantive nature of placeholder 
            content, ensuring its temporary status is clearly understood.
          </div>
        </div>
      </div>

      <div className="transcript-footer">
        <div className="mode-indicator">
          Current Mode: <span className="mode-badge">{currentMode}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div 
      className="transcript-region"
      data-mode={currentMode}
      role="main"
      aria-label="Transcript content"
    >
      <div className="transcript-container">
        <div className="transcript-scroll">
          {children || renderPlaceholderContent()}
        </div>
      </div>

      {/* Panels Toggle Button - Right Side */}
      {onTogglePanels && (
        <button
          className={`panels-toggle-btn ${panelsVisible ? 'active' : ''}`}
          onClick={onTogglePanels}
          title={panelsVisible ? 'Hide Panels' : 'Show Panels'}
          aria-label={panelsVisible ? 'Hide panels' : 'Show panels'}
        >
          {panelsVisible ? '‹' : '›'}
        </button>
      )}

      {/* Scroll indicators for better UX */}
      <div className="scroll-indicator top" aria-hidden="true" />
      <div className="scroll-indicator bottom" aria-hidden="true" />
    </div>
  );
};

export default TranscriptRegion;