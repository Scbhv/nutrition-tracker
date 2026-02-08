import { useState } from 'react';
import { Apple, Database, BarChart3, User, Plus, X, Scan, Sparkles, UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'today' | 'database' | 'trends' | 'profile';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onAddFood: () => void;
  onScanBarcode: () => void;
  onAILookup: () => void;
}

export function BottomNav({ activeTab, onTabChange, onAddFood, onScanBarcode, onAILookup }: BottomNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const leftTabs = [
    { id: 'today' as Tab, label: 'Today', icon: Apple },
    { id: 'database' as Tab, label: 'Foods', icon: Database },
  ];

  const rightTabs = [
    { id: 'trends' as Tab, label: 'Trends', icon: BarChart3 },
    { id: 'profile' as Tab, label: 'You', icon: User },
  ];

  const menuItems = [
    { id: 'add', label: 'Add Food', icon: UtensilsCrossed, action: onAddFood },
    { id: 'scan', label: 'Scan Barcode', icon: Scan, action: onScanBarcode },
    { id: 'ai', label: 'AI Lookup', icon: Sparkles, action: onAILookup },
  ];

  const handleMenuItemClick = (action: () => void) => {
    action();
    setMenuOpen(false);
  };

  const renderTab = (tab: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }) => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;
    
    return (
      <button
        key={tab.id}
        onClick={() => onTabChange(tab.id)}
        className={cn(
          "bottom-nav-item min-w-[56px]",
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
  };

  return (
    <>
      {/* Backdrop when menu is open */}
      {menuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Floating menu */}
      {menuOpen && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-3 animate-scale-in">
          {menuItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => handleMenuItemClick(item.action)}
              className="flex items-center gap-3 px-5 py-3 bg-card rounded-2xl shadow-lg border border-border hover:bg-secondary transition-colors"
              style={{ 
                animationDelay: `${index * 50}ms`,
                animation: 'fade-in 0.2s ease-out forwards'
              }}
            >
              <div className={cn(
                "p-2 rounded-xl",
                item.id === 'ai' ? "bg-accent/20 text-accent" : "bg-primary/20 text-primary"
              )}>
                <item.icon className="h-5 w-5" />
              </div>
              <span className="font-medium text-foreground">{item.label}</span>
            </button>
          ))}
        </div>
      )}

      <nav className="bottom-nav">
        <div className="flex items-center justify-around px-2 pt-2 relative">
          {/* Left tabs */}
          {leftTabs.map(renderTab)}
          
          {/* Center FAB button */}
          <div className="relative -mt-8">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300",
                menuOpen 
                  ? "bg-muted-foreground rotate-45" 
                  : "bg-primary hover:bg-primary/90"
              )}
            >
              {menuOpen ? (
                <X className="h-6 w-6 text-background" />
              ) : (
                <Plus className="h-6 w-6 text-primary-foreground" />
              )}
            </button>
          </div>

          {/* Right tabs */}
          {rightTabs.map(renderTab)}
        </div>
      </nav>
    </>
  );
}
