import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogOut, ArrowRight } from 'lucide-react';

const EXIT_SHOWN_KEY = 'flowchat_exit_shown';

const ExitModal: React.FC = () => {
  const [open, setOpen] = useState(false);

  const wasShown = useCallback(() => {
    return sessionStorage.getItem(EXIT_SHOWN_KEY) === '1';
  }, []);

  const markShown = useCallback(() => {
    sessionStorage.setItem(EXIT_SHOWN_KEY, '1');
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && !wasShown()) {
        // Can't show modal when hidden, mark for next visible
        sessionStorage.setItem('flowchat_pending_exit', '1');
      }
      if (document.visibilityState === 'visible' && sessionStorage.getItem('flowchat_pending_exit') === '1') {
        sessionStorage.removeItem('flowchat_pending_exit');
        if (!wasShown()) {
          setOpen(true);
          markShown();
        }
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!wasShown()) {
        e.preventDefault();
        e.returnValue = '';
        markShown();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [wasShown, markShown]);

  const handleContinueLater = () => {
    setOpen(false);
    // Open in external browser (useful in webviews like Instagram/Facebook)
    window.open(window.location.href, '_blank');
  };

  const handleExit = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground text-center">Já vai? 😊</DialogTitle>
          <DialogDescription className="text-muted-foreground text-center">
            Você pode continuar essa conversa depois. Seus dados estão salvos.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          <Button onClick={handleContinueLater} className="w-full gap-2">
            <ArrowRight className="w-4 h-4" />
            Continuar depois
          </Button>
          <Button variant="ghost" onClick={handleExit} className="w-full gap-2 text-muted-foreground">
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExitModal;
