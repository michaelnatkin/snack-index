import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { Place } from '@/types/models';

interface NotInAreaStateProps {
  previewPlaces?: Place[];
}

export function NotInAreaState({ previewPlaces = [] }: NotInAreaStateProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);
    
    // In production, this would save to Firestore waitlistEntries
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    setSubmitted(true);
    setSubmitting(false);
  };

  const placeEmojis = ['🌮', '🍜', '🥟', '🍕', '🌯', '🍱'];

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <span className="text-6xl mb-4">🗺️</span>
      
      <h2 className="text-2xl font-bold text-charcoal mb-2 font-display">
        We&apos;re not in your area yet
      </h2>

      <p className="text-text-muted mb-6">
        We&apos;ve got {previewPlaces.length || 'lots of'} snack spots in Seattle so far...
      </p>

      {/* Preview carousel */}
      <div className="flex gap-3 mb-8 overflow-x-auto pb-2 max-w-full">
        {(previewPlaces.length > 0 ? previewPlaces : placeEmojis.map(() => null)).slice(0, 6).map((place, i) => (
          <div
            key={place?.id || i}
            className="flex-shrink-0 w-20 h-24 bg-surface rounded-lg shadow-sm border border-butter/30 flex flex-col items-center justify-center opacity-70"
          >
            <span className="text-3xl mb-1">
              {place?.imageURL ? '🍽️' : placeEmojis[i % placeEmojis.length]}
            </span>
            <span className="text-xs text-text-muted truncate w-full px-1 text-center">
              {place?.name || 'Tasty'}
            </span>
          </div>
        ))}
      </div>

      {/* Waitlist form */}
      {submitted ? (
        <div className="bg-success/10 text-success rounded-lg p-4 max-w-xs">
          <p className="font-medium">You&apos;re on the list!</p>
          <p className="text-sm">We&apos;ll let you know when we expand.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
          <input
            type="email"
            placeholder="Enter your email..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-butter bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
          <Button
            type="submit"
            size="md"
            className="w-full"
            loading={submitting}
          >
            Tell me when you launch
          </Button>
        </form>
      )}
    </div>
  );
}

export default NotInAreaState;

