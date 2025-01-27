export type PlanType = 'free' | 'pro' | 'business';

export interface PlanLimits {
  stlDownloads: number;
  stepDownloads: number;
  manufacturingQuotes: number;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    stlDownloads: 10,  // Free/Hobbyist tier
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

export interface DownloadRecord {
  designId: string;
  fileType: 'stl' | 'step';
  downloadedAt: Date;
}

export interface UserSubscription {
  userId: string;
  planType: PlanType;
  tier?: PlanType; // For backwards compatibility
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: number | null;
  downloads: DownloadRecord[];  // Array of downloads in the subscription document
  downloadCounts: {
    stl: number;
    step: number;
  };
  quotesUsed: number;
  updatedAt: any;
} 