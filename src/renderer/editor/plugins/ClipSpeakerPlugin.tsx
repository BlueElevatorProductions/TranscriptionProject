/**
 * ClipSpeakerPlugin - Single-portal dropdown renderer
 * Renders all clip speaker dropdowns via one persistent React root mounted
 * to the editor-managed layer (#clip-speaker-layer) to avoid DOM churn.
 */

import React, { useEffect, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import SpeakerDropdown from '../../components/shared/SpeakerDropdown';
import { useClipEditor as useClipEditorHook } from '../../hooks/useClipEditor';
import type { AudioEditorState, AudioEditorActions } from '../../hooks/useAudioEditor';
import { useProject } from '../../contexts';
import { generateClipId } from '../../audio/AudioAppState';

interface Speaker { id: string; name: string }

interface ClipSpeakerPluginProps {
  availableSpeakers: Speaker[];
  audioState: AudioEditorState;
  audioActions: AudioEditorActions;
  readOnly?: boolean;
  getSpeakerDisplayName: (speakerId: string) => string;
}

type Item = {
  clipId: string;
  speakerId: string;
  displayName: string;
  left: number;
  top: number;
  index: number;
  total: number;
  lastSeen: number;
};

function Layer({ items, availableSpeakers, audioState, audioActions, onApplyClips }: {
  items: Item[];
  availableSpeakers: Speaker[];
  audioState: AudioEditorState;
  audioActions: AudioEditorActions;
  onApplyClips: (next: import('../../types').Clip[]) => void;
}) {
  const clipEditor = useClipEditorHook(audioState, audioActions);
  return (
    <>
      {items.map((it) => (
        <div
          key={it.clipId}
          className="clip-speaker-dropdown-container"
          style={{ position: 'absolute', left: it.left, top: it.top, zIndex: 10001, pointerEvents: 'auto' }}
          data-overlay-clip-id={it.clipId}
        >
          <SpeakerDropdown
            currentSpeakerId={it.speakerId}
            displayName={it.displayName}
            availableSpeakers={availableSpeakers}
            clipIndex={it.index}
            totalClips={it.total}
            onSpeakerChange={(newSpeakerId) => {
              const now = Date.now();
              const next = (audioState.clips || []).map(c => c.id === it.clipId ? { ...c, speaker: newSpeakerId, modifiedAt: now } : c);
              try { audioActions.updateClips(next); } catch {}
              try { onApplyClips(next as any); } catch {}
              window.dispatchEvent(new CustomEvent('clips-updated'));
            }}
            onMergeAbove={() => {
              const clips = audioState.clips || [];
              // Find current clip index in full array
              const currIdx = clips.findIndex(c => c.id === it.clipId);
              if (currIdx <= 0) return;
              // Find previous speech clip to the left (skip gaps)
              let prevIdx = currIdx - 1;
              while (prevIdx >= 0 && clips[prevIdx].type === 'audio-only') prevIdx--;
              if (prevIdx < 0) return;
              const prev = clips[prevIdx];
              const curr = clips[currIdx];
              const mergedWords = [...prev.words, ...curr.words];
              const merged = {
                ...prev,
                id: generateClipId('merged'),
                words: mergedWords,
                endTime: curr.endTime,
                endWordIndex: curr.endWordIndex,
                duration: curr.endTime - prev.startTime,
                text: mergedWords.map(w => w.word).join(' '),
                modifiedAt: Date.now(),
              } as any;
              const next = clips.slice();
              // Preserve gaps: remove only the two speech clips and insert merged at prevIdx
              // Remove the later speech clip first to avoid index shift
              next.splice(currIdx, 1);
              // Replace the previous speech clip with merged
              next.splice(prevIdx, 1, merged);
              // Renumber orders
              for (let i = 0; i < next.length; i++) next[i] = { ...next[i], order: i } as any;
              try { audioActions.updateClips(next); } catch {}
              try { onApplyClips(next as any); } catch {}
              window.dispatchEvent(new CustomEvent('clips-updated'));
            }}
            onMergeBelow={() => {
              const clips = audioState.clips || [];
              // Find current clip index in full array
              const currIdx = clips.findIndex(c => c.id === it.clipId);
              if (currIdx < 0) return;
              // Find next speech clip to the right (skip gaps)
              let nextIdx = currIdx + 1;
              while (nextIdx < clips.length && clips[nextIdx].type === 'audio-only') nextIdx++;
              if (nextIdx >= clips.length) return;
              const curr = clips[currIdx];
              const nextClip = clips[nextIdx];
              const mergedWords = [...curr.words, ...nextClip.words];
              const merged = { ...curr, id: generateClipId('merged'), words: mergedWords, endTime: nextClip.endTime, endWordIndex: nextClip.endWordIndex, duration: nextClip.endTime - curr.startTime, text: mergedWords.map(w => w.word).join(' '), modifiedAt: Date.now() } as any;
              const next = clips.slice();
              // Preserve gaps: remove only the two speech clips and insert merged at currIdx
              next.splice(nextIdx, 1);
              next.splice(currIdx, 1, merged);
              // Renumber orders
              for (let i = 0; i < next.length; i++) next[i] = { ...next[i], order: i } as any;
              try { audioActions.updateClips(next); } catch {}
              try { onApplyClips(next as any); } catch {}
              window.dispatchEvent(new CustomEvent('clips-updated'));
            }}
            isDeleted={(() => {
              const clips = audioState.clips || [];
              const targetClip = clips.find(c => c.id === it.clipId);
              return targetClip?.status === 'deleted';
            })()}
            onDeleteClip={() => {
              const clips = audioState.clips || [];
              const targetClip = clips.find(c => c.id === it.clipId);
              if (!targetClip) return;
              
              // Unified soft deletion: mark as deleted instead of removing
              const now = Date.now();
              const next = clips.map(c => 
                c.id === it.clipId 
                  ? { ...c, status: 'deleted' as const, modifiedAt: now }
                  : c
              );
              
              try { audioActions.updateClips(next); } catch {}
              try { onApplyClips(next as any); } catch {}
              window.dispatchEvent(new CustomEvent('clips-updated'));
            }}
            onRestoreClip={() => {
              const clips = audioState.clips || [];
              const targetClip = clips.find(c => c.id === it.clipId);
              if (!targetClip) return;
              
              // Restore clip: mark as active
              const now = Date.now();
              const next = clips.map(c => 
                c.id === it.clipId 
                  ? { ...c, status: 'active' as const, modifiedAt: now }
                  : c
              );
              
              try { audioActions.updateClips(next); } catch {}
              try { onApplyClips(next as any); } catch {}
              window.dispatchEvent(new CustomEvent('clips-updated'));
            }}
          />
        </div>
      ))}
    </>
  );
}

export default function ClipSpeakerPlugin({ availableSpeakers, audioState, audioActions, readOnly = false, getSpeakerDisplayName }: ClipSpeakerPluginProps) {
  const [editor] = useLexicalComposerContext();
  const layerRef = useRef<HTMLDivElement | null>(null);
  const portalRef = useRef<Root | null>(null);
  const itemsRef = useRef<Map<string, Item>>(new Map());
  const lastUpdateRef = useRef<number>(0);
  const audioStateRef = useRef<AudioEditorState>(audioState);
  const audioActionsRef = useRef<AudioEditorActions>(audioActions);

  // Keep refs fresh without re-running the main effect
  useEffect(() => { audioStateRef.current = audioState; }, [audioState]);
  useEffect(() => { audioActionsRef.current = audioActions; }, [audioActions]);
  const { actions: projectActions } = useProject();

  useEffect(() => {
    // Acquire layer + portal (once)
    const layer = document.getElementById('clip-speaker-layer') as HTMLDivElement | null;
    if (!layer) return;
    layerRef.current = layer;
    if (!portalRef.current) portalRef.current = createRoot(layer);

    const rootEl = editor.getRootElement();
    if (!rootEl) return;

    let cancelled = false;
    const GRACE_MS = 400;

    const update = () => {
      if (cancelled) return;
      const now = performance.now();
      if (now - lastUpdateRef.current < 100) return; // throttle ~10fps
      lastUpdateRef.current = now;

      const parentRect = (layerRef.current!.parentElement as HTMLElement).getBoundingClientRect();
      const containers = rootEl.querySelectorAll('.lexical-clip-container');
      const seen = new Set<string>();
      const liveClips = audioStateRef.current?.clips || [];

      // Compute speech-only indices
      let speechIndex = 0;
      const speechTotal = containers.length;
      containers.forEach((node) => {
        const el = node as HTMLElement;
        const clipId = el.getAttribute('data-clip-id') || '';
        if (!clipId) return;
        // Prefer live speaker from clips over DOM attribute so changes reflect immediately
        const live = liveClips.find((c) => c.id === clipId);
        const speakerId = live?.speaker || el.getAttribute('data-speaker-id') || '';
        seen.add(clipId);
        const r = el.getBoundingClientRect();
        const left = Math.round(r.left - parentRect.left + 8);
        const top = Math.round(r.top - parentRect.top + 8);
        const displayName = getSpeakerDisplayName(speakerId);
        const prev = itemsRef.current.get(clipId);
        const item: Item = { clipId, speakerId, displayName, left, top, index: speechIndex, total: speechTotal, lastSeen: now };
        itemsRef.current.set(clipId, { ...(prev || item), ...item });
        speechIndex++;
      });

      for (const [id, it] of Array.from(itemsRef.current.entries())) {
        if (!seen.has(id) && now - it.lastSeen > GRACE_MS) itemsRef.current.delete(id);
      }

      try {
        // If readOnly, render empty to avoid interactions but keep portal mounted
        const items = readOnly ? [] : Array.from(itemsRef.current.values());
        portalRef.current!.render(
          <Layer
            items={items}
            availableSpeakers={availableSpeakers}
            audioState={audioStateRef.current}
            audioActions={audioActionsRef.current}
            onApplyClips={(next) => {
              try { projectActions.updateClips(next); } catch {}
            }}
          />
        );
      } catch {}
    };

    const rafUpdate = () => requestAnimationFrame(update);
    update();
    const unregister = editor.registerUpdateListener(rafUpdate);
    const obs = new MutationObserver(rafUpdate);
    try { obs.observe(rootEl, { childList: true, subtree: true }); } catch {}
    const evt = () => rafUpdate();
    window.addEventListener('speaker-change-clip', evt as EventListener);
    window.addEventListener('clips-updated', evt as EventListener);
    const timer = window.setInterval(() => rafUpdate(), 1000);

    return () => {
      cancelled = true;
      try { unregister(); } catch {}
      try { obs.disconnect(); } catch {}
      window.removeEventListener('speaker-change-clip', evt as EventListener);
      window.removeEventListener('clips-updated', evt as EventListener);
      clearInterval(timer);
      // Keep portal mounted; no unmount here to avoid React warning
    };
  }, [editor, readOnly, availableSpeakers, getSpeakerDisplayName]);

  return null;
}
