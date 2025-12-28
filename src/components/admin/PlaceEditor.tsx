import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import {
  getPlace,
  createPlace,
  updatePlace,
  deletePlace,
  getDishesForPlace,
} from '@/lib/places';
import { searchPlaces, getPlaceDetails, type PlaceAutocompleteResult } from '@/lib/googlePlaces';
import type { Dish } from '@/types/models';

export function PlaceEditor() {
  const navigate = useNavigate();
  const { placeId } = useParams<{ placeId: string }>();
  const { user } = useAuth();
  const isNew = placeId === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [googlePlaceId, setGooglePlaceId] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [dishes, setDishes] = useState<Dish[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceAutocompleteResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!isNew && placeId) {
      loadPlace(placeId);
    }
  }, [isNew, placeId]);

  const loadPlace = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const place = await getPlace(id);
      if (!place) {
        setError('Place not found');
        return;
      }

      setGooglePlaceId(place.googlePlaceId);
      setName(place.name);
      setAddress(place.address);
      setLatitude(place.latitude);
      setLongitude(place.longitude);
      setDescription(place.description || '');
      setIsActive(place.isActive);

      const placeDishes = await getDishesForPlace(id);
      setDishes(placeDishes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load place');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchPlaces(query);
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPlace = async (result: PlaceAutocompleteResult) => {
    setSearchQuery('');
    setSearchResults([]);

    try {
      const details = await getPlaceDetails(result.placeId);
      if (details) {
        setGooglePlaceId(details.placeId);
        setName(details.name);
        setAddress(details.address);
        setLatitude(details.latitude);
        setLongitude(details.longitude);
      }
    } catch (err) {
      console.error('Failed to get place details:', err);
      // Still use the autocomplete data
      setGooglePlaceId(result.placeId);
      setName(result.name);
      setAddress(result.address);
    }
  };

  const handleSave = async () => {
    if (!googlePlaceId || !name) {
      setError('Please search and select a place');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const placeData = {
        googlePlaceId,
        name,
        address,
        latitude,
        longitude,
        description: description || undefined,
        isActive,
        createdBy: user?.id || '',
      };

      if (isNew) {
        const newId = await createPlace(placeData);
        navigate(`/admin/place/${newId}`, { replace: true });
      } else {
        await updatePlace(placeId!, placeData);
      }

      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save place');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this place? This cannot be undone.')) {
      return;
    }

    setSaving(true);
    try {
      await deletePlace(placeId!);
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete place');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-butter/30 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/admin')}
            className="text-2xl"
            aria-label="Back"
          >
            ←
          </button>
          <h1 className="text-xl font-bold text-charcoal font-display">
            {isNew ? 'Add Place' : 'Edit Place'}
          </h1>
          <Button size="sm" onClick={handleSave} loading={saving}>
            Save
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="p-4 bg-paprika/10 rounded-lg border border-paprika/20">
            <p className="text-paprika">{error}</p>
          </div>
        )}

        {/* Place Search (only for new places) */}
        {isNew && (
          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">
              Search for a place
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Start typing to search..."
                className="w-full px-4 py-2 rounded-lg border border-butter bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {isSearching && (
                <div className="absolute right-3 top-2.5">
                  <LoadingSpinner size="sm" />
                </div>
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-2 bg-surface rounded-lg border border-butter shadow-lg overflow-hidden">
                {searchResults.map((result) => (
                  <button
                    key={result.placeId}
                    onClick={() => handleSelectPlace(result)}
                    className="w-full px-4 py-3 text-left hover:bg-cream/50 border-b border-butter/30 last:border-b-0"
                  >
                    <p className="font-medium text-charcoal">{result.name}</p>
                    <p className="text-sm text-text-muted">{result.address}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Place Info (read-only, auto-filled) */}
        {(googlePlaceId || !isNew) && (
          <div className="bg-surface rounded-lg p-4 border border-butter/30">
            <h3 className="text-lg font-semibold text-charcoal mb-2">{name}</h3>
            <p className="text-sm text-text-muted">{address}</p>
            {latitude !== 0 && (
              <p className="text-xs text-sage mt-1">
                {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </p>
            )}
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-charcoal mb-2">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What makes this place special?"
            rows={3}
            className="w-full px-4 py-2 rounded-lg border border-butter bg-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        {/* Dishes Section (only for existing places) */}
        {!isNew && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-charcoal">Dishes</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/admin/place/${placeId}/dish/new`)}
              >
                + Add Dish
              </Button>
            </div>

            {dishes.length === 0 ? (
              <p className="text-text-muted text-center py-4">
                No dishes yet. Add your first one!
              </p>
            ) : (
              <div className="space-y-2">
                {dishes.map((dish) => (
                  <button
                    key={dish.id}
                    onClick={() => navigate(`/admin/place/${placeId}/dish/${dish.id}`)}
                    className="w-full bg-surface rounded-lg p-3 shadow-sm border border-butter/30 text-left hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-charcoal">
                          {dish.isHero && '⭐ '}
                          {dish.name}
                        </p>
                        <p className="text-xs text-text-muted">
                          {[
                            dish.dietary.vegetarian && 'VEG',
                            dish.dietary.vegan && 'V',
                            dish.dietary.glutenFree && 'GF',
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'No dietary tags'}
                        </p>
                      </div>
                      <span className="text-sage">✎</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Active Toggle */}
        <div className="bg-surface rounded-lg p-4 border border-butter/30">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-5 h-5 rounded border-sage text-primary focus:ring-primary"
            />
            <span className="text-charcoal">Active</span>
          </label>
          <p className="text-xs text-text-muted mt-1 ml-8">
            Inactive places won&apos;t appear in recommendations
          </p>
        </div>

        {/* Delete Button (only for existing places) */}
        {!isNew && (
          <Button
            variant="ghost"
            className="w-full text-paprika hover:bg-paprika/10"
            onClick={handleDelete}
          >
            Delete Place
          </Button>
        )}
      </div>
    </div>
  );
}

export default PlaceEditor;

