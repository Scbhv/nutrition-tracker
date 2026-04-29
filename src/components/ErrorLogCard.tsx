import { useEffect, useState } from 'react';
import { AlertTriangle, Copy, Trash2, ChevronDown, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  getErrorLog,
  subscribeErrorLog,
  clearErrorLog,
  formatErrorReport,
  type ErrorEntry,
} from '@/lib/errorLog';
import { toast } from 'sonner';

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

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error('Could not copy to clipboard');
  }
}

export function ErrorLogCard() {
  const [entries, setEntries] = useState<ErrorEntry[]>(() => getErrorLog());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => subscribeErrorLog(() => setEntries(getErrorLog())), []);

  const handleCopyOne = async (e: ErrorEntry) => {
    await copy(formatErrorReport([e]), 'Error');
    setCopiedId(e.id);
    setTimeout(() => setCopiedId((c) => (c === e.id ? null : c)), 1500);
  };

  const handleCopyAll = () => copy(formatErrorReport(entries), 'Full report');

  const handleClear = () => {
    clearErrorLog();
    toast.success('Error log cleared');
  };

  return (
    <Card className="rounded-2xl border-border/60 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${
            entries.length > 0
              ? 'bg-destructive/15 text-destructive'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold tracking-tight">Error Log</h3>
            <Badge variant={entries.length > 0 ? 'destructive' : 'outline'}>
              {entries.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recent failures from scans, lookups, parsing and exports.
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No errors recorded. ✨
        </p>
      ) : (
        <>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {entries.slice(0, 25).map((e) => (
              <Collapsible key={e.id}>
                <div className="rounded-lg bg-muted/40 border border-border/40">
                  <div className="flex items-center gap-2 p-2">
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {e.source}
                    </Badge>
                    <p className="flex-1 min-w-0 text-xs font-medium text-foreground truncate">
                      {e.message}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {timeAgo(e.timestamp)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 active:scale-[0.92] transition-transform"
                      onClick={() => handleCopyOne(e)}
                      aria-label="Copy error"
                    >
                      {copiedId === e.id ? (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    {e.detail && (
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 active:scale-[0.92] transition-transform data-[state=open]:rotate-180"
                          aria-label="Toggle details"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </CollapsibleTrigger>
                    )}
                  </div>
                  {e.detail && (
                    <CollapsibleContent>
                      <pre className="text-[10px] leading-snug font-mono whitespace-pre-wrap break-words p-2 pt-0 text-muted-foreground max-h-40 overflow-y-auto">
                        {e.detail}
                      </pre>
                    </CollapsibleContent>
                  )}
                </div>
              </Collapsible>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 active:scale-[0.98] transition-transform"
              onClick={handleCopyAll}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copy all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="active:scale-[0.98] transition-transform text-destructive hover:text-destructive"
              onClick={handleClear}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
