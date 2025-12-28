import { useState, useEffect, useCallback } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { create } from 'zustand';
import type { User, AuthProvider } from '@/types/models';
import {
  signIn,
  signOut as authSignOut,
  onAuthChange,
  getOrCreateUserDocument,
} from '@/lib/auth';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  error: Error | null;
  setFirebaseUser: (user: FirebaseUser | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  reset: () => void;
}

const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  user: null,
  loading: true,
  error: null,
  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () => set({ firebaseUser: null, user: null, loading: false, error: null }),
}));

/**
 * Hook to manage authentication state
 */
export function useAuth() {
  const {
    firebaseUser,
    user,
    loading,
    error,
    setFirebaseUser,
    setUser,
    setLoading,
    setError,
    reset,
  } = useAuthStore();

  const [signingIn, setSigningIn] = useState(false);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange(async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          const userDoc = await getOrCreateUserDocument(fbUser);
          setUser(userDoc);
        } catch (err) {
          setError(err instanceof Error ? err : new Error('Failed to get user document'));
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, [setFirebaseUser, setUser, setLoading, setError]);

  const handleSignIn = useCallback(
    async (provider: AuthProvider) => {
      setSigningIn(true);
      setError(null);

      try {
        const userDoc = await signIn(provider);
        setUser(userDoc);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Sign in failed');
        setError(error);
        throw error;
      } finally {
        setSigningIn(false);
      }
    },
    [setUser, setError]
  );

  const handleSignOut = useCallback(async () => {
    try {
      await authSignOut();
      reset();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Sign out failed');
      setError(error);
      throw error;
    }
  }, [reset, setError]);

  return {
    firebaseUser,
    user,
    loading,
    error,
    signingIn,
    signIn: handleSignIn,
    signOut: handleSignOut,
    isAuthenticated: !!user,
    isAdmin: user?.isAdmin === true,
  };
}

export default useAuth;

