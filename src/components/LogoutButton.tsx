'use client';

import { signOut } from "next-auth/react";
import { Button } from "./ui/button";
import { signOutUser } from "@/lib/firebase/auth";
import { useToast } from "./ui/use-toast";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const { toast } = useToast();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      // Sign out from Firebase
      await signOutUser();
      
      // Sign out from NextAuth and redirect
      await signOut({ 
        redirect: true,
        callbackUrl: '/' 
      });
      
      toast({
        title: "Logged out successfully",
        description: "You have been logged out of your account"
      });
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to log out. Please try again."
      });
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleLogout}
    >
      Log Out
    </Button>
  );
} 