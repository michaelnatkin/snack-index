import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { isMilestoneVisit, getCelebrationMessage } from '@/lib/interactions';

// Pre-generated confetti positions (deterministic)
const CONFETTI_PIECES = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  x: (i * 7.3) % 100, // Spread across screen
  delay: (i * 0.033) % 0.5, // Staggered delays
}));

interface CelebrationModalProps {
  visitCount: number;
  onDismiss: () => void;
}

export function CelebrationModal({ visitCount, onDismiss }: CelebrationModalProps) {
  const isMilestone = isMilestoneVisit(visitCount);
  const confetti = isMilestone ? CONFETTI_PIECES : CONFETTI_PIECES.slice(0, 15);

  useEffect(() => {
    // Auto-dismiss after 2 seconds
    const timer = setTimeout(onDismiss, 2000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const message = getCelebrationMessage(visitCount);

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-charcoal/40 z-50"
        onClick={onDismiss}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        {/* Confetti */}
        <div className="absolute inset-0 overflow-hidden">
          {confetti.map((piece) => (
            <div
              key={piece.id}
              className="absolute w-3 h-3 animate-confetti"
              style={{
                left: `${piece.x}%`,
                animationDelay: `${piece.delay}s`,
                backgroundColor: ['#e8a838', '#c44536', '#5a8f5a', '#2d1b2e'][piece.id % 4],
                borderRadius: piece.id % 2 === 0 ? '50%' : '0',
              }}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-surface rounded-2xl shadow-xl p-8 text-center animate-bounce-in pointer-events-auto max-w-[20rem] mx-4">
          <span className="text-6xl block mb-4">🎉</span>
          <h2 className="text-2xl font-bold text-charcoal font-display mb-2">
            Nice!
          </h2>
          <p className="text-text-muted mb-6">
            {message}
          </p>
          <Button onClick={onDismiss} size="md" className="w-full">
            Enjoy!
          </Button>
        </div>
      </div>
    </>
  );
}

export default CelebrationModal;

