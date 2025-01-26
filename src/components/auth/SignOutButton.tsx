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

  const onSignOut = () => {
    if (isSigningOut) return;
    
    // Immediately update UI state
    setIsSigningOut(true);
    clearDesigns();
    loadUserDesigns(null);
    
    // Force immediate session update
    update(null);
    
    // Redirect immediately
    window.location.href = '/';
    
    // Handle cleanup in background
    setTimeout(() => {
      handleSignOut().catch(console.error);
    }, 0);
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