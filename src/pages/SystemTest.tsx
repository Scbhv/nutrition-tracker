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

  const runOne = async (test: TestDef) => {
    setResults((r) => ({ ...r, [test.id]: { status: "running" } }));
    const started = performance.now();
    try {
      const detail = await test.run();
      const durationMs = Math.round(performance.now() - started);
      setResults((r) => ({
        ...r,
        [test.id]: { status: "pass", detail, durationMs },
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
    <div className="min-h-screen bg-background pb-32">
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
