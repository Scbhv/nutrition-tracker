import { useRef, useState } from 'react';
import { MessageSquarePlus, Bug, Sparkles, MoreHorizontal, Send, ImagePlus, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type FeedbackType = 'bug' | 'feature' | 'other';

interface FeedbackCardProps {
  isLoggedIn: boolean;
}

const TYPE_OPTIONS: { value: FeedbackType; label: string; icon: typeof Bug }[] = [
  { value: 'bug', label: 'Bug', icon: Bug },
  { value: 'feature', label: 'Feature', icon: Sparkles },
  { value: 'other', label: 'Other', icon: MoreHorizontal },
];

const MAX_MESSAGE = 2000;
const MAX_IMAGE_MB = 5;

export function FeedbackCard({ isLoggedIn }: FeedbackCardProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [type, setType] = useState<FeedbackType>('feature');
  const [message, setMessage] = useState('');
  const [replyEmail, setReplyEmail] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSent, setJustSent] = useState(false);

  const reset = () => {
    setMessage('');
    setReplyEmail('');
    setScreenshot(null);
    setType('feature');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please pick an image file', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast({ title: `Image too large`, description: `Max ${MAX_IMAGE_MB}MB`, variant: 'destructive' });
      return;
    }
    setScreenshot(file);
  };

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      toast({ title: 'Please write a message', variant: 'destructive' });
      return;
    }
    if (trimmed.length > MAX_MESSAGE) {
      toast({ title: 'Message too long', description: `Max ${MAX_MESSAGE} characters`, variant: 'destructive' });
      return;
    }
    if (replyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyEmail.trim())) {
      toast({ title: 'Invalid email', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      let screenshotPath: string | null = null;
      if (screenshot) {
        const ext = screenshot.name.split('.').pop()?.toLowerCase() || 'png';
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('feedback-screenshots')
          .upload(path, screenshot, { contentType: screenshot.type });
        if (upErr) throw upErr;
        screenshotPath = path;
      }

      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        type,
        message: trimmed,
        reply_email: replyEmail.trim() || null,
        screenshot_path: screenshotPath,
      });
      if (error) throw error;

      reset();
      setJustSent(true);
      setExpanded(false);
      setTimeout(() => setJustSent(false), 3500);
      toast({ title: 'Thanks for the feedback!', description: 'I read every submission.' });
    } catch (err) {
      toast({
        title: 'Could not send',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-card/60 backdrop-blur-2xl rounded-[20px] p-4 space-y-4 border border-border/30 shadow-sm">
      <button
        type="button"
        onClick={() => isLoggedIn && setExpanded(v => !v)}
        className="flex items-center gap-3 w-full text-left"
      >
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <MessageSquarePlus className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[15px] text-foreground tracking-tight">Send Feedback</h3>
          <p className="text-[12px] text-muted-foreground/80 truncate">
            {justSent ? 'Sent — thank you!' : 'Report a bug or suggest a feature'}
          </p>
        </div>
        {justSent && <Check className="h-5 w-5 text-primary shrink-0" />}
      </button>

      {!isLoggedIn && (
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Sign in to send feedback.
        </p>
      )}

      {isLoggedIn && expanded && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={`h-11 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors border ${
                  type === value
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-secondary/40 border-border/30 text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              type === 'bug'
                ? 'What went wrong? Steps to reproduce help a lot.'
                : type === 'feature'
                ? 'What would you love to see added?'
                : 'Tell me anything on your mind.'
            }
            rows={4}
            maxLength={MAX_MESSAGE}
            className="rounded-2xl resize-none bg-secondary/30 border-border/30 text-[14px]"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground/70 -mt-1 px-1">
            <span>{message.length}/{MAX_MESSAGE}</span>
          </div>

          <Input
            type="email"
            value={replyEmail}
            onChange={(e) => setReplyEmail(e.target.value)}
            placeholder="Reply email (optional)"
            className="rounded-2xl h-11 bg-secondary/30 border-border/30 text-[14px]"
          />

          {screenshot ? (
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-secondary/40 border border-border/30">
              <ImagePlus className="h-4 w-4 text-primary shrink-0" />
              <span className="text-[12px] truncate flex-1">{screenshot.name}</span>
              <button
                type="button"
                onClick={() => {
                  setScreenshot(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="p-1 rounded-full hover:bg-secondary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-11 gap-2 rounded-2xl border-border/30 bg-secondary/30"
            >
              <ImagePlus className="h-4 w-4" />
              Attach screenshot
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePickImage}
            className="hidden"
          />

          <div className="grid grid-cols-[auto,1fr] gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => { reset(); setExpanded(false); }}
              className="h-12 rounded-2xl border-border/30"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !message.trim()}
              className="ios-button-primary h-12 gap-2"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
