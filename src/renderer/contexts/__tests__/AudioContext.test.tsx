/**
 * AudioContext Tests
 * Basic test suite for the AudioContext provider and hooks
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { AudioProvider, useAudio } from '../AudioContext';

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AudioProvider>{children}</AudioProvider>
);

describe('AudioContext', () => {
  it('provides correct initial state', () => {
    const { result } = renderHook(() => useAudio(), {
      wrapper: TestWrapper,
    });

    expect(result.current.state.currentTime).toBe(0);
    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.state.volume).toBe(0.7);
    expect(result.current.state.playbackSpeed).toBe(1.0);
    expect(result.current.state.currentAudioPath).toBe(null);
    expect(result.current.state.duration).toBe(0);
    expect(result.current.state.isReady).toBe(false);
  });

  it('updates audio state correctly', () => {
    const { result } = renderHook(() => useAudio(), {
      wrapper: TestWrapper,
    });

    act(() => {
      result.current.actions.updateAudioState({
        currentTime: 30,
        isPlaying: true,
        volume: 0.5,
      });
    });

    expect(result.current.state.currentTime).toBe(30);
    expect(result.current.state.isPlaying).toBe(true);
    expect(result.current.state.volume).toBe(0.5);
    expect(result.current.state.playbackSpeed).toBe(1.0); // Unchanged
  });

  it('validates audio state updates', () => {
    const { result } = renderHook(() => useAudio(), {
      wrapper: TestWrapper,
    });

    act(() => {
      result.current.actions.updateAudioState({
        // @ts-ignore - Testing invalid values
        currentTime: NaN,
        isPlaying: 'invalid',
        volume: 2.0, // Should be clamped to 1.0
        playbackSpeed: -1, // Should be clamped to 0.1
      });
    });

    expect(result.current.state.currentTime).toBe(0); // NaN should fallback to previous
    expect(result.current.state.isPlaying).toBe(false); // Invalid should fallback to false
    expect(result.current.state.volume).toBe(1.0); // Should be clamped
    expect(result.current.state.playbackSpeed).toBe(0.1); // Should be clamped
  });

  it('sets audio source correctly', () => {
    const { result } = renderHook(() => useAudio(), {
      wrapper: TestWrapper,
    });

    act(() => {
      result.current.actions.setAudioSource('/path/to/audio.mp3', 120);
    });

    expect(result.current.state.currentAudioPath).toBe('/path/to/audio.mp3');
    expect(result.current.state.duration).toBe(120);
    expect(result.current.state.currentTime).toBe(0); // Reset to 0
    expect(result.current.state.isPlaying).toBe(false); // Reset to false
  });

  it('provides convenience action methods', () => {
    const { result } = renderHook(() => useAudio(), {
      wrapper: TestWrapper,
    });

    // Test play action
    act(() => {
      result.current.actions.play();
    });
    expect(result.current.state.isPlaying).toBe(true);

    // Test pause action
    act(() => {
      result.current.actions.pause();
    });
    expect(result.current.state.isPlaying).toBe(false);

    // Test seek action
    act(() => {
      result.current.actions.seek(45);
    });
    expect(result.current.state.currentTime).toBe(45);
  });

  it('resets audio state correctly', () => {
    const { result } = renderHook(() => useAudio(), {
      wrapper: TestWrapper,
    });

    // Set some state first
    act(() => {
      result.current.actions.updateAudioState({
        currentTime: 30,
        isPlaying: true,
        volume: 0.5,
        playbackSpeed: 1.5,
      });
      result.current.actions.setAudioSource('/path/to/audio.mp3', 120);
    });

    // Reset
    act(() => {
      result.current.actions.resetAudio();
    });

    expect(result.current.state.currentTime).toBe(0);
    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.state.currentAudioPath).toBe(null);
    expect(result.current.state.duration).toBe(0);
    expect(result.current.state.isReady).toBe(false);
    
    // Volume and playback speed should be preserved
    expect(result.current.state.volume).toBe(0.5);
    expect(result.current.state.playbackSpeed).toBe(1.5);
  });

  it('throws error when used outside provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      renderHook(() => useAudio());
    }).toThrow('useAudio must be used within an AudioProvider');
    
    consoleSpy.mockRestore();
  });
});