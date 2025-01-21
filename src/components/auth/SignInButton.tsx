'use client';

import { signInWithGoogle } from '@/lib/firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from "@/components/ui/use-toast";
import Image from 'next/image';

export default function SignInButton() {
  const router = useRouter();
  const { toast } = useToast();

  const handleGoogleSignIn = async () => {
    try {
      const { user, error } = await signInWithGoogle();
      
      if (error) {
        throw error;
      }

      if (user) {
        toast({
          title: "Success",
          description: "Signed in successfully!"
        });
        
        // Redirect to landing page
        router.push('/');
        router.refresh();
      }
    } catch (error) {
      console.error('Sign in error:', error);
      toast({
        variant: "destructive",
        title: "Error signing in",
        description: "Please try again"
      });
    }
  };

  return (
    <button
      onClick={handleGoogleSignIn}
      className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
    >
      <Image
        src="/google.svg"
        alt="Google"
        width={20}
        height={20}
      />
      <span className="text-black">Sign in with Google</span>
    </button>
  );
} 