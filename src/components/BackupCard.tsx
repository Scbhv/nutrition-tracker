import { useRef, useState } from 'react';
import { Download, Upload, Database, Check, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface BackupCardProps {
  highlightQuery?: string;
  /** Returns a JSON string bundling foods/logs/settings. */
  exportDatabase: () => string;
  /** Imports a JSON string. Returns success + optional error message. */
  importDatabase: (json: string) => { success: boolean; errorMessage?: string };
  foodsCount: number;
  logsCount: number;
}

export function BackupCard({ exportDatabase, importDatabase, foodsCount, logsCount, highlightQuery: _highlightQuery }: BackupCardProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastExport, setLastExport] = useState<string | null>(
    () => localStorage.getItem('nutritrack-last-backup')
  );

  const handleExport = () => {
    try {
      const data = exportDatabase();
      const sizeKb = (new Blob([data]).size / 1024).toFixed(1);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `nutritrack-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      const now = new Date().toISOString();
      localStorage.setItem('nutritrack-last-backup', now);
      setLastExport(now);

      toast({
        title: 'Backup exported',
        description: `${filename} (${sizeKb} KB) — contains foods, logs & settings.`,
      });
    } catch (err) {
      toast({
        title: 'Export failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so same file can be re-selected
    if (!file) return;

    try {
      const text = await file.text();
      const result = importDatabase(text);
      if (result.success) {
        toast({
          title: 'Backup restored',
          description: `Imported ${file.name}`,
        });
      } else {
        toast({
          title: 'Import failed',
          description: result.errorMessage || 'Invalid backup file.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Could not read file',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <section className="bg-card/60 backdrop-blur-2xl rounded-[20px] p-4 space-y-4 border border-border/30 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Database className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[15px] text-foreground tracking-tight">Backup & Restore</h3>
          <p className="text-[12px] text-muted-foreground/80 truncate">
            {foodsCount} foods · {logsCount} days logged
          </p>
        </div>
      </div>

      <p className="text-[12px] text-muted-foreground leading-relaxed">
        Export bundles <span className="font-medium text-foreground/80">foods.json</span>,{' '}
        <span className="font-medium text-foreground/80">logs.json</span> and{' '}
        <span className="font-medium text-foreground/80">settings.json</span> into a single file you can save
        anywhere — and re-import on any device.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={handleExport}
          className="ios-button-primary h-12 gap-2"
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
        <Button
          onClick={handleImportClick}
          variant="outline"
          className="h-12 gap-2 rounded-2xl"
        >
          <Upload className="h-4 w-4" />
          Import
        </Button>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70 pt-1">
        {lastExport ? (
          <>
            <Check className="h-3 w-3 text-primary" />
            <span>Last backup: {format(new Date(lastExport), 'MMM d, yyyy · HH:mm')}</span>
          </>
        ) : (
          <>
            <AlertCircle className="h-3 w-3 text-destructive/70" />
            <span>No backup yet — export one to be safe.</span>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFileChange}
        className="hidden"
      />
    </section>
  );
}
