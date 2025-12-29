import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { seedDatabase } from '../../lib/seed';
import { Button } from '../ui/Button';
import { useTestingStore } from '@/stores/testingStore';
import { searchPlaces, getPlaceDetails } from '@/lib/googlePlaces';

export function DevSetup() {
  const { user } = useAuth();
  const {
    overrideLocation,
    overrideTimeIso,
    setOverrideLocation,
    setOverrideTimeIso,
    clearOverrides,
  } = useTestingStore();

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a1d3bc91-56c5-4ff8-9c4b-0c1b5cabaab5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H6',location:'DevSetup.tsx:initialTempTime',message:'Computed initial temp time from override',data:{overrideTimeIso,localIso},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return localIso;
  })();

  const [tempTime, setTempTime] = useState(initialTempTime);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
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

  const handleSeed = async () => {
    if (!user) {
      setMessage('Please sign in first');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMessage('Seeding database...');

    try {
      await seedDatabase(user.id, user.email || 'unknown');
      setStatus('success');
      setMessage('Database seeded! You are now an admin. Refresh the page to see admin access.');
    } catch (error) {
      console.error('Seed error:', error);
      setStatus('error');
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-[28rem] w-full text-center">
        <h1 className="text-2xl font-display font-bold text-warm-900 mb-4">
          🛠️ Dev Setup
        </h1>
        
        {user ? (
          <>
            <p className="text-warm-600 mb-2">Signed in as:</p>
            <p className="text-warm-900 font-medium mb-6">{user.email}</p>
          </>
        ) : (
          <p className="text-warm-600 mb-6">Not signed in. Go to / to sign in first.</p>
        )}

        <p className="text-warm-600 mb-6">
          This will make you an admin and add sample Seattle snack spots to the database.
        </p>

        <Button
          onClick={handleSeed}
          disabled={!user || status === 'loading' || status === 'success'}
          className="w-full mb-4"
        >
          {status === 'loading' ? 'Seeding...' : 'Seed Database'}
        </Button>

        {message && (
          <p className={`text-sm ${status === 'error' ? 'text-red-600' : status === 'success' ? 'text-green-600' : 'text-warm-600'}`}>
            {message}
          </p>
        )}

        {status === 'success' && (
          <Button
            variant="secondary"
            onClick={() => window.location.href = '/'}
            className="w-full mt-4"
          >
            Go to App →
          </Button>
        )}

        <div className="mt-10 text-left">
          <h2 className="text-lg font-display font-bold text-warm-900 mb-2">
            🧪 Testing overrides (local only)
          </h2>
          <p className="text-sm text-warm-600 mb-4">
            Set a fake location and time for admin testing. Stored in localStorage only (not saved to Firestore).
          </p>

          <div className="space-y-3">
            <div className="border border-butter rounded-lg p-3 bg-cream-50 space-y-3">
              <p className="text-sm font-medium text-warm-900">Search a place to set fake location</p>
              <div className="flex gap-2 flex-col sm:flex-row">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-butter bg-white focus:outline-none focus:ring-2 focus:ring-primary"
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
              {searchError && <p className="text-sm text-red-600">{searchError}</p>}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((r) => (
                    <button
                      key={r.placeId}
                      type="button"
                      onClick={() => handleUsePlaceResult(r.placeId, r.name)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-butter bg-white hover:border-primary"
                    >
                      <p className="font-medium text-warm-900">{r.name}</p>
                      <p className="text-sm text-warm-600">{r.address}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-warm-900 mb-1">Latitude</label>
                <input
                  type="number"
                  value={tempLat}
                  onChange={(e) => setTempLat(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-butter bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="47.6"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-warm-900 mb-1">Longitude</label>
                <input
                  type="number"
                  value={tempLng}
                  onChange={(e) => setTempLng(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-butter bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="-122.3"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-warm-900 mb-1">Label (optional)</label>
              <input
                type="text"
                value={tempLabel}
                onChange={(e) => setTempLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-butter bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., Temple Pastries"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-warm-900 mb-1">Fake current time</label>
              <input
                type="datetime-local"
                value={tempTime}
                onChange={(e) => setTempTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-butter bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                size="sm"
                variant="secondary"
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
                Apply location
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (!tempTime) {
                    setOverrideTimeIso(undefined);
                    return;
                  }
                  const asDate = new Date(tempTime);
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/a1d3bc91-56c5-4ff8-9c4b-0c1b5cabaab5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H7',location:'DevSetup.tsx:applyTime',message:'Apply time clicked',data:{input:tempTime,asDate:isNaN(asDate.getTime())?'invalid':asDate.toISOString(),offsetMinutes:asDate.getTimezoneOffset()},timestamp:Date.now()})}).catch(()=>{});
                  // #endregion
                  if (isNaN(asDate.getTime())) {
                    alert('Enter a valid datetime');
                    return;
                  }
                  setOverrideTimeIso(asDate.toISOString());
                }}
              >
                Apply time
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setTempLat('');
                  setTempLng('');
                  setTempLabel('');
                  setTempTime('');
                  clearOverrides();
                }}
              >
                Clear overrides
              </Button>

              <Button
                size="sm"
                variant="ghost"
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
                Use Temple Pastries (Seattle)
              </Button>
            </div>

            <div className="text-sm text-warm-600">
              <p>Current override location: {overrideLocation ? `${overrideLocation.latitude}, ${overrideLocation.longitude} ${overrideLocation.label ? `(${overrideLocation.label})` : ''}` : 'none'}</p>
              <p>Current override time: {overrideTimeIso ? new Date(overrideTimeIso).toLocaleString() : 'none'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

