import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { WelcomeScreen } from '@/components/auth/WelcomeScreen';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// Placeholder Home screen for Phase 1
function HomeScreen() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-honey to-paprika flex items-center justify-center shadow-lg mx-auto mb-6">
          <span className="text-4xl">🍿</span>
        </div>
        <h1 className="text-3xl font-bold text-charcoal mb-2 font-display">
          Hello, {user?.displayName || 'Snacker'}!
        </h1>
        <p className="text-text-muted mb-8">
          Welcome to Snack Index
        </p>
        <button
          onClick={signOut}
          className="text-text-muted underline hover:text-charcoal transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

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
          isAuthenticated ? <Navigate to="/home" replace /> : <WelcomeScreen />
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
