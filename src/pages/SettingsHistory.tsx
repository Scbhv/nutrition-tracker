import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, RotateCcw, Trash2, Pencil, Undo2, Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  HistoryEntry,
  HistoryKind,
  canUndo,
  clearHistory,
  formatHistoryTime,
  registerUndoHandler,
  subscribeHistory,
  undoHistory,
} from '@/lib/settingsHistory';

const FILTERS: { key: HistoryKind | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'search', label: 'Searches' },
  { key: 'restore', label: 'Restores' },
  { key: 'delete', label: 'Deletes' },
  { key: 'edit', label: 'Edits' },
];

const ICONS: Record<HistoryKind, typeof Search> = {
  search: Search,
  restore: RotateCcw,
  delete: Trash2,
  edit: Pencil,
};

export default function SettingsHistory() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState<HistoryKind | 'all'>('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => subscribeHistory(setEntries), []);

  // Storage-backed undos that work even though the settings screen isn't mounted.
  useEffect(() => {
    const offs = [
      registerUndoHandler('search', async (p) => {
        const { saveSettingsQuery } = await import('@/lib/settingsSearch');
        saveSettingsQuery((p as { query?: string })?.query ?? '');
      }),
      registerUndoHandler('errorLog', async (p) => {
        const { restoreErrorLog } = await import('@/lib/errorLog');
        restoreErrorLog((p as never) ?? []);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  const visible = useMemo(
    () => (filter === 'all' ? entries : entries.filter((e) => e.kind === filter)),
    [entries, filter],
  );

  const handleUndo = async (entry: HistoryEntry) => {
    setBusyId(entry.id);
    const res = await undoHistory(entry.id);
    setBusyId(null);
    if (res.ok) toast({ title: 'Undone', description: entry.title });
    else
      toast({
        title: "Couldn't undo",
        description: res.error ?? 'Unknown error',
        variant: 'destructive',
      });
  };

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-20 safe-top bg-background/80 backdrop-blur-2xl border-b border-border/30">
        <div className="w-full max-w-lg mx-auto px-3 xs:px-4 h-14 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="h-10 px-2 -ml-2 rounded-xl"
          >
            <ChevronLeft className="h-5 w-5" />
            Settings
          </Button>
          <h1 className="text-[16px] font-semibold tracking-tight ml-auto mr-auto pr-14">History</h1>
        </div>
      </header>

      <main className="w-full max-w-lg mx-auto px-3 xs:px-4 py-4 pb-24 space-y-4">
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          Every settings search, backup restore, deletion and edit you've made on this device. Undo
          puts things back the way they were.
        </p>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`h-9 px-3.5 rounded-full text-[13px] border transition-colors ${
                filter === f.key
                  ? 'bg-primary text-primary-foreground border-transparent'
                  : 'bg-card/60 border-border/40 text-muted-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[15px] text-muted-foreground">Nothing recorded yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((entry) => {
              const Icon = ICONS[entry.kind];
              const undoable = canUndo(entry);
              return (
                <li
                  key={entry.id}
                  className="bg-card/60 backdrop-blur-2xl rounded-[20px] border border-border/30 shadow-sm p-3.5 flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-foreground break-words">
                      {entry.title}
                    </p>
                    {entry.detail && (
                      <p className="text-[12px] text-muted-foreground/80 break-words">{entry.detail}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                      {formatHistoryTime(entry.at)}
                      {entry.undone && ' · undone'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!undoable || busyId === entry.id}
                    onClick={() => handleUndo(entry)}
                    className="h-10 rounded-xl shrink-0 transition-transform active:scale-[0.98] disabled:opacity-40"
                  >
                    <Undo2 className="h-4 w-4 mr-1.5" />
                    Undo
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {entries.length > 0 && (
          <Button
            variant="outline"
            onClick={() => setConfirmClear(true)}
            className="w-full h-12 rounded-2xl text-destructive border-destructive/20 hover:bg-destructive/10"
          >
            <Eraser className="h-4 w-4 mr-2" />
            Clear history
          </Button>
        )}
      </main>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent className="max-w-sm rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the whole history?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes all {entries.length} recorded actions and their undo snapshots. Your
              settings and food data stay exactly as they are — but you won't be able to undo past
              actions anymore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-12 rounded-xl">Keep history</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearHistory();
                toast({ title: 'History cleared' });
              }}
              className="h-12 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
