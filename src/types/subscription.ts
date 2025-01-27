export type PlanType = 'free' | 'pro' | 'business';

export interface PlanLimits {
  stlDownloads: number;
  stepDownloads: number;
  manufacturingQuotes: number;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    stlDownloads: 10,    // 10 STL downloads for free tier
    stepDownloads: 0,    // No STEP downloads for free tier
    manufacturingQuotes: 1
  },
  pro: {
    stlDownloads: 30,    // 30 STL downloads for pro tier
    stepDownloads: 3,    // 3 STEP downloads for pro tier
    manufacturingQuotes: 5
  },
  business: {
    stlDownloads: Infinity,
    stepDownloads: 10,
    manufacturingQuotes: 10
  }
};

export interface DownloadRecord {
  designId: string;
  fileType: 'stl' | 'step';
  downloadedAt: Date;
}

export interface UserSubscription {
  userId: string;
  planType: PlanType;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  downloads: DownloadRecord[];  // Array of downloads in the subscription document
  downloadCounts: {
    stl: number;
    step: number;
  };
  quotesUsed: number;
} 