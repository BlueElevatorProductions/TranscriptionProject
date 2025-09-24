/**
 * ProjectDataStore - Canonical project state manager in main process
 *
 * This service owns the authoritative ProjectData and ensures all edit operations
 * maintain data integrity through validation and invariant checking.
 */

import { EventEmitter } from 'events';
import {
  ProjectData,
  Clip,
  EditOperation,
  EditOperationType,
  EditOperationData,
  SplitClipData,
  MergeClipsData,
  DeleteClipData,
  ReorderClipsData,
  InsertSpacerData,
  EditWordData,
  ChangeSpeakerData,
  ValidationResult,
  Segment,
  WordSegment,
  SpacerSegment
} from '../../shared/types';
import { validateSegments, createSpacerSegment } from '../../shared/operations';

export interface ProjectDataStoreEvents {
  'project:updated': [ProjectData];
  'project:error': [Error];
  'operation:applied': [EditOperation];
  'operation:failed': [EditOperation, Error];
}

export class ProjectDataStore extends EventEmitter {
  private static instance: ProjectDataStore | null = null;
  private projectData: ProjectData | null = null;
  private operationHistory: EditOperation[] = [];
  private readonly maxHistorySize = 100;
  private currentProjectPath: string | null = null;

  constructor() {
    super();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ProjectDataStore {
    if (!ProjectDataStore.instance) {
      ProjectDataStore.instance = new ProjectDataStore();
    }
    return ProjectDataStore.instance;
  }

  // ==================== State Management ====================

  /**
   * Load project data and validate all clips
   */
  public loadProject(data: ProjectData): void {
    try {
      // Validate all clips before accepting the data
      // Use lenient validation for imported transcription projects
      const isImport = data.project?.transcription?.status === 'completed' || data.clips?.version === '2.0';
      this.validateAllClips(data.clips.clips, isImport);

      this.projectData = { ...data };
      this.emit('project:updated', this.projectData);
    } catch (error) {
      this.emit('project:error', error);
      throw error;
    }
  }

  /**
   * Get current project data (immutable copy)
   */
  public getProjectData(): ProjectData | null {
    return this.projectData ? JSON.parse(JSON.stringify(this.projectData)) : null;
  }

  /**
   * Get current clips (immutable copy)
   */
  public getClips(): Clip[] {
    return this.projectData ?
      JSON.parse(JSON.stringify(this.projectData.clips.clips)) :
      [];
  }

  /**
   * Set the current project file path
   */
  public setCurrentProjectPath(path: string | null): void {
    this.currentProjectPath = path;
  }

  /**
   * Get the current project file path
   */
  public getCurrentProjectPath(): string | null {
    return this.currentProjectPath;
  }

  // ==================== Edit Operations ====================

  /**
   * Apply an edit operation with full validation
   */
  public async applyEditOperation(operation: EditOperation): Promise<void> {
    if (!this.projectData) {
      const error = new Error('No project loaded');
      this.emit('operation:failed', operation, error);
      throw error;
    }

    try {
      const newClips = this.executeOperation(operation, this.projectData.clips.clips);

      // Validate the result
      this.validateAllClips(newClips);

      // Update project data
      this.projectData.clips.clips = newClips;
      this.projectData.clips.version = Date.now().toString();

      // Add to history
      this.operationHistory.push(operation);
      if (this.operationHistory.length > this.maxHistorySize) {
        this.operationHistory.shift();
      }

      // Emit events
      this.emit('operation:applied', operation);
      this.emit('project:updated', this.getProjectData()!);

    } catch (error) {
      this.emit('operation:failed', operation, error);
      throw error;
    }
  }

  // ==================== Operation Execution ====================

  private executeOperation(operation: EditOperation, clips: Clip[]): Clip[] {
    const newClips = [...clips];

    switch (operation.type) {
      case 'splitClip':
        return this.executeSplitClip(newClips, operation.data as SplitClipData);

      case 'mergeClips':
        return this.executeMergeClips(newClips, operation.data as MergeClipsData);

      case 'deleteClip':
        return this.executeDeleteClip(newClips, operation.data as DeleteClipData);

      case 'reorderClips':
        return this.executeReorderClips(newClips, operation.data as ReorderClipsData);

      case 'insertSpacer':
        return this.executeInsertSpacer(newClips, operation.data as InsertSpacerData);

      case 'editWord':
        return this.executeEditWord(newClips, operation.data as EditWordData);

      case 'changeSpeaker':
        return this.executeChangeSpeaker(newClips, operation.data as ChangeSpeakerData);

      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private executeSplitClip(clips: Clip[], data: SplitClipData): Clip[] {
    const clipIndex = clips.findIndex(c => c.id === data.clipId);
    if (clipIndex === -1) {
      throw new Error(`Clip not found: ${data.clipId}`);
    }

    const clip = clips[clipIndex];
    if (data.segmentIndex <= 0 || data.segmentIndex >= clip.segments.length) {
      throw new Error(`Invalid segment index for split: ${data.segmentIndex}`);
    }

    const splitTime = clip.segments[data.segmentIndex].start;
    const splitAbsoluteTime = clip.startTime + splitTime;

    // Create first clip (before split)
    const firstClip: Clip = {
      ...clip,
      id: `${clip.id}-part1-${Date.now()}`,
      endTime: splitAbsoluteTime,
      duration: splitTime,
      segments: clip.segments.slice(0, data.segmentIndex),
      modifiedAt: Date.now()
    };

    // Create second clip (after split) - adjust segment times to be clip-relative
    const secondClipSegments = clip.segments.slice(data.segmentIndex).map(segment => ({
      ...segment,
      start: segment.start - splitTime,
      end: segment.end - splitTime
    }));

    const secondClip: Clip = {
      ...clip,
      id: `${clip.id}-part2-${Date.now()}`,
      startTime: splitAbsoluteTime,
      duration: clip.duration - splitTime,
      segments: secondClipSegments,
      modifiedAt: Date.now()
    };

    // Replace original clip with two new clips
    const newClips = [...clips];
    newClips.splice(clipIndex, 1, firstClip, secondClip);

    // Update order numbers
    return this.renumberClips(newClips);
  }

  private executeMergeClips(clips: Clip[], data: MergeClipsData): Clip[] {
    if (data.clipIds.length < 2) {
      throw new Error('Must specify at least 2 clips to merge');
    }

    // Find all clips and ensure they're contiguous
    const clipsToMerge = data.clipIds.map(id => {
      const clip = clips.find(c => c.id === id);
      if (!clip) throw new Error(`Clip not found: ${id}`);
      return clip;
    });

    // Sort by order to ensure contiguity
    clipsToMerge.sort((a, b) => a.order - b.order);

    // Verify contiguity
    for (let i = 1; i < clipsToMerge.length; i++) {
      if (clipsToMerge[i].order !== clipsToMerge[i-1].order + 1) {
        throw new Error('Clips to merge must be contiguous');
      }
    }

    const firstClip = clipsToMerge[0];
    const lastClip = clipsToMerge[clipsToMerge.length - 1];

    // Merge segments, adjusting times to be relative to the first clip
    let mergedSegments: Segment[] = [];
    let currentTime = 0;

    for (const clip of clipsToMerge) {
      const adjustedSegments = clip.segments.map(segment => ({
        ...segment,
        start: segment.start + currentTime,
        end: segment.end + currentTime
      }));
      mergedSegments = mergedSegments.concat(adjustedSegments);
      currentTime += clip.duration;
    }

    // Create merged clip
    const mergedClip: Clip = {
      ...firstClip,
      id: `merged-${Date.now()}`,
      endTime: lastClip.endTime,
      duration: lastClip.endTime - firstClip.startTime,
      segments: mergedSegments,
      modifiedAt: Date.now()
    };

    // Remove original clips and add merged clip
    const newClips = clips.filter(c => !data.clipIds.includes(c.id));
    const insertIndex = Math.min(...clipsToMerge.map(c => c.order));
    newClips.splice(insertIndex, 0, mergedClip);

    return this.renumberClips(newClips);
  }

  private executeDeleteClip(clips: Clip[], data: DeleteClipData): Clip[] {
    const clipIndex = clips.findIndex(c => c.id === data.clipId);
    if (clipIndex === -1) {
      throw new Error(`Clip not found: ${data.clipId}`);
    }

    // Mark as deleted rather than removing
    const newClips = [...clips];
    newClips[clipIndex] = {
      ...newClips[clipIndex],
      status: 'deleted',
      modifiedAt: Date.now()
    };

    return newClips;
  }

  private executeReorderClips(clips: Clip[], data: ReorderClipsData): Clip[] {
    const clipIndex = clips.findIndex(c => c.id === data.clipId);
    if (clipIndex === -1) {
      throw new Error(`Clip not found: ${data.clipId}`);
    }

    const newClips = [...clips];
    const [movedClip] = newClips.splice(clipIndex, 1);
    newClips.splice(data.newOrder, 0, {
      ...movedClip,
      modifiedAt: Date.now()
    });

    return this.renumberClips(newClips);
  }

  private executeInsertSpacer(clips: Clip[], data: InsertSpacerData): Clip[] {
    const clipIndex = clips.findIndex(c => c.id === data.clipId);
    if (clipIndex === -1) {
      throw new Error(`Clip not found: ${data.clipId}`);
    }

    const clip = clips[clipIndex];
    const insertTime = data.segmentIndex < clip.segments.length ?
      clip.segments[data.segmentIndex].start :
      clip.duration;

    // Create spacer segment
    const spacer = createSpacerSegment(insertTime, insertTime + data.duration);

    // Adjust subsequent segments
    const newSegments = [...clip.segments];
    for (let i = data.segmentIndex; i < newSegments.length; i++) {
      newSegments[i] = {
        ...newSegments[i],
        start: newSegments[i].start + data.duration,
        end: newSegments[i].end + data.duration
      };
    }

    // Insert spacer
    newSegments.splice(data.segmentIndex, 0, spacer);

    // Update clip
    const newClips = [...clips];
    newClips[clipIndex] = {
      ...clip,
      duration: clip.duration + data.duration,
      endTime: clip.endTime + data.duration,
      segments: newSegments,
      modifiedAt: Date.now()
    };

    return newClips;
  }

  private executeEditWord(clips: Clip[], data: EditWordData): Clip[] {
    const clipIndex = clips.findIndex(c => c.id === data.clipId);
    if (clipIndex === -1) {
      throw new Error(`Clip not found: ${data.clipId}`);
    }

    const clip = clips[clipIndex];
    const segment = clip.segments[data.segmentIndex];

    if (!segment || segment.type !== 'word') {
      throw new Error(`Invalid word segment at index ${data.segmentIndex}`);
    }

    const newSegments = [...clip.segments];
    newSegments[data.segmentIndex] = {
      ...segment,
      text: data.newText
    };

    const newClips = [...clips];
    newClips[clipIndex] = {
      ...clip,
      segments: newSegments,
      modifiedAt: Date.now()
    };

    return newClips;
  }

  private executeChangeSpeaker(clips: Clip[], data: ChangeSpeakerData): Clip[] {
    const clipIndex = clips.findIndex(c => c.id === data.clipId);
    if (clipIndex === -1) {
      throw new Error(`Clip not found: ${data.clipId}`);
    }

    const newClips = [...clips];
    newClips[clipIndex] = {
      ...newClips[clipIndex],
      speaker: data.newSpeaker,
      modifiedAt: Date.now()
    };

    return newClips;
  }

  // ==================== Validation ====================

  private validateAllClips(clips: Clip[], isImport: boolean = false): void {
    for (const clip of clips) {
      const validation = validateSegments(clip.segments, clip.duration, {
        isImport,
        spacerThreshold: 1.0 // Use standard spacer threshold
      });

      if (!validation.isValid) {
        if (isImport) {
          // During import, be more lenient - only fail on critical errors
          const criticalErrors = validation.errors.filter(error =>
            !error.includes('Gap of') || error.includes('Gap of 0.') // Only fail on zero-duration gaps or other critical issues
          );

          if (criticalErrors.length > 0) {
            throw new Error(`Clip ${clip.id} validation failed: ${criticalErrors.join(', ')}`);
          } else {
            console.warn(`⚠️ Clip ${clip.id} has timing gaps that may need spacer segments:`, validation.errors);
          }
        } else {
          throw new Error(`Clip ${clip.id} validation failed: ${validation.errors.join(', ')}`);
        }
      }

      if (validation.warnings.length > 0) {
        console.warn(`⚠️ Clip ${clip.id} validation warnings:`, validation.warnings);
      }
    }

    // Check for timeline overlaps between clips
    const activeClips = clips.filter(c => c.status === 'active').sort((a, b) => a.startTime - b.startTime);
    for (let i = 1; i < activeClips.length; i++) {
      if (activeClips[i].startTime < activeClips[i-1].endTime) {
        throw new Error(`Clips ${activeClips[i-1].id} and ${activeClips[i].id} overlap in timeline`);
      }
    }
  }

  private renumberClips(clips: Clip[]): Clip[] {
    return clips.map((clip, index) => ({
      ...clip,
      order: index
    }));
  }

  // ==================== Utilities ====================

  public getOperationHistory(): EditOperation[] {
    return [...this.operationHistory];
  }

  public clearHistory(): void {
    this.operationHistory = [];
  }

  public validateProject(): ValidationResult {
    if (!this.projectData) {
      return {
        isValid: false,
        errors: ['No project loaded'],
        warnings: [],
        invariants: {
          completeCoverage: false,
          noOverlaps: false,
          chronologicalOrder: false,
          finiteTimes: false
        }
      };
    }

    try {
      this.validateAllClips(this.projectData.clips.clips);
      return {
        isValid: true,
        errors: [],
        warnings: [],
        invariants: {
          completeCoverage: true,
          noOverlaps: true,
          chronologicalOrder: true,
          finiteTimes: true
        }
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        invariants: {
          completeCoverage: false,
          noOverlaps: false,
          chronologicalOrder: false,
          finiteTimes: false
        }
      };
    }
  }
}