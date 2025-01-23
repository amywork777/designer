export type PlanType = 'free' | 'pro' | 'business';

export interface SubscriptionLimits {
  stlDownloads: number;
  stepDownloads: number;
  manufacturingQuotes: number;
}

export interface UserSubscription {
  userId: string;
  planType: PlanType;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

export interface DownloadRecord {
  userId: string;
  designId: string;
  fileType: 'stl' | 'step';
  downloadedAt: Date;
  periodStart: Date;
  periodEnd: Date;
} 