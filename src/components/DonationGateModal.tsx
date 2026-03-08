import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Heart, ExternalLink } from 'lucide-react';

interface DonationGateModalProps {
  open: boolean;
  onClose: () => void;
}

const DONATION_URL = 'https://buymeacoffee.com/Simon0907';

export function DonationGateModal({ open, onClose }: DonationGateModalProps) {
  const handleDonate = () => {
    window.open(DONATION_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-3xl bg-card border-border text-center p-6 gap-4">
        <DialogHeader className="items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Heart className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-lg">Support This App</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Customizing daily goals is a premium feature. If you find this app useful, consider buying me a coffee to unlock it!
        </p>

        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={handleDonate} className="ios-button-primary gap-2">
            <Heart className="h-4 w-4" />
            Buy Me a Coffee
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </Button>
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground text-sm">
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
