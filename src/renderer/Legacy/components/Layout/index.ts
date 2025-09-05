/**
 * Layout Components Index
 * 
 * Exports all layout components for the new Google Docs-inspired interface
 */

export { default as MainLayout } from './MainLayout';
export { default as HeaderRegion } from './HeaderRegion';
export { default as TranscriptRegion } from './TranscriptRegion';
export { default as PanelsRegion } from './PanelsRegion';
export { default as AudioRegion } from './AudioRegion';

// Types
export type { MainLayoutProps, LayoutState } from './MainLayout';
export type { HeaderRegionProps, AppMode, AudioSliderType } from './HeaderRegion';
export type { TranscriptRegionProps } from './TranscriptRegion';
export type { PanelsRegionProps } from './PanelsRegion';
export type { AudioRegionProps } from './AudioRegion';