import { db } from './config';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import type { PlanType, UserSubscription, DownloadRecord } from '@/types/subscription';

// Collection references
const SUBSCRIPTIONS_COLLECTION = 'subscriptions';
const DOWNLOADS_COLLECTION = 'downloads';

// Create or update user subscription
export async function upsertSubscription(
  userId: string, 
  planType: PlanType
): Promise<void> {
  const subscriptionsRef = collection(db, SUBSCRIPTIONS_COLLECTION);
  const now = new Date();
  
  // Set period to start now and end in 30 days
  const subscription: UserSubscription = {
    userId,
    planType,
    currentPeriodStart: now,
    currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await addDoc(subscriptionsRef, subscription);
}

// Record a new download
export async function createDownloadRecord(
  userId: string,
  designId: string,
  fileType: 'stl' | 'step'
): Promise<void> {
  const downloadsRef = collection(db, DOWNLOADS_COLLECTION);
  
  // Get user's current subscription period
  const subscriptionRef = collection(db, SUBSCRIPTIONS_COLLECTION);
  const subscriptionQuery = query(subscriptionRef, where('userId', '==', userId));
  const subscriptionSnap = await getDocs(subscriptionQuery);
  const subscription = subscriptionSnap.docs[0]?.data() as UserSubscription;

  if (!subscription) {
    throw new Error('No active subscription found');
  }

  const downloadRecord: DownloadRecord = {
    userId,
    designId,
    fileType,
    downloadedAt: new Date(),
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
    createdAt: serverTimestamp()
  };

  await addDoc(downloadsRef, downloadRecord);
}

// Get download count for current period
export async function getCurrentPeriodDownloads(
  userId: string,
  fileType: 'stl' | 'step'
): Promise<number> {
  const subscriptionRef = collection(db, SUBSCRIPTIONS_COLLECTION);
  const subscriptionQuery = query(subscriptionRef, where('userId', '==', userId));
  const subscriptionSnap = await getDocs(subscriptionQuery);
  const subscription = subscriptionSnap.docs[0]?.data() as UserSubscription;

  if (!subscription) {
    return 0;
  }

  const downloadsRef = collection(db, DOWNLOADS_COLLECTION);
  const downloadsQuery = query(
    downloadsRef,
    where('userId', '==', userId),
    where('fileType', '==', fileType),
    where('downloadedAt', '>=', subscription.currentPeriodStart),
    where('downloadedAt', '<=', subscription.currentPeriodEnd)
  );

  const downloadsSnap = await getDocs(downloadsQuery);
  return downloadsSnap.size;
} 