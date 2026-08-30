import { useEffect, useState } from 'react';
import { WifiOff, Wifi, Trash2, Database, Cpu, AlertCircle, CheckCircle2, FolderOpen, Cloud } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  isOfflineMode,
  setOfflineMode,
  subscribe,
  getSourceLog,
  clearSourceLog,
  reportSource,
  type DataSource,
  type SourceEvent,
} from '@/lib/offlineMode';
import { toast } from 'sonner';

const SOURCE_META: Record<DataSource, { label: string; icon: typeof Database; tone: string }> = {
  'local-db': { label: 'Local DB', icon: FolderOpen, tone: 'bg-muted text-foreground' },
  'local-files': { label: 'Local files', tone: 'bg-muted text-foreground', icon: FolderOpen },
  openfoodfacts: { label: 'Open Food Facts', tone: 'bg-primary/15 text-primary', icon: Database },
  ai: { label: 'AI', tone: 'bg-accent/20 text-accent', icon: Cpu },
  supabase: { label: 'Cloud', tone: 'bg-secondary text-secondary-foreground', icon: Cloud },
  'offline-skip': { label: 'Skipped (offline)', tone: 'bg-muted text-muted-foreground', icon: WifiOff },
  error: { label: 'Error', tone: 'bg-destructive/15 text-destructive', icon: AlertCircle },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function OfflineSimulationCard({ highlightQuery: _highlightQuery }: { highlightQuery?: string } = {}) {
  const [offline, setOffline] = useState<boolean>(() => isOfflineMode());
  const [log, setLog] = useState<SourceEvent[]>(() => getSourceLog());

  useEffect(() => {
    return subscribe(() => {
      setOffline(isOfflineMode());
      setLog(getSourceLog());
    });
  }, []);

  const handleToggle = (next: boolean) => {
    setOfflineMode(next);
    reportSource('Offline Mode', next ? 'offline-skip' : 'supabase', {
      detail: next ? 'Offline simulation enabled' : 'Offline simulation disabled',
    });
    toast.success(next ? 'Offline simulation on' : 'Offline simulation off', {
      description: next
        ? 'Network calls are skipped. App reads from local files only.'
        : 'Network calls re-enabled.',
    });
  };

  const handleClear = () => {
    clearSourceLog();
    toast.success('Source log cleared');
  };

  const ok = log.filter((e) => e.ok).length;
  const failed = log.length - ok;

  return (
    <Card className="rounded-2xl border-border/60 p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${
            offline ? 'bg-amber-500/15 text-amber-500' : 'bg-muted text-muted-foreground'
          }`}
        >
          {offline ? <WifiOff className="h-5 w-5" /> : <Wifi className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold tracking-tight">Offline Simulation</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Force the app to use only on-device data files. Useful for verifying
            true offline behavior.
          </p>
        </div>
        <Switch checked={offline} onCheckedChange={handleToggle} />
      </div>

      <div className="rounded-xl bg-muted/40 px-3 py-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Recent data sources</span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-foreground">
            <CheckCircle2 className="h-3 w-3 text-primary" />
            {ok}
          </span>
          <span className="inline-flex items-center gap-1 text-foreground">
            <AlertCircle className="h-3 w-3 text-destructive" />
            {failed}
          </span>
          {log.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 active:scale-[0.92] transition-transform"
              onClick={handleClear}
              aria-label="Clear log"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {log.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          No data-source activity yet. Try a lookup, scan, or sign-in.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {log.slice(0, 20).map((e) => {
            const meta = SOURCE_META[e.source] ?? SOURCE_META.error;
            const Icon = meta.icon;
            return (
              <div
                key={e.id}
                className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 text-xs"
              >
                <Badge
                  variant="outline"
                  className={`shrink-0 gap-1 border-0 ${meta.tone}`}
                >
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{e.feature}</p>
                  {e.detail && (
                    <p className="text-muted-foreground truncate">{e.detail}</p>
                  )}
                </div>
                <span className="text-muted-foreground shrink-0">{timeAgo(e.timestamp)}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
