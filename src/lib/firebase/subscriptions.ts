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
  arrayUnion 
} from 'firebase/firestore';
import { PLAN_LIMITS, PlanType, UserSubscription } from '@/types/subscription';

const SUBSCRIPTIONS_COLLECTION = 'subscriptions';

// Get user's subscription
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const subscriptionRef = collection(db, SUBSCRIPTIONS_COLLECTION);
  const q = query(subscriptionRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    // Create a free tier subscription if none exists
    const newSubscription: UserSubscription = {
      userId,
      planType: 'free',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      downloads: [],
      downloadCounts: {
        stl: 0,
        step: 0
      },
      quotesUsed: 0
    };
    
    await addDoc(subscriptionRef, {
      ...newSubscription,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return newSubscription;
  }
  
  const data = snapshot.docs[0].data();
  
  // Ensure downloadCounts exists even for existing subscriptions
  if (!data.downloadCounts) {
    data.downloadCounts = {
      stl: 0,
      step: 0
    };
    // Update the document with default counts
    await updateDoc(snapshot.docs[0].ref, {
      downloadCounts: data.downloadCounts,
      updatedAt: serverTimestamp()
    });
  }
  
  return data as UserSubscription;
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

  const limits = PLAN_LIMITS[subscription.planType];
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