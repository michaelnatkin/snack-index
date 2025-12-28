import { useAuth } from '@/hooks/useAuth';
import { GoogleSignInButton } from './GoogleSignInButton';
import { AppleSignInButton } from './AppleSignInButton';

export function WelcomeScreen() {
  const { signIn } = useAuth();

  const handleGoogleSignIn = async () => {
    await signIn('google');
  };

  const handleAppleSignIn = async () => {
    await signIn('apple');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 text-6xl opacity-10 rotate-12">🍜</div>
        <div className="absolute top-1/4 right-8 text-5xl opacity-10 -rotate-12">🌮</div>
        <div className="absolute bottom-1/3 left-12 text-5xl opacity-10 rotate-6">🥟</div>
        <div className="absolute bottom-20 right-16 text-6xl opacity-10 -rotate-6">🍕</div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
        {/* Logo/Icon */}
        <div className="mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-honey to-paprika flex items-center justify-center shadow-lg">
            <span className="text-5xl" role="img" aria-label="snack">
              🍿
            </span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold text-charcoal mb-3 font-display">
          Snack Index
        </h1>

        {/* Tagline */}
        <p className="text-xl text-text-muted mb-12">
          Find your next snack
        </p>

        {/* Auth buttons */}
        <div className="w-full space-y-4">
          <GoogleSignInButton onSignIn={handleGoogleSignIn} />
          <AppleSignInButton onSignIn={handleAppleSignIn} />
        </div>

        {/* Footer text */}
        <p className="mt-12 text-sm text-text-muted">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

export default WelcomeScreen;

