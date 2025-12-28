import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/stores/userStore';
import { WelcomeScreen } from '@/components/auth/WelcomeScreen';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { PermissionsScreen } from '@/components/onboarding/PermissionsScreen';
import { AdminHome } from '@/components/admin/AdminHome';
import { PlaceEditor } from '@/components/admin/PlaceEditor';
import { DishEditor } from '@/components/admin/DishEditor';
import { HomeScreen } from '@/components/home/HomeScreen';
import { PlaceDetail } from '@/components/place/PlaceDetail';
import { MySnacksScreen } from '@/components/mysnacks/MySnacksScreen';
import { SettingsScreen } from '@/components/settings/SettingsScreen';
import { ShareLanding } from '@/components/share/ShareLanding';
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
        path="/place/:placeId"
        element={
          <AuthGuard>
            <PlaceDetail />
          </AuthGuard>
        }
      />

      {/* Share routes - accessible without auth */}
      <Route
        path="/s/:placeId"
        element={<ShareLanding />}
      />
      <Route
        path="/s/:placeId/dish/:dishId"
        element={<ShareLanding />}
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
