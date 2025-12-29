import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { GoogleSignInButton } from './GoogleSignInButton';
import { AppleSignInButton } from './AppleSignInButton';
import { EmailSignInForm } from './EmailSignInForm';

export function WelcomeScreen() {
  const { signIn } = useAuth();
  const [showEmailForm, setShowEmailForm] = useState(false);

  const handleGoogleSignIn = async () => {
    await signIn('google');
  };

  const handleAppleSignIn = async () => {
    await signIn('apple');
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 text-6xl opacity-10 rotate-12">🍜</div>
        <div className="absolute top-1/4 right-8 text-5xl opacity-10 -rotate-12">🌮</div>
        <div className="absolute bottom-1/3 left-12 text-5xl opacity-10 rotate-6">🥟</div>
        <div className="absolute bottom-20 right-16 text-6xl opacity-10 -rotate-6">🍕</div>
      </div>

      {/* Content - simple block layout */}
      <div className="relative z-10 min-h-screen flex flex-col justify-center px-8 py-12">
        {/* Logo/Icon */}
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-honey to-paprika flex items-center justify-center shadow-lg">
            <span className="text-5xl" role="img" aria-label="snack">
              🍿
            </span>
          </div>
        </div>

        {/* Title */}
        <h1
          id="welcome-title"
          className="text-4xl font-bold text-charcoal mb-3 font-display text-center"
        >
          Snack Index
        </h1>

        {/* Tagline */}
        <p id="welcome-tagline" className="text-lg text-text-muted mb-10 text-center">
          Discover snacks near you
        </p>

        {/* Auth options */}
        <div className="space-y-3 self-stretch px-4">
          {showEmailForm ? (
            <>
              <EmailSignInForm />
              
              {/* Divider */}
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-warm-200" />
                <span className="text-sm text-text-muted">or</span>
                <div className="flex-1 h-px bg-warm-200" />
              </div>
              
              <button
                onClick={() => setShowEmailForm(false)}
                className="w-full text-sm text-text-muted hover:text-charcoal transition-colors py-2"
              >
                Sign in with Google or Apple
              </button>
            </>
          ) : (
            <>
              <GoogleSignInButton id="google-signin" onSignIn={handleGoogleSignIn} />
              <AppleSignInButton id="apple-signin" onSignIn={handleAppleSignIn} />
              
              {/* Divider */}
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-warm-200" />
                <span className="text-sm text-text-muted">or</span>
                <div className="flex-1 h-px bg-warm-200" />
              </div>
              
              <button
                onClick={() => setShowEmailForm(true)}
                className="w-full text-sm text-text-muted hover:text-charcoal transition-colors py-2"
              >
                Continue with email
              </button>
            </>
          )}
        </div>

        {/* Footer text */}
        <p className="mt-10 text-sm text-text-muted text-center px-4">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

export default WelcomeScreen;
