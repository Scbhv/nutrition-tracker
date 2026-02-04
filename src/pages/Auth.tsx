import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Apple, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { lovable } from '@/integrations/lovable';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleAppleSignIn = async () => {
    setIsLoading(true);
    
    const { error, redirected } = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin,
    });

    if (redirected) {
      // User is being redirected to Apple for authentication
      return;
    }

    if (error) {
      toast({
        title: 'Sign in failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsLoading(false);
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
        <div className="space-y-4">
          <Button
            onClick={handleAppleSignIn}
            disabled={isLoading}
            className="w-full h-14 bg-foreground text-background hover:bg-foreground/90 rounded-2xl text-base font-medium"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 mr-3 animate-spin" />
            ) : (
              <Apple className="h-5 w-5 mr-3 fill-current" />
            )}
            Sign in with Apple
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
