import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { useTestingStore } from '@/stores/testingStore';
import { searchPlaces, getPlaceDetails } from '@/lib/googlePlaces';

type Tab = 'location' | 'time';

export function DevSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    overrideLocation,
    overrideTimeIso,
    setOverrideLocation,
    setOverrideTimeIso,
    clearOverrides,
  } = useTestingStore();
  const [activeTab, setActiveTab] = useState<Tab>('location');

  const [tempLat, setTempLat] = useState(overrideLocation?.latitude?.toString() || '');
  const [tempLng, setTempLng] = useState(overrideLocation?.longitude?.toString() || '');
  const [tempLabel, setTempLabel] = useState(overrideLocation?.label || '');
  const initialTempTime = (() => {
    if (!overrideTimeIso) return '';
    const d = new Date(overrideTimeIso);
    const localIso = [
      d.getFullYear(),
      '-',
      String(d.getMonth() + 1).padStart(2, '0'),
      '-',
      String(d.getDate()).padStart(2, '0'),
      'T',
      String(d.getHours()).padStart(2, '0'),
      ':',
      String(d.getMinutes()).padStart(2, '0'),
    ].join('');
    return localIso;
  })();

  const [tempTime, setTempTime] = useState(initialTempTime);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<{ placeId: string; name: string; address: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearchPlaces = async () => {
    setSearchError(null);
    setSearchLoading(true);
    try {
      const results = await searchPlaces(searchTerm.trim());
      setSearchResults(results);
    } catch (err) {
      console.error('Search places failed', err);
      setSearchError('Search failed. Check API key and try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleUsePlaceResult = async (placeId: string, label: string) => {
    setSearchError(null);
    try {
      const details = await getPlaceDetails(placeId);
      if (!details) {
        setSearchError('Could not load place details.');
        return;
      }
      setTempLat(details.latitude.toString());
      setTempLng(details.longitude.toString());
      setTempLabel(label);
      setOverrideLocation({
        latitude: details.latitude,
        longitude: details.longitude,
        label,
      });
    } catch (err) {
      console.error('Load place details failed', err);
      setSearchError('Could not set location from place. Try again.');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-butter/30 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-[42rem] mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/admin')}
            className="text-2xl"
            aria-label="Back"
          >
            ←
          </button>
          <h1 className="text-xl font-bold text-charcoal font-display">Testing Overrides</h1>
          <div className="w-8" /> {/* Spacer */}
        </div>
      </header>

      <div className="max-w-[42rem] mx-auto px-4 py-6">
        {user ? (
          <p className="text-sm text-text-muted mb-4">Signed in as: {user.email}</p>
        ) : (
          <p className="text-paprika text-sm mb-4">Not signed in. Go to / to sign in first.</p>
        )}

        <p className="text-sm text-text-muted mb-6">
          Set a fake location and time for admin testing. Stored in localStorage only (not saved to Firestore).
        </p>

        {/* Tabs */}
        <div className="flex border-b border-butter/30 mb-6">
          <button
            onClick={() => setActiveTab('location')}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              activeTab === 'location'
                ? 'text-charcoal border-b-2 border-primary'
                : 'text-text-muted hover:text-charcoal'
            }`}
          >
            📍 Location
          </button>
          <button
            onClick={() => setActiveTab('time')}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              activeTab === 'time'
                ? 'text-charcoal border-b-2 border-primary'
                : 'text-text-muted hover:text-charcoal'
            }`}
          >
            🕐 Time
          </button>
        </div>

        {/* Location Tab */}
        {activeTab === 'location' && (
          <div className="space-y-4">
            {/* Place Search */}
            <div className="bg-surface rounded-lg p-4 border border-butter/30 space-y-3">
              <p className="text-sm font-medium text-charcoal">Search a place to set fake location</p>
              <div className="flex gap-2 flex-col sm:flex-row">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-butter bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Temple Pastries"
                />
                <Button
                  size="sm"
                  onClick={handleSearchPlaces}
                  disabled={!searchTerm.trim() || searchLoading}
                >
                  {searchLoading ? 'Searching...' : 'Search'}
                </Button>
              </div>
              {searchError && <p className="text-sm text-paprika">{searchError}</p>}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((r) => (
                    <button
                      key={r.placeId}
                      type="button"
                      onClick={() => handleUsePlaceResult(r.placeId, r.name)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-butter bg-surface hover:border-primary"
                    >
                      <p className="font-medium text-charcoal">{r.name}</p>
                      <p className="text-sm text-text-muted">{r.address}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Manual Coordinates */}
            <div className="bg-surface rounded-lg p-4 border border-butter/30 space-y-3">
              <p className="text-sm font-medium text-charcoal">Or enter coordinates manually</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-text-muted mb-1">Latitude</label>
                  <input
                    type="number"
                    value={tempLat}
                    onChange={(e) => setTempLat(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-butter bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="47.6"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-1">Longitude</label>
                  <input
                    type="number"
                    value={tempLng}
                    onChange={(e) => setTempLng(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-butter bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="-122.3"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Label (optional)</label>
                <input
                  type="text"
                  value={tempLabel}
                  onChange={(e) => setTempLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-butter bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Temple Pastries"
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3">
              <Button
                size="sm"
                onClick={() => {
                  const lat = parseFloat(tempLat);
                  const lng = parseFloat(tempLng);
                  if (Number.isFinite(lat) && Number.isFinite(lng)) {
                    setOverrideLocation({
                      latitude: lat,
                      longitude: lng,
                      label: tempLabel || undefined,
                    });
                  } else {
                    alert('Enter a valid latitude and longitude');
                  }
                }}
              >
                Apply Location
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setTempLat('47.5993');
                  setTempLng('-122.3031');
                  setTempLabel('Temple Pastries');
                  setOverrideLocation({
                    latitude: 47.5993,
                    longitude: -122.3031,
                    label: 'Temple Pastries',
                  });
                }}
              >
                Use Temple Pastries
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setTempLat('');
                  setTempLng('');
                  setTempLabel('');
                  setOverrideLocation(undefined);
                }}
              >
                Clear Location
              </Button>
            </div>

            {/* Current Status */}
            <div className="bg-cream/50 rounded-lg p-4 border border-butter/30">
              <p className="text-sm text-charcoal">
                <span className="font-medium">Current override location:</span>{' '}
                {overrideLocation
                  ? `${overrideLocation.latitude}, ${overrideLocation.longitude}${overrideLocation.label ? ` (${overrideLocation.label})` : ''}`
                  : 'none'}
              </p>
            </div>
          </div>
        )}

        {/* Time Tab */}
        {activeTab === 'time' && (
          <div className="space-y-4">
            <div className="bg-surface rounded-lg p-4 border border-butter/30 space-y-3">
              <p className="text-sm font-medium text-charcoal">Set fake current time</p>
              <input
                type="datetime-local"
                value={tempTime}
                onChange={(e) => setTempTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-butter bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                size="sm"
                onClick={() => {
                  if (!tempTime) {
                    setOverrideTimeIso(undefined);
                    return;
                  }
                  const asDate = new Date(tempTime);
                  if (isNaN(asDate.getTime())) {
                    alert('Enter a valid datetime');
                    return;
                  }
                  setOverrideTimeIso(asDate.toISOString());
                }}
              >
                Apply Time
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setTempTime('');
                  setOverrideTimeIso(undefined);
                }}
              >
                Clear Time
              </Button>
            </div>

            {/* Current Status */}
            <div className="bg-cream/50 rounded-lg p-4 border border-butter/30">
              <p className="text-sm text-charcoal">
                <span className="font-medium">Current override time:</span>{' '}
                {overrideTimeIso ? new Date(overrideTimeIso).toLocaleString() : 'none'}
              </p>
            </div>
          </div>
        )}

        {/* Clear All Button */}
        <div className="mt-8">
          <Button
            variant="ghost"
            className="w-full text-paprika hover:bg-paprika/10"
            onClick={() => {
              setTempLat('');
              setTempLng('');
              setTempLabel('');
              setTempTime('');
              clearOverrides();
            }}
          >
            Clear All Overrides
          </Button>
        </div>
      </div>
    </div>
  );
}

