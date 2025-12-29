import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getFavoritePlaces, getVisitedPlaces, unfavoritePlace } from '@/lib/interactions';
import { getPlace } from '@/lib/places';
import { getPlaceHours } from '@/lib/googlePlaces';
import { useUserStore } from '@/stores/userStore';
import type { Place, UserPlaceInteraction } from '@/types/models';

interface PlaceWithInteraction {
  place: Place;
  interaction: UserPlaceInteraction;
}

type Tab = 'saved' | 'visited';

export function MySnacksScreen() {
  const navigate = useNavigate();
  const { user } = useUserStore();

  const [activeTab, setActiveTab] = useState<Tab>('saved');
  const [loading, setLoading] = useState(true);
  const [savedPlaces, setSavedPlaces] = useState<PlaceWithInteraction[]>([]);
  const [visitedPlaces, setVisitedPlaces] = useState<PlaceWithInteraction[]>([]);
  const [undoItem, setUndoItem] = useState<PlaceWithInteraction | null>(null);

  useEffect(() => {
    if (!user) return;
    
    const loadPlaces = async () => {
      setLoading(true);

      try {
        const [favorites, visited] = await Promise.all([
          getFavoritePlaces(user.id),
          getVisitedPlaces(user.id),
        ]);

        // Load place data for each interaction
        const savedWithPlaces = await Promise.all(
          favorites.map(async (interaction) => {
            const place = await getPlace(interaction.placeId);
            return place ? { place, interaction } : null;
          })
        );

        const visitedWithPlaces = await Promise.all(
          visited.map(async (interaction) => {
            const place = await getPlace(interaction.placeId);
            return place ? { place, interaction } : null;
          })
        );

        setSavedPlaces(savedWithPlaces.filter(Boolean) as PlaceWithInteraction[]);
        setVisitedPlaces(visitedWithPlaces.filter(Boolean) as PlaceWithInteraction[]);
      } catch (err) {
        console.error('Failed to load places:', err);
      }

      setLoading(false);
    };

    loadPlaces();
  }, [user]);

  const handleSurpriseMe = async () => {
    if (savedPlaces.length === 0) return;

    // Filter to open places
    const openPlaces: PlaceWithInteraction[] = [];
    for (const item of savedPlaces) {
      try {
        const hours = await getPlaceHours(item.place.googlePlaceId);
        if (hours.isOpen) {
          openPlaces.push(item);
        }
      } catch {
        // Include if we can't check
        openPlaces.push(item);
      }
    }

    if (openPlaces.length === 0) {
      alert('None of your saves are open right now');
      return;
    }

    // Pick random
    const randomPlace = openPlaces[Math.floor(Math.random() * openPlaces.length)];
    navigate(`/place/${randomPlace.place.id}`);
  };

  const handleRemove = async (item: PlaceWithInteraction) => {
    if (!user) return;

    // Remove from list
    if (activeTab === 'saved') {
      setSavedPlaces((prev) => prev.filter((p) => p.place.id !== item.place.id));
    } else {
      setVisitedPlaces((prev) => prev.filter((p) => p.place.id !== item.place.id));
    }

    // Show undo
    setUndoItem(item);
    setTimeout(() => setUndoItem(null), 5000);

    // Update in database
    try {
      await unfavoritePlace(user.id, item.place.id);
    } catch (err) {
      console.error('Failed to remove:', err);
      // Restore on error
      if (activeTab === 'saved') {
        setSavedPlaces((prev) => [...prev, item]);
      }
    }
  };

  const handleUndo = () => {
    if (!undoItem) return;

    if (activeTab === 'saved') {
      setSavedPlaces((prev) => [...prev, undoItem]);
    } else {
      setVisitedPlaces((prev) => [...prev, undoItem]);
    }

    setUndoItem(null);
  };

  const currentPlaces = activeTab === 'saved' ? savedPlaces : visitedPlaces;
  const totalPlaces = savedPlaces.length + visitedPlaces.length;
  const visitedCount = user?.stats.totalVisits || 0;

  const formatTimeAgo = (timestamp: unknown): string => {
    if (!timestamp) return '';
    const date = (timestamp as { toDate: () => Date }).toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  return (
    <AppLayout>
      <div className="px-6 py-6 max-w-[32rem] mx-auto">
        <h1 className="text-2xl font-bold text-charcoal mb-2 font-display">
          My Snacks
        </h1>

        {/* Progress indicator */}
        {visitedCount > 0 && (
          <p className="text-text-muted mb-4">
            You&apos;ve been to {visitedCount} of {totalPlaces} spots 🎯
          </p>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'saved'
                ? 'bg-primary text-charcoal'
                : 'bg-butter/30 text-text-muted hover:bg-butter/50'
            }`}
          >
            Saved ({savedPlaces.length})
          </button>
          <button
            onClick={() => setActiveTab('visited')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'visited'
                ? 'bg-primary text-charcoal'
                : 'bg-butter/30 text-text-muted hover:bg-butter/50'
            }`}
          >
            Visited ({visitedPlaces.length})
          </button>
        </div>

        {/* Surprise Me button */}
        {activeTab === 'saved' && savedPlaces.length > 0 && (
          <Button
            variant="outline"
            size="md"
            className="w-full mb-4"
            onClick={handleSurpriseMe}
            disabled={savedPlaces.length === 0}
          >
            🎲 Surprise Me
          </Button>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : currentPlaces.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-5xl block mb-4">
              {activeTab === 'saved' ? '💭' : '👣'}
            </span>
            <p className="text-text-muted">
              {activeTab === 'saved'
                ? 'No saves yet. Swipe right on snacks you want to remember!'
                : 'No visits yet. Get out there and snack!'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {currentPlaces.map((item) => (
              <div
                key={item.place.id}
                className="bg-surface rounded-lg p-4 shadow-sm border border-butter/30 relative overflow-hidden"
              >
                <button
                  onClick={() => navigate(`/place/${item.place.id}`)}
                  className="w-full text-left"
                >
                  <h3 className="font-semibold text-charcoal">
                    {item.place.name}
                  </h3>
                  <p className="text-sm text-text-muted">
                    {item.place.address.split(',')[0]}
                  </p>
                  <p className="text-xs text-sage mt-1">
                    {activeTab === 'saved'
                      ? item.interaction.visitedAt
                        ? `Last visit: ${formatTimeAgo(item.interaction.visitedAt)}`
                        : 'Not visited yet'
                      : `Visited ${formatTimeAgo(item.interaction.visitedAt)}`}
                  </p>
                </button>

                {/* Swipe to remove indicator */}
                {activeTab === 'saved' && (
                  <button
                    onClick={() => handleRemove(item)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-sage hover:text-paprika p-2"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Undo toast */}
        {undoItem && (
          <div className="fixed bottom-24 left-4 right-4 max-w-[32rem] mx-auto bg-charcoal text-cream rounded-lg p-4 flex items-center justify-between shadow-lg z-40">
            <span>Removed {undoItem.place.name}</span>
            <button
              onClick={handleUndo}
              className="font-medium text-primary hover:underline"
            >
              Undo
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default MySnacksScreen;

