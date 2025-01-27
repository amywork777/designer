'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useToast } from '@/components/ui/use-toast';
import { signInWithEmail, signUpWithEmail } from '@/lib/firebase/auth';

interface SignInPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SignInPopup({ isOpen, onClose }: SignInPopupProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    
    if (isSignUp && password !== verifyPassword) {
      setErrorMessage("Passwords don't match");
      return;
    }

    setIsLoading(true);

    try {
      const result = isSignUp 
        ? await signUpWithEmail(email, password)
        : await signInWithEmail(email, password);

      if (result.error) {
        setErrorMessage(result.error.message);
        setIsLoading(false);
        return;
      }

      const nextAuthResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (nextAuthResult?.error) {
        setErrorMessage("Failed to complete authentication");
        setIsLoading(false);
        return;
      }

      toast({
        title: "Success!",
        description: isSignUp 
          ? "Account created successfully!" 
          : "Signed in successfully!"
      });
      onClose();
    } catch (error) {
      setErrorMessage("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSignUp = () => {
    setIsSignUp(!isSignUp);
    setPassword('');
    setVerifyPassword('');
    setErrorMessage(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h2>
          <p className="text-gray-600 mt-1">
            {isSignUp 
              ? "Sign up to start creating designs" 
              : "Sign in to your account"}
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg">
            <p className="text-red-600 text-center text-sm font-medium">
              {errorMessage}
            </p>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                font-inter placeholder:text-gray-400"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                font-inter placeholder:text-gray-400"
            />
            {isSignUp && (
              <input
                type="password"
                value={verifyPassword}
                onChange={(e) => setVerifyPassword(e.target.value)}
                placeholder="Verify password"
                required
                minLength={6}
                className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                  font-inter placeholder:text-gray-400"
              />
            )}
          </div>

          {isSignUp && (
            <p className="text-sm text-gray-500 mt-2">
              Password must be at least 6 characters long
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-black text-white font-dm-sans font-medium rounded-xl 
              hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              isSignUp ? 'Sign Up' : 'Sign In'
            )}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleToggleSignUp}
              className="text-gray-600 hover:text-gray-900 font-dm-sans font-medium transition-colors"
            >
              {isSignUp 
                ? "Already have an account? Sign In" 
                : "Don't have an account? Sign Up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 