import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { signInWithEmail, signUpWithEmail } from '@/lib/auth';

interface EmailSignInFormProps {
  onSuccess?: () => void;
}

export function EmailSignInForm({ onSuccess }: EmailSignInFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      // Clean up Firebase error messages
      if (message.includes('auth/invalid-credential')) {
        setError('Invalid email or password');
      } else if (message.includes('auth/email-already-in-use')) {
        setError('An account with this email already exists');
      } else if (message.includes('auth/weak-password')) {
        setError('Password should be at least 6 characters');
      } else if (message.includes('auth/invalid-email')) {
        setError('Please enter a valid email address');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-lg border-2 border-warm-200 bg-white text-charcoal placeholder:text-warm-400 focus:outline-none focus:border-primary transition-colors"
        />
      </div>
      <div>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full px-4 py-3 rounded-lg border-2 border-warm-200 bg-white text-charcoal placeholder:text-warm-400 focus:outline-none focus:border-primary transition-colors"
        />
      </div>
      
      {error && (
        <p className="text-sm text-red-600 text-center" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={loading}
        className="w-full"
      >
        {isSignUp ? 'Create Account' : 'Sign In'}
      </Button>

      <button
        type="button"
        onClick={() => {
          setIsSignUp(!isSignUp);
          setError(null);
        }}
        className="w-full text-sm text-text-muted hover:text-charcoal transition-colors py-2"
      >
        {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
      </button>
    </form>
  );
}

export default EmailSignInForm;


