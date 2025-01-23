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
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      let result;
      
      if (isSignUp) {
        // Handle sign up
        result = await signUpWithEmail(email, password);
      } else {
        // Handle sign in
        result = await signInWithEmail(email, password);
      }
      
      if (result.error) {
        toast({
          variant: "destructive",
          title: "Authentication Error",
          description: result.error.message
        });
        return;
      }

      // If Firebase auth successful, also sign in with NextAuth
      const nextAuthResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      
      if (nextAuthResult?.error) {
        toast({
          variant: "destructive",
          title: "Authentication Error",
          description: nextAuthResult.error
        });
      } else {
        toast({
          title: "Success",
          description: isSignUp ? "Account created successfully!" : "Signed in successfully!"
        });
        onClose();
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-2xl shadow-lg relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h2 className="text-3xl font-dm-sans font-medium text-gray-900">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h2>
          <p className="mt-2 text-gray-600 font-inter">
            {isSignUp ? "Sign up to get started" : "Sign in to access your designs"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="mt-8 space-y-6">
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
          </div>

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
              onClick={() => setIsSignUp(!isSignUp)}
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