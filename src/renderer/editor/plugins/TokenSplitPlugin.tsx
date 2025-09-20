/**
 * TokenSplitPlugin - Splits the current clip container at the selected token boundary.
 *
 * Listens for a global 'token-split' event dispatched by the keyboard integration and
 * performs a Lexical-level split of the ClipContainerNode at the token index recorded
 * by CursorTrackingPlugin (words + spacers).
 */

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';
import { ClipContainerNode, $createClipContainerNode } from '../nodes/ClipContainerNode';

export default function TokenSplitPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const clipId: string | undefined = detail.clipId;
      const DEBUG = (import.meta as any).env?.VITE_AUDIO_DEBUG === 'true';
      editor.update(() => {
        try {
          const root = $getRoot();
          // Find target container by clip id
          const containers = root.getChildren().filter((c) => c instanceof ClipContainerNode) as ClipContainerNode[];
          const container = containers.find((c) => c.getClipId() === clipId);
          if (!container) return;
          // Gather paragraph and token-like children
          const paragraph = (container as any).getChildren?.().find((n: any) => n.getType && n.getType() === 'paragraph');
          if (!paragraph) return;
          const children = (paragraph as any).getChildren?.() || [];
          const tokens: any[] = [];
          // Build tokens from words and spacers in DOM order
          for (const ch of children) {
            const t = (ch as any).getType?.();
            if (t === 'word' || t === 'spacer') tokens.push(ch);
          }
          // Read token index recorded by CursorTrackingPlugin
          const latch: any = (window as any).__LEXICAL_CURSOR_TOKEN_INDEX__ || null;
          const tokenIndex: number = (latch && latch.clipId === clipId) ? latch.tokenIndex : -1;
          const kinds = tokens.slice(0, 6).map((n) => (n as any).getType());
          if (DEBUG) console.log('[TokenSplitPlugin] token split request', { clipId, tokenIndex, tokenCount: tokens.length, tokensHead: kinds });

          // Determine effective split index: always before the selected token.
          let splitIndex = tokenIndex;
          if (splitIndex <= 0) {
            // If the container starts with one or more spacers and the selected token is the first word,
            // split after the leading spacers to honor word-start split semantics.
            let k = 0;
            while (k < tokens.length && (tokens[k] as any).getType?.() === 'spacer') k++;
            if (k > 0 && k < tokens.length) splitIndex = k; // split after leading spacers
          }
          if (splitIndex <= 0 || splitIndex >= tokens.length) {
            if (DEBUG) console.log('[TokenSplitPlugin] Split ignored due to boundary', { splitIndex });
            return;
          }

          // Create new container appearing after the current container
          const newContainer = $createClipContainerNode((container as any).getClipId() + '-part-' + Date.now(), (container as any).getSpeakerId?.() || '', (container as any).getStatus?.() || 'active');
          const newParagraph = $createParagraphNode();
          (newContainer as any).append(newParagraph);

          // Move tokens at and after boundary into new paragraph
          for (let i = splitIndex; i < tokens.length; i++) {
            const node = tokens[i] as any;
            node.remove();
            (newParagraph as any).append(node);
            // Optional readability: insert a space between tokens we move
            if (i < tokens.length - 1) (newParagraph as any).append($createTextNode(' '));
          }

          // Determine if we're splitting at a spacer (pill at any position)
          const isLeadingSpacer = tokenIndex >= 0 && tokens[tokenIndex] && (tokens[tokenIndex] as any).getType?.() === 'spacer';

          if (DEBUG) {
            console.log('[TokenSplitPlugin] Split analysis:', {
              clipId,
              tokenIndex,
              splitIndex,
              tokenTypes: tokens.slice(Math.max(0, tokenIndex - 2), tokenIndex + 3).map((t: any) => t.getType?.()),
              isLeadingSpacer,
              willMoveSpacer: isLeadingSpacer && tokenIndex === splitIndex
            });
          }

          if (isLeadingSpacer) {
            // Insert new container BEFORE current container (pill moves up)
            (container as any).insertBefore(newContainer);
            if (DEBUG) console.log('[TokenSplitPlugin] Spacer split - new clip placed before current');
          } else {
            // Insert new container AFTER current container (normal behavior)
            (container as any).insertAfter(newContainer);
            if (DEBUG) console.log('[TokenSplitPlugin] Normal split - new clip placed after current');
          }

          // Emit a marker event so external systems can refresh if needed
          try { window.dispatchEvent(new CustomEvent('clips-updated')); } catch {}
        } catch (err) {
          console.error('[TokenSplitPlugin] Split failed:', err);
        }
      });
    };
    window.addEventListener('token-split', handler as EventListener, true);
    return () => window.removeEventListener('token-split', handler as EventListener, true);
  }, [editor]);

  return null;
}
