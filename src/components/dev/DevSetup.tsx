import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { seedDatabase } from '../../lib/seed';
import { Button } from '../ui/Button';

export function DevSetup() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

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
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
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
      </div>
    </div>
  );
}

