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
      hasData: index < dayOfWeek,
      isToday: index === dayOfWeek,
      isPast: index < dayOfWeek,
    };
  });

  return (
    <div className="bg-card/60 backdrop-blur-2xl rounded-[20px] p-4 border border-border/30 shadow-sm animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[15px] text-foreground tracking-tight">My Week</h3>
        <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
      </div>
      
      <div className="flex items-center justify-between gap-1">
        {days.map((dayData) => (
          <button
            key={dayData.day}
            onClick={() => onDayClick?.(dayData.date)}
            className={cn(
              "flex flex-col items-center gap-1.5 py-2 px-2 rounded-2xl transition-all",
              dayData.isToday && "bg-primary/15",
              !dayData.isPast && !dayData.isToday && "opacity-40"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold transition-colors",
              dayData.hasData && "bg-primary text-primary-foreground",
              dayData.isToday && !dayData.hasData && "bg-secondary text-foreground",
              !dayData.hasData && !dayData.isToday && "bg-muted/50 text-muted-foreground"
            )}>
              {dayData.hasData ? '✓' : dayData.date}
            </div>
            <span className={cn(
              "text-[10px] font-medium tracking-wide",
              dayData.isToday ? "text-primary" : "text-muted-foreground/70"
            )}>
              {dayData.day}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}