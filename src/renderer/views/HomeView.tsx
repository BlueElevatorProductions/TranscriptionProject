/**
 * HomeView - Modern landing page with ScriptScribe-inspired design
 * Modularized from App.tsx for better organization
 */

import React from 'react';
import { useTranscriptionJobs } from '../contexts';
import { TranscriptionJob } from '../types';
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
  Sparkles
} from 'lucide-react';

interface HomeViewProps {
  onNewProject: () => void;
  onOpenProject: () => void;
  onJobSelect: (job: TranscriptionJob) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onNewProject, onOpenProject, onJobSelect }) => {
  const { jobs } = useTranscriptionJobs();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'processing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
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


        {/* Recent Transcriptions */}
        {jobs.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Recent Transcriptions</CardTitle>
              <CardDescription>
                Continue working on your recent projects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {jobs.map(job => (
                  <div 
                    key={job.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => onJobSelect(job)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        {getStatusIcon(job.status)}
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">{job.fileName}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                          {job.status === 'completed' && job.result?.segments && (
                            <span className="text-sm text-muted-foreground">
                              {job.result.segments.length} segments
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0">
                      {job.status === 'processing' && (
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${job.progress}%` }}
                          ></div>
                        </div>
                      )}
                      {job.status === 'error' && job.error && (
                        <span className="text-xs text-red-500 max-w-32 truncate" title={job.error}>
                          {job.error}
                        </span>
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
              <CardTitle className="mb-2">No transcriptions yet</CardTitle>
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