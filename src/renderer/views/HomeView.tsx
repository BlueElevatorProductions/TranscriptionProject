/**
 * HomeView - Modern landing page with ScriptScribe-inspired design
 * Modularized from App.tsx for better organization
 */

import React, { useState, useEffect } from 'react';
import { TranscriptionJob } from '../types';
import RecentProjectsService, { RecentProject } from '../services/RecentProjectsService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Plus, 
  FolderOpen, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Sparkles,
  Users,
  FileAudio
} from 'lucide-react';

interface HomeViewProps {
  onNewProject: () => void;
  onOpenProject: () => void;
  onJobSelect: (job: TranscriptionJob) => void;
  onProjectFileSelect?: (filePath: string) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ 
  onNewProject, 
  onOpenProject, 
  onJobSelect,
  onProjectFileSelect 
}) => {
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  // Load recent projects on mount and listen for updates
  useEffect(() => {
    // Load initial projects
    const loadRecentProjects = () => {
      const projects = RecentProjectsService.getRecentProjects();
      setRecentProjects(projects);
    };

    loadRecentProjects();

    // Listen for updates to recent projects
    const handleRecentProjectsUpdate = (event: CustomEvent) => {
      setRecentProjects(event.detail || []);
    };

    window.addEventListener('recentProjectsUpdated', handleRecentProjectsUpdate as EventListener);

    return () => {
      window.removeEventListener('recentProjectsUpdated', handleRecentProjectsUpdate as EventListener);
    };
  }, []);

  const handleRecentProjectClick = async (project: RecentProject) => {
    try {
      // Check if file still exists
      const exists = await RecentProjectsService.validateProjectExists(project.filePath);
      
      if (!exists) {
        // File doesn't exist, remove from recent list
        RecentProjectsService.removeRecentProject(project.filePath);
        alert(`Project file not found: ${project.filePath}`);
        return;
      }

      // Load the project file
      if (onProjectFileSelect) {
        onProjectFileSelect(project.filePath);
      } else {
        // Fallback: use the electronAPI directly
        const projectData = await (window as any).electronAPI.loadProject(project.filePath);
        
        // Call the parent handler to load the project
        const loadProjectEvent = new CustomEvent('loadProjectFile', { 
          detail: { projectData, filePath: project.filePath } 
        });
        window.dispatchEvent(loadProjectEvent);
      }
    } catch (error) {
      console.error('Failed to load recent project:', error);
      alert('Failed to load project. Please try opening it manually.');
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatLastAccessed = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 7) {
      return date.toLocaleDateString();
    } else if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Welcome to TranscriptionProject
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Professional desktop transcription editor with advanced audio synchronization and cloud API integration
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={onNewProject}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Plus className="h-5 w-5 text-primary-foreground" />
                </div>
                New Project
              </CardTitle>
              <CardDescription>
                Create a new transcription project from an audio file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">
                <Sparkles className="h-4 w-4 mr-2" />
                Start New Project
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={onOpenProject}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                  <FolderOpen className="h-5 w-5 text-secondary-foreground" />
                </div>
                Open Project
              </CardTitle>
              <CardDescription>
                Continue working on an existing transcription project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                Browse Projects
              </Button>
            </CardContent>
          </Card>
        </div>


        {/* Recent Projects */}
        {recentProjects.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Recent Projects</CardTitle>
              <CardDescription>
                Continue working on your saved transcription projects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentProjects.map(project => (
                  <div 
                    key={project.filePath}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => handleRecentProjectClick(project)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">{project.name}</h4>
                        <div className="flex items-center gap-4 mt-1">
                          {project.audioFileName && (
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <FileAudio className="h-3 w-3" />
                              {project.audioFileName}
                            </span>
                          )}
                          {project.speakerCount !== undefined && project.speakerCount > 0 && (
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {project.speakerCount} speaker{project.speakerCount > 1 ? 's' : ''}
                            </span>
                          )}
                          {project.segmentCount !== undefined && project.segmentCount > 0 && (
                            <span className="text-sm text-muted-foreground">
                              {project.segmentCount} segments
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {formatLastAccessed(project.lastAccessed)}
                          </span>
                          {project.duration && (
                            <span className="text-xs text-muted-foreground">
                              • {formatDuration(project.duration)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0 text-right">
                      <div className="text-xs text-muted-foreground">
                        {project.filePath.split('/').pop()}
                      </div>
                      {project.fileSize && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatFileSize(project.fileSize)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
                <FileText className="h-12 w-12 text-muted-foreground" />
              </div>
              <CardTitle className="mb-2">No recent projects</CardTitle>
              <CardDescription className="max-w-md mx-auto">
                Import your first audio file to get started with professional transcription editing
              </CardDescription>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default HomeView;