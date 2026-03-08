import { useState, useRef, useEffect } from 'react';
import { Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScannerModal({ open, onClose, onScan }: BarcodeScannerModalProps) {
  const [manualBarcode, setManualBarcode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      setError(null);
      setIsScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setError('Camera access denied');
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      setManualBarcode('');
      setError(null);
    }
  }, [open]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualBarcode.trim();
    if (!trimmed) return;
    // Validate: alphanumeric + hyphens, max 50 chars
    if (!/^[a-zA-Z0-9-]+$/.test(trimmed) || trimmed.length > 50) {
      setError('Invalid barcode format');
      return;
    }
    onScan(trimmed);
    setManualBarcode('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border rounded-3xl">
        <DialogHeader>
          <DialogTitle>Scan Barcode</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Camera View */}
          <div className="relative aspect-video bg-muted rounded-2xl overflow-hidden">
            {isScanning ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-32 border-2 border-primary rounded-xl" />
                </div>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={stopCamera}
                  className="absolute top-3 right-3 rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <Camera className="h-12 w-12 text-muted-foreground" />
                <Button onClick={startCamera} className="ios-button-secondary">
                  Start Camera
                </Button>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground">
                or enter manually
              </span>
            </div>
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <Input
              value={manualBarcode}
              onChange={e => setManualBarcode(e.target.value)}
              placeholder="Barcode number"
              className="flex-1 bg-secondary border-0 rounded-xl"
            />
            <Button type="submit" disabled={!manualBarcode.trim()} className="ios-button-primary">
              Search
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
