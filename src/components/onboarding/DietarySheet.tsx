import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useUserStore } from '@/stores/userStore';
import type { DietaryFilters } from '@/types/models';

interface DietarySheetProps {
  onDismiss: () => void;
}

export function DietarySheet({ onDismiss }: DietarySheetProps) {
  const { user, updateDietaryFilters, updateOnboarding } = useUserStore();
  
  const [filters, setFilters] = useState<DietaryFilters>({
    vegetarian: user?.preferences.dietaryFilters.vegetarian ?? false,
    vegan: user?.preferences.dietaryFilters.vegan ?? false,
    glutenFree: user?.preferences.dietaryFilters.glutenFree ?? false,
  });
  const [saving, setSaving] = useState(false);

  const handleFilterChange = (key: keyof DietaryFilters) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGotIt = async () => {
    setSaving(true);
    try {
      await updateDietaryFilters(filters);
      await updateOnboarding({ hasSeenDietarySheet: true });
    } catch (err) {
      console.error('Failed to save dietary preferences:', err);
    }
    setSaving(false);
    onDismiss();
  };

  const handleDismiss = async () => {
    try {
      await updateOnboarding({ hasSeenDietarySheet: true });
    } catch (err) {
      console.error('Failed to update onboarding:', err);
    }
    onDismiss();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-charcoal/40 z-40"
        onClick={handleDismiss}
      />
      
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        <div className="bg-surface rounded-t-2xl shadow-lg max-w-[32rem] mx-auto">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-sage/30 rounded-full" />
          </div>

          <div className="px-6 pb-8">
            <h2 className="text-xl font-bold text-charcoal mb-4 font-display">
              What can you eat?
            </h2>

            {/* Filter options */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-cream/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={filters.vegetarian}
                  onChange={() => handleFilterChange('vegetarian')}
                  className="w-5 h-5 rounded border-sage text-primary focus:ring-primary"
                />
                <span className="text-charcoal">Vegetarian only</span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-cream/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={filters.vegan}
                  onChange={() => handleFilterChange('vegan')}
                  className="w-5 h-5 rounded border-sage text-primary focus:ring-primary"
                />
                <span className="text-charcoal">Vegan only</span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-cream/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={filters.glutenFree}
                  onChange={() => handleFilterChange('glutenFree')}
                  className="w-5 h-5 rounded border-sage text-primary focus:ring-primary"
                />
                <span className="text-charcoal">Gluten-free only</span>
              </label>
            </div>

            <p className="text-sm text-text-muted mt-4 mb-6">
              Leave unchecked to see everything
            </p>

            <Button
              size="lg"
              className="w-full"
              onClick={handleGotIt}
              loading={saving}
            >
              Got It
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default DietarySheet;

