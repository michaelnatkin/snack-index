import { useEffect, useState } from 'react';

const snackEmojis = ['🍜', '🌮', '🥟', '🍕', '🌯', '🍱', '🥙', '🍿'];

export function LoadingState() {
  const [emojiIndex, setEmojiIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setEmojiIndex((i) => (i + 1) % snackEmojis.length);
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <div className="relative">
        <span
          className="text-7xl block animate-bounce-slow"
          style={{
            animation: 'wiggle 0.5s ease-in-out infinite',
          }}
        >
          {snackEmojis[emojiIndex]}
        </span>
      </div>
      
      <h2 className="text-xl font-display text-charcoal mt-6">
        Finding your snack...
      </h2>
    </div>
  );
}

export default LoadingState;

