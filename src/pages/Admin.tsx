import { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Trash2, ToggleLeft, ToggleRight, Loader2, ArrowLeft, Copy, Check, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface UnlockCode {
  id: string;
  code: string;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  created_at: string;
}

interface PremiumUser {
  id: string;
  user_id: string;
  unlocked_at: string;
  unlock_method: string;
}

export default function AdminPanel() {
  const { toast } = useToast();
  const [codes, setCodes] = useState<UnlockCode[]>([]);
  const [premiumUsers, setPremiumUsers] = useState<PremiumUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newMaxUses, setNewMaxUses] = useState('10');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session?.user);
      setCheckingAuth(false);
    };
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
      setCheckingAuth(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('admin-codes', {
        body: { action: 'list' },
      });
      if (fnError) throw fnError;
      if (data?.error) {
        setError(data.error);
        return;
      }
      setCodes(data.codes || []);
      setPremiumUsers(data.premiumUsers || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!newCode.trim()) return;
    setCreating(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('admin-codes', {
        body: { action: 'create', code: newCode.trim(), max_uses: parseInt(newMaxUses) || 1 },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Created', description: `Code "${newCode}" created` });
      setNewCode('');
      fetchData();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await supabase.functions.invoke('admin-codes', {
        body: { action: 'toggle', id, is_active: !isActive },
      });
      fetchData();
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.functions.invoke('admin-codes', {
        body: { action: 'delete', id },
      });
      toast({ title: 'Deleted' });
      fetchData();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-svh bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-svh bg-background flex flex-col items-center justify-center p-6 text-center">
        <Shield className="h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Sign In Required</h1>
        <p className="text-muted-foreground text-sm mb-4">Please sign in with your admin account to access this panel.</p>
        <Button variant="outline" onClick={() => window.location.href = '/'} className="rounded-2xl">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go to App
        </Button>
      </div>
    );
  }

  if (error === 'Forbidden') {
    return (
      <div className="min-h-svh bg-background flex flex-col items-center justify-center p-6 text-center">
        <Shield className="h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Access Denied</h1>
        <p className="text-muted-foreground text-sm mb-4">You don't have admin privileges.</p>
        <Button variant="outline" onClick={() => window.location.href = '/'} className="rounded-2xl">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 bg-background/70 backdrop-blur-2xl border-b border-border/30">
        <div className="flex items-center gap-3 px-5 py-3">
          <Button variant="ghost" size="icon" onClick={() => window.location.href = '/'} className="rounded-full h-9 w-9">
            <ArrowLeft className="h-[18px] w-[18px]" />
          </Button>
          <h1 className="text-xl font-bold tracking-tight">Admin Panel</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-5 space-y-6">
        {/* Create New Code */}
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
            Create Unlock Code
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="CODE-NAME"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              className="rounded-xl bg-secondary border-0 flex-1"
              maxLength={50}
            />
            <Input
              type="number"
              placeholder="Uses"
              value={newMaxUses}
              onChange={(e) => setNewMaxUses(e.target.value)}
              className="rounded-xl bg-secondary border-0 w-20"
              min={1}
            />
          </div>
          <Button
            onClick={handleCreate}
            disabled={creating || !newCode.trim()}
            className="w-full ios-button-primary"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Create Code
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{codes.length}</p>
            <p className="text-xs text-muted-foreground">Total Codes</p>
          </div>
          <div className="glass-card rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-primary">{premiumUsers.length}</p>
            <p className="text-xs text-muted-foreground">Premium Users</p>
          </div>
        </div>

        {/* Codes List */}
        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
            Unlock Codes
          </Label>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : codes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No codes yet</p>
          ) : (
            codes.map((code) => (
              <div
                key={code.id}
                className={cn(
                  "glass-card rounded-2xl p-4 space-y-2 transition-opacity",
                  !code.is_active && "opacity-50"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyCode(code.code, code.id)}
                      className="font-mono text-sm font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      {code.code}
                      {copiedId === code.id ? (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggle(code.id, code.is_active)}
                      className="h-8 w-8 rounded-full"
                    >
                      {code.is_active ? (
                        <ToggleRight className="h-5 w-5 text-primary" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(code.id)}
                      className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {code.current_uses}/{code.max_uses} used
                  </span>
                  <span>{code.is_active ? '✅ Active' : '⛔ Disabled'}</span>
                  <span>{new Date(code.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Premium Users */}
        {premiumUsers.length > 0 && (
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              Premium Users ({premiumUsers.length})
            </Label>
            {premiumUsers.map((pu) => (
              <div key={pu.id} className="glass-card rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">{pu.user_id}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {pu.unlock_method} · {new Date(pu.unlocked_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
