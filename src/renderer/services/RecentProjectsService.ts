/**
 * RecentProjectsService - Manages recently accessed project files
 * Stores metadata about recent .transcript files for quick access
 */

interface RecentProject {
  id: string;
  name: string;
  filePath: string;
  lastAccessed: string;
  fileSize?: number;
  audioFileName?: string;
  duration?: number;
  speakerCount?: number;
  segmentCount?: number;
}

class RecentProjectsService {
  private static readonly STORAGE_KEY = 'recentProjects';
  private static readonly MAX_RECENT_PROJECTS = 10;

  /**
   * Get all recent projects sorted by last accessed date
   */
  static getRecentProjects(): RecentProject[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const projects = JSON.parse(stored) as RecentProject[];
      // Sort by most recently accessed first
      return projects.sort((a, b) => 
        new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
      );
    } catch (error) {
      console.error('Failed to load recent projects:', error);
      return [];
    }
  }

  /**
   * Add or update a project in the recent list
   */
  static addRecentProject(project: RecentProject): void {
    try {
      let projects = this.getRecentProjects();
      
      // Remove existing entry for this file path if it exists
      projects = projects.filter(p => p.filePath !== project.filePath);
      
      // Add new entry at the beginning
      projects.unshift({
        ...project,
        lastAccessed: new Date().toISOString()
      });
      
      // Keep only the most recent projects
      projects = projects.slice(0, this.MAX_RECENT_PROJECTS);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(projects));
      
      // Dispatch custom event so UI can update
      window.dispatchEvent(new CustomEvent('recentProjectsUpdated', { 
        detail: projects 
      }));
    } catch (error) {
      console.error('Failed to save recent project:', error);
    }
  }

  /**
   * Remove a project from the recent list
   */
  static removeRecentProject(filePath: string): void {
    try {
      const projects = this.getRecentProjects();
      const filtered = projects.filter(p => p.filePath !== filePath);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
      
      // Dispatch custom event so UI can update
      window.dispatchEvent(new CustomEvent('recentProjectsUpdated', { 
        detail: filtered 
      }));
    } catch (error) {
      console.error('Failed to remove recent project:', error);
    }
  }

  /**
   * Clear all recent projects
   */
  static clearRecentProjects(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      
      // Dispatch custom event so UI can update
      window.dispatchEvent(new CustomEvent('recentProjectsUpdated', { 
        detail: [] 
      }));
    } catch (error) {
      console.error('Failed to clear recent projects:', error);
    }
  }

  /**
   * Check if a project file still exists
   */
  static async validateProjectExists(filePath: string): Promise<boolean> {
    try {
      // Use IPC to check if file exists
      const exists = await (window as any).electronAPI?.checkFileExists?.(filePath);
      return exists || false;
    } catch (error) {
      console.error('Failed to validate project file:', error);
      return false;
    }
  }

  /**
   * Create a RecentProject object from loaded project data
   */
  static createRecentProjectFromData(projectData: any, filePath: string): RecentProject {
    // Use file path hash as unique ID to prevent duplicate key issues
    const uniqueId = filePath.split('/').pop()?.replace('.transcript', '') || Date.now().toString();
    
    return {
      id: uniqueId,
      name: projectData.project?.name || 'Untitled Project',
      filePath: filePath,
      lastAccessed: new Date().toISOString(),
      audioFileName: projectData.project?.audio?.originalName,
      duration: projectData.project?.audio?.duration,
      speakerCount: Object.keys(projectData.speakers?.speakers || {}).length,
      segmentCount: projectData.transcription?.segments?.length || 0
    };
  }
}

export default RecentProjectsService;
export type { RecentProject };