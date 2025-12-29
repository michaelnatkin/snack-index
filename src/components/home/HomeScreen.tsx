import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { DietarySheet } from '@/components/onboarding/DietarySheet';
import { LoadingState } from './LoadingState';
import { RecommendationCard } from './RecommendationCard';
import { SwipeTutorial } from './SwipeTutorial';
import { NothingOpenState } from './NothingOpenState';
import { NotInAreaState } from './NotInAreaState';
import { useUserStore } from '@/stores/userStore';
import { requestLocation } from '@/lib/location';
import {
  getRecommendationQueue,
  getNearestOpenPlace,
  type PlaceRecommendation,
} from '@/lib/recommendations';
import { useTestingStore } from '@/stores/testingStore';
import { favoritePlace, markPlaceVisited, dismissPlace } from '@/lib/interactions';
import { getGoogleMapsUrl } from '@/lib/googlePlaces';
import { DismissModal } from './DismissModal';
import { CelebrationModal } from './CelebrationModal';
import type { Place } from '@/types/models';

export function HomeScreen() {
  const navigate = useNavigate();
  const { user, updateOnboarding } = useUserStore();
  const { overrideLocation, overrideTimeIso } = useTestingStore();

  // UI State
  const [loading, setLoading] = useState(true);
  const [showDietarySheet, setShowDietarySheet] = useState(false);
  const [showSwipeTutorial, setShowSwipeTutorial] = useState(false);
  const [swipeNudgeShown, setSwipeNudgeShown] = useState(false);
  const [buttonTapCount, setButtonTapCount] = useState(0);
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
  const [resultType, setResultType] = useState<'loading' | 'recommendations' | 'nothing_open' | 'not_in_area' | 'all_seen'>('loading');

  // Load recommendations on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      // Get current location (allow admin override)
      const locationResult = overrideLocation
        ? { success: true, coordinates: overrideLocation }
        : await requestLocation();
      if (!locationResult.success || !locationResult.coordinates) {
        setLocationError(locationResult.error || 'Location required to find snacks nearby');
        setResultType('nothing_open');
        setLoading(false);
        return;
      }

      const { latitude, longitude } = locationResult.coordinates;
      const nowOverride = overrideTimeIso ? new Date(overrideTimeIso) : undefined;
      const dietaryFilters = user?.preferences.dietaryFilters || {
        vegetarian: false,
        vegan: false,
        glutenFree: false,
      };
      const maxDistance = user?.preferences.notificationDistance ?? 0.5;

      try {
        // Determine high-level state
        const nearest = await getNearestOpenPlace(
          { latitude, longitude },
          dietaryFilters,
          user?.id || '',
          maxDistance,
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

        // Minimum delay for anticipation
        await new Promise((resolve) => setTimeout(resolve, 800));

        const recs = await getRecommendationQueue(
          { latitude, longitude },
          dietaryFilters,
          user?.id || '',
          10,
          maxDistance,
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
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrideLocation, overrideTimeIso]);

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

  // Button-user nudge (after 5 button taps without swiping)
  useEffect(() => {
    if (
      user &&
      !user.onboarding.hasSeenSwipeNudge &&
      buttonTapCount >= 5 &&
      !swipeNudgeShown
    ) {
      setSwipeNudgeShown(true);
      setToast('Pro tip: Swipe the card! ← → ↑');
      setTimeout(() => setToast(null), 2500);
      updateOnboarding({ hasSeenSwipeNudge: true });
    }
  }, [buttonTapCount, user, swipeNudgeShown, updateOnboarding]);

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

  const handleSwipeLeft = () => {
    // Skip - just go to next
    goToNext();
  };

  const handleSwipeRight = async () => {
    if (!user || !currentRecommendation) {
      goToNext();
      return;
    }
    try {
      await favoritePlace(user.id, currentRecommendation.place.id);
      setToast('Saved to My Snacks');
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      console.error('Failed to save favorite:', err);
      setToast('Could not save. Try again.');
      setTimeout(() => setToast(null), 2500);
    }
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
      setPendingMapUrl(getGoogleMapsUrl(currentRecommendation.place.googlePlaceId));
    } catch (err) {
      console.error('Failed to mark visited:', err);
      setToast('Could not mark visited');
      setTimeout(() => setToast(null), 2500);
    }
    goToNext();
  };

  const handleGetDirections = async () => {
    // Track button tap
    setButtonTapCount((c) => c + 1);
    await handleSwipeUp();
  };

  const handleCardTap = () => {
    if (currentRecommendation) {
      navigate(`/place/${currentRecommendation.place.id}`);
    }
  };

  const handleNotForMe = () => {
    setButtonTapCount((c) => c + 1);
    setDismissOpen(true);
  };

  const handleSave = () => {
    setButtonTapCount((c) => c + 1);
    handleSwipeRight();
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
    <AppLayout>
      {loading && <LoadingState />}

      {!loading && resultType === 'not_in_area' && (
        <NotInAreaState previewPlaces={previewPlaces} userLocation={overrideLocation || undefined} />
      )}

      {!loading && resultType === 'nothing_open' && (
        <NothingOpenState nextToOpen={nextToOpen} />
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
        <div className="px-4 py-6">
          {/* Recommendation Card */}
          <RecommendationCard
            recommendation={currentRecommendation}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
            onSwipeUp={handleSwipeUp}
            onGetDirections={handleGetDirections}
            onCardTap={handleCardTap}
          />

          {/* Secondary Actions */}
          <div className="flex justify-center gap-8 mt-6">
            <button
              onClick={handleSave}
              className="flex flex-col items-center text-sage hover:text-paprika transition-colors"
            >
              <span className="text-3xl">❤️</span>
              <span className="text-xs mt-1">Save</span>
            </button>
            <button
              onClick={handleNotForMe}
              className="flex flex-col items-center text-sage hover:text-charcoal transition-colors"
            >
              <span className="text-3xl">👎</span>
              <span className="text-xs mt-1">Not for me</span>
            </button>
          </div>
        </div>
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
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-charcoal text-cream px-4 py-2 rounded-lg shadow-lg z-50">
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

