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
  planType: PlanType;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: number | null;
  updatedAt: any; // FirebaseTimestamp
  downloadCounts: {
    stl: number;
    step: number;
  };
  quotesUsed: number;
}

// Get user's subscription with proper type checking
export async function getUserSubscription(userId: string): Promise<SubscriptionData> {
  const subscriptionRef = doc(db, SUBSCRIPTIONS_COLLECTION, userId);
  const subscriptionSnap = await getDoc(subscriptionRef);
  
  if (!subscriptionSnap.exists()) {
    // Initialize free tier subscription
    const initialData: SubscriptionData = {
      planType: 'free',  // Using planType
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
  
  const data = subscriptionSnap.data();
  // Ensure we have a valid plan type
  const planType = (data.planType || 'free') as PlanType;
  
  return {
    ...data,
    planType,  // Ensure planType is set
    downloadCounts: data.downloadCounts || { stl: 0, step: 0 }
  } as SubscriptionData;
}

// Record a new download and increment counter
export async function recordDownload(
  userId: string,
  designId: string,
  fileType: 'stl' | 'step'
): Promise<void> {
  try {
    console.log('📝 Recording download:', { userId, designId, fileType });
    
    const subscriptionRef = doc(db, SUBSCRIPTIONS_COLLECTION, userId);
    
    // Get current counts
    const subscriptionSnap = await getDoc(subscriptionRef);
    const currentData = subscriptionSnap.data();
    const currentCount = currentData?.downloadCounts?.[fileType] || 0;
    
    console.log('Current download count:', currentCount);

    // Update the document with new download count
    await updateDoc(subscriptionRef, {
      [`downloadCounts.${fileType}`]: increment(1),
      updatedAt: serverTimestamp(),
      downloads: arrayUnion({
        designId,
        fileType,
        downloadedAt: new Date()
      })
    });

    console.log('✅ Download recorded successfully');
  } catch (error) {
    console.error('❌ Error recording download:', error);
    throw error;
  }
}

// Check download limits with proper type safety
export async function canDownloadFile(
  userId: string, 
  fileType: 'stl' | 'step'
): Promise<{ allowed: boolean; remaining: number }> {
  const subscription = await getUserSubscription(userId);
  
  // Ensure we have a valid plan type
  const planType = (subscription?.planType || 'free') as PlanType;
  const limits = PLAN_LIMITS[planType];
  
  if (!limits) {
    console.error('Invalid plan type:', planType);
    return { allowed: false, remaining: 0 };
  }
  
  const currentCount = subscription?.downloadCounts?.[fileType] || 0;
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
      planType: newPlanType,
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

// Update subscription with proper plan type
export async function updateUserSubscription(
  userId: string,
  planType: PlanType,
  stripeSubscriptionId: string | null,
  currentPeriodEnd: number | null
) {
  console.log('📝 Updating subscription:', { userId, planType });
  
  const subscriptionRef = doc(db, SUBSCRIPTIONS_COLLECTION, userId);
  
  const subscriptionData: Partial<SubscriptionData> = {
    planType,
    stripeSubscriptionId,
    currentPeriodEnd,
    updatedAt: serverTimestamp(),
  };

  if (planType === 'pro') {
    subscriptionData.downloadCounts = { stl: 0, step: 0 };
    subscriptionData.quotesUsed = 0;
  }

  await setDoc(subscriptionRef, subscriptionData, { merge: true });
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
    planType: 'free',
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