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
    <div className="app-shell relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 text-6xl opacity-10 rotate-12">🍜</div>
        <div className="absolute top-1/4 right-8 text-5xl opacity-10 -rotate-12">🌮</div>
        <div className="absolute bottom-1/3 left-12 text-5xl opacity-10 rotate-6">🥟</div>
        <div className="absolute bottom-20 right-16 text-6xl opacity-10 -rotate-6">🍕</div>
      </div>

      <div className="shell-inner flex min-h-screen flex-col justify-center py-12">
        <div className="glass-panel p-8 text-center">
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-honey to-paprika flex items-center justify-center shadow-lg">
              <span className="text-5xl" role="img" aria-label="snack">
                🍿
              </span>
            </div>
          </div>

          <h1
            id="welcome-title"
            className="text-4xl font-bold text-charcoal mb-3 font-display text-center"
          >
            Snack Index
          </h1>

          <p id="welcome-tagline" className="text-lg text-text-muted mb-8 text-center">
            Discover snacks near you
          </p>

          <div className="space-y-3">
            {showEmailForm ? (
              <>
                <EmailSignInForm />

                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-butter/80" />
                  <span className="text-sm text-text-muted">or</span>
                  <div className="flex-1 h-px bg-butter/80" />
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

                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-butter/80" />
                  <span className="text-sm text-text-muted">or</span>
                  <div className="flex-1 h-px bg-butter/80" />
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

          <p className="mt-8 text-sm text-text-muted text-center">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}

export default WelcomeScreen;
