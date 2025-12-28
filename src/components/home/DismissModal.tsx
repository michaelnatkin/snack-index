import { Button } from '@/components/ui/Button';

interface DismissModalProps {
  placeName: string;
  onNeverShow: () => void;
  onNotToday: () => void;
  onCancel: () => void;
}

export function DismissModal({ placeName, onNeverShow, onNotToday, onCancel }: DismissModalProps) {
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-charcoal/40 z-50"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        <div className="bg-surface rounded-t-2xl shadow-lg max-w-lg mx-auto">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-sage/30 rounded-full" />
          </div>

          <div className="px-6 pb-8">
            <h2 className="text-xl font-bold text-charcoal mb-1 font-display">
              Not your thing?
            </h2>
            <p className="text-text-muted mb-6">
              {placeName}
            </p>

            <div className="space-y-3">
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={onNeverShow}
              >
                Never show this place
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={onNotToday}
              >
                Just not today
              </Button>

              <button
                onClick={onCancel}
                className="w-full text-center py-2 text-text-muted hover:text-charcoal transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default DismissModal;

