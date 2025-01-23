import { auth } from './config';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  User
} from 'firebase/auth';
import { signOut as nextAuthSignOut } from "next-auth/react";
import { upsertSubscription } from './subscriptions';

interface AuthError {
  code: string;
  message: string;
}

export async function signUpWithEmail(email: string, password: string) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(userCredential.user);
    
    // Create free tier subscription for new user
    await upsertSubscription(userCredential.user.uid, 'free');
    
    return { user: userCredential.user, error: null };
  } catch (error) {
    console.error('Sign up error:', error);
    return { user: null, error: error as AuthError };
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error) {
    console.error('Sign in error:', error);
    return { user: null, error: error as AuthError };
  }
}

export async function signInWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    
    // Check if this is a new user
    if (userCredential.user.metadata.creationTime === userCredential.user.metadata.lastSignInTime) {
      // Create free tier subscription for new Google sign-in
      await upsertSubscription(userCredential.user.uid, 'free');
    }
    
    return { user: userCredential.user, error: null };
  } catch (error) {
    console.error('Google sign in error:', error);
    return { user: null, error: error as AuthError };
  }
}

export async function handlePasswordReset(email: string) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true, error: null };
  } catch (error) {
    console.error('Password reset error:', error);
    return { success: false, error: error as AuthError };
  }
}

export const signOutUser = async () => {
  try {
    await signOut(auth);
    await nextAuthSignOut();
    return { success: true, error: null };
  } catch (error) {
    console.error('Sign out error:', error);
    return { success: false, error: error as AuthError };
  }
}; 