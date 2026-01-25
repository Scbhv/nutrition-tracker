import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

interface DayData {
  day: string;
  date: number;
  hasData: boolean;
  isToday: boolean;
  isPast: boolean;
}

interface WeekViewProps {
  onDayClick?: (date: number) => void;
}

export function WeekView({ onDayClick }: WeekViewProps) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  
  const days: DayData[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, index) => {
    const diff = index - dayOfWeek;
    const date = new Date(today);
    date.setDate(today.getDate() + diff);
    
    return {
      day,
      date: date.getDate(),
      hasData: index < dayOfWeek, // Mock: past days have data
      isToday: index === dayOfWeek,
      isPast: index < dayOfWeek,
    };
  });

  return (
    <div className="glass-card rounded-2xl p-4 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">My Week</h3>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </div>
      
      <div className="flex items-center justify-between gap-1">
        {days.map((dayData, index) => (
          <button
            key={dayData.day}
            onClick={() => onDayClick?.(dayData.date)}
            className={cn(
              "flex flex-col items-center gap-1 py-2 px-2 rounded-xl transition-all",
              dayData.isToday && "bg-primary/20",
              !dayData.isPast && !dayData.isToday && "opacity-50"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
              dayData.hasData && "bg-primary text-primary-foreground",
              dayData.isToday && !dayData.hasData && "bg-secondary text-foreground",
              !dayData.hasData && !dayData.isToday && "bg-muted text-muted-foreground"
            )}>
              {dayData.hasData ? '✓' : dayData.date}
            </div>
            <span className={cn(
              "text-[10px] font-medium",
              dayData.isToday ? "text-primary" : "text-muted-foreground"
            )}>
              {dayData.day}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
