import { useEffect, useState, ReactNode } from 'react';
import { Loader2, Shield, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isCurrentUserAdmin } from '@/lib/adminAccess';

export function AdminRoute({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    isCurrentUserAdmin().then((ok) => setState(ok ? 'allowed' : 'denied'));
  }, []);

  if (state === 'checking') {
    return (
      <div className="min-h-svh bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (state === 'denied') {
    return (
      <div className="min-h-svh bg-background flex flex-col items-center justify-center p-6 text-center">
        <Shield className="h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Access Denied</h1>
        <p className="text-muted-foreground text-sm mb-4">This page is restricted.</p>
        <Button variant="outline" onClick={() => (window.location.href = '/')} className="rounded-2xl">
          <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
