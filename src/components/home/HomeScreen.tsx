import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProfileMenu } from '@/components/layout/ProfileMenu';
import { DietarySheet } from '@/components/onboarding/DietarySheet';
import { LoadingState } from './LoadingState';
import { RecommendationCard } from './RecommendationCard';
import { SwipeTutorial } from './SwipeTutorial';
import { NothingOpenState } from './NothingOpenState';
import { NotInAreaState } from './NotInAreaState';
import { useUserStore } from '@/stores/userStore';
import { requestLocation, getLocationPermissionState } from '@/lib/location';
import { Button } from '@/components/ui/Button';
import {
  getRecommendationQueue,
  getNearestOpenPlace,
  type PlaceRecommendation,
} from '@/lib/recommendations';
import { useTestingStore } from '@/stores/testingStore';
import { markPlaceVisited, dismissPlace } from '@/lib/interactions';
import { getGoogleMapsUrl } from '@/lib/googlePlaces';
import { DismissModal } from './DismissModal';
import { CelebrationModal } from './CelebrationModal';
import type { Place } from '@/types/models';

export function HomeScreen() {
  const navigate = useNavigate();
  const { user, updateOnboarding, updatePermissions } = useUserStore();
  const { overrideLocation, overrideTimeIso } = useTestingStore();

  // UI State
  const [loading, setLoading] = useState(true);
  const [showDietarySheet, setShowDietarySheet] = useState(false);
  const [showSwipeTutorial, setShowSwipeTutorial] = useState(false);
  const swipeNudgeShownRef = useRef(false);
  const buttonTapCountRef = useRef(0);
  const [toast, setToast] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [pendingMapUrl, setPendingMapUrl] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [visitCount, setVisitCount] = useState(0);
  const [nextToOpen, setNextToOpen] = useState<{ place: Place; opensIn: string }>();
  const [previewPlaces, setPreviewPlaces] = useState<Place[]>([]);

  // Data state
  const [recommendations, setRecommendations] = useState<PlaceRecommendation[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resultType, setResultType] = useState<'loading' | 'recommendations' | 'nothing_open' | 'not_in_area' | 'all_seen' | 'needs_location_prompt'>('loading');
  const [userCoordinates, setUserCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);

  // Load recommendations with given coordinates
  const loadRecommendationsWithCoords = useCallback(async (coords: { latitude: number; longitude: number }) => {
    setUserCoordinates(coords);
    const nowOverride = overrideTimeIso ? new Date(overrideTimeIso) : undefined;
    const dietaryFilters = user?.preferences.dietaryFilters || {
      vegetarian: false,
      vegan: false,
      glutenFree: false,
    };

    try {
      // Determine high-level state
      const nearest = await getNearestOpenPlace(
        coords,
        dietaryFilters,
        user?.id || '',
        Infinity,
        nowOverride
      );

      if (nearest.type === 'not_in_area') {
        setPreviewPlaces(nearest.previewPlaces || []);
        setResultType('not_in_area');
        setLoading(false);
        return;
      }

      if (nearest.type === 'nothing_open') {
        if (nearest.nextToOpen) setNextToOpen(nearest.nextToOpen);
        setResultType('nothing_open');
        setLoading(false);
        return;
      }

      const recs = await getRecommendationQueue(
        coords,
        dietaryFilters,
        user?.id || '',
        10,
        Infinity,
        nowOverride
      );

      if (recs.length === 0) {
        setResultType('nothing_open');
      } else {
        setRecommendations(recs);
        setResultType('recommendations');
      }
    } catch (err) {
      console.error('Failed to load recommendations:', err);
      setResultType('nothing_open');
    }

    setLoading(false);
  }, [overrideTimeIso, user?.preferences.dietaryFilters, user?.id]);

  // Handle location request triggered by user gesture
  const handleRequestLocation = async () => {
    setLoading(true);
    setLocationError(null);
    const locationResult = await requestLocation();
    if (!locationResult.success || !locationResult.coordinates) {
      setLocationError(locationResult.error || 'Location required to find snacks nearby');
      setResultType('nothing_open');
      setLoading(false);
      return;
    }
    // Store permission state
    const permState = await getLocationPermissionState();
    if (permState === 'granted') {
      updatePermissions({ location: 'granted' });
    }
    // Load data with the fresh location
    await loadRecommendationsWithCoords(locationResult.coordinates);
  };

  // Load recommendations on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      // Get current location (allow admin override)
      let locationResult: { success: boolean; coordinates?: { latitude: number; longitude: number }; error?: string };
      
      if (overrideLocation) {
        locationResult = { success: true, coordinates: overrideLocation };
      } else {
        // Always use cached location first to avoid geolocation API issues
        const cached = user?.lastKnownLocation;
        if (cached) {
          locationResult = { 
            success: true, 
            coordinates: { latitude: cached.latitude, longitude: cached.longitude } 
          };
        } else {
          // No cached location - need user gesture to request
          setResultType('needs_location_prompt');
          setLoading(false);
          return;
        }
      }
      
      if (!locationResult.success || !locationResult.coordinates) {
        setLocationError(locationResult.error || 'Location required to find snacks nearby');
        setResultType('nothing_open');
        setLoading(false);
        return;
      }

      await loadRecommendationsWithCoords(locationResult.coordinates);
    };

    loadData();
    // Re-run when location override changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrideLocation, overrideTimeIso, user?.id]);

  // Show dietary sheet on first load
  useEffect(() => {
    if (user && !user.onboarding.hasSeenDietarySheet) {
      const timer = setTimeout(() => {
        setShowDietarySheet(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Show swipe tutorial after dietary sheet dismissed
  useEffect(() => {
    if (user && !user.onboarding.hasSeenSwipeTutorial && !showDietarySheet && !loading && recommendations.length > 0) {
      const timer = setTimeout(() => {
        setShowSwipeTutorial(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user, showDietarySheet, loading, recommendations.length]);

  const maybeShowSwipeNudge = useCallback((nextCount: number) => {
    if (
      user &&
      !user.onboarding.hasSeenSwipeNudge &&
      nextCount >= 5 &&
      !swipeNudgeShownRef.current
    ) {
      swipeNudgeShownRef.current = true;
      setToast('Pro tip: Swipe the card! ← → ↑');
      setTimeout(() => setToast(null), 2500);
      updateOnboarding({ hasSeenSwipeNudge: true });
    }
  }, [updateOnboarding, user]);

  const handleSwipeTutorialDismiss = useCallback(async () => {
    setShowSwipeTutorial(false);
    try {
      await updateOnboarding({ hasSeenSwipeTutorial: true });
    } catch (err) {
      console.error('Failed to update onboarding:', err);
    }
  }, [updateOnboarding]);

  const currentRecommendation = recommendations[currentIndex];

  const goToNext = () => {
    if (currentIndex < recommendations.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setResultType('all_seen');
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => Math.max(0, i - 1));
    }
  };

  const handleSwipeLeft = () => {
    // Navigate back
    goToPrev();
  };

  const handleSwipeRight = () => {
    // Navigate forward
    goToNext();
  };

  const handleSwipeUp = async () => {
    if (!user || !currentRecommendation) {
      goToNext();
      return;
    }
    try {
      const count = await markPlaceVisited(user.id, currentRecommendation.place.id);
      setVisitCount(count);
    setShowCelebration(true);
    setPendingMapUrl(
      getGoogleMapsUrl(
        currentRecommendation.place.googlePlaceId,
        userCoordinates || overrideLocation || undefined,
        {
          latitude: currentRecommendation.place.latitude,
          longitude: currentRecommendation.place.longitude,
        }
      )
    );
    } catch (err) {
      console.error('Failed to mark visited:', err);
      setToast('Could not mark visited');
      setTimeout(() => setToast(null), 2500);
    }
    goToNext();
  };

  const handleGoToDetails = () => {
    if (currentRecommendation) {
      navigate(`/place/${currentRecommendation.place.id}`);
    }
  };

  const handleNotForMe = () => {
    buttonTapCountRef.current += 1;
    maybeShowSwipeNudge(buttonTapCountRef.current);
    setDismissOpen(true);
  };

  const handleDismissNever = async () => {
    if (user && currentRecommendation) {
      try {
        await dismissPlace(user.id, currentRecommendation.place.id);
      } catch (err) {
        console.error('Failed to dismiss place:', err);
      }
    }
    setDismissOpen(false);
    goToNext();
  };

  const handleDismissNotToday = () => {
    setDismissOpen(false);
    goToNext();
  };

  const handleCelebrationDismiss = () => {
    setShowCelebration(false);
    if (pendingMapUrl) {
      window.open(pendingMapUrl, '_blank');
      setPendingMapUrl(null);
    }
  };

  return (
    <AppLayout hideNav>
      {loading && <LoadingState />}

      {!loading && resultType === 'not_in_area' && (
        <NotInAreaState previewPlaces={previewPlaces} userLocation={overrideLocation || undefined} />
      )}

      {!loading && resultType === 'nothing_open' && (
        <NothingOpenState nextToOpen={nextToOpen} />
      )}

      {!loading && resultType === 'needs_location_prompt' && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
          <span className="text-6xl mb-4">📍</span>
          <h2 className="text-2xl font-bold text-charcoal mb-2 font-display">
            Enable Location
          </h2>
          <p className="text-text-muted mb-6">
            We need your location to find snacks near you.
          </p>
          <Button onClick={handleRequestLocation} size="lg">
            Enable Location
          </Button>
        </div>
      )}

      {!loading && resultType === 'all_seen' && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
          <span className="text-6xl mb-4">🎉</span>
          <h2 className="text-2xl font-bold text-charcoal mb-2 font-display">
            You&apos;ve seen everything nearby!
          </h2>
          <p className="text-text-muted">
            Check back later for more snacks.
          </p>
        </div>
      )}

      {!loading && resultType === 'recommendations' && currentRecommendation && (
        <>
          {/* Profile Menu - top right */}
          <div className="fixed top-4 right-4 z-50">
            <ProfileMenu />
          </div>

          {/* Full-page recommendation */}
          <RecommendationCard
            recommendation={currentRecommendation}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
            onSwipeUp={handleSwipeUp}
          />

          {/* Navigation chevrons */}
          <button
            aria-label="Previous"
            onClick={goToPrev}
            disabled={currentIndex === 0}
            className={`nav-chevron nav-chevron--left ${currentIndex === 0 ? 'nav-chevron--disabled' : ''}`}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <button
            aria-label="Next"
            onClick={goToNext}
            disabled={currentIndex >= recommendations.length - 1}
            className={`nav-chevron nav-chevron--right ${currentIndex >= recommendations.length - 1 ? 'nav-chevron--disabled' : ''}`}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {/* Action buttons - bottom */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 z-40">
            <button
              onClick={handleNotForMe}
              className="action-button action-button--dismiss"
              aria-label="Not for me"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
                <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
              </svg>
            </button>
            <button
              onClick={handleGoToDetails}
              className="action-button action-button--go"
              aria-label="See details"
            >
              <span className="text-xl">👀</span>
            </button>
          </div>
        </>
      )}

      {/* Dietary Sheet (first load) */}
      {showDietarySheet && (
        <DietarySheet onDismiss={() => setShowDietarySheet(false)} />
      )}

      {/* Swipe Tutorial */}
      {showSwipeTutorial && (
        <SwipeTutorial onDismiss={handleSwipeTutorialDismiss} />
      )}

      {/* Dismiss Modal */}
      {dismissOpen && currentRecommendation && (
        <DismissModal
          placeName={currentRecommendation.place.name}
          onNeverShow={handleDismissNever}
          onNotToday={handleDismissNotToday}
          onCancel={() => setDismissOpen(false)}
        />
      )}

      {/* Celebration */}
      {showCelebration && (
        <CelebrationModal visitCount={visitCount} onDismiss={handleCelebrationDismiss} />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-charcoal text-cream px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      {locationError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-paprika text-cream px-4 py-2 rounded-lg shadow-lg z-50">
          {locationError}
        </div>
      )}
    </AppLayout>
  );
}

export default HomeScreen;

