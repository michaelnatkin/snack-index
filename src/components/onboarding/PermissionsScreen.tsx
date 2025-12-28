import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { requestLocation } from '@/lib/location';
import { requestNotificationPermission } from '@/lib/notifications';
import { useUserStore } from '@/stores/userStore';

type PermissionStep = 'initial' | 'requesting' | 'location-denied' | 'complete';

export function PermissionsScreen() {
  const navigate = useNavigate();
  const { updateLocation, updateOnboarding } = useUserStore();
  const [step, setStep] = useState<PermissionStep>('initial');
  const [error, setError] = useState<string | null>(null);

  const handleLetsGo = async () => {
    setStep('requesting');
    setError(null);

    // Step 1: Request location permission
    const locationResult = await requestLocation();
    
    if (locationResult.success && locationResult.coordinates) {
      // Save location to user document
      try {
        await updateLocation(locationResult.coordinates);
      } catch (err) {
        console.error('Failed to save location:', err);
      }
    } else {
      setStep('location-denied');
      setError(locationResult.error || 'Location access is required to find snacks near you');
      return;
    }

    // Step 2: Request notification permission (non-blocking)
    await requestNotificationPermission();
    // We don't check the result - user can proceed without notifications

    // Mark onboarding as complete
    try {
      await updateOnboarding({ completed: true });
    } catch (err) {
      console.error('Failed to update onboarding:', err);
    }

    setStep('complete');
    navigate('/home');
  };

  const handleRetryLocation = async () => {
    setStep('requesting');
    setError(null);

    const locationResult = await requestLocation();
    
    if (locationResult.success && locationResult.coordinates) {
      try {
        await updateLocation(locationResult.coordinates);
      } catch (err) {
        console.error('Failed to save location:', err);
      }

      // Request notifications after successful location
      await requestNotificationPermission();

      try {
        await updateOnboarding({ completed: true });
      } catch (err) {
        console.error('Failed to update onboarding:', err);
      }

      navigate('/home');
    } else {
      setStep('location-denied');
      setError(locationResult.error || 'Location access is required');
    }
  };

  const handleSkipAnyway = async () => {
    // Allow user to skip but they won't get full functionality
    try {
      await updateOnboarding({ completed: true });
    } catch (err) {
      console.error('Failed to update onboarding:', err);
    }
    navigate('/home');
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 bg-background">
      <div className="max-w-[28rem] w-full mx-auto text-center">
        {/* Header */}
        <h1 className="text-2xl font-bold text-charcoal mb-2 font-display leading-tight">
          To find snacks near you, we need a couple things...
        </h1>

        {/* Permission cards */}
        <div className="mt-8 space-y-4">
          {/* Location card */}
          <div className="bg-surface rounded-lg p-4 shadow-sm border border-butter/50">
            <div className="flex items-start gap-3">
              <span className="text-3xl" role="img" aria-label="location">
                📍
              </span>
              <div className="text-left">
                <h3 className="font-semibold text-charcoal">Your location</h3>
                <p className="text-sm text-text-muted">
                  So we know what&apos;s nearby
                </p>
              </div>
            </div>
          </div>

          {/* Notifications card */}
          <div className="bg-surface rounded-lg p-4 shadow-sm border border-butter/50">
            <div className="flex items-start gap-3">
              <span className="text-3xl" role="img" aria-label="notifications">
                🔔
              </span>
              <div className="text-left">
                <h3 className="font-semibold text-charcoal">Notifications</h3>
                <p className="text-sm text-text-muted">
                  So we can tell you when you&apos;re close
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && step === 'location-denied' && (
          <div className="mt-6 p-4 bg-paprika/10 rounded-lg border border-paprika/20">
            <p className="text-sm text-paprika">{error}</p>
            <p className="text-xs text-text-muted mt-2">
              Without location access, we can&apos;t find snacks near you.
              You may need to enable it in your browser settings.
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-8 space-y-3">
          {step === 'initial' && (
            <Button
              size="lg"
              className="w-full"
              onClick={handleLetsGo}
            >
              Let&apos;s Go
            </Button>
          )}

          {step === 'requesting' && (
            <Button
              size="lg"
              className="w-full"
              loading
              disabled
            >
              Setting up...
            </Button>
          )}

          {step === 'location-denied' && (
            <>
              <Button
                size="lg"
                className="w-full"
                onClick={handleRetryLocation}
              >
                Try Again
              </Button>
              <button
                onClick={handleSkipAnyway}
                className="text-sm text-text-muted underline hover:text-charcoal transition-colors"
              >
                Continue without location
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PermissionsScreen;

