/**
 * MainLayout.tsx - New Google Docs-inspired layout with 4 regions
 * 
 * Layout Structure:
 * ┌─────────────────────────────────────────┐
 * │              HeaderRegion               │
 * ├─────────────────────────┬───────────────┤
 * │                         │               │
 * │    TranscriptRegion     │ PanelsRegion  │
 * │                         │               │
 * ├─────────────────────────┴───────────────┤
 * │              AudioRegion                │
 * └─────────────────────────────────────────┘
 */

import React, { useState, useCallback } from 'react';
import './MainLayout.css';

// Region components
import HeaderRegion from './HeaderRegion';
import TranscriptRegion from './TranscriptRegion';
import PanelsRegion from './PanelsRegion';
import AudioRegion from './AudioRegion';

export interface LayoutState {
  panelsVisible: boolean;
  audioSliderVisible: boolean;
  activeAudioSlider: 'player' | 'editor' | null;
  panelsWidth: number;
  audioHeight: number;
}

export interface MainLayoutProps {
  children?: React.ReactNode;
  // Optional props for gradual migration
  legacyMode?: boolean;
  // Mode state
  currentMode?: 'listen' | 'edit';
  onModeChange?: (mode: 'listen' | 'edit') => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ 
  children, 
  legacyMode = false,
  currentMode = 'listen',
  onModeChange
}) => {
  // Layout state
  const [layoutState, setLayoutState] = useState<LayoutState>({
    panelsVisible: true,
    audioSliderVisible: true,
    activeAudioSlider: 'player',
    panelsWidth: 300,
    audioHeight: 120,
  });

  // Layout control handlers
  const togglePanels = useCallback(() => {
    setLayoutState(prev => ({
      ...prev,
      panelsVisible: !prev.panelsVisible
    }));
  }, []);

  const toggleAudioSlider = useCallback((type?: 'player' | 'editor') => {
    setLayoutState(prev => {
      if (type && prev.activeAudioSlider === type) {
        // If clicking the same slider, close it
        return {
          ...prev,
          audioSliderVisible: false,
          activeAudioSlider: null
        };
      } else if (type) {
        // Switch to new slider type
        return {
          ...prev,
          audioSliderVisible: true,
          activeAudioSlider: type
        };
      } else {
        // Toggle current slider
        return {
          ...prev,
          audioSliderVisible: !prev.audioSliderVisible
        };
      }
    });
  }, []);

  const updatePanelsWidth = useCallback((width: number) => {
    setLayoutState(prev => ({
      ...prev,
      panelsWidth: Math.max(250, Math.min(500, width))
    }));
  }, []);

  const updateAudioHeight = useCallback((height: number) => {
    setLayoutState(prev => ({
      ...prev,
      audioHeight: Math.max(80, Math.min(300, height))
    }));
  }, []);

  // If in legacy mode, render children as-is for backwards compatibility
  if (legacyMode) {
    return <div className="legacy-layout">{children}</div>;
  }

  // CSS custom properties for dynamic layout
  const layoutStyles = {
    '--panels-width': layoutState.panelsVisible ? `${layoutState.panelsWidth}px` : '0px',
    '--audio-height': layoutState.audioSliderVisible ? `${layoutState.audioHeight}px` : '0px',
  } as React.CSSProperties;

  return (
    <div 
      className="main-layout" 
      style={layoutStyles}
      data-panels-visible={layoutState.panelsVisible}
      data-audio-visible={layoutState.audioSliderVisible}
    >
      {/* Header Region - Mode tabs + Toolbar */}
      <HeaderRegion
        onTogglePanels={togglePanels}
        onToggleAudioSlider={toggleAudioSlider}
        panelsVisible={layoutState.panelsVisible}
        audioSliderVisible={layoutState.audioSliderVisible}
        activeAudioSlider={layoutState.activeAudioSlider}
        currentMode={currentMode}
        onModeChange={onModeChange}
      />

      {/* Transcript Region - Central content area */}
      <TranscriptRegion 
        panelsVisible={layoutState.panelsVisible}
        onTogglePanels={togglePanels}
        currentMode={currentMode}
      />

      {/* Panels Region - Right sliding panels */}
      <PanelsRegion
        visible={layoutState.panelsVisible}
        width={layoutState.panelsWidth}
        onWidthChange={updatePanelsWidth}
        onClose={() => setLayoutState(prev => ({ ...prev, panelsVisible: false }))}
      />

      {/* Audio Region - Bottom audio sliders */}
      <AudioRegion
        visible={layoutState.audioSliderVisible}
        activeSlider={layoutState.activeAudioSlider}
        height={layoutState.audioHeight}
        onHeightChange={updateAudioHeight}
        onSliderChange={toggleAudioSlider}
      />
    </div>
  );
};

export default MainLayout;