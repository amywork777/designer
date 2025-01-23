import { getCurrentPeriodDownloads, createDownloadRecord } from '@/lib/firebase/subscriptions';
import type { PlanType, SubscriptionLimits } from '@/types/subscription';

const PLAN_LIMITS: Record<PlanType, SubscriptionLimits> = {
  free: {
    stlDownloads: 10,
    stepDownloads: 0,
    manufacturingQuotes: 1
  },
  pro: {
    stlDownloads: 30,
    stepDownloads: 3,
    manufacturingQuotes: 5
  },
  business: {
    stlDownloads: Infinity,
    stepDownloads: 10,
    manufacturingQuotes: 10
  }
};

export async function canDownloadFile(
  userId: string, 
  fileType: 'stl' | 'step'
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const downloadCount = await getCurrentPeriodDownloads(userId, fileType);
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      return { allowed: false, remaining: 0 };
    }

    const limit = PLAN_LIMITS[subscription.planType][
      fileType === 'stl' ? 'stlDownloads' : 'stepDownloads'
    ];
    
    const remaining = limit - downloadCount;
    
    return {
      allowed: downloadCount < limit,
      remaining
    };
  } catch (error) {
    console.error('Error checking download limits:', error);
    return { allowed: false, remaining: 0 };
  }
}

export async function recordDownload(
  userId: string,
  designId: string,
  fileType: 'stl' | 'step'
): Promise<void> {
  await createDownloadRecord(userId, designId, fileType);
} 