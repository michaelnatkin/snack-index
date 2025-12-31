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
      <div className="max-w-[42rem] mx-auto">
        <div className="relative h-[22.5rem] rounded-b-[2rem] overflow-hidden shadow-xl bg-gradient-to-br from-honey via-paprika to-eggplant">
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
            <button
              onClick={handleShare}
              className="glass-button text-lg"
              style={{ width: '3rem', height: '3rem' }}
              aria-label="Share"
            >
              ↗️
            </button>
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

        <div className="px-6 py-6 space-y-6">
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
                Also good
              </h2>
              <div className="space-y-3">
                {filteredOtherDishes.map((dish) => (
                  <div
                    key={dish.id}
                    className="rounded-lg border border-butter/40 bg-white/80 px-3 py-2 shadow-sm"
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

          <div className="glass-panel p-5">
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

