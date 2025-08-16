import React from 'react';
import { Info, FileText, Clock, User, Hash, Calendar, HardDrive } from 'lucide-react';

interface InfoPanelProps {
  fileName?: string;
  projectName?: string;
  duration?: number;
  wordCount?: number;
  speakerCount?: number;
  createdAt?: Date;
  modifiedAt?: Date;
  fileSize?: number;
  transcriptionModel?: string;
  audioFormat?: string;
  sampleRate?: number;
}

const InfoPanel: React.FC<InfoPanelProps> = ({
  fileName = 'Unknown',
  projectName = 'Untitled Project',
  duration = 0,
  wordCount = 0,
  speakerCount = 0,
  createdAt,
  modifiedAt,
  fileSize = 0,
  transcriptionModel = 'Not specified',
  audioFormat,
  sampleRate
}) => {
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date?: Date): string => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const infoItems = [
    {
      icon: FileText,
      label: 'Project Name',
      value: projectName
    },
    {
      icon: FileText,
      label: 'File Name',
      value: fileName
    },
    {
      icon: Clock,
      label: 'Duration',
      value: formatDuration(duration)
    },
    {
      icon: Hash,
      label: 'Word Count',
      value: wordCount.toLocaleString()
    },
    {
      icon: User,
      label: 'Speakers',
      value: speakerCount.toString()
    },
    {
      icon: Calendar,
      label: 'Created',
      value: formatDate(createdAt)
    },
    {
      icon: Calendar,
      label: 'Modified',
      value: formatDate(modifiedAt)
    },
    {
      icon: HardDrive,
      label: 'File Size',
      value: formatFileSize(fileSize)
    },
    {
      icon: Info,
      label: 'Model',
      value: transcriptionModel
    }
  ];

  if (audioFormat) {
    infoItems.push({
      icon: FileText,
      label: 'Audio Format',
      value: audioFormat.toUpperCase()
    });
  }

  if (sampleRate) {
    infoItems.push({
      icon: Info,
      label: 'Sample Rate',
      value: `${sampleRate / 1000} kHz`
    });
  }

  return (
    <div className="info-panel h-full flex flex-col bg-card">
      <div className="panel-header p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Project Info</h3>
        </div>
      </div>
      
      <div className="info-list flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {infoItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className="info-item">
                <div className="flex items-start gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                    <div className="text-sm font-medium">{item.value}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Statistics Section */}
        <div className="mt-6 pt-6 border-t border-border">
          <h4 className="text-sm font-medium mb-3">Statistics</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="stat-card p-3 bg-background rounded-md">
              <div className="text-2xl font-bold">{wordCount}</div>
              <div className="text-xs text-muted-foreground">Total Words</div>
            </div>
            <div className="stat-card p-3 bg-background rounded-md">
              <div className="text-2xl font-bold">{speakerCount}</div>
              <div className="text-xs text-muted-foreground">Speakers</div>
            </div>
            <div className="stat-card p-3 bg-background rounded-md">
              <div className="text-2xl font-bold">
                {duration > 0 ? Math.round(wordCount / (duration / 60)) : 0}
              </div>
              <div className="text-xs text-muted-foreground">Words/Min</div>
            </div>
            <div className="stat-card p-3 bg-background rounded-md">
              <div className="text-2xl font-bold">
                {speakerCount > 0 ? Math.round(wordCount / speakerCount) : 0}
              </div>
              <div className="text-xs text-muted-foreground">Words/Speaker</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfoPanel;