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
};

const SecondaryPanel: React.FC<SecondaryPanelProps> = ({
  open,
  title = "Panel",
  onClose,
  widthPx = 320,
  children
}) => {
  return (
    <div
      className={[
        "relative h-full shrink-0 border-r border-gray-300 bg-white text-gray-900",
        "transition-all duration-300 ease-in-out",
        open ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none overflow-hidden",
      ].join(" ")}
      style={{ width: open ? widthPx : 0 }}
      aria-hidden={!open}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-gray-300 bg-white">
        <h3 className="text-base font-medium text-gray-700">{title}</h3>
        <button
          onClick={onClose}
          className="rounded p-1.5 hover:bg-gray-100 transition-colors"
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
};

export default SecondaryPanel;
