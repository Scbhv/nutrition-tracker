import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RotateCcw, CheckCircle2, Circle, ChevronDown, Cloud, CloudOff, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Step = { id: string; text: string; expected: string };
type Section = { id: string; title: string; emoji: string; steps: Step[] };

const SECTIONS: Section[] = [
  {
    id: "auth",
    title: "Authentication",
    emoji: "🔐",
    steps: [
      { id: "auth-1", text: "Sign in with Apple", expected: "Lands on Today screen, no errors in console." },
      { id: "auth-2", text: "Sign in with Google", expected: "Same Today screen loads, profile email shown in Settings." },
      { id: "auth-3", text: "Sign out from Profile", expected: "Returns to /auth screen." },
    ],
  },
  {
    id: "logging",
    title: "Food Logging",
    emoji: "🍎",
    steps: [
      { id: "log-1", text: "Manually add a food via the FAB → Add Food", expected: "Food appears in database and can be selected for today." },
      { id: "log-2", text: "Log a quick portion using gram presets", expected: "Macro rings update immediately; entry shows in Today list." },
      { id: "log-3", text: "Edit the portion of an existing entry", expected: "Rings recalculate; previous serving shown as history." },
      { id: "log-4", text: "Swipe-to-delete an entry", expected: "Entry removed with haptic; rings recalculate." },
    ],
  },
  {
    id: "barcode",
    title: "Barcode Scan",
    emoji: "📷",
    steps: [
      { id: "bc-1", text: "Open scanner from FAB", expected: "Camera permission prompt appears (first time) then live preview." },
      { id: "bc-2", text: "Scan a known product barcode", expected: "Product fetched from Open Food Facts and pre-filled in Add Food." },
      { id: "bc-3", text: "Scan an unknown barcode", expected: "Falls back to AI lookup or empty form with barcode pre-filled." },
    ],
  },
  {
    id: "ai",
    title: "AI Food Lookup",
    emoji: "✨",
    steps: [
      { id: "ai-1", text: "Use AI lookup with a free-text query", expected: "Returns nutrient data within a few seconds." },
      { id: "ai-2", text: "Confirm result and save to database", expected: "Food persists and is loggable." },
    ],
  },
  {
    id: "offline",
    title: "Offline Persistence",
    emoji: "📦",
    steps: [
      { id: "off-1", text: "Add an entry while offline (Airplane mode)", expected: "Entry saves and rings update without errors." },
      { id: "off-2", text: "Force-quit app, reopen offline", expected: "All foods, logs, settings reload from Documents/NutriTrack." },
      { id: "off-3", text: "Export full backup JSON from Settings", expected: "JSON file generated with foods, logs, settings." },
      { id: "off-4", text: "Import that backup into a fresh state", expected: "Data restores; no validation errors in console." },
    ],
  },
  {
    id: "trends",
    title: "Trends & Charts",
    emoji: "📈",
    steps: [
      { id: "tr-1", text: "Open Trends tab with at least 3 days of data", expected: "Charts render with correct values; date range selector works." },
      { id: "tr-2", text: "Switch macro distribution view", expected: "Pie/area updates without flicker." },
      { id: "tr-3", text: "Export trends as CSV", expected: "CSV downloads with one row per day, all tracked nutrients." },
    ],
  },
  {
    id: "exercise",
    title: "Exercise & Net Calories",
    emoji: "🏃",
    steps: [
      { id: "ex-1", text: "Log an exercise with calories burned", expected: "Net calorie display decreases by burned amount." },
      { id: "ex-2", text: "Delete the exercise entry", expected: "Net calories revert." },
    ],
  },
  {
    id: "goals",
    title: "Goals & Custom Nutrients",
    emoji: "🎯",
    steps: [
      { id: "g-1", text: "Edit daily calorie goal in Settings", expected: "Today rings reflect new target immediately." },
      { id: "g-2", text: "Enable weekday goals and override one day", expected: "On that weekday the goals match the override." },
      { id: "g-3", text: "Add a custom nutrient and log a food with it", expected: "Custom nutrient appears in the summary list." },
    ],
  },
  {
    id: "health",
    title: "Apple Health Sync",
    emoji: "❤️",
    steps: [
      { id: "h-1", text: "Trigger HealthKit export from Settings", expected: "Shortcuts opens with payload; user can run shortcut." },
      { id: "h-2", text: "Verify entry appears in Apple Health Nutrition", expected: "Today's calories/macros visible in Health app." },
    ],
  },
  {
    id: "premium",
    title: "Premium & Donation",
    emoji: "💎",
    steps: [
      { id: "pr-1", text: "Tap a premium-locked feature as free user", expected: "Donation gate modal appears with Buy Me a Coffee link." },
      { id: "pr-2", text: "Enter a valid unlock code", expected: "Premium activates; gated features become accessible." },
      { id: "pr-3", text: "Enter an invalid code", expected: "Clear error toast; no premium granted." },
    ],
  },
  {
    id: "polish",
    title: "UI Polish",
    emoji: "🎨",
    steps: [
      { id: "ui-1", text: "Trigger haptics on FAB and swipe actions", expected: "Subtle tap feedback on device." },
      { id: "ui-2", text: "Change appearance theme", expected: "Theme applies instantly across all screens." },
      { id: "ui-3", text: "Submit feedback from Profile", expected: "Success toast; row appears in backend feedback table." },
    ],
  },
];

const TOTAL_STEPS = SECTIONS.reduce((n, s) => n + s.steps.length, 0);
const STORAGE_KEY = "nutrient-tracker-test-checklist-v1";

type State = {
  checked: Record<string, boolean>;
  notes: string;
  lastRun: string | null;
};

const EMPTY_STATE: State = { checked: {}, notes: "", lastRun: null };

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    return { ...EMPTY_STATE, ...JSON.parse(raw) };
  } catch {
    return EMPTY_STATE;
  }
}

export default function TestChecklist() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>(EMPTY_STATE);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.id, true]))
  );

  useEffect(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    if (state === EMPTY_STATE) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const completed = useMemo(
    () => Object.values(state.checked).filter(Boolean).length,
    [state.checked]
  );
  const pct = Math.round((completed / TOTAL_STEPS) * 100);

  const toggle = (id: string) =>
    setState((s) => ({
      ...s,
      checked: { ...s.checked, [id]: !s.checked[id] },
      lastRun: new Date().toISOString(),
    }));

  const reset = () => {
    setState(EMPTY_STATE);
    localStorage.removeItem(STORAGE_KEY);
    toast.success("Checklist reset");
  };

  const markSectionPass = (section: Section) => {
    setState((s) => {
      const next = { ...s.checked };
      section.steps.forEach((st) => (next[st.id] = true));
      return { ...s, checked: next, lastRun: new Date().toISOString() };
    });
    toast.success(`${section.title} marked complete`);
  };

  const exportReport = () => {
    const lines: string[] = [
      `# Test report`,
      `Date: ${new Date().toLocaleString()}`,
      `Result: ${completed}/${TOTAL_STEPS} steps passed (${pct}%)`,
      "",
    ];
    SECTIONS.forEach((sec) => {
      const passed = sec.steps.filter((st) => state.checked[st.id]).length;
      lines.push(`## ${sec.emoji} ${sec.title} — ${passed}/${sec.steps.length}`);
      sec.steps.forEach((st) => {
        const mark = state.checked[st.id] ? "✅" : "⬜";
        lines.push(`- ${mark} ${st.text}`);
        lines.push(`    Expected: ${st.expected}`);
      });
      lines.push("");
    });
    if (state.notes.trim()) {
      lines.push("## Notes");
      lines.push(state.notes.trim());
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test-report-${new Date().toISOString().split("T")[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/70 border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="active:scale-[0.92] transition-transform"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold tracking-tight">Test Checklist</h1>
            <p className="text-xs text-muted-foreground">
              {completed}/{TOTAL_STEPS} steps · {pct}% complete
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={reset}
            className="active:scale-[0.92] transition-transform"
            aria-label="Reset checklist"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <Progress value={pct} className="h-2" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {state.lastRun && (
          <p className="text-xs text-muted-foreground px-1">
            Last updated {new Date(state.lastRun).toLocaleString()}
          </p>
        )}

        {SECTIONS.map((section) => {
          const passed = section.steps.filter((s) => state.checked[s.id]).length;
          const total = section.steps.length;
          const allPass = passed === total;
          const anyFail = passed > 0 && passed < total;
          const open = openSections[section.id] ?? true;

          return (
            <Card key={section.id} className="overflow-hidden rounded-2xl border-border/60">
              <Collapsible
                open={open}
                onOpenChange={(o) => setOpenSections((p) => ({ ...p, [section.id]: o }))}
              >
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-3 p-4 text-left active:bg-muted/40 transition-colors">
                    <span className="text-2xl">{section.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold tracking-tight">{section.title}</h2>
                      <p className="text-xs text-muted-foreground">
                        {passed}/{total} passed
                      </p>
                    </div>
                    <Badge
                      variant={allPass ? "default" : anyFail ? "secondary" : "outline"}
                      className="shrink-0"
                    >
                      {allPass ? "Pass" : anyFail ? "Partial" : "Pending"}
                    </Badge>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-2">
                    {section.steps.map((step, idx) => {
                      const checked = !!state.checked[step.id];
                      return (
                        <button
                          key={step.id}
                          onClick={() => toggle(step.id)}
                          className={`w-full flex gap-3 p-3 rounded-xl text-left transition-all active:scale-[0.99] ${
                            checked
                              ? "bg-primary/5 border border-primary/20"
                              : "bg-muted/30 border border-transparent hover:bg-muted/50"
                          }`}
                        >
                          <div className="pt-0.5">
                            {checked ? (
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground/60" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium ${
                                checked ? "text-muted-foreground line-through" : "text-foreground"
                              }`}
                            >
                              {idx + 1}. {step.text}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <span className="font-medium">Expected:</span> {step.expected}
                            </p>
                          </div>
                          <Checkbox checked={checked} className="mt-1 pointer-events-none" />
                        </button>
                      );
                    })}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-1 active:scale-[0.98] transition-transform"
                      onClick={() => markSectionPass(section)}
                    >
                      Mark all as passed
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}

        <Card className="rounded-2xl border-border/60 p-4 space-y-2">
          <h2 className="font-semibold tracking-tight">Notes</h2>
          <p className="text-xs text-muted-foreground">
            Capture any bugs, regressions, or follow-ups.
          </p>
          <Textarea
            value={state.notes}
            onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
            placeholder="e.g. barcode scanner laggy on iPhone 12, AI lookup returned wrong sodium…"
            rows={5}
            className="resize-none rounded-xl"
          />
        </Card>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1 active:scale-[0.98] transition-transform"
            onClick={exportReport}
          >
            Export report (.md)
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground pt-4">
          Progress is saved locally on this device.
        </p>
      </main>
    </div>
  );
}
