import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/stores/userStore';
import { WelcomeScreen } from '@/components/auth/WelcomeScreen';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { PermissionsScreen } from '@/components/onboarding/PermissionsScreen';
import { DietarySheet } from '@/components/onboarding/DietarySheet';
import { AppLayout } from '@/components/layout/AppLayout';
import { AdminHome } from '@/components/admin/AdminHome';
import { PlaceEditor } from '@/components/admin/PlaceEditor';
import { DishEditor } from '@/components/admin/DishEditor';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// Admin Guard component
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}

// Placeholder Home screen
function HomeScreen() {
  const { user } = useUserStore();
  const [showDietarySheet, setShowDietarySheet] = useState(false);

  // Show dietary sheet on first load
  useEffect(() => {
    if (user && !user.onboarding.hasSeenDietarySheet) {
      const timer = setTimeout(() => {
        setShowDietarySheet(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-honey to-paprika flex items-center justify-center shadow-lg mx-auto mb-6">
            <span className="text-4xl">🍿</span>
          </div>
          <h1 className="text-3xl font-bold text-charcoal mb-2 font-display">
            Hello, {user?.displayName || 'Snacker'}!
          </h1>
          <p className="text-text-muted mb-4">
            Finding snacks near you...
          </p>
          <p className="text-sm text-sage">
            (Home screen coming in Phase 4)
          </p>
        </div>
      </div>

      {showDietarySheet && (
        <DietarySheet onDismiss={() => setShowDietarySheet(false)} />
      )}
    </AppLayout>
  );
}

// Placeholder My Snacks screen
function MySnacksScreen() {
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
        <div className="text-center">
          <span className="text-6xl mb-4 block">♥</span>
          <h1 className="text-2xl font-bold text-charcoal mb-2 font-display">
            My Snacks
          </h1>
          <p className="text-text-muted">
            Your saved and visited spots will appear here
          </p>
          <p className="text-sm text-sage mt-4">
            (Coming in Phase 5)
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

// Placeholder Settings screen
function SettingsScreen() {
  const { signOut, isAdmin } = useAuth();
  const { user } = useUserStore();

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-charcoal mb-6 font-display">
          Settings
        </h1>

        <div className="space-y-6">
          {/* Account info */}
          <div className="bg-surface rounded-lg p-4 shadow-sm">
            <p className="text-sm text-text-muted">Signed in as</p>
            <p className="font-medium text-charcoal">{user?.email}</p>
          </div>

          {/* Admin button (conditional) */}
          {isAdmin && (
            <a
              href="/admin"
              className="block w-full bg-eggplant text-cream text-center py-3 rounded-lg font-medium hover:bg-charcoal transition-colors"
            >
              Admin Dashboard →
            </a>
          )}

          {/* Placeholder sections */}
          <div className="space-y-4">
            <p className="text-sm text-sage">
              (Full settings coming in Phase 6)
            </p>
          </div>

          {/* Sign out */}
          <button
            onClick={signOut}
            className="w-full text-center py-3 text-paprika font-medium hover:bg-paprika/10 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </AppLayout>
  );
}

function AppRoutes() {
  const { isAuthenticated, loading, user } = useAuth();
  const { setUser } = useUserStore();

  // Sync auth user to user store
  useEffect(() => {
    setUser(user);
  }, [user, setUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/"
        element={
          isAuthenticated ? (
            user?.onboarding.completed ? (
              <Navigate to="/home" replace />
            ) : (
              <Navigate to="/permissions" replace />
            )
          ) : (
            <WelcomeScreen />
          )
        }
      />

      {/* Onboarding routes */}
      <Route
        path="/permissions"
        element={
          <AuthGuard>
            <PermissionsScreen />
          </AuthGuard>
        }
      />

      {/* Protected routes */}
      <Route
        path="/home"
        element={
          <AuthGuard>
            <HomeScreen />
          </AuthGuard>
        }
      />
      <Route
        path="/my-snacks"
        element={
          <AuthGuard>
            <MySnacksScreen />
          </AuthGuard>
        }
      />
      <Route
        path="/settings"
        element={
          <AuthGuard>
            <SettingsScreen />
          </AuthGuard>
        }
      />

      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <AuthGuard>
            <AdminGuard>
              <AdminHome />
            </AdminGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/admin/place/:placeId"
        element={
          <AuthGuard>
            <AdminGuard>
              <PlaceEditor />
            </AdminGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/admin/place/:placeId/dish/:dishId"
        element={
          <AuthGuard>
            <AdminGuard>
              <DishEditor />
            </AdminGuard>
          </AuthGuard>
        }
      />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
