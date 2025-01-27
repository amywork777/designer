import { auth } from './config';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  fetchSignInMethodsForEmail,
  AuthError 
} from 'firebase/auth';
import { signOut as nextAuthSignOut } from "next-auth/react";
import { upsertSubscription } from './subscriptions';

function handleAuthError(error: any) {
  const errorMap: Record<string, { message: string, suggestion: 'signup' | 'signin' | 'retry' }> = {
    'auth/invalid-credential': {
      message: 'Invalid email or password. Please try again.',
      suggestion: 'retry'
    },
    'auth/too-many-requests': {
      message: 'Too many attempts. Please try again later.',
      suggestion: 'retry'
    },
    'auth/email-already-in-use': {
      message: 'An account already exists with this email. Please sign in instead.',
      suggestion: 'signin'
    },
    'auth/user-not-found': {
      message: 'No account found with this email. Would you like to create one?',
      suggestion: 'signup'
    },
    'auth/wrong-password': {
      message: 'Incorrect password. Please try again.',
      suggestion: 'retry'
    }
  };

  const errorInfo = errorMap[error.code] || {
    message: 'An error occurred. Please try again.',
    suggestion: 'retry'
  };

  return {
    user: null,
    error: {
      code: error.code || 'unknown',
      message: errorInfo.message,
      suggestion: errorInfo.suggestion
    }
  };
}

export async function signUpWithEmail(email: string, password: string) {
  try {
    // Check if account exists first
    const methods = await fetchSignInMethodsForEmail(auth, email);
    
    if (methods.length > 0) {
      return { 
        user: null, 
        error: {
          code: 'auth/email-already-in-use',
          message: 'An account already exists with this email. Please sign in instead.',
          suggestion: 'signin'
        }
      };
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    return { user: userCredential.user, error: null };
  } catch (error: any) {
    console.error('Sign up error:', error);
    return handleAuthError(error);
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error) {
    return { 
      user: null, 
      error: {
        code: 'auth/failed',
        message: "Invalid email or password.",
        suggestion: 'retry'
      }
    };
  }
}

export async function signInWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    
    // Check if this is a new user
    if (userCredential.user.metadata.creationTime === userCredential.user.metadata.lastSignInTime) {
      await upsertSubscription(userCredential.user.uid, 'free');
    }
    
    return { user: userCredential.user, error: null };
  } catch (error: any) {
    console.error('Google sign in error:', error);
    return handleAuthError(error);
  }
}

export async function handlePasswordReset(email: string) {
  try {
    // Check if account exists first
    const methods = await fetchSignInMethodsForEmail(auth, email);
    
    if (methods.length === 0) {
      return {
        success: false,
        error: {
          code: 'auth/user-not-found',
          message: 'No account found with this email.',
          suggestion: 'signup'
        }
      };
    }

    await sendPasswordResetEmail(auth, email);
    return { success: true, error: null };
  } catch (error: any) {
    console.error('Password reset error:', error);
    return handleAuthError(error);
  }
}

export const handleSignOut = async () => {
  try {
    // Get the current path before signing out
    const currentPath = window.location.pathname;
    
    // Sign out from both NextAuth and Firebase
    await signOut({ 
      redirect: false // Prevent NextAuth's default redirect
    });
    
    // Redirect to the same path
    window.location.href = currentPath;
    
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};