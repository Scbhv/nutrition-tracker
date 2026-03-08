import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit, Trash2, Download, Upload, FolderOpen, FolderSync, Check, X, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FoodItem, DailyLog, UserSettings } from '@/types/nutrients';
import { useFileSystemSync } from '@/hooks/useFileSystemSync';
import { cn } from '@/lib/utils';

interface FoodDatabaseViewProps {
  foods: FoodItem[];
  logs: DailyLog[];
  settings: UserSettings;
  onAddFood: () => void;
  onEditFood: (food: FoodItem) => void;
  onDeleteFood: (id: string) => void;
  onLogFood: (foodId: string, portionGrams: number) => void;
  onExport: () => void;
  onImport: () => void;
  onImportFoods: (foods: FoodItem[]) => void;
}

export function FoodDatabaseView({
  foods,
  logs,
  settings,
  onAddFood,
  onEditFood,
  onDeleteFood,
  onLogFood,
  onExport,
  onImport,
  onImportFoods,
}: FoodDatabaseViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'database' | 'files'>('database');
  const [portionFood, setPortionFood] = useState<FoodItem | null>(null);
  const [portionGrams, setPortionGrams] = useState('');
  const portionInputRef = useRef<HTMLInputElement>(null);
  
  const fileSystem = useFileSystemSync();

  // Auto-save when data changes
  useEffect(() => {
    if (fileSystem.isAutoSaveEnabled && fileSystem.hasPermission) {
      fileSystem.scheduleAutoSave(foods, logs, settings);
    }
  }, [foods, logs, settings, fileSystem.isAutoSaveEnabled, fileSystem.hasPermission]);

  // Load files when directory is connected
  useEffect(() => {
    if (fileSystem.hasPermission) {
      fileSystem.loadFilesFromDirectory();
    }
  }, [fileSystem.hasPermission]);

  const filteredFoods = foods.filter(food =>
    food.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    food.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    food.barcode?.includes(searchQuery)
  );

  const handleConnectFolder = async () => {
    const success = await fileSystem.requestAccess();
    if (success) {
      // Initial save after connecting
      await fileSystem.saveToFile(foods, logs, settings);
    }
  };

  const handleImportFromFile = async (fileName: string) => {
    const result = await fileSystem.importFromFile(fileName);
    if (result.success && result.data) {
      onImportFoods(result.data.foods);
    }
  };

  const openPortionDialog = (food: FoodItem) => {
    setPortionFood(food);
    setPortionGrams(String(food.servingSize));
    setTimeout(() => portionInputRef.current?.select(), 100);
  };

  const confirmPortion = () => {
    if (!portionFood) return;
    const grams = parseFloat(portionGrams);
    if (isNaN(grams) || grams <= 0) return;
    onLogFood(portionFood.id, grams);
    setPortionFood(null);
    setPortionGrams('');
  };

  const handleManualSave = async () => {
    await fileSystem.saveToFile(foods, logs, settings);
  };

  // Get all foods from saved files (excluding current database foods by ID)
  const fileFoods = fileSystem.savedFiles.flatMap(file => 
    file.foods.map(food => ({ ...food, _sourceFile: file.name }))
  );

  const filteredFileFoods = fileFoods.filter(food =>
    food.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    food.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    food.barcode?.includes(searchQuery)
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Search & Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search foods..."
            className="pl-10 bg-secondary border-0 rounded-xl"
          />
        </div>
        <Button onClick={onAddFood} className="ios-button-primary">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Sub-tabs for Database vs Files */}
      <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'database' | 'files')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="database" className="gap-2">
            <FileJson className="h-4 w-4" />
            Database ({foods.length})
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Files {fileSystem.hasPermission && `(${fileSystem.savedFiles.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="database" className="space-y-4 mt-4">
          {/* Export/Import */}
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={onExport} className="rounded-full">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="secondary" size="sm" onClick={onImport} className="rounded-full">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </div>

          {/* Food List */}
          <ScrollArea className="h-[calc(100vh-380px)]">
            <div className="space-y-2 pr-4">
              {filteredFoods.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <p className="text-lg font-medium">No foods yet</p>
                  <p className="text-sm mt-1">Add your first food to get started!</p>
                </div>
              ) : (
                filteredFoods.map(food => (
                  <FoodDatabaseCard
                    key={food.id}
                    food={food}
                    onEdit={() => onEditFood(food)}
                    onDelete={() => onDeleteFood(food.id)}
                    onLog={() => openPortionDialog(food)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="files" className="space-y-4 mt-4">
          {!fileSystem.isSupported ? (
            <div className="glass-card rounded-2xl p-6 text-center">
              <FolderOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-semibold mb-2">Not Supported</h3>
              <p className="text-sm text-muted-foreground">
                File System Access is not supported in this browser. 
                Use Chrome or Edge on desktop for automatic file syncing.
              </p>
            </div>
          ) : !fileSystem.hasPermission ? (
            <div className="glass-card rounded-2xl p-6 text-center">
              <FolderSync className="h-10 w-10 mx-auto mb-3 text-primary" />
              <h3 className="font-semibold mb-2">Connect to Files App</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select a folder to automatically save your food database as JSON files for offline access.
              </p>
              <Button onClick={handleConnectFolder} className="ios-button-primary">
                <FolderOpen className="h-4 w-4 mr-2" />
                Choose Folder
              </Button>
            </div>
          ) : (
            <>
              {/* Sync Status */}
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-sm font-medium">Connected</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={fileSystem.disconnect} className="text-destructive">
                    <X className="h-4 w-4 mr-1" />
                    Disconnect
                  </Button>
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm">Auto-save</span>
                  <Switch
                    checked={fileSystem.isAutoSaveEnabled}
                    onCheckedChange={fileSystem.toggleAutoSave}
                  />
                </div>
                
                <div className="flex items-center justify-between py-2 border-t border-border/50">
                  <div>
                    <p className="text-sm">File: {fileSystem.fileName}</p>
                    {fileSystem.lastSaved && (
                      <p className="text-xs text-muted-foreground">
                        Last saved: {fileSystem.lastSaved.toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                  <Button variant="secondary" size="sm" onClick={handleManualSave}>
                    <Download className="h-4 w-4 mr-1" />
                    Save Now
                  </Button>
                </div>
              </div>

              {/* Files in Directory */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Saved Files</h3>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => fileSystem.loadFilesFromDirectory()}
                    disabled={fileSystem.isLoading}
                  >
                    Refresh
                  </Button>
                </div>
                
                <ScrollArea className="h-[calc(100vh-520px)]">
                  <div className="space-y-2 pr-4">
                    {fileSystem.isLoading ? (
                      <div className="text-center py-8">
                        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                      </div>
                    ) : fileSystem.savedFiles.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileJson className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No JSON files found</p>
                      </div>
                    ) : (
                      fileSystem.savedFiles.map(file => (
                        <div key={file.name} className="glass-card rounded-xl p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {file.foods.length} foods • {file.lastModified.toLocaleDateString()}
                              </p>
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleImportFromFile(file.name)}
                            >
                              <Upload className="h-4 w-4 mr-1" />
                              Import
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Foods from Files */}
              {filteredFileFoods.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Foods in Files ({filteredFileFoods.length})</h3>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2 pr-4">
                      {filteredFileFoods.map((food, idx) => (
                        <div key={`${food.id}-${idx}`} className="glass-card rounded-xl p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">{food.name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {(food as any)._sourceFile}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {food.nutrients['energy-kcal'] || 0} kcal
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openPortionDialog(food)}
                              className="rounded-full h-8 w-8"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Portion Dialog */}
      <Dialog open={!!portionFood} onOpenChange={(open) => !open && setPortionFood(null)}>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center">
              {portionFood?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="text-center text-sm text-muted-foreground">
              {portionFood?.servingSize}{portionFood?.servingUnit} per serving •{' '}
              {portionFood?.nutrients['energy-kcal'] || 0} kcal/100g
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {[50, 100, 150, 200].map(g => (
                <button
                  key={g}
                  onClick={() => setPortionGrams(String(g))}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                    portionGrams === String(g)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-secondary-foreground border-border hover:bg-accent"
                  )}
                >
                  {g}g
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Input
                ref={portionInputRef}
                type="number"
                inputMode="decimal"
                min="1"
                value={portionGrams}
                onChange={(e) => setPortionGrams(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmPortion()}
                className="text-center text-lg font-semibold rounded-xl"
                placeholder="100"
              />
              <span className="text-muted-foreground font-medium shrink-0">grams</span>
            </div>
            {portionGrams && parseFloat(portionGrams) > 0 && portionFood && (
              <div className="text-center text-sm text-muted-foreground">
                ≈ {Math.round((portionFood.nutrients['energy-kcal'] || 0) * parseFloat(portionGrams) / 100)} kcal
              </div>
            )}
            <Button onClick={confirmPortion} className="w-full rounded-xl">
              Add to Today
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FoodDatabaseCard({
  food,
  onEdit,
  onDelete,
  onLog,
}: {
  food: FoodItem;
  onEdit: () => void;
  onDelete: () => void;
  onLog: () => void;
}) {
  return (
    <div className="glass-card rounded-2xl p-4 group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0" onClick={onLog}>
          <h4 className="font-semibold text-foreground truncate">{food.name}</h4>
          {food.brand && (
            <p className="text-xs text-muted-foreground">{food.brand}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2 text-xs">
            <span className="text-muted-foreground">{food.servingSize}{food.servingUnit}</span>
            <span className="text-primary">{food.nutrients['energy-kcal'] || 0} kcal</span>
            <span className="text-nutrient-protein">{food.nutrients['proteins'] || 0}g P</span>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" onClick={onLog} className="rounded-full">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onEdit} className="rounded-full">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} className="rounded-full hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
