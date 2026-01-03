import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProfileMenu } from '@/components/layout/ProfileMenu';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CelebrationModal } from '@/components/home/CelebrationModal';
import { getPlace, getActiveDishesForPlace, getHeroDishForPlace } from '@/lib/places';
import { getPlaceHoursWithRefresh, getGoogleMapsUrl, getGooglePlacePhotoUrlWithRefresh } from '@/lib/googlePlaces';
import { markPlaceVisited, favoritePlace, isPlaceFavorited, isMilestoneVisit } from '@/lib/interactions';
import { formatDistance, calculateDistance } from '@/lib/location';
import { useUserStore } from '@/stores/userStore';
import type { Place, Dish } from '@/types/models';

export function PlaceDetail() {
  const navigate = useNavigate();
  const { placeId } = useParams<{ placeId: string }>();
  const { user } = useUserStore();

  const [loading, setLoading] = useState(true);
  const [place, setPlace] = useState<Place | null>(null);
  const [heroDish, setHeroDish] = useState<Dish | null>(null);
  const [otherDishes, setOtherDishes] = useState<Dish[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [closeTime, setCloseTime] = useState<string | undefined>();
  const [distance, setDistance] = useState<number | undefined>();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const [showCelebration, setShowCelebration] = useState(false);
  const [visitCount, setVisitCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [expandedDishIds, setExpandedDishIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!placeId) return;
    
    const loadPlaceData = async () => {
      setLoading(true);
      try {
        const [placeData, dishes, hero] = await Promise.all([
          getPlace(placeId),
          getActiveDishesForPlace(placeId),
          getHeroDishForPlace(placeId),
        ]);

        if (!placeData) {
          navigate('/home');
          return;
        }

        setPlace(placeData);
        setHeroDish(hero);
        // Show all dishes except the one chosen as "THE MOVE"
        setOtherDishes(dishes.filter((d) => d.id !== hero?.id));

        // Check if open
        try {
          const hours = await getPlaceHoursWithRefresh(placeId, placeData.googlePlaceId);
          setIsOpen(hours.isOpen);
          setCloseTime(hours.closeTime);
        } catch {
          // Assume open if we can't check
        }

        // Calculate distance if we have user location
        if (user?.lastKnownLocation) {
          const dist = calculateDistance(
            { latitude: user.lastKnownLocation.latitude, longitude: user.lastKnownLocation.longitude },
            { latitude: placeData.latitude, longitude: placeData.longitude }
          );
          setDistance(dist);
        }
      } catch (err) {
        console.error('Failed to load place:', err);
        navigate('/home');
      }
      setLoading(false);
    };

    loadPlaceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId]);

  // Check if place is already favorited - separate effect to handle auth loading
  useEffect(() => {
    if (!user || !placeId) return;

    const checkFavorited = async () => {
      try {
        const favorited = await isPlaceFavorited(user.id, placeId);
        setIsSaved(favorited);
      } catch (err) {
        console.error('Failed to check favorited status:', err);
      }
    };

    checkFavorited();
  }, [user, placeId]);

  useEffect(() => {
    let isMounted = true;

    const loadPhoto = async () => {
      if (!place?.id || !place?.googlePlaceId) return;
      try {
        const url = await getGooglePlacePhotoUrlWithRefresh(place.id, place.googlePlaceId, 1200);
        if (isMounted) {
          setPhotoUrl(url);
        }
      } catch (err) {
        console.error('Failed to load photo:', err);
      }
    };

    loadPhoto();
    return () => {
      isMounted = false;
    };
  }, [place?.id, place?.googlePlaceId]);

  const handleNavigate = async () => {
    if (!place || !user) return;

    try {
      const count = await markPlaceVisited(user.id, place.id);
      setVisitCount(count);
      // Only celebrate on milestone visits
      if (isMilestoneVisit(count)) {
        setShowCelebration(true);
      } else {
        // No celebration - go directly to directions
        openDirections();
      }
    } catch (err) {
      console.error('Failed to mark visited:', err);
      // Still open directions even if tracking fails
      openDirections();
    }
  };

  const openDirections = () => {
    if (!place) return;
    const origin = user?.lastKnownLocation
      ? {
          latitude: user.lastKnownLocation.latitude,
          longitude: user.lastKnownLocation.longitude,
        }
      : undefined;
    window.open(
      getGoogleMapsUrl(place.googlePlaceId, origin, {
        latitude: place.latitude,
        longitude: place.longitude,
      }),
      '_blank'
    );
  };

  const handleCelebrationDismiss = () => {
    setShowCelebration(false);
    openDirections();
  };

  const handleShare = async () => {
    if (!place) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: place.name,
          text: `Check out ${place.name} on Snack Index!`,
          url: window.location.href,
        });
      } catch {
        // User cancelled or error
      }
    }
  };

  const handleSave = async () => {
    if (!place || !user || isSaved) return;

    try {
      await favoritePlace(user.id, place.id);
      setIsSaved(true);
      setSaveToast('Saved to My Snacks!');
      setTimeout(() => setSaveToast(null), 2500);
    } catch (err) {
      console.error('Failed to save favorite:', err);
      setSaveToast('Could not save. Try again.');
      setTimeout(() => setSaveToast(null), 2500);
    }
  };

  const toggleDishExpanded = (dishId: string) => {
    setExpandedDishIds((prev) => {
      const next = new Set(prev);
      if (next.has(dishId)) {
        next.delete(dishId);
      } else {
        next.add(dishId);
      }
      return next;
    });
  };

  // Filter dishes by user's dietary preferences
  const filterDishes = (dishes: Dish[]) => {
    if (!user) return dishes;
    const filters = user.preferences.dietaryFilters;
    if (!filters.vegetarian && !filters.vegan && !filters.glutenFree) {
      return dishes;
    }
    return dishes.filter((dish) => {
      if (filters.vegetarian && !dish.dietary.vegetarian) return false;
      if (filters.vegan && !dish.dietary.vegan) return false;
      if (filters.glutenFree && !dish.dietary.glutenFree) return false;
      return true;
    });
  };

  if (loading) {
    return (
      <AppLayout hideNav>
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (!place) return null;

  const filteredOtherDishes = filterDishes(otherDishes);

  return (
    <AppLayout hideNav>
      <div>
        {/* Sticky header with full-width image - breaks out of shell-inner completely */}
        <div 
          className="sticky top-0 z-10" 
          style={{ 
            width: '100vw', 
            marginLeft: 'calc(-50vw + 50%)',
            marginTop: '-1.25rem'
          }}
        >
          <div className="relative h-[22.5rem] overflow-hidden bg-gradient-to-br from-honey via-paprika to-eggplant">
            {place.imageURL || photoUrl ? (
              <img
                src={place.imageURL || photoUrl || ''}
                alt={place.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-6xl">🍽️</div>
            )}
            <div className="hero-card__overlay" />

            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <button
                onClick={() => navigate(-1)}
                className="glass-button text-xl"
                style={{ width: '3rem', height: '3rem' }}
                aria-label="Back"
              >
                ←
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  className={`glass-button text-lg ${isSaved ? 'text-paprika' : ''}`}
                  style={{ width: '3rem', height: '3rem' }}
                  aria-label={isSaved ? 'Saved' : 'Save to My Snacks'}
                >
                  {isSaved ? '♥' : '♡'}
                </button>
                <button
                  onClick={handleNavigate}
                  className="glass-button"
                  style={{ width: '3rem', height: '3rem' }}
                  aria-label="Navigate"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                </button>
                <button
                  onClick={handleShare}
                  className="glass-button"
                  style={{ width: '3rem', height: '3rem' }}
                  aria-label="Share"
                >
                  {/* iOS share icon - square with arrow pointing up */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                </button>
                <ProfileMenu placeId={placeId} />
              </div>
            </div>

            <div className="absolute bottom-6 left-6 right-6 text-white drop-shadow-lg space-y-2">
              <h1 className="text-3xl font-bold font-display leading-tight">
                {place.name}
              </h1>
              <p className="text-white/85 text-sm">
                {distance !== undefined && `${formatDistance(distance)} · `}
                {place.address.split(',')[0]}
              </p>
              <p className="text-sm">
                {isOpen ? `Open${closeTime ? ` until ${closeTime}` : ''}` : 'Closed'}
              </p>
            </div>
          </div>
        </div>

        {/* Content area - centered with max-width */}
        <div className="max-w-[42rem] mx-auto px-6 py-6 space-y-6">
          {place.description && (
            <div className="glass-panel p-5">
              <p className="text-text-muted">{place.description}</p>
            </div>
          )}

          {heroDish && (
            <div className="glass-panel p-5">
              <h2 className="text-sm font-semibold text-sage uppercase tracking-wide mb-3">
                ⭐ THE MOVE
              </h2>
              <h3 className="text-xl font-semibold text-charcoal">
                {heroDish.name}
              </h3>
              {heroDish.description && (
                <p className="text-text-muted mt-1">{heroDish.description}</p>
              )}
              <div className="flex gap-2 mt-3">
                {heroDish.dietary.vegetarian && (
                  <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded">VEG</span>
                )}
                {heroDish.dietary.vegan && (
                  <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded">V</span>
                )}
                {heroDish.dietary.glutenFree && (
                  <span className="text-xs bg-honey/20 text-honey px-2 py-0.5 rounded">GF</span>
                )}
              </div>
            </div>
          )}

          {filteredOtherDishes.length > 0 && (
            <div className="glass-panel p-5">
              <h2 className="text-sm font-semibold text-sage uppercase tracking-wide mb-3">
                Also Great
              </h2>
              <div className="space-y-3">
                {filteredOtherDishes.map((dish) => {
                  const isExpanded = expandedDishIds.has(dish.id);
                  const hasDescription = !!dish.description;
                  return (
                    <div
                      key={dish.id}
                      className={`rounded-lg border border-butter/40 bg-white/80 px-3 py-2 shadow-sm ${hasDescription ? 'cursor-pointer hover:bg-white/90 transition-colors' : ''}`}
                      onClick={hasDescription ? () => toggleDishExpanded(dish.id) : undefined}
                      role={hasDescription ? 'button' : undefined}
                      tabIndex={hasDescription ? 0 : undefined}
                      onKeyDown={hasDescription ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleDishExpanded(dish.id);
                        }
                      } : undefined}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-charcoal">{dish.name}</h3>
                        {hasDescription && (
                          <span className="text-text-muted text-sm transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                            ▼
                          </span>
                        )}
                      </div>
                      {hasDescription && (
                        <p className={`text-text-muted text-sm mt-1 ${isExpanded ? '' : 'line-clamp-1'}`}>
                          {dish.description}
                        </p>
                      )}
                      <div className="flex gap-2 mt-1">
                        {dish.dietary.vegetarian && (
                          <span className="text-xs text-success">VEG</span>
                        )}
                        {dish.dietary.vegan && (
                          <span className="text-xs text-success">V</span>
                        )}
                        {dish.dietary.glutenFree && (
                          <span className="text-xs text-honey">GF</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Celebration Modal */}
      {showCelebration && (
        <CelebrationModal
          visitCount={visitCount}
          onDismiss={handleCelebrationDismiss}
        />
      )}

      {/* Save Toast */}
      {saveToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-charcoal text-cream px-4 py-2 rounded-lg shadow-lg z-50">
          {saveToast}
        </div>
      )}
    </AppLayout>
  );
}

export default PlaceDetail;

