import { Users, Scissors, Type, Info } from 'lucide-react';
import { ComponentType } from 'react';
import SpeakersPanel from '../components/shared/SpeakersPanel';
import ClipsPanel from '../components/shared/ClipsPanel';
import FontsPanel from '../components/shared/FontsPanel';
import InfoPanel from '../components/shared/InfoPanel';

export interface PanelConfig {
  id: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType<any>;
  defaultOrder: number;
  minHeight?: number;
  maxHeight?: number;
  defaultHeight?: number;
  resizable?: boolean;
  collapsible?: boolean;
}

export const PANEL_CONFIGS: Record<string, PanelConfig> = {
  speakers: {
    id: 'speakers',
    title: 'Speakers',
    icon: Users,
    component: SpeakersPanel,
    defaultOrder: 1,
    minHeight: 200,
    resizable: true,
    collapsible: true
  },
  clips: {
    id: 'clips',
    title: 'Clips',
    icon: Scissors,
    component: ClipsPanel,
    defaultOrder: 2,
    minHeight: 200,
    resizable: true,
    collapsible: true
  },
  fonts: {
    id: 'fonts',
    title: 'Fonts',
    icon: Type,
    component: FontsPanel,
    defaultOrder: 3,
    minHeight: 300,
    resizable: true,
    collapsible: true
  },
  info: {
    id: 'info',
    title: 'Project Info',
    icon: Info,
    component: InfoPanel,
    defaultOrder: 4,
    minHeight: 250,
    resizable: true,
    collapsible: true
  }
};

export const getPanelConfig = (panelId: string): PanelConfig | undefined => {
  return PANEL_CONFIGS[panelId];
};

export const getVisiblePanels = (panelStates: Record<string, boolean>): PanelConfig[] => {
  return Object.entries(panelStates)
    .filter(([_, isVisible]) => isVisible)
    .map(([panelId]) => PANEL_CONFIGS[panelId])
    .filter(Boolean)
    .sort((a, b) => a.defaultOrder - b.defaultOrder);
};