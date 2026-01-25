import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { NutrientData } from '@/types/nutrients';

interface AILookupModalProps {
  open: boolean;
  onClose: () => void;
  onResult: (data: { name: string; nutrients: NutrientData }) => void;
}

export function AILookupModal({ open, onClose, onResult }: AILookupModalProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setResult(null);

    setTimeout(() => {
      setResult(
        "Enable Lovable Cloud to use AI food lookup. You can query:\n\n" +
        "• \"100g cooked oatmeal\"\n" +
        "• \"1 medium banana\"\n" +
        "• \"Grilled chicken breast 150g\""
      );
      setIsLoading(false);
    }, 800);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            AI Lookup
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Describe a food to get nutrition info
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g., 100g brown rice cooked"
            className="bg-secondary border-0 rounded-xl"
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
                Generate
              </>
            )}
          </Button>

          {result && (
            <div className="p-4 bg-secondary rounded-2xl text-sm text-muted-foreground whitespace-pre-wrap">
              {result}
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
