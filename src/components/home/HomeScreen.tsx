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
import { getRecommendationQueue, type PlaceRecommendation } from '@/lib/recommendations';
import { useTestingStore } from '@/stores/testingStore';

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
        setResultType('not_in_area');
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

      try {
        const recs = await getRecommendationQueue(
          { latitude, longitude },
          dietaryFilters,
          user?.id || '',
          10,
          nowOverride
        );

        // Minimum delay for anticipation
        await new Promise((resolve) => setTimeout(resolve, 800));

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
      // Show toast
      alert('Pro tip: Swipe the card! ← → ↑');
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
    // Save to favorites - will implement in Phase 5
    console.log('Saved:', currentRecommendation?.place.name);
    goToNext();
  };

  const handleSwipeUp = async () => {
    // Mark as visited, trigger celebration, open maps
    console.log('Going to:', currentRecommendation?.place.name);
    goToNext();
  };

  const handleGetDirections = async () => {
    // Track button tap
    setButtonTapCount((c) => c + 1);
    // Mark as visited - will implement in Phase 5
    console.log('Directions for:', currentRecommendation?.place.name);
  };

  const handleCardTap = () => {
    if (currentRecommendation) {
      navigate(`/place/${currentRecommendation.place.id}`);
    }
  };

  const handleNotForMe = () => {
    setButtonTapCount((c) => c + 1);
    // Will open dismiss modal in Phase 5
    goToNext();
  };

  const handleSave = () => {
    setButtonTapCount((c) => c + 1);
    handleSwipeRight();
  };

  return (
    <AppLayout>
      {loading && <LoadingState />}

      {!loading && resultType === 'not_in_area' && (
        <NotInAreaState />
      )}

      {!loading && resultType === 'nothing_open' && (
        <NothingOpenState />
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
    </AppLayout>
  );
}

export default HomeScreen;

