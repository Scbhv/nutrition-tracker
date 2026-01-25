import { Apple, Database, BarChart3, User, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'today' | 'database' | 'trends' | 'profile';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: 'today' as Tab, label: 'Today', icon: Apple },
    { id: 'database' as Tab, label: 'Foods', icon: Database },
    { id: 'trends' as Tab, label: 'Trends', icon: BarChart3 },
    { id: 'profile' as Tab, label: 'You', icon: User },
  ];

  return (
    <nav className="bottom-nav">
      <div className="flex items-center justify-around px-4 pt-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "bottom-nav-item min-w-[64px]",
                isActive && "active"
              )}
            >
              <div className={cn(
                "p-2 rounded-xl transition-colors",
                isActive && "bg-secondary"
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
        
        {/* Search button */}
        <button className="bottom-nav-item min-w-[64px]">
          <div className="p-2 rounded-full bg-secondary">
            <Search className="h-5 w-5" />
          </div>
        </button>
      </div>
    </nav>
  );
}
