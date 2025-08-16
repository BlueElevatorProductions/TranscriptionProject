import React, { useEffect, useRef, useState } from 'react';

interface ContextMenuItem {
  label: string;
  action?: () => void;
  icon?: string;
  disabled?: boolean;
  isSubmenu?: boolean;
  submenu?: ContextMenuItem[];
  isSeparator?: boolean;
  className?: string;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  visible: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  items,
  onClose,
  visible
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [visible, onClose]);

  useEffect(() => {
    // Adjust position if menu would go off-screen
    if (visible && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };

      let adjustedX = x;
      let adjustedY = y;

      // Adjust horizontal position
      if (x + rect.width > viewport.width) {
        adjustedX = x - rect.width;
      }

      // Adjust vertical position
      if (y + rect.height > viewport.height) {
        adjustedY = y - rect.height;
      }

      menu.style.left = `${adjustedX}px`;
      menu.style.top = `${adjustedY}px`;
    }
  }, [visible, x, y]);

  if (!visible) return null;

  const handleItemClick = (item: ContextMenuItem) => {
    if (!item.disabled && item.action) {
      item.action();
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000
      }}
      onMouseLeave={() => setOpenSubmenu(null)}
    >
      {items.map((item, index) => {
        if (item.isSeparator) {
          return <div key={index} className="context-menu-separator" />;
        }
        
        return (
          <div
            key={index}
            className={`context-menu-item ${item.disabled ? 'disabled' : ''} ${item.isSubmenu ? 'has-submenu' : ''} ${item.className || ''}`}
            onClick={() => handleItemClick(item)}
            onMouseEnter={() => item.isSubmenu && setOpenSubmenu(index)}
          >
            {item.icon && <span className="context-menu-icon">{item.icon}</span>}
            <span className="context-menu-label">{item.label}</span>
            {item.isSubmenu && openSubmenu === index && (
              <div className="submenu">
                {item.submenu?.map((subItem, subIndex) => {
                  if (subItem.isSeparator) {
                    return <div key={subIndex} className="context-menu-separator" />;
                  }
                  return (
                    <div
                      key={subIndex}
                      className={`context-menu-item ${subItem.disabled ? 'disabled' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleItemClick(subItem);
                      }}
                    >
                      {subItem.icon && <span className="context-menu-icon">{subItem.icon}</span>}
                      <span className="context-menu-label">{subItem.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ContextMenu;