import React from "react";
import { X } from "lucide-react";

/**
 * SecondaryPanel
 * Slide-in working panel that appears to the right of the left sidebar.
 * - Fixed width desktop (e.g., 320px). On small screens it overlays.
 * - Uses Tailwind transitions; no external deps.
 */
export type SecondaryPanelProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  widthPx?: number;
  children?: React.ReactNode;
  backgroundColor?: string;
};

const SecondaryPanel: React.FC<SecondaryPanelProps> = ({
  open,
  title = "Panel",
  onClose,
  widthPx = 320,
  children,
  backgroundColor = '#003223'
}) => {
  return (
    <div
      className={[
        "relative h-full shrink-0 border-r border-white border-opacity-20",
        open ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none overflow-hidden",
      ].join(" ")}
      style={{ 
        width: open ? widthPx : 0,
        backgroundColor: backgroundColor,
        position: 'relative',
        transition: 'width 300ms ease-in-out, opacity 300ms ease-in-out, transform 300ms ease-in-out, background-color 150ms ease-in-out'
      }}
      aria-hidden={!open}
    >
      {/* White overlay with 28% opacity for better text readability */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.28)',
          zIndex: 0
        }}
      />
      
      {/* Content with higher z-index to be above overlay */}
      <div className="relative z-10 h-full flex flex-col">
        <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-white border-opacity-20">
          <h3 className="text-base font-medium text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded p-1.5 hover:bg-white hover:bg-opacity-10 transition-colors"
            aria-label="Close panel"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
        <div className="p-4 text-white flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default SecondaryPanel;
