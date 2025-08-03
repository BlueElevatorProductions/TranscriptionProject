/**
 * ProjectContext - Centralized project data management
 * Handles project file data, speakers, segments, and persistence state
 */

import React, { createContext, useContext, useReducer, ReactNode, useCallback } from 'react';
import { ProjectState, ProjectAction, ProjectData, Segment, UseProjectReturn } from '../types';

// ==================== Initial State ====================

const initialProjectState: ProjectState = {
  projectData: null,
  hasUnsavedChanges: false,
  currentProjectPath: null,
  globalSpeakers: {},
  editedSegments: [],
  isLoading: false,
  error: null,
};

// ==================== Reducer ====================

function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'LOAD_PROJECT': {
      const projectData = action.payload;
      console.log('ProjectContext - Loading project:', projectData.project.name);
      
      return {
        ...state,
        projectData,
        globalSpeakers: projectData.speakers?.speakerMappings || projectData.speakers?.speakers || {},
        editedSegments: projectData.transcription?.segments || [],
        hasUnsavedChanges: false,
        isLoading: false,
        error: null,
      };
    }

    case 'UPDATE_PROJECT_DATA': {
      if (!state.projectData) {
        console.warn('ProjectContext - Cannot update project data: no project loaded');
        return state;
      }

      const updatedProjectData = {
        ...state.projectData,
        ...action.payload,
        project: {
          ...state.projectData.project,
          ...action.payload.project,
          lastModified: new Date().toISOString(),
        },
      };

      return {
        ...state,
        projectData: updatedProjectData,
        hasUnsavedChanges: true,
      };
    }

    case 'SET_UNSAVED_CHANGES':
      return {
        ...state,
        hasUnsavedChanges: action.payload,
      };

    case 'UPDATE_SPEAKERS': {
      const newSpeakers = action.payload;
      console.log('ProjectContext - Updating speakers:', newSpeakers);

      let updatedProjectData = state.projectData;
      if (updatedProjectData) {
        updatedProjectData = {
          ...updatedProjectData,
          speakers: {
            ...updatedProjectData.speakers,
            speakers: newSpeakers,
            speakerMappings: newSpeakers,
          },
          project: {
            ...updatedProjectData.project,
            lastModified: new Date().toISOString(),
          },
        };
      }

      return {
        ...state,
        globalSpeakers: newSpeakers,
        projectData: updatedProjectData,
        hasUnsavedChanges: true,
      };
    }

    case 'UPDATE_SEGMENTS': {
      const newSegments = action.payload;
      console.log('ProjectContext - Updating segments:', newSegments.length, 'segments');

      let updatedProjectData = state.projectData;
      if (updatedProjectData) {
        // Calculate metadata
        const totalWords = newSegments.reduce((sum, seg) => sum + (seg.words?.length || 0), 0);
        const averageConfidence = newSegments.length > 0 
          ? newSegments.reduce((sum, seg) => {
              const segmentConfidence = seg.words?.reduce((wordSum, word) => wordSum + (word.score || 0), 0) || 0;
              return sum + (segmentConfidence / (seg.words?.length || 1));
            }, 0) / newSegments.length
          : 0;

        updatedProjectData = {
          ...updatedProjectData,
          transcription: {
            ...updatedProjectData.transcription,
            segments: newSegments,
            globalMetadata: {
              ...updatedProjectData.transcription?.globalMetadata,
              totalSegments: newSegments.length,
              totalWords,
              averageConfidence,
              editCount: (updatedProjectData.transcription?.globalMetadata?.editCount || 0) + 1,
            },
          },
          project: {
            ...updatedProjectData.project,
            lastModified: new Date().toISOString(),
          },
        };
      }

      return {
        ...state,
        editedSegments: newSegments,
        projectData: updatedProjectData,
        hasUnsavedChanges: true,
      };
    }

    case 'SET_PROJECT_PATH':
      return {
        ...state,
        currentProjectPath: action.payload,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case 'RESET_PROJECT':
      console.log('ProjectContext - Resetting project state');
      return {
        ...initialProjectState,
      };

    default:
      return state;
  }
}

// ==================== Context Creation ====================

interface ProjectContextType {
  state: ProjectState;
  dispatch: React.Dispatch<ProjectAction>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// ==================== Provider Component ====================

interface ProjectProviderProps {
  children: ReactNode;
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(projectReducer, initialProjectState);

  const value = {
    state,
    dispatch,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

// ==================== Custom Hook ====================

export const useProject = (): UseProjectReturn => {
  const context = useContext(ProjectContext);
  
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }

  const { state, dispatch } = context;

  // Action creators
  const actions = {
    loadProject: useCallback((projectData: ProjectData) => {
      dispatch({ type: 'LOAD_PROJECT', payload: projectData });
    }, [dispatch]),

    updateProjectData: useCallback((updates: Partial<ProjectData>) => {
      dispatch({ type: 'UPDATE_PROJECT_DATA', payload: updates });
    }, [dispatch]),

    updateSpeakers: useCallback((speakers: { [key: string]: string }) => {
      dispatch({ type: 'UPDATE_SPEAKERS', payload: speakers });
    }, [dispatch]),

    updateSegments: useCallback((segments: Segment[]) => {
      dispatch({ type: 'UPDATE_SEGMENTS', payload: segments });
    }, [dispatch]),

    setUnsavedChanges: useCallback((hasChanges: boolean) => {
      dispatch({ type: 'SET_UNSAVED_CHANGES', payload: hasChanges });
    }, [dispatch]),

    setProjectPath: useCallback((path: string | null) => {
      dispatch({ type: 'SET_PROJECT_PATH', payload: path });
    }, [dispatch]),

    setLoading: useCallback((loading: boolean) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    }, [dispatch]),

    setError: useCallback((error: string | null) => {
      dispatch({ type: 'SET_ERROR', payload: error });
    }, [dispatch]),

    resetProject: useCallback(() => {
      dispatch({ type: 'RESET_PROJECT' });
    }, [dispatch]),

    // Complex operations
    saveProject: useCallback(async (): Promise<void> => {
      if (!state.projectData) {
        throw new Error('No project data to save');
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        // Prepare save data with current state
        const saveData = {
          ...state.projectData,
          project: {
            ...state.projectData.project,
            lastModified: new Date().toISOString(),
          },
          transcription: {
            ...state.projectData.transcription,
            segments: state.editedSegments,
          },
          speakers: {
            ...state.projectData.speakers,
            speakers: state.globalSpeakers,
            speakerMappings: state.globalSpeakers,
          },
        };

        let filePath = state.currentProjectPath;

        // Show save dialog for new projects
        if (!filePath) {
          const result = await (window as any).electronAPI.saveProjectDialog(
            `${state.projectData.project.name || 'Untitled'}.transcript`
          );

          if (result.canceled || !result.filePath) {
            dispatch({ type: 'SET_LOADING', payload: false });
            return;
          }

          filePath = result.filePath;
          dispatch({ type: 'SET_PROJECT_PATH', payload: filePath });
        }

        // Save project file
        await (window as any).electronAPI.saveProject(saveData, filePath);
        
        dispatch({ type: 'SET_UNSAVED_CHANGES', payload: false });
        dispatch({ type: 'SET_LOADING', payload: false });
        
        console.log('ProjectContext - Project saved successfully to:', filePath);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to save project';
        console.error('ProjectContext - Save failed:', error);
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        throw error;
      }
    }, [state.projectData, state.editedSegments, state.globalSpeakers, state.currentProjectPath, dispatch]),
  };

  return {
    state,
    actions,
  };
};

// ==================== Selector Hooks ====================

/**
 * Hook for components that only need speaker data
 */
export const useSpeakers = () => {
  const { state, actions } = useProject();
  
  return {
    speakers: state.globalSpeakers,
    updateSpeakers: actions.updateSpeakers,
    isLoading: state.isLoading,
  };
};

/**
 * Hook for components that only need segment data
 */
export const useSegments = () => {
  const { state, actions } = useProject();
  
  return {
    segments: state.editedSegments,
    updateSegments: actions.updateSegments,
    isLoading: state.isLoading,
  };
};

/**
 * Hook for components that need project metadata
 */
export const useProjectMetadata = () => {
  const { state } = useProject();
  
  return {
    projectData: state.projectData,
    projectName: state.projectData?.project.name || 'Untitled Project',
    hasUnsavedChanges: state.hasUnsavedChanges,
    currentProjectPath: state.currentProjectPath,
    isLoading: state.isLoading,
    error: state.error,
  };
};

// ==================== Legacy Compatibility ====================

/**
 * Temporary hook for backward compatibility with existing components
 * @deprecated Use useProject(), useSpeakers(), or useSegments() instead
 */
export const useLegacyProjectState = () => {
  const { state, actions } = useProject();
  
  return {
    // Legacy state format
    projectData: state.projectData,
    hasUnsavedChanges: state.hasUnsavedChanges,
    currentProjectPath: state.currentProjectPath,
    globalSpeakers: state.globalSpeakers,
    editedSegments: state.editedSegments,
    
    // Legacy action format
    setHasUnsavedChanges: actions.setUnsavedChanges,
    handleSpeakerUpdate: actions.updateSpeakers,
    handleSegmentUpdate: actions.updateSegments,
    handleSave: actions.saveProject,
    handleProjectLoaded: actions.loadProject,
  };
};