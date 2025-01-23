'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
          isSignUp: true
        });

        if (result?.error) {
          throw new Error(result.error);
        }

        toast({
          title: "Account created",
          description: "Welcome! Your account has been created successfully."
        });
        router.push('/');
      } else {
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false
        });

        if (result?.error) {
          throw new Error(result.error);
        }

        toast({
          title: "Welcome back",
          description: "Successfully signed in!"
        });
        router.push('/');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Authentication failed"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-blue-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h2>
          <p className="mt-2 text-gray-600">
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
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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
              className="text-blue-600 hover:text-blue-700 font-medium"
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