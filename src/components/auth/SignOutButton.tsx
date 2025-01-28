import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useDesignStore } from '@/lib/store/designs';
import { handleSignOut } from "@/lib/firebase/auth";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { clearDesigns, loadUserDesigns } = useDesignStore();
  const { toast } = useToast();
  const router = useRouter();
  const { data: session, status, update } = useSession();

  const onSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      // Clear local data first
      clearDesigns();
      loadUserDesigns(null);
      
      // Sign out from both services synchronously
      await handleSignOut();
      
      // Force immediate redirect to landing page
      window.location.href = '/';
      
      // Then complete the sign out process
      await signOut({
        redirect: false,
      });
      
      await update(null);
      
    } catch (error) {
      console.error('Sign out error:', error);
      // Ensure redirect happens even on error
      window.location.href = '/';
    }
  };

  // Don't show button if not signed in
  if (status !== 'authenticated') return null;

  return (
    <Button 
      variant="ghost" 
      onClick={onSignOut}
      disabled={isSigningOut}
    >
      {isSigningOut ? 'Signing out...' : 'Sign out'}
    </Button>
  );
} 