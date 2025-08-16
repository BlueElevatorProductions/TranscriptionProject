import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { Button } from '../ui/button';
import { getVisiblePanels, PanelConfig } from '../../config/panelConfig';
import './PanelContainer.css';

interface PanelContainerProps {
  panelStates: Record<string, boolean>;
  onTogglePanel: (panelId: string) => void;
  panelProps: Record<string, any>;
  sidebarWidth?: number;
}

interface PanelWrapperProps {
  config: PanelConfig;
  onClose: () => void;
  children: React.ReactNode;
  isLast: boolean;
}

const PanelWrapper: React.FC<PanelWrapperProps> = ({ 
  config, 
  onClose, 
  children, 
  isLast 
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const Icon = config.icon;

  return (
    <div className={`panel-wrapper ${isCollapsed ? 'collapsed' : ''} ${isLast ? 'last' : ''}`}>
      <div className="panel-header">
        <button 
          className="panel-header-title"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="panel-header-left">
            {config.collapsible && (
              isCollapsed ? 
                <ChevronRight className="h-3 w-3" /> : 
                <ChevronDown className="h-3 w-3" />
            )}
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="panel-title">{config.title}</span>
          </div>
        </button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="panel-close-btn"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      
      {!isCollapsed && (
        <div 
          className="panel-content"
          style={{ 
            minHeight: config.minHeight ? `${config.minHeight}px` : undefined,
            maxHeight: config.maxHeight ? `${config.maxHeight}px` : undefined
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

const PanelContainer: React.FC<PanelContainerProps> = ({
  panelStates,
  onTogglePanel,
  panelProps,
  sidebarWidth = 320
}) => {
  // Memoize visible panels to prevent infinite re-renders
  const visiblePanels = useMemo(() => {
    return getVisiblePanels(panelStates);
  }, [panelStates]);
  
  // Remove problematic height calculation that was causing infinite loops

  if (visiblePanels.length === 0) {
    return (
      <div className="panel-container empty" style={{ width: `${sidebarWidth}px` }}>
        <div className="no-panels">
          <p className="text-sm text-muted-foreground">No panels visible</p>
          <p className="text-xs text-muted-foreground mt-1">
            Use the menu to add panels
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-container" style={{ width: `${sidebarWidth}px` }}>
      {visiblePanels.map((panelConfig, index) => {
        const Component = panelConfig.component;
        const props = panelProps[panelConfig.id] || {};
        const isLast = index === visiblePanels.length - 1;
        
        return (
          <PanelWrapper
            key={panelConfig.id}
            config={panelConfig}
            onClose={() => onTogglePanel(panelConfig.id)}
            isLast={isLast}
          >
            <Component {...props} />
          </PanelWrapper>
        );
      })}
    </div>
  );
};

export default PanelContainer;