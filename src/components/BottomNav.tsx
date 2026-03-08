import { useState, useCallback } from 'react';
import { Apple, Database, BarChart3, User, Plus, X, Scan, Sparkles, UtensilsCrossed, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'today' | 'database' | 'trends' | 'profile';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onAddFood: () => void;
  onScanBarcode: () => void;
  onAILookup: () => void;
  onImport: () => void;
}

function triggerHaptic(pattern: number | number[] = 8) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
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

  const toggleMenu = useCallback(() => {
    if (!menuOpen) {
      // Opening menu: double tap pattern
      triggerHaptic([10, 20, 10]);
    } else {
      // Closing menu: single gentle tap
      triggerHaptic(6);
    }
    setMenuOpen(prev => !prev);
  }, [menuOpen]);

  const handleMenuItemClick = (action: () => void) => {
    triggerHaptic(12);
    action();
    setMenuOpen(false);
  };

  const renderTab = (tab: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }) => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;
    
    return (
      <button
        key={tab.id}
        onClick={() => {
          triggerHaptic();
          onTabChange(tab.id);
        }}
        className={cn(
          "bottom-nav-item min-w-[56px] transition-transform duration-150 active:scale-90",
          isActive && "active"
        )}
      >
        <div className={cn(
          "p-2 rounded-xl transition-all duration-200",
          isActive && "bg-secondary scale-105"
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
          className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm animate-fade-in"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Floating menu */}
      {menuOpen && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-3">
          {menuItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => handleMenuItemClick(item.action)}
              className="flex items-center gap-3 px-5 py-3 bg-card rounded-2xl shadow-lg border border-border/50 
                hover:bg-secondary active:scale-95 transition-all duration-150 opacity-0"
              style={{ 
                animation: `menuItemIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) ${(menuItems.length - 1 - index) * 60}ms forwards`,
              }}
            >
              <div className={cn(
                "p-2 rounded-xl transition-colors",
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
              onClick={toggleMenu}
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center shadow-lg",
                "transition-all duration-300 ease-out active:scale-90",
                menuOpen 
                  ? "bg-muted-foreground rotate-[135deg] scale-110 shadow-xl" 
                  : "bg-primary hover:bg-primary/90 hover:shadow-glow hover:scale-105"
              )}
            >
              <Plus className={cn(
                "h-6 w-6 transition-colors duration-200",
                menuOpen ? "text-background" : "text-primary-foreground"
              )} />
            </button>
            {/* Pulse ring on idle */}
            {!menuOpen && (
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping pointer-events-none" 
                style={{ animationDuration: '2s' }} 
              />
            )}
          </div>

          {/* Right tabs */}
          {rightTabs.map(renderTab)}
        </div>
      </nav>
    </>
  );
}
