import { useState, useCallback, useEffect, useRef } from 'react';
import { FoodItem, DailyLog, UserSettings } from '@/types/nutrients';
import { validateImportData } from '@/lib/schemas/importValidation';

const AUTO_SAVE_DELAY = 2000; // 2 seconds debounce

interface FileSystemState {
  isSupported: boolean;
  hasPermission: boolean;
  directoryHandle: any | null;
  fileName: string;
  lastSaved: Date | null;
  isAutoSaveEnabled: boolean;
}

interface SavedFile {
  name: string;
  lastModified: Date;
  foods: FoodItem[];
}

export function useFileSystemSync() {
  const [state, setState] = useState<FileSystemState>({
    isSupported: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
    hasPermission: false,
    directoryHandle: null,
    fileName: 'nutritrack-foods.json',
    lastSaved: null,
    isAutoSaveEnabled: false,
  });
  
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Request directory access
  const requestAccess = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      console.warn('File System Access API not supported');
      return false;
    }

    try {
      const showDirectoryPicker = (window as any).showDirectoryPicker;
      if (!showDirectoryPicker) return false;
      
      const dirHandle = await showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
      });

      setState(prev => ({
        ...prev,
        hasPermission: true,
        directoryHandle: dirHandle,
        isAutoSaveEnabled: true,
      }));

      return true;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error requesting directory access:', error);
      }
      return false;
    }
  }, [state.isSupported]);

  // Save data to file
  const saveToFile = useCallback(async (
    foods: FoodItem[],
    logs: DailyLog[],
    settings: UserSettings,
    fileName?: string
  ): Promise<boolean> => {
    const handle = state.directoryHandle;
    if (!handle) return false;

    try {
      const targetFileName = fileName || state.fileName;
      const fileHandle = await handle.getFileHandle(targetFileName, { create: true });
      const writable = await fileHandle.createWritable();
      
      const data = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        foods,
        logs,
        settings,
      };

      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();

      setState(prev => ({
        ...prev,
        lastSaved: new Date(),
        fileName: targetFileName,
      }));

      return true;
    } catch (error) {
      console.error('Error saving to file:', error);
      return false;
    }
  }, [state.directoryHandle, state.fileName]);

  // Debounced auto-save
  const scheduleAutoSave = useCallback((
    foods: FoodItem[],
    logs: DailyLog[],
    settings: UserSettings
  ) => {
    if (!state.isAutoSaveEnabled || !state.directoryHandle) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveToFile(foods, logs, settings);
    }, AUTO_SAVE_DELAY);
  }, [state.isAutoSaveEnabled, state.directoryHandle, saveToFile]);

  // Load files from directory
  const loadFilesFromDirectory = useCallback(async (): Promise<SavedFile[]> => {
    const handle = state.directoryHandle;
    if (!handle) return [];

    setIsLoading(true);
    const files: SavedFile[] = [];

    try {
      // Use for-await to iterate over directory entries
      for await (const entry of handle) {
        const [name, fileHandle] = entry;
        if (fileHandle.kind === 'file' && name.endsWith('.json')) {
          try {
            const file = await fileHandle.getFile();
            const content = await file.text();
            const validation = validateImportData(content);
            
            if (validation.success && validation.data?.foods) {
              files.push({
                name,
                lastModified: new Date(file.lastModified),
                foods: validation.data.foods as FoodItem[],
              });
            }
          } catch (e) {
            console.warn(`Could not read file ${name}:`, e);
          }
        }
      }

      setSavedFiles(files);
      return files;
    } catch (error) {
      console.error('Error loading files from directory:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [state.directoryHandle]);

  // Import from a specific file
  const importFromFile = useCallback(async (fileName: string): Promise<{
    success: boolean;
    data?: { foods: FoodItem[]; logs: DailyLog[]; settings: UserSettings };
    error?: string;
  }> => {
    const handle = state.directoryHandle;
    if (!handle) return { success: false, error: 'No directory access' };

    try {
      const fileHandle = await handle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const content = await file.text();
      
      const validation = validateImportData(content);
      
      if (!validation.success) {
        return { success: false, error: validation.errorMessage };
      }

      return {
        success: true,
        data: {
          foods: validation.data!.foods as FoodItem[],
          logs: validation.data!.logs as DailyLog[],
          settings: validation.data!.settings as UserSettings,
        },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [state.directoryHandle]);

  // Toggle auto-save
  const toggleAutoSave = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, isAutoSaveEnabled: enabled }));
  }, []);

  // Set file name
  const setFileName = useCallback((name: string) => {
    setState(prev => ({ ...prev, fileName: name.endsWith('.json') ? name : `${name}.json` }));
  }, []);

  // Disconnect from directory
  const disconnect = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setState(prev => ({
      ...prev,
      hasPermission: false,
      directoryHandle: null,
      isAutoSaveEnabled: false,
      lastSaved: null,
    }));
    setSavedFiles([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    savedFiles,
    isLoading,
    requestAccess,
    saveToFile,
    scheduleAutoSave,
    loadFilesFromDirectory,
    importFromFile,
    toggleAutoSave,
    setFileName,
    disconnect,
  };
}
