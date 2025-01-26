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
    
    // Immediately update UI and local state
    setIsSigningOut(true);
    clearDesigns();
    loadUserDesigns(null);
    
    // Immediately clear session data to update UI
    await update({
      ...session,
      user: null,
      expires: new Date(0).toISOString(),
    });
    
    toast({
      title: "Signing out...",
      description: "You will be redirected shortly"
    });
    
    // Handle actual sign out in the background
    try {
      const { success, error } = await handleSignOut();
      if (!success && error) {
        console.error('Sign out error:', error);
      }
      // Force navigation after cleanup
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
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