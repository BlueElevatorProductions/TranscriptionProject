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
  widthPx, // Now optional - defaults to CSS variable
  children,
  backgroundColor // Now optional - uses CSS variable
}) => {
  return (
    <div
      className={[
        "relative h-full shrink-0 border-r vibrancy-panel",
        open ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none overflow-hidden",
      ].join(" ")}
      style={{ 
        width: open ? (widthPx ? `${widthPx}px` : 'var(--secondary-panel-width)') : 0,
        position: 'relative',
        transition: 'width 300ms ease-in-out, opacity 300ms ease-in-out, transform 300ms ease-in-out, background-color 150ms ease-in-out'
      }}
      aria-hidden={!open}
    >
      {/* Panel content */}
      <div className="relative h-full flex flex-col">
        <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-glass-border-subtle">
          <h3 className="text-base font-medium text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded p-1.5 hover:bg-glass-hover transition-colors"
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
