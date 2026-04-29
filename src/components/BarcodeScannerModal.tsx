import { useState, useRef, useEffect } from 'react';
import { Camera, X, FlaskConical, Loader2, CheckCircle2, AlertCircle, Database, Cpu, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { logError } from '@/lib/errorLog';
import { isOfflineMode, reportSource } from '@/lib/offlineMode';
import { supabase } from '@/integrations/supabase/client';
import {
  FoodItem,
  NutrientData,
  NUTRIENT_LABELS,
  NUTRIENT_UNITS,
} from '@/types/nutrients';

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  /** Optional — used by Test Mode for local database lookups. */
  localFoods?: FoodItem[];
}

interface TestResult {
  ok: boolean;
  source: 'local-db' | 'openfoodfacts' | 'ai' | 'offline-skip' | 'error';
  barcode: string;
  name?: string;
  brand?: string;
  servingSize?: number;     // grams per serving used for calculation
  servingAmount?: number;   // multiplier (e.g. 1.0 = 1 serving)
  perServing?: NutrientData;
  per100g?: NutrientData;
  error?: string;
  durationMs: number;
}

/** Real, well-known products on Open Food Facts. */
const SAMPLE_BARCODES: { code: string; label: string }[] = [
  { code: '737628064502', label: 'Thai Kitchen Pad Thai' },
  { code: '3017620422003', label: 'Nutella 350g' },
  { code: '5449000000996', label: 'Coca-Cola Classic 330ml' },
  { code: '4006381333931', label: 'Haribo Goldbears' },
  { code: '00012000161155', label: 'Tropicana Orange Juice' },
];

const FOOD_LOOKUP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/food-lookup`;
const TEST_SERVING_GRAMS = 100;
const TEST_SERVING_AMOUNT = 1; // 1 serving

const SOURCE_BADGE: Record<TestResult['source'], { label: string; tone: string; Icon: typeof Database }> = {
  'local-db':       { label: 'Local DB',        tone: 'bg-muted text-foreground',           Icon: FolderOpen },
  openfoodfacts:    { label: 'Open Food Facts', tone: 'bg-primary/15 text-primary',         Icon: Database },
  ai:               { label: 'AI Estimated',    tone: 'bg-accent/20 text-accent',           Icon: Cpu },
  'offline-skip':   { label: 'Offline (skipped)', tone: 'bg-muted text-muted-foreground',   Icon: AlertCircle },
  error:            { label: 'Error',           tone: 'bg-destructive/15 text-destructive', Icon: AlertCircle },
};

export function BarcodeScannerModal({ open, onClose, onScan, localFoods = [] }: BarcodeScannerModalProps) {
  const [manualBarcode, setManualBarcode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Test mode state
  const [testBarcode, setTestBarcode] = useState(SAMPLE_BARCODES[0].code);
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const startCamera = async () => {
    try {
      setError(null);
      setIsScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      logError(
        'Barcode Scan',
        err,
        'getUserMedia({ video: { facingMode: "environment" } }) failed — likely permission denied or no camera available.'
      );
      setError('Camera access denied');
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      setManualBarcode('');
      setError(null);
      setTestResult(null);
    }
  }, [open]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualBarcode.trim();
    if (!trimmed) return;
    if (!/^[a-zA-Z0-9-]+$/.test(trimmed) || trimmed.length > 50) {
      logError(
        'Barcode Parsing',
        `Invalid barcode format: "${trimmed}"`,
        `Expected /^[a-zA-Z0-9-]+$/ with length ≤ 50.`
      );
      setError('Invalid barcode format');
      return;
    }
    onScan(trimmed);
    setManualBarcode('');
    onClose();
  };

  /** Compute per-serving nutrients given a per-100g profile. */
  const scaleNutrients = (per100g: NutrientData, servingGrams: number, amount: number): NutrientData => {
    const factor = (servingGrams * amount) / 100;
    const out: NutrientData = {};
    Object.entries(per100g).forEach(([k, v]) => {
      if (typeof v === 'number') out[k as keyof NutrientData] = v * factor;
    });
    return out;
  };

  const runTest = async () => {
    const code = testBarcode.trim();
    if (!code) return;
    setTestRunning(true);
    setTestResult(null);
    const started = performance.now();

    // 1) Try local DB first
    const localMatch = localFoods.find((f) => f.barcode === code);
    if (localMatch) {
      const per100g = localMatch.nutrients;
      const servingGrams = localMatch.servingSize || TEST_SERVING_GRAMS;
      const result: TestResult = {
        ok: true,
        source: 'local-db',
        barcode: code,
        name: localMatch.name,
        brand: localMatch.brand,
        servingSize: servingGrams,
        servingAmount: TEST_SERVING_AMOUNT,
        per100g,
        perServing: scaleNutrients(per100g, servingGrams, TEST_SERVING_AMOUNT),
        durationMs: Math.round(performance.now() - started),
      };
      reportSource('Barcode Test', 'local-db', { detail: localMatch.name });
      setTestResult(result);
      setTestRunning(false);
      return;
    }

    // 2) If offline, stop here — the test should report what would have happened.
    if (isOfflineMode()) {
      const result: TestResult = {
        ok: false,
        source: 'offline-skip',
        barcode: code,
        error: 'Offline simulation is on and no local match was found.',
        durationMs: Math.round(performance.now() - started),
      };
      reportSource('Barcode Test', 'offline-skip', {
        ok: false,
        detail: `No local match for ${code}`,
      });
      setTestResult(result);
      setTestRunning(false);
      return;
    }

    // 3) Online lookup via existing food-lookup edge function (uses OFF then AI)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const result: TestResult = {
          ok: false,
          source: 'error',
          barcode: code,
          error: 'Sign in required to call online food lookup.',
          durationMs: Math.round(performance.now() - started),
        };
        setTestResult(result);
        setTestRunning(false);
        return;
      }

      const response = await fetch(FOOD_LOOKUP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ query: code }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const result: TestResult = {
          ok: false,
          source: 'error',
          barcode: code,
          error: data.error || `HTTP ${response.status}`,
          durationMs: Math.round(performance.now() - started),
        };
        logError(
          'Barcode Test',
          data.error || `HTTP ${response.status}`,
          `Barcode: ${code}\nBody: ${JSON.stringify(data).slice(0, 500)}`
        );
        reportSource('Barcode Test', 'error', { ok: false, detail: result.error });
        setTestResult(result);
        setTestRunning(false);
        return;
      }

      const per100g = (data.nutrients ?? {}) as NutrientData;
      const source: TestResult['source'] = data.source === 'ai' ? 'ai' : 'openfoodfacts';
      const result: TestResult = {
        ok: true,
        source,
        barcode: code,
        name: data.name,
        brand: data.brand,
        servingSize: TEST_SERVING_GRAMS,
        servingAmount: TEST_SERVING_AMOUNT,
        per100g,
        perServing: scaleNutrients(per100g, TEST_SERVING_GRAMS, TEST_SERVING_AMOUNT),
        durationMs: Math.round(performance.now() - started),
      };
      reportSource('Barcode Test', source, { detail: data.name });
      setTestResult(result);
    } catch (err) {
      const result: TestResult = {
        ok: false,
        source: 'error',
        barcode: code,
        error: err instanceof Error ? err.message : 'Network error',
        durationMs: Math.round(performance.now() - started),
      };
      logError('Barcode Test', err, `Barcode: ${code}`);
      reportSource('Barcode Test', 'error', { ok: false, detail: result.error });
      setTestResult(result);
    } finally {
      setTestRunning(false);
    }
  };

  const formatVal = (key: string, value: number) => {
    const unit = NUTRIENT_UNITS[key] || '';
    return `${value.toFixed(1)} ${unit}`.trim();
  };

  const renderNutrientList = (nutrients: NutrientData) => {
    const entries = Object.entries(nutrients).filter(([, v]) => typeof v === 'number' && v > 0);
    if (entries.length === 0) {
      return <p className="text-xs text-muted-foreground italic">No nutrient values returned.</p>;
    }
    return (
      <div className="grid grid-cols-2 gap-1.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs px-2 py-1 rounded-lg bg-muted/40">
            <span className="text-muted-foreground truncate pr-1">
              {NUTRIENT_LABELS[k] || k}
            </span>
            <span className="font-medium">{formatVal(k, v as number)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border rounded-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Scan Barcode</DialogTitle>
          <DialogDescription className="sr-only">
            Scan, enter, or test a barcode to look up food
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="scan" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="scan">Scan</TabsTrigger>
            <TabsTrigger value="test" className="gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" />
              Test Mode
            </TabsTrigger>
          </TabsList>

          {/* ─── SCAN TAB ─── */}
          <TabsContent value="scan" className="flex-1 overflow-y-auto space-y-5 mt-4">
            <div className="relative aspect-video bg-muted rounded-2xl overflow-hidden">
              {isScanning ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-32 border-2 border-primary rounded-xl" />
                  </div>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={stopCamera}
                    className="absolute top-3 right-3 rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <Camera className="h-12 w-12 text-muted-foreground" />
                  <Button onClick={startCamera} className="ios-button-secondary">
                    Start Camera
                  </Button>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground">or enter manually</span>
              </div>
            </div>

            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <Input
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder="Barcode number"
                className="flex-1 bg-secondary border-0 rounded-xl"
              />
              <Button
                type="submit"
                disabled={!manualBarcode.trim()}
                className="ios-button-primary"
              >
                Search
              </Button>
            </form>
          </TabsContent>

          {/* ─── TEST MODE TAB ─── */}
          <TabsContent value="test" className="flex-1 overflow-y-auto space-y-4 mt-4 pr-1">
            <div className="rounded-2xl bg-muted/30 p-3 space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Picks a sample barcode and runs it through the same lookup
                pipeline used by real scans (Local DB → Open Food Facts → AI).
                Nothing is saved.
              </p>
              {isOfflineMode() && (
                <p className="text-xs text-amber-500 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Offline simulation is on — only Local DB will be tried.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Sample barcode</Label>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_BARCODES.map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => setTestBarcode(s.code)}
                    className={`text-xs px-2.5 py-1.5 rounded-full border transition-all active:scale-[0.97] ${
                      testBarcode === s.code
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/40 border-border/40 hover:bg-muted/70'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <Input
                value={testBarcode}
                onChange={(e) => setTestBarcode(e.target.value)}
                placeholder="Or type any barcode"
                className="bg-secondary border-0 rounded-xl font-mono text-sm"
              />
            </div>

            <Button
              onClick={runTest}
              disabled={testRunning || !testBarcode.trim()}
              className="w-full active:scale-[0.98] transition-transform"
            >
              {testRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running test…
                </>
              ) : (
                <>
                  <FlaskConical className="h-4 w-4 mr-2" />
                  Run barcode test
                </>
              )}
            </Button>

            {testResult && (() => {
              const meta = SOURCE_BADGE[testResult.source];
              const Icon = meta.Icon;
              return (
                <div className="rounded-2xl border border-border/60 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    {testResult.ok ? (
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold tracking-tight truncate">
                        {testResult.ok ? testResult.name || 'Match found' : 'Test failed'}
                      </p>
                      {testResult.brand && (
                        <p className="text-xs text-muted-foreground truncate">
                          {testResult.brand}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {testResult.barcode} · {testResult.durationMs}ms
                      </p>
                    </div>
                    <Badge variant="outline" className={`gap-1 border-0 ${meta.tone}`}>
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </Badge>
                  </div>

                  {testResult.error && (
                    <p className="text-xs text-destructive bg-destructive/10 rounded-lg p-2">
                      {testResult.error}
                    </p>
                  )}

                  {testResult.ok && testResult.perServing && testResult.per100g && (
                    <>
                      <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 text-xs">
                        <p className="font-medium text-foreground">
                          Serving calculation
                        </p>
                        <p className="text-muted-foreground mt-0.5">
                          {testResult.servingAmount}× serving of{' '}
                          <span className="font-mono">{testResult.servingSize}g</span> ={' '}
                          <span className="font-mono">
                            {((testResult.servingAmount ?? 1) * (testResult.servingSize ?? 0)).toFixed(0)}g
                          </span>{' '}
                          eaten
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-foreground">Per serving</p>
                        {renderNutrientList(testResult.perServing)}
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          Per 100g (raw)
                        </p>
                        {renderNutrientList(testResult.per100g)}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
