import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getAllPlaces, getDishesForPlace } from '@/lib/places';
import type { Place } from '@/types/models';

interface PlaceWithDishCount extends Place {
  dishCount: number;
}

export function AdminHome() {
  const navigate = useNavigate();
  const [places, setPlaces] = useState<PlaceWithDishCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPlaces();
  }, []);

  const loadPlaces = async () => {
    setLoading(true);
    setError(null);

    try {
      const allPlaces = await getAllPlaces();
      
      // Get dish counts for each place
      const placesWithCounts = await Promise.all(
        allPlaces.map(async (place) => {
          const dishes = await getDishesForPlace(place.id);
          return { ...place, dishCount: dishes.length };
        })
      );

      setPlaces(placesWithCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load places');
    } finally {
      setLoading(false);
    }
  };

  const filteredPlaces = places.filter((place) =>
    place.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-butter/30 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-[42rem] mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/settings')}
            className="text-2xl"
            aria-label="Back"
          >
            ←
          </button>
          <h1 className="text-xl font-bold text-charcoal font-display">Admin</h1>
          <div className="w-8" /> {/* Spacer for alignment */}
        </div>
      </header>

      <div className="max-w-[42rem] mx-auto px-4 py-6">
        {/* Add Place Button */}
        <Button
          size="lg"
          className="w-full mb-6"
          onClick={() => navigate('/admin/place/new')}
        >
          + Add Place
        </Button>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search places..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-butter bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-paprika mb-4">{error}</p>
            <Button onClick={loadPlaces}>Retry</Button>
          </div>
        ) : filteredPlaces.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted">
              {searchQuery ? 'No places match your search' : 'No places yet. Add your first one!'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPlaces.map((place) => (
              <button
                key={place.id}
                onClick={() => navigate(`/admin/place/${place.id}`)}
                className="w-full bg-surface rounded-lg p-4 shadow-sm border border-butter/30 text-left hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-charcoal">{place.name}</h3>
                    <p className="text-sm text-text-muted">
                      {place.dishCount} {place.dishCount === 1 ? 'dish' : 'dishes'} ·{' '}
                      <span className={place.isActive ? 'text-success' : 'text-sage'}>
                        {place.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </p>
                  </div>
                  <span className="text-sage">→</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminHome;

