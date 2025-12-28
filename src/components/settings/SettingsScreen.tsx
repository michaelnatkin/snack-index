import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/stores/userStore';
import type { DietaryFilters } from '@/types/models';

const DISTANCE_OPTIONS = [
  { value: 0.25, label: '¼ mile' },
  { value: 0.5, label: '½ mile' },
  { value: 1, label: '1 mile' },
  { value: 2, label: '2 miles' },
];

export function SettingsScreen() {
  const navigate = useNavigate();
  const { signOut, isAdmin } = useAuth();
  const { user, updatePreferences, updateDietaryFilters } = useUserStore();

  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Local state for settings
  const [distance, setDistance] = useState(user?.preferences.notificationDistance || 0.5);
  const [dietary, setDietary] = useState<DietaryFilters>(
    user?.preferences.dietaryFilters || {
      vegetarian: false,
      vegan: false,
      glutenFree: false,
    }
  );
  const [emailUpdates, setEmailUpdates] = useState(user?.preferences.emailUpdates ?? true);

  const handleDistanceChange = async (value: number) => {
    setDistance(value);
    setSaving(true);
    try {
      await updatePreferences({ notificationDistance: value });
    } catch (err) {
      console.error('Failed to update distance:', err);
    }
    setSaving(false);
  };

  const handleDietaryChange = async (key: keyof DietaryFilters) => {
    const newDietary = { ...dietary, [key]: !dietary[key] };
    setDietary(newDietary);
    setSaving(true);
    try {
      await updateDietaryFilters(newDietary);
    } catch (err) {
      console.error('Failed to update dietary:', err);
    }
    setSaving(false);
  };

  const handleEmailChange = async () => {
    const newValue = !emailUpdates;
    setEmailUpdates(newValue);
    setSaving(true);
    try {
      await updatePreferences({ emailUpdates: newValue });
    } catch (err) {
      console.error('Failed to update email preference:', err);
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/');
    } catch (err) {
      console.error('Failed to sign out:', err);
    }
    setSigningOut(false);
  };

  return (
    <AppLayout>
      <div className="px-6 py-6 max-w-[32rem] mx-auto">
        <h1 className="text-2xl font-bold text-charcoal mb-6 font-display">
          Settings
        </h1>

        {/* Account section */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-sage uppercase tracking-wide mb-3">
            Account
          </h2>
          <div className="bg-surface rounded-lg p-4 shadow-sm border border-butter/30">
            {user?.photoURL && (
              <img
                src={user.photoURL}
                alt=""
                className="w-12 h-12 rounded-full mb-3"
              />
            )}
            <p className="font-medium text-charcoal">{user?.displayName}</p>
            <p className="text-sm text-text-muted">{user?.email}</p>
          </div>
        </section>

        {/* Distance section */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-sage uppercase tracking-wide mb-3">
            Notification Distance
          </h2>
          <div className="bg-surface rounded-lg p-4 shadow-sm border border-butter/30">
            <p className="text-sm text-text-muted mb-3">
              How close should you be before we alert you?
            </p>
            <div className="grid grid-cols-4 gap-2">
              {DISTANCE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleDistanceChange(option.value)}
                  className={`py-2 px-3 rounded-lg font-medium transition-colors ${
                    distance === option.value
                      ? 'bg-primary text-charcoal'
                      : 'bg-cream text-text-muted hover:bg-butter/50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Dietary section */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-sage uppercase tracking-wide mb-3">
            Dietary Preferences
          </h2>
          <div className="bg-surface rounded-lg p-4 shadow-sm border border-butter/30 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={dietary.vegetarian}
                onChange={() => handleDietaryChange('vegetarian')}
                className="w-5 h-5 rounded border-sage text-primary focus:ring-primary"
              />
              <span className="text-charcoal">Vegetarian only</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={dietary.vegan}
                onChange={() => handleDietaryChange('vegan')}
                className="w-5 h-5 rounded border-sage text-primary focus:ring-primary"
              />
              <span className="text-charcoal">Vegan only</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={dietary.glutenFree}
                onChange={() => handleDietaryChange('glutenFree')}
                className="w-5 h-5 rounded border-sage text-primary focus:ring-primary"
              />
              <span className="text-charcoal">Gluten-free only</span>
            </label>

            <p className="text-xs text-text-muted pt-2">
              Only show places with dishes matching your preferences
            </p>
          </div>
        </section>

        {/* Notifications section */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-sage uppercase tracking-wide mb-3">
            Notifications
          </h2>
          <div className="bg-surface rounded-lg p-4 shadow-sm border border-butter/30">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-charcoal">Email updates</span>
              <div
                className={`w-12 h-6 rounded-full transition-colors ${
                  emailUpdates ? 'bg-primary' : 'bg-sage/30'
                } relative`}
                onClick={handleEmailChange}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    emailUpdates ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </div>
            </label>
            <p className="text-xs text-text-muted mt-2">
              Occasional emails about new spots and features
            </p>
          </div>
        </section>

        {/* Admin section */}
        {isAdmin && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-sage uppercase tracking-wide mb-3">
              Admin
            </h2>
            <Button
              variant="secondary"
              size="md"
              className="w-full"
              onClick={() => navigate('/admin')}
            >
              Admin Dashboard →
            </Button>
          </section>
        )}

        {/* Sign out */}
        <section className="mb-8">
          <Button
            variant="ghost"
            size="lg"
            className="w-full text-paprika hover:bg-paprika/10"
            onClick={handleSignOut}
            loading={signingOut}
          >
            Sign Out
          </Button>
        </section>

        {/* Saving indicator */}
        {saving && (
          <div className="fixed top-4 right-4 bg-charcoal text-cream px-3 py-1 rounded text-sm">
            Saving...
          </div>
        )}

        {/* Version */}
        <p className="text-center text-xs text-sage">
          Snack Index v0.1.0
        </p>
      </div>
    </AppLayout>
  );
}

export default SettingsScreen;

