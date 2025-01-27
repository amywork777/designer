import { signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useDesignStore } from '@/lib/store/designs';
import { handleSignOut } from "@/lib/firebase/auth";
import { useToast } from "@/components/ui/use-toast";
import { cleanupUserData } from "@/lib/firebase/utils";
import { useSession } from "next-auth/react";

export function SignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { clearDesigns, loadUserDesigns } = useDesignStore();
  const { toast } = useToast();
  const { data: session } = useSession();

  const onSignOut = async () => {
    if (isSigningOut) return;
    
    setIsSigningOut(true);
    
    try {
      // Clean up user data first
      if (session?.user?.id) {
        await cleanupUserData(session.user.id);
      }

      // Clear local data
      clearDesigns();
      loadUserDesigns(null);
      
      // Clear any cached files or data
      localStorage.clear();
      sessionStorage.clear();
      
      // Sign out from Firebase
      await handleSignOut();
      
      // Sign out from NextAuth
      await signOut({
        callbackUrl: new URL('/', window.location.origin).toString(),
      });
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        variant: "destructive",
        title: "Error signing out",
        description: "Please try again"
      });
      setIsSigningOut(false);
    }
  };

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