import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Apple, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { lovable } from '@/integrations/lovable';
import { useToast } from '@/hooks/use-toast';

// Google icon component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function Auth() {
  const [loadingProvider, setLoadingProvider] = useState<'apple' | 'google' | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSignIn = async (provider: 'apple' | 'google') => {
    setLoadingProvider(provider);
    
    const { error, redirected } = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });

    if (redirected) {
      return;
    }

    if (error) {
      toast({
        title: 'Sign in failed',
        description: error.message,
        variant: 'destructive',
      });
      setLoadingProvider(null);
      return;
    }

    toast({
      title: 'Welcome!',
      description: 'Successfully signed in',
    });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo/Header */}
        <div className="text-center space-y-2">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <span className="text-3xl">🍎</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">NutriTrack</h1>
          <p className="text-muted-foreground">Track your nutrition effortlessly</p>
        </div>

        {/* Sign In Options */}
        <div className="space-y-3">
          <Button
            onClick={() => handleSignIn('apple')}
            disabled={loadingProvider !== null}
            className="w-full h-14 bg-foreground text-background hover:bg-foreground/90 rounded-2xl text-base font-medium"
          >
            {loadingProvider === 'apple' ? (
              <Loader2 className="h-5 w-5 mr-3 animate-spin" />
            ) : (
              <Apple className="h-5 w-5 mr-3 fill-current" />
            )}
            Sign in with Apple
          </Button>

          <Button
            onClick={() => handleSignIn('google')}
            disabled={loadingProvider !== null}
            className="w-full h-14 bg-secondary text-foreground hover:bg-secondary/80 rounded-2xl text-base font-medium"
          >
            {loadingProvider === 'google' ? (
              <Loader2 className="h-5 w-5 mr-3 animate-spin" />
            ) : (
              <GoogleIcon className="h-5 w-5 mr-3" />
            )}
            Sign in with Google
          </Button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
