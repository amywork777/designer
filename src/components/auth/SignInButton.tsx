'use client';

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function SignInButton() {
  return (
    <Button 
      onClick={() => signIn('google', { callbackUrl: '/select-design' })}
      variant="outline"
      className="bg-white text-gray-700 hover:bg-gray-50"
    >
      Sign in
    </Button>
  );
} 