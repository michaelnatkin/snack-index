import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getPlace, getActiveDishesForPlace, getDish } from '@/lib/places';
import { getGoogleMapsUrl } from '@/lib/googlePlaces';
import { useAuth } from '@/hooks/useAuth';
import type { Place, Dish } from '@/types/models';

export function ShareLanding() {
  const navigate = useNavigate();
  const { placeId, dishId } = useParams<{ placeId: string; dishId?: string }>();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [place, setPlace] = useState<Place | null>(null);
  const [dish, setDish] = useState<Dish | null>(null);
  const [allDishes, setAllDishes] = useState<Dish[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (placeId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId, dishId]);

  // Redirect authenticated users to full place detail
  useEffect(() => {
    if (!authLoading && isAuthenticated && place) {
      navigate(`/place/${placeId}`, { replace: true });
    }
  }, [authLoading, isAuthenticated, place, placeId, navigate]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [placeData, dishes] = await Promise.all([
        getPlace(placeId!),
        getActiveDishesForPlace(placeId!),
      ]);

      if (!placeData) {
        setError('Place not found');
        setLoading(false);
        return;
      }

      setPlace(placeData);
      setAllDishes(dishes);

      if (dishId) {
        const dishData = await getDish(dishId);
        setDish(dishData);
      }
    } catch (err) {
      console.error('Failed to load:', err);
      setError('Failed to load place');
    }

    setLoading(false);
  };

  const handleGetDirections = () => {
    if (place) {
      window.open(getGoogleMapsUrl(place.googlePlaceId), '_blank');
    }
  };

  const handleSignUp = () => {
    // Store deep link destination for after auth
    sessionStorage.setItem('redirectAfterAuth', `/place/${placeId}`);
    navigate('/');
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !place) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
        <span className="text-6xl mb-4">😕</span>
        <h1 className="text-2xl font-bold text-charcoal mb-2 font-display">
          {error || 'Place not found'}
        </h1>
        <p className="text-text-muted mb-6">
          This link might be outdated or the place has been removed.
        </p>
        <Button onClick={() => navigate('/')}>
          Go to Snack Index
        </Button>
      </div>
    );
  }

  const heroDish = allDishes.find((d) => d.isHero);
  const displayDish = dish || heroDish;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Image */}
      <div className="h-64 bg-gradient-to-br from-honey via-paprika to-eggplant flex items-center justify-center relative">
        {place.imageURL ? (
          <img
            src={place.imageURL}
            alt={place.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-8xl">🍽️</span>
        )}
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 to-transparent" />
        
        {/* Logo */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-lg">🍿</span>
          </div>
          <span className="text-cream font-display font-bold">Snack Index</span>
        </div>
      </div>

      <div className="px-6 py-6 max-w-[32rem] mx-auto">
        {/* Place Info */}
        <h1 className="text-3xl font-bold text-charcoal font-display mb-2">
          {place.name}
        </h1>
        <p className="text-text-muted mb-4">
          {place.address.split(',')[0]}
        </p>

        {/* Featured Dish */}
        {displayDish && (
          <div className="bg-surface rounded-xl p-4 shadow-sm border border-butter/30 mb-6">
            <p className="text-sm text-sage uppercase tracking-wide mb-1">
              {displayDish.isHero ? '⭐ THE MOVE' : 'Featured'}
            </p>
            <h2 className="text-xl font-semibold text-charcoal">
              {displayDish.name}
            </h2>
            {displayDish.description && (
              <p className="text-text-muted mt-1">{displayDish.description}</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full"
            onClick={handleGetDirections}
          >
            Get Directions
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleSignUp}
          >
            Join Snack Index for more!
          </Button>
        </div>

        {/* App pitch */}
        <div className="mt-8 text-center">
          <h3 className="font-display font-bold text-charcoal mb-2">
            Find your next snack
          </h3>
          <p className="text-sm text-text-muted mb-4">
            Snack Index helps you discover the best food spots near you.
            Get notified when you&apos;re close to something delicious.
          </p>
          <div className="flex justify-center gap-4 text-3xl">
            <span>🌮</span>
            <span>🍜</span>
            <span>🥟</span>
            <span>🍕</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShareLanding;

