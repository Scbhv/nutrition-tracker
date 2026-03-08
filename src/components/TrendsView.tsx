import { useState, useMemo, forwardRef } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ReferenceLine, ComposedChart, Line } from 'recharts';
import { TrendingUp, PieChartIcon, CalendarIcon, Flame, Download, Lock } from 'lucide-react';
import { DonationGateModal } from '@/components/DonationGateModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { FoodItem, DailyLog, NutrientData, NUTRIENT_LABELS, NUTRIENT_UNITS, NUTRIENT_CATEGORIES } from '@/types/nutrients';

// Custom tooltip for Net Calories chart
function NetCalorieTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3">
      <p className="text-sm font-semibold text-foreground mb-2">{label}</p>
      {payload.map((entry: any, index: number) => {
        const color = entry.color || 'hsl(var(--foreground))';
        const labels: Record<string, string> = {
          eaten: 'Eaten',
          burned: 'Burned',
          net: 'Net',
          goal: 'Goal',
        };
        return (
          <p key={index} style={{ color }} className="text-xs font-medium">
            {labels[entry.dataKey] || entry.dataKey}: <span className="font-bold">{entry.value} kcal</span>
          </p>
        );
      })}
    </div>
  );
}

interface TrendsViewProps {
  foods: FoodItem[];
  logs: DailyLog[];
  dailyGoals: NutrientData;
  isPremium?: boolean;
}

// Calorie conversion factors
const KCAL_PER_GRAM = {
  carbs: 4,
  protein: 4,
  fat: 9,
};

// Chart colors using CSS variables where possible
const PIE_COLORS = [
  'hsl(var(--nutrient-carbs))',
  'hsl(var(--nutrient-protein))',
  'hsl(var(--nutrient-fat))',
];

// Get all trackable nutrients for the selector
const ALL_NUTRIENTS = [
  ...NUTRIENT_CATEGORIES.macros,
  ...NUTRIENT_CATEGORIES.minerals,
  ...NUTRIENT_CATEGORIES.vitamins,
  ...NUTRIENT_CATEGORIES.other,
];

export const TrendsView = forwardRef<HTMLDivElement, TrendsViewProps>(function TrendsView({ foods, logs, dailyGoals, isPremium = false }, ref) {
  const [selectedNutrient, setSelectedNutrient] = useState<string>('energy-kcal');
  const [daysToShow, setDaysToShow] = useState<number>(7);
  const [pieChartDate, setPieChartDate] = useState<Date>(new Date());
  const [averagePeriod, setAveragePeriod] = useState<'week' | 'month'>('week');
  const [showDonationGate, setShowDonationGate] = useState(false);
  const trendsLocked = !isPremium;

  // Calculate nutrients for a specific date
  const getNutrientsForDate = (date: string): NutrientData => {
    const log = logs.find(l => l.date === date);
    if (!log) return {};
    
    const totals: NutrientData = {};
    log.entries.forEach(entry => {
      const food = foods.find(f => f.id === entry.foodId);
      if (food) {
        const multiplier = (entry.servingAmount * food.servingSize) / 100;
        Object.entries(food.nutrients).forEach(([key, value]) => {
          if (typeof value === 'number') {
            const nutrientKey = key as keyof NutrientData;
            totals[nutrientKey] = (totals[nutrientKey] || 0) + value * multiplier;
          }
        });
      }
    });
    return totals;
  };

  // Get burned calories for a specific date
  const getBurnedForDate = (date: string): number => {
    const log = logs.find(l => l.date === date);
    if (!log) return 0;
    return (log.exerciseEntries || []).reduce((sum, e) => sum + e.caloriesBurned, 0);
  };

  // Get selected date for pie chart
  const selectedDateStr = format(pieChartDate, 'yyyy-MM-dd');
  const selectedDateNutrients = useMemo(() => getNutrientsForDate(selectedDateStr), [logs, foods, selectedDateStr]);
  const isToday = selectedDateStr === format(new Date(), 'yyyy-MM-dd');

  // Bar chart data - nutrient over time
  const { barChartData, averageValue } = useMemo(() => {
    const data = [];
    let total = 0;
    let daysWithData = 0;
    
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      const nutrients = getNutrientsForDate(date);
      const value = nutrients[selectedNutrient as keyof NutrientData] || 0;
      data.push({
        date: format(parseISO(date), 'MMM d'),
        value: Math.round(value * 10) / 10,
        goal: dailyGoals[selectedNutrient as keyof NutrientData] || 0,
      });
      if (value > 0) {
        total += value;
        daysWithData++;
      }
    }
    
    const avg = daysWithData > 0 ? Math.round((total / daysWithData) * 10) / 10 : 0;
    return { barChartData: data, averageValue: avg };
  }, [logs, foods, selectedNutrient, daysToShow, dailyGoals]);

  // Net calorie chart data
  const netCalorieData = useMemo(() => {
    const data = [];
    const calorieGoal = dailyGoals['energy-kcal'] || 2000;

    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      const nutrients = getNutrientsForDate(date);
      const eaten = Math.round(nutrients['energy-kcal'] || 0);
      const burned = Math.round(getBurnedForDate(date));
      const net = eaten - burned;
      data.push({
        date: format(parseISO(date), 'MMM d'),
        eaten,
        burned,
        net,
        goal: calorieGoal,
      });
    }
    return data;
  }, [logs, foods, daysToShow, dailyGoals]);

  const hasAnyExercise = netCalorieData.some(d => d.burned > 0);

  // Calculate average summary based on period
  const averageSummary = useMemo(() => {
    const periodDays = averagePeriod === 'week' ? 7 : 30;
    let totalIntake = 0;
    let totalBurned = 0;
    let daysWithData = 0;

    for (let i = periodDays - 1; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      const nutrients = getNutrientsForDate(date);
      const intake = nutrients['energy-kcal'] || 0;
      const burned = getBurnedForDate(date);
      
      if (intake > 0) {
        totalIntake += intake;
        totalBurned += burned;
        daysWithData++;
      }
    }

    const avgIntake = daysWithData > 0 ? Math.round(totalIntake / daysWithData) : 0;
    const avgBurned = daysWithData > 0 ? Math.round(totalBurned / daysWithData) : 0;
    const avgNet = avgIntake - avgBurned;

    return { avgIntake, avgBurned, avgNet, daysWithData };
  }, [logs, foods, averagePeriod]);

  // Export trends data as CSV
  const exportCSV = () => {
    const rows: string[][] = [];
    rows.push(['Date', 'Calories Eaten (kcal)', 'Calories Burned (kcal)', 'Net Calories (kcal)', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Goal (kcal)']);

    const calorieGoal = dailyGoals['energy-kcal'] || 2000;

    for (let i = daysToShow - 1; i >= 0; i--) {
      const dateStr = format(subDays(new Date(), i), 'yyyy-MM-dd');
      const nutrients = getNutrientsForDate(dateStr);
      const eaten = Math.round(nutrients['energy-kcal'] || 0);
      const burned = Math.round(getBurnedForDate(dateStr));
      const protein = Math.round((nutrients['proteins'] || 0) * 10) / 10;
      const carbs = Math.round(((nutrients['carbohydrates'] || 0) + (nutrients['sugars'] || 0)) * 10) / 10;
      const fat = Math.round(((nutrients['fat'] || 0) + (nutrients['saturated-fat'] || 0) + (nutrients['unsaturated-fat'] || 0)) * 10) / 10;

      rows.push([dateStr, String(eaten), String(burned), String(eaten - burned), String(protein), String(carbs), String(fat), String(calorieGoal)]);
    }

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nutrition-trends-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pieChartData = useMemo(() => {
    // Get total grams of each macro
    const carbs = (selectedDateNutrients['carbohydrates'] || 0) + (selectedDateNutrients['sugars'] || 0);
    const protein = selectedDateNutrients['proteins'] || 0;
    const fat = (selectedDateNutrients['fat'] || 0) + (selectedDateNutrients['saturated-fat'] || 0) + (selectedDateNutrients['unsaturated-fat'] || 0);

    // Convert to calories
    const carbsKcal = carbs * KCAL_PER_GRAM.carbs;
    const proteinKcal = protein * KCAL_PER_GRAM.protein;
    const fatKcal = fat * KCAL_PER_GRAM.fat;

    const total = carbsKcal + proteinKcal + fatKcal;

    if (total === 0) {
      return [];
    }

    return [
      { name: 'Carbs', value: Math.round(carbsKcal), percentage: Math.round((carbsKcal / total) * 100) },
      { name: 'Protein', value: Math.round(proteinKcal), percentage: Math.round((proteinKcal / total) * 100) },
      { name: 'Fat', value: Math.round(fatKcal), percentage: Math.round((fatKcal / total) * 100) },
    ];
  }, [selectedDateNutrients]);

  const totalMacroKcal = pieChartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Export Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className={cn("rounded-xl gap-2", trendsLocked && "opacity-50")}
          onClick={() => {
            if (trendsLocked) {
              setShowDonationGate(true);
            } else {
              exportCSV();
            }
          }}
        >
          <Download className="h-4 w-4" />
          Export CSV
          {trendsLocked && <Lock className="h-3 w-3" />}
        </Button>
      </div>
      {/* Nutrient Over Time - Bar Chart */}
      <Card className="glass-card border-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Nutrient History
            </CardTitle>
          </div>
          <div className="flex gap-2 mt-3">
            <Select value={selectedNutrient} onValueChange={setSelectedNutrient}>
              <SelectTrigger className="flex-1 bg-secondary border-0 rounded-xl">
                <SelectValue placeholder="Select nutrient" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {ALL_NUTRIENTS.map(nutrient => (
                  <SelectItem key={nutrient} value={nutrient}>
                    {NUTRIENT_LABELS[nutrient] || nutrient}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={daysToShow.toString()} onValueChange={(v) => {
              const num = Number(v);
              if (num > 7 && trendsLocked) {
                setShowDonationGate(true);
                return;
              }
              setDaysToShow(num);
            }}>
              <SelectTrigger className="w-28 bg-secondary border-0 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14" className={trendsLocked ? "opacity-50" : ""}>
                  <span className="flex items-center gap-1">
                    14 days {trendsLocked && <Lock className="h-3 w-3" />}
                  </span>
                </SelectItem>
                <SelectItem value="30" className={trendsLocked ? "opacity-50" : ""}>
                  <span className="flex items-center gap-1">
                    30 days {trendsLocked && <Lock className="h-3 w-3" />}
                  </span>
                </SelectItem>
                <SelectItem value="365" className={trendsLocked ? "opacity-50" : ""}>
                  <span className="flex items-center gap-1">
                    1 year {trendsLocked && <Lock className="h-3 w-3" />}
                  </span>
                </SelectItem>
                <SelectItem value="9999" className={trendsLocked ? "opacity-50" : ""}>
                  <span className="flex items-center gap-1">
                    All time {trendsLocked && <Lock className="h-3 w-3" />}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [
                    `${value} ${NUTRIENT_UNITS[selectedNutrient] || ''}`,
                    NUTRIENT_LABELS[selectedNutrient]
                  ]}
                />
                <Bar 
                  dataKey="value" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                {averageValue > 0 && (
                  <ReferenceLine 
                    y={averageValue} 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{
                      value: 'Avg',
                      position: 'left',
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  />
                )}
                {dailyGoals[selectedNutrient as keyof NutrientData] && (
                  <ReferenceLine 
                    y={dailyGoals[selectedNutrient as keyof NutrientData]} 
                    stroke="hsl(var(--accent))" 
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    label={{
                      value: 'Goal',
                      position: 'right',
                      fill: 'hsl(var(--accent))',
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-2">
            {NUTRIENT_LABELS[selectedNutrient]} ({NUTRIENT_UNITS[selectedNutrient]})
            {averageValue > 0 && (
              <span> • Avg: {averageValue} {NUTRIENT_UNITS[selectedNutrient]}</span>
            )}
            {dailyGoals[selectedNutrient as keyof NutrientData] && (
              <span> • Goal: {dailyGoals[selectedNutrient as keyof NutrientData]} {NUTRIENT_UNITS[selectedNutrient]}</span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Net Calorie Trend */}
      <Card className="glass-card border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Flame className="h-5 w-5 text-destructive" />
            Net Calories
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Intake minus exercise burned
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={netCalorieData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <Tooltip
                  content={<NetCalorieTooltip />}
                  cursor={{ fill: 'hsl(var(--primary) / 0.1)' }}
                />
                <Bar dataKey="eaten" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={30} name="eaten" />
                {hasAnyExercise && (
                  <Bar dataKey="burned" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} maxBarSize={30} name="burned" />
                )}
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="hsl(var(--accent-foreground))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'hsl(var(--accent-foreground))' }}
                  name="net"
                />
                <ReferenceLine
                  y={netCalorieData[0]?.goal || 2000}
                  stroke="hsl(var(--accent))"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  label={{
                    value: 'Goal',
                    position: 'right',
                    fill: 'hsl(var(--accent))',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--primary))' }} />
              Eaten
            </span>
            {hasAnyExercise && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--destructive))' }} />
                Burned
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-sm border" style={{ borderColor: 'hsl(var(--accent-foreground))' }} />
              Net
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5" style={{ backgroundColor: 'hsl(var(--accent))', display: 'block' }} />
              Goal
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Average Summary Card */}
      <Card className="glass-card border-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              {averagePeriod === 'week' ? 'Weekly' : 'Monthly'} Average
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={averagePeriod === 'week' ? 'default' : 'outline'}
                size="sm"
                className="rounded-xl"
                onClick={() => setAveragePeriod('week')}
              >
                Week
              </Button>
              <Button
                variant={averagePeriod === 'month' ? 'default' : 'outline'}
                size="sm"
                className={cn("rounded-xl", trendsLocked && "opacity-50")}
                onClick={() => {
                  if (trendsLocked) {
                    setShowDonationGate(true);
                    return;
                  }
                  setAveragePeriod('month');
                }}
              >
                Month {trendsLocked && <Lock className="h-3 w-3 ml-1" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-secondary/50 border border-border/30">
              <p className="text-xs text-muted-foreground mb-1">Avg Intake</p>
              <p className="text-2xl font-bold text-foreground">{averageSummary.avgIntake}</p>
              <p className="text-xs text-muted-foreground mt-1">kcal/day</p>
            </div>
            
            {hasAnyExercise && (
              <div className="p-4 rounded-xl bg-secondary/50 border border-border/30">
                <p className="text-xs text-muted-foreground mb-1">Avg Burned</p>
                <p className="text-2xl font-bold text-destructive">{averageSummary.avgBurned}</p>
                <p className="text-xs text-muted-foreground mt-1">kcal/day</p>
              </div>
            )}
            
            <div className={cn(
              "p-4 rounded-xl border border-border/30",
              averageSummary.avgNet > 0 
                ? "bg-secondary/50" 
                : "bg-secondary/50"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Avg Net</p>
              <p className={cn(
                "text-2xl font-bold",
                averageSummary.avgNet < 0 
                  ? "text-primary" 
                  : "text-foreground"
              )}>
                {averageSummary.avgNet > 0 ? '+' : ''}{averageSummary.avgNet}
              </p>
              <p className="text-xs text-muted-foreground mt-1">kcal/day</p>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Based on {averageSummary.daysWithData} days with logged data
          </p>
        </CardContent>
      </Card>

      {/* Macro Calorie Distribution - Pie Chart */}
      <Card className="glass-card border-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-primary" />
              {isToday ? "Today's" : format(pieChartDate, 'MMM d')} Calorie Sources
            </CardTitle>
            {trendsLocked ? (
              <Button
                variant="outline"
                size="sm"
                className="bg-secondary border-0 rounded-xl opacity-50"
                onClick={() => setShowDonationGate(true)}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Today
                <Lock className="h-3 w-3 ml-1" />
              </Button>
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "bg-secondary border-0 rounded-xl",
                      !pieChartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(pieChartDate, 'MMM d')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={pieChartDate}
                    onSelect={(date) => date && setPieChartDate(date)}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Macronutrient calorie distribution
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          {pieChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <p>No food logged {isToday ? 'today' : 'on this day'}</p>
            </div>
          ) : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percentage }) => `${name} ${percentage}%`}
                      labelLine={false}
                    >
                      {pieChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                      formatter={(value: number, name: string) => [`${value} kcal`, name]}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value, entry: any) => (
                        <span style={{ color: 'hsl(var(--foreground))' }}>
                          {value} ({entry.payload.percentage}%)
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="text-center mt-2">
                <p className="text-2xl font-bold text-foreground">{totalMacroKcal} kcal</p>
                <p className="text-sm text-muted-foreground">from macronutrients</p>
              </div>
              
              {/* Breakdown details */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                {pieChartData.map((item, index) => (
                  <div 
                    key={item.name} 
                    className="text-center p-3 rounded-xl bg-secondary"
                  >
                    <div 
                      className="w-3 h-3 rounded-full mx-auto mb-1"
                      style={{ backgroundColor: PIE_COLORS[index] }}
                    />
                    <p className="text-xs text-muted-foreground">{item.name}</p>
                    <p className="font-semibold text-sm">{item.value} kcal</p>
                    <p className="text-xs text-muted-foreground">
                      {item.name === 'Carbs' && '4 kcal/g'}
                      {item.name === 'Protein' && '4 kcal/g'}
                      {item.name === 'Fat' && '9 kcal/g'}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <DonationGateModal open={showDonationGate} onClose={() => setShowDonationGate(false)} />
    </div>
  );
}
