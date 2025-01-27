import { db } from './config';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  increment,
  arrayUnion,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { PLAN_LIMITS, PlanType, UserSubscription } from '@/types/subscription';

const SUBSCRIPTIONS_COLLECTION = 'subscriptions';

export type SubscriptionTier = 'free' | 'pro' | 'business';

interface SubscriptionData {
  tier: SubscriptionTier;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: number | null;
  updatedAt: any; // FirebaseTimestamp
  downloadCounts: {
    stl: number;
    step: number;
  };
  quotesUsed: number;
}

// Get user's subscription
export async function getUserSubscription(userId: string): Promise<SubscriptionData> {
  const subscriptionRef = doc(db, SUBSCRIPTIONS_COLLECTION, userId);
  const subscriptionSnap = await getDoc(subscriptionRef);
  
  if (!subscriptionSnap.exists()) {
    // Initialize free tier subscription
    const initialData: SubscriptionData = {
      tier: 'free',
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      updatedAt: serverTimestamp(),
      downloadCounts: {
        stl: 0,
        step: 0
      },
      quotesUsed: 0
    };
    
    await setDoc(subscriptionRef, initialData);
    return initialData;
  }
  
  return subscriptionSnap.data() as SubscriptionData;
}

// Record a new download and increment counter
export async function recordDownload(
  userId: string,
  designId: string,
  fileType: 'stl' | 'step'
): Promise<void> {
  const subscriptionRef = collection(db, SUBSCRIPTIONS_COLLECTION);
  const q = query(subscriptionRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  
  if (!snapshot.empty) {
    const docRef = doc(db, SUBSCRIPTIONS_COLLECTION, snapshot.docs[0].id);
    const downloadRecord = {
      designId,
      fileType,
      downloadedAt: new Date(),
    };

    await updateDoc(docRef, {
      downloads: arrayUnion(downloadRecord),
      [`downloadCounts.${fileType}`]: increment(1),
      updatedAt: serverTimestamp()
    });
  }
}

// Check if user can download file type
export async function canDownloadFile(
  userId: string, 
  fileType: 'stl' | 'step'
): Promise<{ allowed: boolean; remaining: number }> {
  const subscription = await getUserSubscription(userId);
  if (!subscription) return { allowed: false, remaining: 0 };

  const limits = PLAN_LIMITS[subscription.tier];
  const currentCount = subscription.downloadCounts?.[fileType] || 0;
  const limit = fileType === 'stl' ? limits.stlDownloads : limits.stepDownloads;
  
  return {
    allowed: currentCount < limit || limit === Infinity,
    remaining: limit === Infinity ? Infinity : limit - currentCount
  };
}

// Update user's subscription plan
export async function updateSubscriptionPlan(
  userId: string,
  newPlanType: PlanType
): Promise<void> {
  const subscriptionRef = collection(db, SUBSCRIPTIONS_COLLECTION);
  const q = query(subscriptionRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  
  if (!snapshot.empty) {
    const docRef = doc(db, SUBSCRIPTIONS_COLLECTION, snapshot.docs[0].id);
    await updateDoc(docRef, {
      tier: newPlanType,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      updatedAt: serverTimestamp()
    });
  }
}

// Reset monthly counters
export async function resetMonthlyCounters(userId: string): Promise<void> {
  const subscriptionRef = collection(db, SUBSCRIPTIONS_COLLECTION);
  const q = query(subscriptionRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  
  if (!snapshot.empty) {
    const docRef = doc(db, SUBSCRIPTIONS_COLLECTION, snapshot.docs[0].id);
    await updateDoc(docRef, {
      'downloadCounts.stl': 0,
      'downloadCounts.step': 0,
      quotesUsed: 0,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      updatedAt: serverTimestamp()
    });
  }
}

export async function updateUserSubscription(
  userId: string,
  tier: SubscriptionTier,
  stripeSubscriptionId: string | null,
  currentPeriodEnd: number | null
) {
  console.log('📝 Starting subscription update in Firebase:', {
    userId,
    tier,
    stripeSubscriptionId
  });

  const subscriptionRef = doc(db, SUBSCRIPTIONS_COLLECTION, userId);
  
  const subscriptionData: Partial<SubscriptionData> = {
    tier,
    stripeSubscriptionId,
    currentPeriodEnd,
    updatedAt: serverTimestamp(),
  };

  if (tier === 'pro') {
    console.log('🔄 Resetting counters for pro subscription');
    subscriptionData.downloadCounts = {
      stl: 0,
      step: 0
    };
    subscriptionData.quotesUsed = 0;
  }

  await setDoc(subscriptionRef, subscriptionData, { merge: true });
  
  console.log('✅ Firebase subscription update complete:', {
    userId,
    tier,
    stripeSubscriptionId,
    counters: subscriptionData.downloadCounts,
    quotesUsed: subscriptionData.quotesUsed
  });
  
  return subscriptionData;
}

export const upsertSubscription = updateUserSubscription;

export async function getSubscription(userId: string) {
  const subscriptionRef = doc(db, 'subscriptions', userId);
  const subscriptionSnap = await getDoc(subscriptionRef);
  
  if (subscriptionSnap.exists()) {
    return subscriptionSnap.data();
  }
  
  return {
    tier: 'free',
    stripeSubscriptionId: null,
    currentPeriodEnd: null
  };
}

export async function resetUserQuotas(userId: string) {
  const subscriptionRef = doc(db, 'subscriptions', userId);
  
  await setDoc(subscriptionRef, {
    quotesUsed: 0,
    counters: {
      stl: 0,
      step: 0
    }
  }, { merge: true });
} 