import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { Place } from '@/types/models';

interface NothingOpenStateProps {
  nextToOpen?: {
    place: Place;
    opensIn: string;
  };
}

export function NothingOpenState({ nextToOpen }: NothingOpenStateProps) {
  const [reminderSet, setReminderSet] = useState(false);

  const handleRemindMe = () => {
    // In production, this would schedule a local notification
    setReminderSet(true);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <span className="text-6xl mb-4">😴</span>
      
      <h2 className="text-2xl font-bold text-charcoal mb-2 font-display">
        Everything&apos;s closed right now
      </h2>

      {nextToOpen ? (
        <div className="mt-6 bg-surface rounded-xl p-5 shadow-sm border border-butter/30 max-w-xs w-full">
          <p className="text-sm text-text-muted mb-1">Next to open:</p>
          <h3 className="text-lg font-semibold text-charcoal mb-1">
            {nextToOpen.place.name}
          </h3>
          <p className="text-honey font-medium mb-4">
            Opens {nextToOpen.opensIn}
          </p>

          <Button
            size="md"
            variant={reminderSet ? 'outline' : 'primary'}
            className="w-full"
            onClick={handleRemindMe}
            disabled={reminderSet}
          >
            {reminderSet ? 'Reminder Set ✓' : 'Remind Me'}
          </Button>
        </div>
      ) : (
        <p className="text-text-muted mt-2">
          Check back later for snack spots!
        </p>
      )}
    </div>
  );
}

export default NothingOpenState;

