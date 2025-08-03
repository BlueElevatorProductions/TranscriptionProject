/**
 * NewLayoutView.tsx - Test view for the new Google Docs-inspired layout
 * 
 * This view demonstrates the new layout system and can be toggled
 * alongside the existing interface for comparison during development.
 */

import React, { useState, useCallback, useRef } from 'react';
import { MainLayout } from '../components/Layout';
import { useLayoutKeyboard } from '../hooks/useLayoutKeyboard';
import type { AppMode, AudioSliderType } from '../components/Layout/HeaderRegion';

export interface NewLayoutViewProps {
  onBack?: () => void;
}

const NewLayoutView: React.FC<NewLayoutViewProps> = ({ onBack }) => {
  // Only manage mode state here - let MainLayout handle panel state
  const [currentMode, setCurrentMode] = useState<AppMode>('listen');
  
  // Reference to MainLayout's control functions
  const layoutControlsRef = useRef<{
    togglePanels: () => void;
    toggleAudioSlider: (type?: AudioSliderType) => void;
  } | null>(null);

  const handleModeChange = useCallback((mode: AppMode) => {
    setCurrentMode(mode);
    console.log(`Switched to ${mode} mode`);
  }, []);

  const handleLayoutReady = useCallback((controls: {
    togglePanels: () => void;
    toggleAudioSlider: (type?: AudioSliderType) => void;
  }) => {
    layoutControlsRef.current = controls;
  }, []);

  // Keyboard shortcuts - use refs to access MainLayout's functions
  useLayoutKeyboard({
    onTogglePanels: () => layoutControlsRef.current?.togglePanels(),
    onTogglePlayer: () => layoutControlsRef.current?.toggleAudioSlider('player'),
    onToggleEditor: () => layoutControlsRef.current?.toggleAudioSlider('editor'),
    onSwitchToListen: () => handleModeChange('listen'),
    onSwitchToEdit: () => handleModeChange('edit'),
  });

  return (
    <div 
      className="new-layout-wrapper"
      style={{ 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
        background: '#a8d5e5', /* Light cyan background for border area */
        overflowX: 'auto', /* Allow horizontal scroll when content exceeds viewport */
        overflowY: 'hidden'
      }}>
      {/* Optional back button for testing - positioned to not overlap tabs */}
      {onBack && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
        }}>
          <button
            onClick={onBack}
            style={{
              background: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '12px',
            }}
          >
            ← Back to Current UI
          </button>
        </div>
      )}

      {/* Status indicator */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '12px',
        zIndex: 1000,
        fontFamily: 'monospace',
      }}>
        Mode: {currentMode} | Layout: Managed by MainLayout
      </div>


      {/* Main Layout */}
      <MainLayout
        legacyMode={false}
        currentMode={currentMode}
        onModeChange={handleModeChange}
        onLayoutReady={handleLayoutReady}
      />
    </div>
  );
};

export default NewLayoutView;