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
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  getNearbyEligiblePlaces,
  processCandidateBatch,
  getNearestOpenPlace,
  type PlaceRecommendation,
  type PlaceWithDistance,
} from '@/lib/recommendations';
import { useTestingStore } from '@/stores/testingStore';
import { markPlaceVisited, dismissPlace, isMilestoneVisit } from '@/lib/interactions';
import { getGoogleMapsUrl } from '@/lib/googlePlaces';
import { DismissModal } from './DismissModal';
import { CelebrationModal } from './CelebrationModal';
import type { Place } from '@/types/models';

// Session storage key for preserving navigation state
const HOME_STATE_KEY = 'snack-index-home-state';

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

  // Data state - two-tier queue system
  const [candidateQueue, setCandidateQueue] = useState<PlaceWithDistance[]>([]);
  const [readyQueue, setReadyQueue] = useState<PlaceRecommendation[]>([]);
  const [candidateOffset, setCandidateOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resultType, setResultType] = useState<'loading' | 'recommendations' | 'nothing_open' | 'not_in_area' | 'all_seen' | 'needs_location_prompt'>('loading');
  const [userCoordinates, setUserCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  
  // Track if we've restored from session storage
  const restoredFromSession = useRef(false);

  // Restore state from session storage when navigating back
  useEffect(() => {
    const savedState = sessionStorage.getItem(HOME_STATE_KEY);
    if (savedState && !restoredFromSession.current) {
      try {
        const parsed = JSON.parse(savedState);
        // Only restore if we have valid data
        if (parsed.readyQueue?.length > 0) {
          restoredFromSession.current = true;
          setCandidateQueue(parsed.candidateQueue || []);
          setReadyQueue(parsed.readyQueue);
          setCandidateOffset(parsed.candidateOffset || 0);
          setCurrentIndex(parsed.currentIndex || 0);
          setResultType('recommendations');
          setUserCoordinates(parsed.userCoordinates || null);
          setLoading(false);
          // Clear the saved state after restoring
          sessionStorage.removeItem(HOME_STATE_KEY);
        }
      } catch {
        // Invalid saved state, ignore
        sessionStorage.removeItem(HOME_STATE_KEY);
      }
    }
  }, []);

  // Save state to session storage before navigating away
  const saveStateToSession = useCallback(() => {
    if (readyQueue.length > 0) {
      const stateToSave = {
        candidateQueue,
        readyQueue,
        candidateOffset,
        currentIndex,
        userCoordinates,
      };
      sessionStorage.setItem(HOME_STATE_KEY, JSON.stringify(stateToSave));
    }
  }, [candidateQueue, readyQueue, candidateOffset, currentIndex, userCoordinates]);

  // Load recommendations with given coordinates using two-tier queue
  const loadRecommendationsWithCoords = useCallback(async (coords: { latitude: number; longitude: number }) => {
    setUserCoordinates(coords);
    const nowOverride = overrideTimeIso ? new Date(overrideTimeIso) : undefined;
    const dietaryFilters = user?.preferences.dietaryFilters || {
      vegetarian: false,
      vegan: false,
      glutenFree: false,
    };

    try {
      // First, check if there are any open places at all
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

      // Get all eligible places (candidate queue)
      const eligibleResult = await getNearbyEligiblePlaces(
        coords,
        user?.id || '',
        Infinity
      );

      if (eligibleResult.type === 'not_in_area') {
        setPreviewPlaces(eligibleResult.previewPlaces || []);
        setResultType('not_in_area');
        setLoading(false);
        return;
      }

      const allCandidates = eligibleResult.places;
      setCandidateQueue(allCandidates);

      // Process initial batch (20 candidates to get ~10 open places)
      const initialBatchSize = Math.min(allCandidates.length, 20);
      const initialBatch = allCandidates.slice(0, initialBatchSize);
      const initialReady = await processCandidateBatch(initialBatch, dietaryFilters, nowOverride);

      setCandidateOffset(initialBatchSize);
      setReadyQueue(initialReady);
      setCurrentIndex(0);

      if (initialReady.length === 0) {
        setResultType('nothing_open');
      } else {
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
    // Skip loading if we've restored from session storage
    if (restoredFromSession.current) {
      return;
    }

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
    if (user && !user.onboarding.hasSeenSwipeTutorial && !showDietarySheet && !loading && readyQueue.length > 0) {
      const timer = setTimeout(() => {
        setShowSwipeTutorial(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user, showDietarySheet, loading, readyQueue.length]);

  // Auto-advance when loading finishes and we have new items (user was waiting at end)
  const prevReadyLengthRef = useRef(readyQueue.length);
  useEffect(() => {
    // If we were at the end and new items were added, advance to the next one
    if (
      readyQueue.length > prevReadyLengthRef.current &&
      currentIndex === prevReadyLengthRef.current - 1 &&
      resultType === 'recommendations'
    ) {
      setCurrentIndex((i) => i + 1);
    }
    prevReadyLengthRef.current = readyQueue.length;
  }, [readyQueue.length, currentIndex, resultType]);

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

  const currentRecommendation = readyQueue[currentIndex];

  // Load more candidates when nearing end of ready queue
  const loadMore = useCallback(async () => {
    if (loadingMore) return; // Prevent duplicate calls
    if (candidateOffset >= candidateQueue.length) return; // No more candidates

    setLoadingMore(true);
    const nowOverride = overrideTimeIso ? new Date(overrideTimeIso) : undefined;
    const dietaryFilters = user?.preferences.dietaryFilters || {
      vegetarian: false,
      vegan: false,
      glutenFree: false,
    };

    try {
      const batchSize = Math.min(10, candidateQueue.length - candidateOffset);
      const batch = candidateQueue.slice(candidateOffset, candidateOffset + batchSize);
      const newReady = await processCandidateBatch(batch, dietaryFilters, nowOverride);

      setCandidateOffset((prev) => prev + batchSize);
      setReadyQueue((prev) => [...prev, ...newReady]);
    } catch (err) {
      console.error('Failed to load more recommendations:', err);
    }

    setLoadingMore(false);
  }, [loadingMore, candidateOffset, candidateQueue, overrideTimeIso, user?.preferences.dietaryFilters]);

  const goToNext = () => {
    const hasMoreCandidates = candidateOffset < candidateQueue.length;
    const nearingEnd = currentIndex >= readyQueue.length - 3;

    // Trigger load more when nearing end and candidates remain
    if (nearingEnd && hasMoreCandidates && !loadingMore) {
      loadMore();
    }

    if (currentIndex < readyQueue.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else if (loadingMore) {
      // At exact end while loading - stay at current position (will advance when ready)
      // The loading state will show a spinner
    } else if (!hasMoreCandidates) {
      // Truly at the end - no more candidates
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
      // Only celebrate on milestone visits
      if (isMilestoneVisit(count)) {
        setShowCelebration(true);
      }
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
      saveStateToSession();
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
            onClick={handleGoToDetails}
          />

          {/* Loading more indicator - shows when at end while fetching more */}
          {loadingMore && currentIndex >= readyQueue.length - 1 && (
            <div className="fixed inset-0 bg-cream/80 flex items-center justify-center z-30">
              <div className="flex flex-col items-center gap-3">
                <LoadingSpinner size="lg" />
                <p className="text-text-muted text-sm">Finding more snacks...</p>
              </div>
            </div>
          )}

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
            disabled={currentIndex >= readyQueue.length - 1 && candidateOffset >= candidateQueue.length && !loadingMore}
            className={`nav-chevron nav-chevron--right ${currentIndex >= readyQueue.length - 1 && candidateOffset >= candidateQueue.length && !loadingMore ? 'nav-chevron--disabled' : ''}`}
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

