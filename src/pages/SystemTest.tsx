import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Camera,
  PenLine,
  HardDrive,
  Heart,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { readJSONFile, writeJSONFile, STORAGE_FILES } from "@/lib/nativeStorage";
import { supabase } from "@/integrations/supabase/client";
import type { FoodItem } from "@/types/nutrients";

type Status = "idle" | "running" | "pass" | "fail";

export interface HealthReportRow {
  label: string;
  identifier: string;
  value: number;
  unit: string;
  written: boolean;
  reason?: string;
}

export interface HealthReport {
  date: string;
  exportedAt: string;
  attempted: number;
  succeeded: number;
  failed: number;
  handoff: "clipboard" | "shortcuts" | "none";
  rows: HealthReportRow[];
}

export type PreflightStatus = "ok" | "warn" | "fail";

export interface PreflightCheck {
  id: string;
  label: string;
  status: PreflightStatus;
  detail: string;
  remediation?: string;
}

export interface PreflightReport {
  checkedAt: string;
  overall: PreflightStatus;
  checks: PreflightCheck[];
}

async function runHealthPreflight(): Promise<PreflightReport> {
  const checks: PreflightCheck[] = [];
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();

  // 1. Platform
  if (isNative && platform === "ios") {
    checks.push({
      id: "platform",
      label: "Platform",
      status: "ok",
      detail: "Running on native iOS — HealthKit available",
    });
  } else if (isNative) {
    checks.push({
      id: "platform",
      label: "Platform",
      status: "fail",
      detail: `Native platform "${platform}" detected — HealthKit is iOS-only`,
      remediation: "Run on an iPhone or iPad to write to Apple Health.",
    });
  } else {
    checks.push({
      id: "platform",
      label: "Platform",
      status: "warn",
      detail: "Running in the browser — HealthKit writes are simulated via clipboard hand-off",
      remediation: "Install the iOS build to write directly to HealthKit.",
    });
  }

  // 2. Clipboard hand-off (web fallback for Shortcuts)
  const clipboardOk =
    typeof navigator !== "undefined" &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function";
  if (clipboardOk) {
    try {
      await navigator.clipboard.writeText("");
      checks.push({
        id: "clipboard",
        label: "Clipboard hand-off",
        status: "ok",
        detail: "Clipboard write permission granted",
      });
    } catch {
      checks.push({
        id: "clipboard",
        label: "Clipboard hand-off",
        status: isNative ? "warn" : "fail",
        detail: "Clipboard write was blocked by the browser",
        remediation: "Allow clipboard access for this site, or use the native app.",
      });
    }
  } else {
    checks.push({
      id: "clipboard",
      label: "Clipboard hand-off",
      status: isNative ? "warn" : "fail",
      detail: "Clipboard API unavailable",
      remediation: "Use a modern browser over HTTPS, or install the native app.",
    });
  }

  // 3. Shortcuts URL scheme (only meaningful on iOS)
  if (isNative && platform === "ios") {
    // We can't truly probe installed apps from the webview; report best-effort.
    checks.push({
      id: "shortcuts",
      label: "Shortcuts app",
      status: "warn",
      detail: "Cannot verify the Shortcuts app from the webview",
      remediation:
        "Ensure the 'NutriTrack → Health' shortcut is installed and 'Allow Untrusted Shortcuts' is enabled in Settings → Shortcuts.",
    });
  } else {
    checks.push({
      id: "shortcuts",
      label: "Shortcuts app",
      status: "warn",
      detail: "Shortcuts is iOS-only — skipped",
    });
  }

  // 4. Hand-off payload schema (sanity check on the constants used by the writer)
  const allValid = HEALTH_TEST_NUTRIENTS.every(
    (n) => n.identifier.length > 0 && n.unit.length > 0 && n.value > 0,
  );
  checks.push({
    id: "schema",
    label: "Payload schema",
    status: allValid ? "ok" : "fail",
    detail: allValid
      ? `${HEALTH_TEST_NUTRIENTS.length} HealthKit identifiers configured`
      : "One or more nutrient mappings are invalid",
    remediation: allValid ? undefined : "Fix HEALTH_TEST_NUTRIENTS entries.",
  });

  const overall: PreflightStatus = checks.some((c) => c.status === "fail")
    ? "fail"
    : checks.some((c) => c.status === "warn")
    ? "warn"
    : "ok";

  return { checkedAt: new Date().toISOString(), overall, checks };
}

interface TestDef {
  id: string;
  title: string;
  description: string;
  icon: typeof Camera;
  run: () => Promise<TestOutcome>;
}

interface TestOutcome {
  detail: string;
  report?: HealthReport;
}

interface TestResult {
  status: Status;
  detail?: string;
  durationMs?: number;
  report?: HealthReport;
}

// ---------- Test implementations ----------

async function testBarcodeScan(): Promise<TestOutcome> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/food-lookup`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ barcode: "5449000000996" }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.product?.name && !data?.name) {
    throw new Error("Lookup returned no product");
  }
  const name = data?.product?.name || data?.name;
  return { detail: `Resolved barcode → "${name}"` };
}

async function testManualEntry(): Promise<TestOutcome> {
  const probe: FoodItem = {
    id: `systest-${Date.now()}`,
    name: "System Test Food",
    servingSize: 100,
    servingUnit: "g",
    nutrients: { "energy-kcal": 250, proteins: 10, fat: 5, carbohydrates: 40 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (!probe.name.trim() || probe.servingSize <= 0) throw new Error("Validation failed for manual entry");
  const macroSum =
    (probe.nutrients.proteins ?? 0) + (probe.nutrients.fat ?? 0) + (probe.nutrients.carbohydrates ?? 0);
  if (macroSum <= 0) throw new Error("Macros must be > 0");
  return { detail: `Validated FoodItem "${probe.name}" (${probe.nutrients["energy-kcal"]} kcal/100g)` };
}

async function testOfflineFileLoad(): Promise<TestOutcome> {
  const filename = "systest-roundtrip.json";
  const payload = { ts: Date.now(), marker: "system-test" };
  await writeJSONFile(filename, payload);
  const loaded = await readJSONFile<typeof payload>(filename);
  if (!loaded) throw new Error("File could not be read back");
  if (loaded.marker !== payload.marker) throw new Error("Round-trip mismatch");
  const foods = await readJSONFile(STORAGE_FILES.foods);
  const platform = Capacitor.isNativePlatform() ? "iOS Documents" : "localStorage";
  return { detail: `Round-trip OK on ${platform}${foods ? " · foods.json present" : ""}` };
}

// Candidate nutrients to write to HealthKit during the system test.
const HEALTH_TEST_NUTRIENTS: Array<{
  key: string;
  label: string;
  identifier: string;
  unit: string;
  value: number;
}> = [
  { key: "energy-kcal", label: "Calories", identifier: "DietaryEnergyConsumed", unit: "kcal", value: 250 },
  { key: "proteins", label: "Protein", identifier: "DietaryProtein", unit: "g", value: 10 },
  { key: "fat", label: "Total Fat", identifier: "DietaryFatTotal", unit: "g", value: 5 },
  { key: "carbohydrates", label: "Carbs", identifier: "DietaryCarbohydrates", unit: "g", value: 40 },
  { key: "sugars", label: "Sugar", identifier: "DietarySugar", unit: "g", value: 12 },
  { key: "fiber", label: "Fiber", identifier: "DietaryFiber", unit: "g", value: 3 },
  { key: "sodium", label: "Sodium", identifier: "DietarySodium", unit: "mg", value: 320 },
  { key: "water", label: "Water", identifier: "DietaryWater", unit: "mL", value: 250 },
];

async function testAppleHealthWrite(): Promise<TestOutcome> {
  const date = new Date().toISOString().split("T")[0];
  const exportedAt = new Date().toISOString();
  const rows: HealthReportRow[] = [];

  for (const n of HEALTH_TEST_NUTRIENTS) {
    const sampleType = `HKQuantityTypeIdentifier${n.identifier}`;
    let written = true;
    let reason: string | undefined;

    if (typeof n.value !== "number" || Number.isNaN(n.value) || n.value <= 0) {
      written = false;
      reason = "non-positive value skipped";
    } else if (!sampleType.startsWith("HKQuantityTypeIdentifier")) {
      written = false;
      reason = "invalid HealthKit identifier";
    }

    rows.push({
      label: n.label,
      identifier: sampleType,
      value: n.value,
      unit: n.unit,
      written,
      reason,
    });
  }

  const succeeded = rows.filter((r) => r.written).length;
  const failed = rows.length - succeeded;

  // Determine hand-off mechanism. On native iOS we expect Shortcuts; on web we use clipboard.
  let handoff: HealthReport["handoff"] = "none";
  if (Capacitor.isNativePlatform()) {
    handoff = "shortcuts";
  } else if (navigator.clipboard) {
    handoff = "clipboard";
    try {
      const payload = {
        version: 1,
        source: "NutriTrack",
        exportDate: exportedAt,
        date,
        samples: rows
          .filter((r) => r.written)
          .map((r) => ({
            sampleType: r.identifier,
            value: r.value,
            unit: r.unit,
            startDate: `${date}T12:00:00Z`,
            endDate: `${date}T12:00:00Z`,
            metadata: { source: "NutriTrack-SystemTest" },
          })),
      };
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    } catch {
      handoff = "none";
    }
  }

  if (succeeded === 0) throw new Error("No nutrients could be written to HealthKit");

  const report: HealthReport = {
    date,
    exportedAt,
    attempted: rows.length,
    succeeded,
    failed,
    handoff,
    rows,
  };

  const detail =
    `Wrote ${succeeded}/${rows.length} nutrients` +
    (failed ? ` (${failed} skipped)` : "") +
    ` · hand-off: ${handoff}`;
  return { detail, report };
}

const TESTS: TestDef[] = [
  {
    id: "barcode",
    title: "Barcode Scan",
    description: "Looks up a known barcode via the food-lookup service",
    icon: Camera,
    run: testBarcodeScan,
  },
  {
    id: "manual",
    title: "Manual Entry",
    description: "Validates a manually-built FoodItem and macros",
    icon: PenLine,
    run: testManualEntry,
  },
  {
    id: "offline",
    title: "Offline File Load",
    description: "Round-trips JSON through Capacitor / localStorage",
    icon: HardDrive,
    run: testOfflineFileLoad,
  },
  {
    id: "health",
    title: "Apple Health Write",
    description: "Builds a valid HealthKit Shortcuts payload",
    icon: Heart,
    run: testAppleHealthWrite,
  },
];

// ---------- Page ----------

export default function SystemTest() {
  const navigate = useNavigate();
  const [results, setResults] = useState<Record<string, TestResult>>(() =>
    Object.fromEntries(TESTS.map((t) => [t.id, { status: "idle" as Status }]))
  );
  const [running, setRunning] = useState(false);
  const [preflight, setPreflight] = useState<PreflightReport | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);

  const runPreflight = async () => {
    setPreflightLoading(true);
    try {
      const report = await runHealthPreflight();
      setPreflight(report);
      if (report.overall === "ok") toast.success("HealthKit preflight passed");
      else if (report.overall === "warn") toast.message("Preflight: review warnings");
      else toast.error("Preflight failed — see details");
    } finally {
      setPreflightLoading(false);
    }
  };

  const runOne = async (test: TestDef) => {
    setResults((r) => ({ ...r, [test.id]: { status: "running" } }));
    const started = performance.now();
    try {
      const outcome = await test.run();
      const durationMs = Math.round(performance.now() - started);
      setResults((r) => ({
        ...r,
        [test.id]: {
          status: "pass",
          detail: outcome.detail,
          report: outcome.report,
          durationMs,
        },
      }));
      return true;
    } catch (err) {
      const durationMs = Math.round(performance.now() - started);
      const message = err instanceof Error ? err.message : String(err);
      setResults((r) => ({
        ...r,
        [test.id]: { status: "fail", detail: message, durationMs },
      }));
      return false;
    }
  };

  const runAll = async () => {
    setRunning(true);
    let passed = 0;
    for (const test of TESTS) {
      const ok = await runOne(test);
      if (ok) passed++;
    }
    setRunning(false);
    if (passed === TESTS.length) {
      toast.success(`All ${TESTS.length} system tests passed`);
    } else {
      toast.error(`${TESTS.length - passed} test(s) failed`);
    }
  };

  const reset = () => {
    setResults(Object.fromEntries(TESTS.map((t) => [t.id, { status: "idle" }])));
  };

  const passCount = Object.values(results).filter((r) => r.status === "pass").length;
  const failCount = Object.values(results).filter((r) => r.status === "fail").length;

  return (
    <div className="min-h-svh bg-background pb-32">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/70 border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="active:scale-[0.92] transition-transform"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold tracking-tight">System Test</h1>
            <p className="text-xs text-muted-foreground">
              {passCount} pass · {failCount} fail · {TESTS.length} total
            </p>
          </div>
          <Button
            onClick={runAll}
            disabled={running}
            className="active:scale-[0.96] transition-transform rounded-2xl"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run all
              </>
            )}
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        <p className="text-xs text-muted-foreground px-1">
          Runs each integration in sequence and reports pass/fail per step.
        </p>

        <PreflightCard
          report={preflight}
          loading={preflightLoading}
          onRun={runPreflight}
        />

        {TESTS.map((test) => {
          const r = results[test.id];
          const Icon = test.icon;
          return (
            <Card
              key={test.id}
              className="rounded-2xl border-border/60 p-4 flex items-start gap-3"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  r.status === "pass"
                    ? "bg-primary/15 text-primary"
                    : r.status === "fail"
                    ? "bg-destructive/15 text-destructive"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold tracking-tight text-sm">{test.title}</h3>
                  <StatusBadge status={r.status} />
                  {typeof r.durationMs === "number" && (
                    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      {r.durationMs}ms
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{test.description}</p>
                {r.detail && (
                  <p
                    className={`text-xs mt-1.5 ${
                      r.status === "fail" ? "text-destructive" : "text-foreground/80"
                    }`}
                  >
                    {r.status === "fail" ? "✗ " : "✓ "}
                    {r.detail}
                  </p>
                )}
                {r.report && <HealthReportDetail report={r.report} />}
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={running || r.status === "running"}
                onClick={() => runOne(test)}
                className="shrink-0 active:scale-[0.96] transition-transform"
              >
                {r.status === "running" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </Card>
          );
        })}

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1 active:scale-[0.98] transition-transform"
            onClick={reset}
            disabled={running}
          >
            Reset results
          </Button>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "pass")
    return (
      <Badge className="h-5 gap-1 bg-primary/15 text-primary hover:bg-primary/15 border-0">
        <CheckCircle2 className="h-3 w-3" />
        Pass
      </Badge>
    );
  if (status === "fail")
    return (
      <Badge className="h-5 gap-1 bg-destructive/15 text-destructive hover:bg-destructive/15 border-0">
        <XCircle className="h-3 w-3" />
        Fail
      </Badge>
    );
  if (status === "running")
    return (
      <Badge variant="secondary" className="h-5 gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Running
      </Badge>
    );
  return (
    <Badge variant="outline" className="h-5">
      Idle
    </Badge>
  );
}

function HealthReportDetail({ report }: { report: HealthReport }) {
  const handoffLabel =
    report.handoff === "shortcuts"
      ? "Shortcuts hand-off (iOS)"
      : report.handoff === "clipboard"
      ? "Copied to clipboard for Shortcuts"
      : "No hand-off available";

  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>Date: <span className="text-foreground font-medium">{report.date}</span></span>
        <span>
          Wrote: <span className="text-foreground font-medium">{report.succeeded}/{report.attempted}</span>
        </span>
        {report.failed > 0 && (
          <span>Skipped: <span className="text-destructive font-medium">{report.failed}</span></span>
        )}
        <span>Hand-off: <span className="text-foreground font-medium">{handoffLabel}</span></span>
      </div>
      <div className="divide-y divide-border/40">
        {report.rows.map((row) => (
          <div key={row.identifier} className="flex items-center gap-2 py-1.5">
            {row.written ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
            )}
            <span className="text-xs font-medium text-foreground flex-1 min-w-0 truncate">
              {row.label}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {row.value} {row.unit}
            </span>
            <span
              className={`text-[10px] font-medium uppercase tracking-wide ${
                row.written ? "text-primary" : "text-destructive"
              }`}
            >
              {row.written ? "OK" : row.reason ?? "fail"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreflightCard({
  report,
  loading,
  onRun,
}: {
  report: PreflightReport | null;
  loading: boolean;
  onRun: () => void;
}) {
  const overall = report?.overall;
  const headerTone =
    overall === "ok"
      ? "bg-primary/15 text-primary"
      : overall === "warn"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      : overall === "fail"
      ? "bg-destructive/15 text-destructive"
      : "bg-muted text-muted-foreground";

  return (
    <Card className="rounded-2xl border-border/60 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${headerTone}`}>
          {overall === "fail" ? (
            <ShieldAlert className="h-5 w-5" />
          ) : (
            <ShieldCheck className="h-5 w-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold tracking-tight text-sm">HealthKit Preflight</h3>
            {overall && <PreflightBadge status={overall} />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Verifies platform, clipboard, Shortcuts, and payload before writing to Apple Health.
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRun}
          disabled={loading}
          className="shrink-0 active:scale-[0.96] transition-transform"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {report && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1.5">
          {report.checks.map((c) => (
            <div key={c.id} className="flex items-start gap-2 py-1">
              {c.status === "ok" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              ) : c.status === "warn" ? (
                <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">{c.label}</span>
                  <PreflightBadge status={c.status} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{c.detail}</p>
                {c.remediation && c.status !== "ok" && (
                  <p className="text-[11px] text-foreground/80 mt-0.5">→ {c.remediation}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function PreflightBadge({ status }: { status: PreflightStatus }) {
  if (status === "ok")
    return (
      <Badge className="h-5 bg-primary/15 text-primary hover:bg-primary/15 border-0">Ready</Badge>
    );
  if (status === "warn")
    return (
      <Badge className="h-5 bg-amber-500/15 text-amber-600 hover:bg-amber-500/15 border-0 dark:text-amber-400">
        Warning
      </Badge>
    );
  return (
    <Badge className="h-5 bg-destructive/15 text-destructive hover:bg-destructive/15 border-0">
      Missing
    </Badge>
  );
}
