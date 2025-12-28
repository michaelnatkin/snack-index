import { useEffect, useState } from 'react';

interface SwipeTutorialProps {
  onDismiss: () => void;
}

export function SwipeTutorial({ onDismiss }: SwipeTutorialProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Animate through steps
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % 3);
    }, 1000);

    // Auto-dismiss after 3 seconds
    const timeout = setTimeout(() => {
      onDismiss();
    }, 3500);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [onDismiss]);

  const hints = [
    { direction: '←', label: 'Skip', x: -30 },
    { direction: '→', label: 'Save', x: 30 },
    { direction: '↑', label: 'Go!', x: 0 },
  ];

  const currentHint = hints[step];

  return (
    <div
      className="fixed inset-0 bg-charcoal/60 z-50 flex items-center justify-center"
      onClick={onDismiss}
    >
      <div className="text-center text-cream">
        {/* Animated hand */}
        <div
          className="text-6xl mb-6 transition-transform duration-300"
          style={{
            transform: `translateX(${currentHint.x}px) ${step === 2 ? 'translateY(-20px)' : ''}`,
          }}
        >
          👆
        </div>

        {/* Direction labels */}
        <div className="flex justify-center gap-8 mb-6">
          {hints.map((hint, i) => (
            <div
              key={hint.direction}
              className={`transition-opacity duration-300 ${
                i === step ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <span className="text-3xl block">{hint.direction}</span>
              <span className="text-sm">{hint.label}</span>
            </div>
          ))}
        </div>

        <p className="text-xl font-display mb-4">Swipe to explore</p>
        <p className="text-sm text-cream/60">(tap anywhere to start)</p>
      </div>
    </div>
  );
}

export default SwipeTutorial;

