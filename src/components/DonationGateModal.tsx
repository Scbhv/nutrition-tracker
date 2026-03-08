import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, ExternalLink, KeyRound, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DonationGateModalProps {
  open: boolean;
  onClose: () => void;
  onUnlocked?: () => void;
}

const DONATION_URL = 'https://buymeacoffee.com/Simon0907';

export function DonationGateModal({ open, onClose, onUnlocked }: DonationGateModalProps) {
  const { toast } = useToast();
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const handleDonate = () => {
    window.open(DONATION_URL, '_blank', 'noopener,noreferrer');
  };

  const handleVerifyCode = async () => {
    if (!code.trim()) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-unlock-code', {
        body: { code: code.trim() },
      });

      if (error) throw error;

      if (data?.success) {
        setUnlocked(true);
        toast({
          title: '🎉 Premium Unlocked!',
          description: data.message || 'All features are now available.',
        });
        setTimeout(() => {
          onUnlocked?.();
          onClose();
          setShowCodeInput(false);
          setCode('');
          setUnlocked(false);
        }, 1500);
      } else {
        toast({
          title: 'Invalid Code',
          description: data?.error || 'Please check your code and try again.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      const message = err?.message || 'Could not verify code. Please try again.';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setShowCodeInput(false); setCode(''); } }}>
      <DialogContent className="max-w-sm rounded-3xl bg-card border-border text-center p-6 gap-4">
        <DialogHeader className="items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            {unlocked ? (
              <Check className="h-7 w-7 text-primary" />
            ) : (
              <Heart className="h-7 w-7 text-primary" />
            )}
          </div>
          <DialogTitle className="text-lg">
            {unlocked ? 'Unlocked!' : 'Support This App'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {unlocked ? 'All premium features unlocked' : 'Donate to unlock premium features or enter an unlock code'}
          </DialogDescription>
        </DialogHeader>

        {unlocked ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            All premium features are now unlocked. Enjoy! 🎉
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This is a premium feature. Support the app by buying me a coffee, then enter your unlock code below!
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={handleDonate} className="ios-button-primary gap-2">
                <Heart className="h-4 w-4" />
                Buy Me a Coffee
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </Button>

              {!showCodeInput ? (
                <Button
                  variant="outline"
                  onClick={() => setShowCodeInput(true)}
                  className="gap-2 rounded-xl"
                >
                  <KeyRound className="h-4 w-4" />
                  I have a code
                </Button>
              ) : (
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="Enter unlock code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                    className="rounded-xl bg-secondary border-0"
                    maxLength={100}
                    disabled={verifying}
                  />
                  <Button
                    onClick={handleVerifyCode}
                    disabled={verifying || !code.trim()}
                    className="ios-button-primary px-4 shrink-0"
                  >
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                </div>
              )}

              <Button variant="ghost" onClick={onClose} className="text-muted-foreground text-sm">
                Maybe later
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
