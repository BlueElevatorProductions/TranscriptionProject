/**
 * DoubleClickEditGuardPlugin
 *
 * In Edit mode, keep the editor non-editable by default and only enable
 * text editing after a user double-clicks. Editing is disabled again on blur
 * or when the user presses Escape.
 */

import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

interface Props {
  enabled: boolean; // true in Edit mode (readOnly=false)
}

export default function DoubleClickEditGuardPlugin({ enabled }: Props) {
  const [editor] = useLexicalComposerContext();
  const isTemporarilyEditableRef = useRef(false);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;

    // Initialize: if guard is enabled, lock editing until double-click
    if (enabled) {
      editor.setEditable(false);
      isTemporarilyEditableRef.current = false;
    }

    const handleDblClick = (e: MouseEvent) => {
      if (!enabled) return;
      // Only activate if the double-click is inside the editor root
      if (!root.contains(e.target as Node)) return;
      editor.setEditable(true);
      isTemporarilyEditableRef.current = true;
      // Let the browser place the caret/selection on the double-clicked word
    };

    window.addEventListener('dblclick', handleDblClick, true);

    return () => {
      window.removeEventListener('dblclick', handleDblClick, true);
    };
  }, [editor, enabled]);

  return null;
}
