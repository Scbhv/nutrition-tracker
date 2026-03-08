import { cn } from '@/lib/utils';

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
  value?: string;
  sublabel?: string;
  className?: string;
}

export function ProgressRing({
  progress,
  size = 220,
  strokeWidth = 12,
  label,
  value,
  sublabel,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="progress-ring"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted) / 0.5)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="progress-ring-circle"
          style={{
            filter: 'drop-shadow(0 0 6px hsl(var(--primary) / 0.4))',
          }}
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {label && (
          <span className="text-[15px] text-muted-foreground/80 font-medium tracking-tight">{label}</span>
        )}
        {value && (
          <span className="text-[44px] font-semibold text-foreground tracking-tight leading-none">{value}</span>
        )}
        {sublabel && (
          <span className="text-[13px] text-primary font-semibold mt-1 tracking-tight">{sublabel}</span>
        )}
      </div>
    </div>
  );
}