import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CelebrationModal } from '@/components/home/CelebrationModal';
import { getPlace, getActiveDishesForPlace, getHeroDishForPlace } from '@/lib/places';
import { getPlaceHours, getGoogleMapsUrl, getGooglePlacePhotoUrl } from '@/lib/googlePlaces';
import { markPlaceVisited } from '@/lib/interactions';
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
        setOtherDishes(dishes.filter((d) => !d.isHero));

        // Check if open
        try {
          const hours = await getPlaceHours(placeData.googlePlaceId);
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

  useEffect(() => {
    let isMounted = true;

    const loadPhoto = async () => {
      if (!place?.googlePlaceId) return;
      const url = await getGooglePlacePhotoUrl(place.googlePlaceId, 1200);
      if (isMounted) {
        setPhotoUrl(url);
      }
    };

    loadPhoto();
    return () => {
      isMounted = false;
    };
  }, [place?.googlePlaceId]);

  const handleGetDirections = async () => {
    if (!place || !user) return;

    try {
      const count = await markPlaceVisited(user.id, place.id);
      setVisitCount(count);
      setShowCelebration(true);
    } catch (err) {
      console.error('Failed to mark visited:', err);
    }
  };

  const handleCelebrationDismiss = () => {
    setShowCelebration(false);
    if (place) {
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
    }
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
      {/* Header */}
      <header className="bg-surface border-b border-butter/30 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-[42rem] mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="text-2xl"
            aria-label="Back"
          >
            ←
          </button>
          <div className="flex-1" />
          <button
            onClick={handleShare}
            className="text-xl p-2"
            aria-label="Share"
          >
            ↗️
          </button>
        </div>
      </header>

      <div className="max-w-[42rem] mx-auto">
        {/* Hero Image */}
        <div className="h-48 bg-gradient-to-br from-honey via-paprika to-eggplant flex items-center justify-center">
          {place.imageURL || photoUrl ? (
            <img
              src={place.imageURL || photoUrl || ''}
              alt={place.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-6xl">🍽️</span>
          )}
        </div>

        <div className="px-6 py-6">
          {/* Place Info */}
          <h1 className="text-3xl font-bold text-charcoal font-display mb-2">
            {place.name}
          </h1>
          <p className="text-text-muted mb-1">
            {distance !== undefined && `${formatDistance(distance)} · `}
            {place.address.split(',')[0]}
          </p>
          <p className={isOpen ? 'text-success' : 'text-paprika'}>
            {isOpen ? `Open${closeTime ? ` until ${closeTime}` : ''}` : 'Closed'}
          </p>

          {place.description && (
            <p className="text-text-muted mt-3">{place.description}</p>
          )}

          {/* Hero Dish */}
          {heroDish && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-sage uppercase tracking-wide mb-3">
                ⭐ THE MOVE
              </h2>
              <div className="bg-surface rounded-xl p-4 shadow-sm border border-butter/30">
                <h3 className="text-xl font-semibold text-charcoal">
                  {heroDish.name}
                </h3>
                {heroDish.description && (
                  <p className="text-text-muted mt-1">{heroDish.description}</p>
                )}
                <div className="flex gap-2 mt-2">
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
            </div>
          )}

          {/* Other Dishes */}
          {filteredOtherDishes.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-sage uppercase tracking-wide mb-3">
                Also good
              </h2>
              <div className="space-y-2">
                {filteredOtherDishes.map((dish) => (
                  <div
                    key={dish.id}
                    className="bg-surface rounded-lg p-3 shadow-sm border border-butter/30"
                  >
                    <h3 className="font-medium text-charcoal">{dish.name}</h3>
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
                ))}
              </div>
            </div>
          )}

          {/* Get Directions Button */}
          <div className="mt-8 mb-4">
            <Button
              size="lg"
              className="w-full"
              onClick={handleGetDirections}
            >
              Get Directions
            </Button>
          </div>
        </div>
      </div>

      {/* Celebration Modal */}
      {showCelebration && (
        <CelebrationModal
          visitCount={visitCount}
          onDismiss={handleCelebrationDismiss}
        />
      )}
    </AppLayout>
  );
}

export default PlaceDetail;

