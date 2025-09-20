/**
 * CursorTrackingPlugin - Tracks the current word/clip selection and updates the audio cursor.
 *
 * Computes clipId and local word index from the Lexical selection and calls audioActions.setCursor.
 * This enables Edit Mode shortcuts like Enter-to-split at the current word.
 */

import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, $getRoot } from 'lexical';
import { ClipContainerNode } from '../nodes/ClipContainerNode';

type Clip = import('../../types').Clip;
type AudioEditorActions = import('../../hooks/useAudioEditor').AudioEditorActions;

interface CursorTrackingPluginProps {
  clips: Clip[];
  audioActions: AudioEditorActions;
  enabled?: boolean;
}

export default function CursorTrackingPlugin({ clips, audioActions, enabled = true }: CursorTrackingPluginProps) {
  const [editor] = useLexicalComposerContext();
  // Override state must persist across renders and event callbacks
  const overrideRef = useRef<null | {
    editedTime: number;
    originalTime: number;
    clipId: string;
    localWordIndex: number;
    wordIndex: number;
    expiresAt: number;
  }>(null);

  useEffect(() => {
    if (!enabled) return;
    const unregister = editor.registerUpdateListener(({ editorState }) => {
      try {
        editorState.read(() => {
          // Prefer any fresh spacer override to avoid selection flicker choosing a nearby word
          const o = overrideRef.current;
          if (o && Date.now() < o.expiresAt) {
            audioActions.setCursor({
              editedTime: o.editedTime,
              originalTime: o.originalTime,
              clipId: o.clipId,
              wordIndex: o.wordIndex,
              localWordIndex: o.localWordIndex,
            });
            return;
          }
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) {
            audioActions.setCursor(null);
            return;
          }

          // Ascend to ClipContainerNode for the current selection
          let n: any = selection.anchor.getNode();
          while (n && !(n instanceof ClipContainerNode)) {
            const p = n.getParent && n.getParent();
            if (!p) break; n = p;
          }
          if (!n || !(n instanceof ClipContainerNode)) { audioActions.setCursor(null); return; }
          const clipId = n.getClipId();
          const paragraph = (n as any).getChildren?.().find((c: any) => c.getType && c.getType() === 'paragraph');
          if (!paragraph) { audioActions.setCursor(null); return; }
          const children = (paragraph as any).getChildren?.() || [];
          const tokenNodes: any[] = [];
          const wordNodes: any[] = [];
          const getType = (x: any) => (x && x.getType ? x.getType() : undefined);
          for (const ch of children) {
            const t = getType(ch);
            if (t === 'word' || t === 'spacer') tokenNodes.push(ch);
            if (t === 'word') wordNodes.push(ch);
          }
          // Anchor word
          let wnode: any = selection.anchor.getNode();
          while (wnode && getType(wnode) !== 'word') {
            const p = wnode.getParent && wnode.getParent();
            if (!p) break; wnode = p;
          }
          if (!wnode || getType(wnode) !== 'word') { audioActions.setCursor(null); return; }
          const wkey = wnode.getKey();
          const localIndex = wordNodes.findIndex(x => x.getKey && x.getKey() === wkey);
          const tokenIndex = tokenNodes.findIndex(x => x.getKey && x.getKey() === wkey);
          if (localIndex < 0 || tokenIndex < 0) { audioActions.setCursor(null); return; }

          // Times from WordNode
          const editedTime = (wnode as any).getEditedStart?.() ?? (wnode as any).getStart?.() ?? 0;
          const originalTime = (wnode as any).getStart?.() ?? editedTime;

          const clip = clips.find(c => c.id === clipId);
          const globalIndex = clip ? (clip.startWordIndex + localIndex) : localIndex;

          const DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
          audioActions.setCursor({ editedTime, originalTime, clipId, wordIndex: globalIndex, localWordIndex: localIndex });
          try {
            (window as any).__LEXICAL_CURSOR_TOKEN_INDEX__ = { clipId, tokenIndex, at: Date.now() };
            if (DEBUG) {
              const kinds = tokenNodes.slice(0, 6).map((n: any) => n.getType?.());
              console.log('[CursorTracking] word selection', { clipId, tokenIndex, tokenCount: tokenNodes.length, tokensHead: kinds });
            }
          } catch {}
        });
      } catch {
        // ignore
      }
    });

    // Also handle clicks/focus on spacer pills which aren't part of Lexical selections
    const el = editor.getRootElement();
    if (!el) return unregister;

    let lastFocusedPill: HTMLElement | null = null;

    const setCursorFromSpacer = (spacerEl: HTMLElement) => {
      const container = spacerEl.closest('.lexical-clip-container') as HTMLElement | null;
      if (!container) { audioActions.setCursor(null); return; }
      const clipId = container.getAttribute('data-clip-id') || '';
      if (!clipId) { audioActions.setCursor(null); return; }
      // Visual affordance: focus the button pill and keep a selected class until blur
      const focusTarget = (spacerEl.tagName === 'BUTTON' ? spacerEl : (spacerEl.querySelector('button.lexical-spacer-node') as HTMLElement | null)) || spacerEl;
      if (lastFocusedPill && lastFocusedPill !== focusTarget) {
        try { lastFocusedPill.classList.remove('selected'); } catch {}
      }
      try { (focusTarget as HTMLElement).focus({ preventScroll: true }); } catch {}
      try { focusTarget.classList.add('selected'); } catch {}
      lastFocusedPill = focusTarget as HTMLElement;
      // Compute tokenIndex and word-before count using Lexical nodes
      editor.update(() => {
        const root = $getRoot();
        const clipKey = container.getAttribute('data-lexical-node-key');
        let targetContainer: any = null;
        const rootChildren = root.getChildren();
        for (const n of rootChildren) {
          if ((n as any).getKey && (n as any).getKey() === clipKey) { targetContainer = n; break; }
        }
        if (!targetContainer) return;
        const paragraph = (targetContainer as any).getChildren?.().find((n: any) => n.getType && n.getType() === 'paragraph');
        if (!paragraph) return;
        const children = (paragraph as any).getChildren?.() || [];
        const tokens: any[] = [];
        for (const ch of children) {
          const t = (ch as any).getType?.();
          if (t === 'word' || t === 'spacer') tokens.push(ch);
        }
        const sKey = spacerEl.getAttribute('data-lexical-node-key') || (spacerEl.querySelector('[data-lexical-node-key]') as HTMLElement | null)?.getAttribute('data-lexical-node-key') || '';
        const tokenIndex = tokens.findIndex(n => n.getKey && n.getKey() === sKey);
        if (tokenIndex < 0) return;
        const beforeCount = tokens.slice(0, tokenIndex).filter(n => n.getType && n.getType() === 'word').length;
      const editedAttr = spacerEl.getAttribute('data-edited-start-sec') || spacerEl.getAttribute('data-start-sec') || '0';
      const origAttr = spacerEl.getAttribute('data-start-sec') || '0';
      const editedTime = parseFloat(editedAttr) || 0;
      const originalTime = parseFloat(origAttr) || 0;
      const clip = clips.find(c => c.id === clipId);
      const globalIndex = clip ? (clip.startWordIndex + beforeCount) : beforeCount;
      // Publish spacer selection to a global latch so non-Lexical code can act on it (e.g., split behavior)
      try {
        (window as any).__LEXICAL_LAST_CURSOR_FROM_SPACER__ = {
          clipId,
          originalStart: originalTime,
          editedStart: editedTime,
          localWordIndex: beforeCount,
          gapClipId: spacerEl.getAttribute('data-clip-id') || null,
          at: Date.now(),
        };
      } catch {}
      // Publish token index latch for split plugin
      try {
        (window as any).__LEXICAL_CURSOR_TOKEN_INDEX__ = { clipId, tokenIndex, at: Date.now() };
        const DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
        if (DEBUG) console.log('[CursorTracking] spacer selection', { clipId, tokenIndex });
      } catch {}
      // Set a short-lived override to prevent selection listeners from overriding this
      overrideRef.current = {
        editedTime,
        originalTime,
        clipId,
        localWordIndex: beforeCount,
        wordIndex: globalIndex,
        expiresAt: Date.now() + 350,
      };
      audioActions.setCursor({ editedTime, originalTime, clipId, wordIndex: globalIndex, localWordIndex: beforeCount });
      });
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const spacerEl = (target.closest && target.closest('.lexical-spacer-node')) as HTMLElement | null;
      if (spacerEl) {
        setCursorFromSpacer(spacerEl);
      }
    };
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const spacerEl = (target.closest && target.closest('.lexical-spacer-node')) as HTMLElement | null;
      if (spacerEl) {
        // Prevent Lexical from doing its default word selection on mousedown
        e.preventDefault();
        e.stopPropagation();
        try { (spacerEl as HTMLButtonElement).focus(); } catch {}
        setCursorFromSpacer(spacerEl);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const active = document.activeElement as HTMLElement | null;
      if (!active) return;
      const spacerEl = (active.closest && active.closest('.lexical-spacer-node')) as HTMLElement | null;
      if (spacerEl) {
        setCursorFromSpacer(spacerEl);
      }
    };
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const spacerEl = (target.closest && target.closest('.lexical-spacer-node')) as HTMLElement | null;
      if (spacerEl) {
        setCursorFromSpacer(spacerEl);
      }
    };
    el.addEventListener('click', handleClick, true);
    el.addEventListener('mousedown', handleMouseDown, true);
    el.addEventListener('keydown', handleKeyDown, true);
    el.addEventListener('focusin', handleFocusIn, true);
    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const wasPill = target.classList?.contains('lexical-spacer-node') || !!target.closest?.('.lexical-spacer-node');
      if (wasPill) {
        try { target.classList.remove('selected'); } catch {}
        if (lastFocusedPill === target) lastFocusedPill = null;
      }
    };
    el.addEventListener('focusout', handleFocusOut, true);

    return () => {
      unregister();
      el.removeEventListener('click', handleClick, true);
      el.removeEventListener('mousedown', handleMouseDown, true);
      el.removeEventListener('keydown', handleKeyDown, true);
      el.removeEventListener('focusin', handleFocusIn, true);
      el.removeEventListener('focusout', handleFocusOut, true);
    };
  }, [editor, audioActions, clips, enabled]);

  return null;
}
