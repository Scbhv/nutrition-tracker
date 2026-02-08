import { useState, useMemo } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ReferenceLine } from 'recharts';
import { TrendingUp, PieChartIcon, CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { FoodItem, DailyLog, NutrientData, NUTRIENT_LABELS, NUTRIENT_UNITS, NUTRIENT_CATEGORIES } from '@/types/nutrients';

interface TrendsViewProps {
  foods: FoodItem[];
  logs: DailyLog[];
  dailyGoals: NutrientData;
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

export function TrendsView({ foods, logs, dailyGoals }: TrendsViewProps) {
  const [selectedNutrient, setSelectedNutrient] = useState<string>('energy-kcal');
  const [daysToShow, setDaysToShow] = useState<number>(7);
  const [pieChartDate, setPieChartDate] = useState<Date>(new Date());

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

  // Get selected date for pie chart
  const selectedDateStr = format(pieChartDate, 'yyyy-MM-dd');
  const selectedDateNutrients = useMemo(() => getNutrientsForDate(selectedDateStr), [logs, foods, selectedDateStr]);
  const isToday = selectedDateStr === format(new Date(), 'yyyy-MM-dd');

  // Bar chart data - nutrient over time
  const barChartData = useMemo(() => {
    const data = [];
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      const nutrients = getNutrientsForDate(date);
      const value = nutrients[selectedNutrient as keyof NutrientData] || 0;
      data.push({
        date: format(parseISO(date), 'MMM d'),
        value: Math.round(value * 10) / 10,
        goal: dailyGoals[selectedNutrient as keyof NutrientData] || 0,
      });
    }
    return data;
  }, [logs, foods, selectedNutrient, daysToShow, dailyGoals]);

  // Pie chart data - macro calorie distribution for selected date
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
            <Select value={daysToShow.toString()} onValueChange={(v) => setDaysToShow(Number(v))}>
              <SelectTrigger className="w-24 bg-secondary border-0 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
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
            {dailyGoals[selectedNutrient as keyof NutrientData] && (
              <span> • Goal: {dailyGoals[selectedNutrient as keyof NutrientData]} {NUTRIENT_UNITS[selectedNutrient]}</span>
            )}
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
    </div>
  );
}
