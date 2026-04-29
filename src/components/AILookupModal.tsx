import { useState } from 'react';
import { Sparkles, Loader2, Check, Database, Cpu, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { NutrientData, NUTRIENT_LABELS, NUTRIENT_UNITS, FoodItem } from '@/types/nutrients';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { isOfflineMode, reportSource } from '@/lib/offlineMode';
import { logError } from '@/lib/errorLog';

interface AILookupModalProps {
  open: boolean;
  onClose: () => void;
  onResult: (data: { name: string; nutrients: NutrientData }) => void;
  localFoods?: FoodItem[];
}

interface LookupResult {
  source: 'openfoodfacts' | 'ai' | 'local-db';
  name: string;
  brand?: string;
  nutrients: NutrientData;
  barcode?: string;
}

const FOOD_LOOKUP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/food-lookup`;

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;

export function AILookupModal({ open, onClose, onResult, localFoods = [] }: AILookupModalProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const { toast } = useToast();

  const handleSearch = async () => {
    const trimmedQuery = query.trim();
    
    if (!trimmedQuery) return;
    
    // Client-side validation
    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      toast({
        title: 'Query too short',
        description: 'Please enter at least 2 characters.',
        variant: 'destructive',
      });
      return;
    }
    
    if (trimmedQuery.length > MAX_QUERY_LENGTH) {
      toast({
        title: 'Query too long',
        description: `Please enter no more than ${MAX_QUERY_LENGTH} characters.`,
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    setResult(null);

    // Always try local DB first — useful for offline mode and faster lookups.
    const q = trimmedQuery.toLowerCase();
    const localMatch = localFoods.find(
      (f) => f.name.toLowerCase() === q || f.name.toLowerCase().includes(q)
    );

    if (isOfflineMode()) {
      if (localMatch) {
        reportSource('AI Lookup', 'local-db', { detail: `Matched "${localMatch.name}"` });
        setResult({
          source: 'local-db',
          name: localMatch.name,
          brand: localMatch.brand,
          nutrients: localMatch.nutrients,
          barcode: localMatch.barcode,
        });
      } else {
        reportSource('AI Lookup', 'offline-skip', {
          ok: false,
          detail: `No local match for "${trimmedQuery}"`,
        });
        toast({
          title: 'Offline mode',
          description: 'No local match found. Disable offline simulation to use online lookup.',
          variant: 'destructive',
        });
      }
      setIsLoading(false);
      return;
    }

    try {
      // Get authenticated user session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: 'Authentication required',
          description: 'Please sign in to use AI food lookup.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const response = await fetch(FOOD_LOOKUP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ query: trimmedQuery }),
      });

      if (response.status === 429) {
        toast({
          title: 'Rate limit reached',
          description: 'Please wait a moment and try again.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      if (response.status === 402) {
        toast({
          title: 'Credits exhausted',
          description: 'Please add credits to continue using AI lookup.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        reportSource('AI Lookup', 'error', {
          ok: false,
          detail: data.error || `HTTP ${response.status}`,
        });
        toast({
          title: 'Lookup failed',
          description: data.error || 'Could not find nutrition data',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      reportSource('AI Lookup', data.source === 'ai' ? 'ai' : 'openfoodfacts', {
        detail: data.name,
      });
      setResult(data);
    } catch (error) {
      console.error('Lookup error:', error);
      reportSource('AI Lookup', 'error', {
        ok: false,
        detail: error instanceof Error ? error.message : 'Network error',
      });
      toast({
        title: 'Error',
        description: 'Failed to lookup food. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  const handleAddFood = () => {
    if (result) {
      onResult({ name: result.name, nutrients: result.nutrients });
      setResult(null);
      setQuery('');
      onClose();
    }
  };

  const formatNutrientValue = (key: string, value: number) => {
    const unit = NUTRIENT_UNITS[key] || '';
    return `${value.toFixed(1)} ${unit}`;
  };

  // Get non-zero nutrients for display
  const displayNutrients = result 
    ? Object.entries(result.nutrients).filter(([_, v]) => v !== undefined && v > 0)
    : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border rounded-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            AI Food Lookup
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Search Open Food Facts or use AI to estimate nutrition
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g., 100g brown rice cooked, banana, oatmeal"
            className="bg-secondary border-0 rounded-xl"
            disabled={isLoading}
          />

          <Button 
            type="submit" 
            className="w-full ios-button-accent" 
            disabled={!query.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Looking up...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Search
              </>
            )}
          </Button>
        </form>

        {result && (
          <div className="flex-1 overflow-y-auto space-y-4 mt-4">
            {/* Source badge */}
            <div className="flex items-center gap-2">
              {result.source === 'openfoodfacts' && (
                <span className="flex items-center gap-1.5 text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                  <Database className="h-3 w-3" />
                  Open Food Facts
                </span>
              )}
              {result.source === 'ai' && (
                <span className="flex items-center gap-1.5 text-xs bg-accent/20 text-accent px-2 py-1 rounded-full">
                  <Cpu className="h-3 w-3" />
                  AI Estimated
                </span>
              )}
              {result.source === 'local-db' && (
                <span className="flex items-center gap-1.5 text-xs bg-muted text-foreground px-2 py-1 rounded-full">
                  <WifiOff className="h-3 w-3" />
                  Local database (offline)
                </span>
              )}
            </div>

            {/* Food name */}
            <div className="glass-card rounded-2xl p-4">
              <h4 className="font-semibold text-foreground">{result.name}</h4>
              {result.brand && (
                <p className="text-sm text-muted-foreground">{result.brand}</p>
              )}
            </div>

            {/* Nutrients grid */}
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <h5 className="text-sm font-medium text-muted-foreground">Per 100g</h5>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {displayNutrients.slice(0, 12).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground truncate">
                      {NUTRIENT_LABELS[key] || key}
                    </span>
                    <span className="text-foreground font-medium">
                      {formatNutrientValue(key, value as number)}
                    </span>
                  </div>
                ))}
              </div>
              {displayNutrients.length > 12 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{displayNutrients.length - 12} more nutrients
                </p>
              )}
            </div>

            {/* Add button */}
            <Button 
              onClick={handleAddFood}
              className="w-full ios-button-primary"
            >
              <Check className="h-4 w-4 mr-2" />
              Add to Database
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
