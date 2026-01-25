import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

    // For now, this is a placeholder. In a real implementation,
    // you would connect to Lovable Cloud and use AI to look up food data.
    setTimeout(() => {
      setResult(
        "AI food lookup requires Lovable Cloud to be enabled. Once enabled, you can ask questions like:\n\n" +
        "• \"100g of cooked oatmeal\"\n" +
        "• \"1 medium banana\"\n" +
        "• \"Chicken breast grilled, 150g\"\n\n" +
        "The AI will return accurate nutritional information for your food database."
      );
      setIsLoading(false);
    }, 1000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Food Lookup
          </DialogTitle>
          <DialogDescription>
            Describe a food and get its nutritional information
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g., 100g cooked brown rice"
            className="w-full"
          />

          <Button 
            type="submit" 
            className="w-full" 
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
                Look Up Food
              </>
            )}
          </Button>

          {result && (
            <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground whitespace-pre-wrap">
              {result}
            </div>
          )}
        </form>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Tip: Be specific about portion size and preparation method for accurate results.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
