import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { requestLocation, getLocationPermissionState } from '@/lib/location';
import { requestNotificationPermission } from '@/lib/notifications';
import { useUserStore } from '@/stores/userStore';

type PermissionStep = 'initial' | 'requesting' | 'location-denied' | 'complete';

export function PermissionsScreen() {
  const navigate = useNavigate();
  const { updateLocation, updateOnboarding, updatePermissions } = useUserStore();
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
      // Persist permission state
      try {
        const permissionState = await getLocationPermissionState();
        await updatePermissions({ location: permissionState });
      } catch (err) {
        console.error('Failed to record location permission:', err);
      }
    } else {
      setStep('location-denied');
      setError(locationResult.error || 'Location access is required to find snacks near you');
      try {
        const permissionState = await getLocationPermissionState();
        await updatePermissions({ location: permissionState });
      } catch (err) {
        console.error('Failed to record denied location permission:', err);
      }
      return;
    }

    // Step 2: Request notification permission (non-blocking)
    const notificationResult = await requestNotificationPermission();
    try {
      await updatePermissions(
        { notifications: notificationResult.permissionState },
        notificationResult.token
      );
    } catch (err) {
      console.error('Failed to record notification permission:', err);
    }
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

      try {
        const permissionState = await getLocationPermissionState();
        await updatePermissions({ location: permissionState });
      } catch (err) {
        console.error('Failed to record location permission:', err);
      }

      // Request notifications after successful location
      const notificationResult = await requestNotificationPermission();
      try {
        await updatePermissions(
          { notifications: notificationResult.permissionState },
          notificationResult.token
        );
      } catch (err) {
        console.error('Failed to record notification permission:', err);
      }

      try {
        await updateOnboarding({ completed: true });
      } catch (err) {
        console.error('Failed to update onboarding:', err);
      }

      navigate('/home');
    } else {
      setStep('location-denied');
      setError(locationResult.error || 'Location access is required');
      try {
        const permissionState = await getLocationPermissionState();
        await updatePermissions({ location: permissionState });
      } catch (err) {
        console.error('Failed to record denied location permission:', err);
      }
    }
  };

  const handleSkipAnyway = async () => {
    // Allow user to skip but they won't get full functionality
    try {
      await updateOnboarding({ completed: true });
      await updatePermissions({ location: 'denied' });
    } catch (err) {
      console.error('Failed to update onboarding:', err);
    }
    navigate('/home');
  };

  return (
    <div className="app-shell">
      <div className="shell-inner min-h-screen flex flex-col justify-center">
        <div className="glass-panel p-6 text-center">
          <h1 className="text-2xl font-bold text-charcoal mb-2 font-display leading-tight">
            To find snacks near you, we need a couple things...
          </h1>

          <div className="mt-8 space-y-4">
            <div className="rounded-xl border border-butter/50 bg-white/80 p-4 shadow-sm">
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

            <div className="rounded-xl border border-butter/50 bg-white/80 p-4 shadow-sm">
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

          {error && step === 'location-denied' && (
            <div className="mt-6 p-4 bg-paprika/10 rounded-lg border border-paprika/20 text-left">
              <p className="text-sm text-paprika">{error}</p>
              <p className="text-xs text-text-muted mt-2">
                Without location access, we can&apos;t find snacks near you.
                You may need to enable it in your browser settings.
              </p>
            </div>
          )}

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
    </div>
  );
}

export default PermissionsScreen;

