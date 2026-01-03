import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { usePlanningStore } from '@/stores/planningStore';
import { searchPlaces, getPlaceDetails } from '@/lib/googlePlaces';

interface TimePlaceModalProps {
  onClose: () => void;
}

function formatDatetimeLocal(date: Date): string {
  return [
    date.getFullYear(),
    '-',
    String(date.getMonth() + 1).padStart(2, '0'),
    '-',
    String(date.getDate()).padStart(2, '0'),
    'T',
    String(date.getHours()).padStart(2, '0'),
    ':',
    String(date.getMinutes()).padStart(2, '0'),
  ].join('');
}

export function TimePlaceModal({ onClose }: TimePlaceModalProps) {
  const {
    overrideLocation,
    overrideTimeIso,
    setOverrideLocation,
    setOverrideTimeIso,
    clearOverrides,
  } = usePlanningStore();

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<{ placeId: string; name: string; address: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Selected location state
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number; label?: string } | undefined>(overrideLocation);

  // Time state - default to current time if no override
  const [selectedTime, setSelectedTime] = useState(() => {
    if (overrideTimeIso) {
      return formatDatetimeLocal(new Date(overrideTimeIso));
    }
    return formatDatetimeLocal(new Date());
  });

  // Update local state when store changes
  useEffect(() => {
    setSelectedLocation(overrideLocation);
  }, [overrideLocation]);

  const handleSearchPlaces = async () => {
    if (!searchTerm.trim()) return;
    
    setSearchError(null);
    setSearchLoading(true);
    try {
      const results = await searchPlaces(searchTerm.trim());
      setSearchResults(results);
    } catch (err) {
      console.error('Search places failed', err);
      setSearchError('Search failed. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectPlace = async (placeId: string, label: string) => {
    setSearchError(null);
    try {
      const details = await getPlaceDetails(placeId);
      if (!details) {
        setSearchError('Could not load place details.');
        return;
      }
      setSelectedLocation({
        latitude: details.latitude,
        longitude: details.longitude,
        label,
      });
      setSearchResults([]);
      setSearchTerm('');
    } catch (err) {
      console.error('Load place details failed', err);
      setSearchError('Could not set location. Please try again.');
    }
  };

  const handleApply = () => {
    // Apply location if set
    if (selectedLocation) {
      setOverrideLocation(selectedLocation);
    } else {
      setOverrideLocation(undefined);
    }

    // Apply time
    if (selectedTime) {
      const asDate = new Date(selectedTime);
      if (!isNaN(asDate.getTime())) {
        setOverrideTimeIso(asDate.toISOString());
      }
    } else {
      setOverrideTimeIso(undefined);
    }

    onClose();
    // Reload to apply changes
    window.location.reload();
  };

  const handleUseCurrent = () => {
    clearOverrides();
    onClose();
    window.location.reload();
  };

  const hasChanges = selectedLocation || selectedTime;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-charcoal/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto animate-slide-up w-full sm:max-w-lg mx-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-butter/30 px-5 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-charcoal font-display">Plan Ahead</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-charcoal text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* Location Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📍</span>
              <h3 className="font-semibold text-charcoal">Location</h3>
            </div>

            {/* Current selection */}
            {selectedLocation && (
              <div className="bg-cream/50 rounded-lg p-3 border border-butter/30 flex items-center justify-between">
                <div>
                  <p className="font-medium text-charcoal">{selectedLocation.label || 'Custom location'}</p>
                  <p className="text-sm text-text-muted">
                    {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLocation(undefined)}
                  className="text-paprika hover:text-paprika/80 text-sm font-medium"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Search input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchPlaces()}
                className="flex-1 px-3 py-2.5 rounded-lg border border-butter bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Search for a place..."
              />
              <Button
                size="sm"
                onClick={handleSearchPlaces}
                disabled={!searchTerm.trim() || searchLoading}
              >
                {searchLoading ? '...' : 'Search'}
              </Button>
            </div>

            {searchError && <p className="text-sm text-paprika">{searchError}</p>}

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {searchResults.map((r) => (
                  <button
                    key={r.placeId}
                    type="button"
                    onClick={() => handleSelectPlace(r.placeId, r.name)}
                    className="w-full text-left px-3 py-2.5 rounded-lg border border-butter bg-surface hover:border-primary transition-colors"
                  >
                    <p className="font-medium text-charcoal">{r.name}</p>
                    <p className="text-sm text-text-muted truncate">{r.address}</p>
                  </button>
                ))}
              </div>
            )}

            {!selectedLocation && !searchResults.length && (
              <p className="text-sm text-text-muted">
                Leave empty to use your current location
              </p>
            )}
          </div>

          {/* Time Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🕐</span>
              <h3 className="font-semibold text-charcoal">Date & Time</h3>
            </div>

            <input
              type="datetime-local"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-butter bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <p className="text-sm text-text-muted">
              Set a future time to see what will be open then
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2">
            <Button onClick={handleApply} disabled={!hasChanges}>
              Apply & Refresh
            </Button>
            
            {(overrideLocation || overrideTimeIso) && (
              <Button variant="ghost" onClick={handleUseCurrent}>
                Use Current Time & Location
              </Button>
            )}
            
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>

          {/* Current overrides indicator */}
          {(overrideLocation || overrideTimeIso) && (
            <div className="bg-honey/20 rounded-lg p-3 border border-honey/50">
              <p className="text-sm text-charcoal">
                <span className="font-medium">Currently planning for:</span>
              </p>
              {overrideLocation && (
                <p className="text-sm text-text-muted">
                  📍 {overrideLocation.label || `${overrideLocation.latitude.toFixed(4)}, ${overrideLocation.longitude.toFixed(4)}`}
                </p>
              )}
              {overrideTimeIso && (
                <p className="text-sm text-text-muted">
                  🕐 {new Date(overrideTimeIso).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default TimePlaceModal;

