/**
 * ClipDndPlugin - Drag and drop reordering of ClipContainerNode blocks.
 */

import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey } from 'lexical';
import { ClipContainerNode } from '../nodes/ClipContainerNode';

export default function ClipDndPlugin() {
  const [editor] = useLexicalComposerContext();
  const dragKeyRef = useRef<string | null>(null);
  const hoverKeyRef = useRef<string | null>(null);
  const hoverBeforeRef = useRef<boolean>(true);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const dragClipIdRef = useRef<string | null>(null);
  const hoverClipIdRef = useRef<string | null>(null);

  useEffect(() => {
    const rootEl = editor.getRootElement();
    if (!rootEl) return;

    const refreshDraggables = () => {
      const els = rootEl.querySelectorAll('.lexical-clip-container');
      console.log('[ClipDndPlugin] refreshDraggables count=', els.length);
      els.forEach((el) => {
        el.setAttribute('draggable', 'true');
        (el as any).draggable = true;
      });
    };

    const ensureIndicator = () => {
      if (!indicatorRef.current) {
        const bar = document.createElement('div');
        bar.id = 'clip-drop-indicator';
        bar.style.position = 'absolute';
        bar.style.left = '0';
        bar.style.right = '0';
        bar.style.height = '4px';
        bar.style.background = '#3b82f6';
        bar.style.borderRadius = '2px';
        bar.style.pointerEvents = 'none';
        bar.style.zIndex = '9999';
        bar.style.display = 'none';
        const wrapper = rootEl.closest('.lexical-transcript-editor-wrapper') as HTMLElement | null;
        (wrapper || document.body).appendChild(bar);
        indicatorRef.current = bar;
      }
    };

    const onDragStart = (e: DragEvent) => {
      const target = (e.target as HTMLElement)?.closest('.lexical-clip-container') as HTMLElement | null;
      if (!target) return;
      const key = target.getAttribute('data-lexical-node-key');
      if (!key) return;
      dragKeyRef.current = key;
      dragClipIdRef.current = target.getAttribute('data-clip-id');
      e.dataTransfer?.setData('text/plain', key);
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
      }
      e.dataTransfer?.setDragImage(target, 10, 10);
      console.log('[ClipDndPlugin] dragstart key=', key);
      ensureIndicator();
      
      // Notify LexicalTranscriptEditor to enter drag mode
      window.dispatchEvent(new CustomEvent('clip-drag-start'));
    };

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      ensureIndicator();

      // Determine nearest container and whether to place before or after
      const containers = Array.from(rootEl.querySelectorAll('.lexical-clip-container')) as HTMLElement[];
      if (containers.length === 0) return;
      const y = e.clientY;
      let nearest: HTMLElement = containers[0];
      let nearestDist = Infinity;
      let before = true;

      containers.forEach((el) => {
        const rect = el.getBoundingClientRect();
        // Compute distance to top and bottom boundaries; choose closest
        const dTop = Math.abs(y - rect.top);
        const dBottom = Math.abs(y - rect.bottom);
        if (dTop < nearestDist) {
          nearestDist = dTop;
          nearest = el;
          before = true;
        }
        if (dBottom < nearestDist) {
          nearestDist = dBottom;
          nearest = el;
          before = false;
        }
      });

      // Position indicator between dashed lines (midpoint between adjacent clips)
      const wrapper = rootEl.closest('.lexical-transcript-editor-wrapper') as HTMLElement | null;
      const baseTop = (wrapper || document.body).getBoundingClientRect().top;
      const rect = nearest.getBoundingClientRect();
      let topPx = 0;
      if (before) {
        const prev = nearest.previousElementSibling as HTMLElement | null;
        const prevBottom = prev?.classList.contains('lexical-clip-container') ? prev.getBoundingClientRect().bottom : rect.top - 16;
        topPx = (prevBottom + rect.top) / 2 - baseTop - 2;
      } else {
        const next = nearest.nextElementSibling as HTMLElement | null;
        const nextTop = next?.classList.contains('lexical-clip-container') ? next.getBoundingClientRect().top : rect.bottom + 16;
        topPx = (rect.bottom + nextTop) / 2 - baseTop - 2;
      }
      if (indicatorRef.current) {
        indicatorRef.current.style.display = 'block';
        indicatorRef.current.style.top = `${topPx}px`;
      }
      hoverKeyRef.current = nearest.getAttribute('data-lexical-node-key');
      hoverClipIdRef.current = nearest.getAttribute('data-clip-id');
      hoverBeforeRef.current = before;
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      if (indicatorRef.current) indicatorRef.current.style.display = 'none';
      const placeBefore = hoverBeforeRef.current;
      const srcClipId = dragClipIdRef.current;
      const targetClipId = hoverClipIdRef.current;
      if (!srcClipId || !targetClipId || srcClipId === targetClipId) return;
      console.log('[ClipDndPlugin] dispatch clip-reorder', { srcClipId, targetClipId, placeBefore });
      window.dispatchEvent(new CustomEvent('clip-reorder', { detail: { srcClipId, targetClipId, placeBefore } } as any));
    };

    const onDragLeave = (e: DragEvent) => {
      const related = e.relatedTarget as Node | null;
      if (!related || !rootEl.contains(related)) {
        if (indicatorRef.current) indicatorRef.current.style.display = 'none';
      }
    };

    rootEl.addEventListener('dragstart', onDragStart);
    rootEl.addEventListener('dragover', onDragOver);
    // Use capture phase to avoid contentEditable interception
    rootEl.addEventListener('drop', onDrop, true);
    const onDragEnd = () => {
      if (indicatorRef.current) indicatorRef.current.style.display = 'none';
      dragKeyRef.current = null;
      hoverKeyRef.current = null;
      dragClipIdRef.current = null;
      hoverClipIdRef.current = null;
      
      // Notify LexicalTranscriptEditor to exit drag mode
      window.dispatchEvent(new CustomEvent('clip-drag-end'));
    };
    rootEl.addEventListener('dragend', onDragEnd);
    rootEl.addEventListener('dragleave', onDragLeave);

    const unregister = editor.registerUpdateListener(() => refreshDraggables());
    refreshDraggables();

    return () => {
      rootEl.removeEventListener('dragstart', onDragStart);
      rootEl.removeEventListener('dragover', onDragOver);
      rootEl.removeEventListener('drop', onDrop, true as any);
      rootEl.removeEventListener('dragend', onDragEnd);
      rootEl.removeEventListener('dragleave', onDragLeave);
      unregister();
    };
  }, [editor]);

  return null;
}
