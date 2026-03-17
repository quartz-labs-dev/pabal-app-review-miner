export type ReviewSource = "play" | "ios";

export interface ReviewItem {
  rating: number;
  text: string;
  date: string;
  user: string;
  reviewId?: string;
  storeReviewId?: string;
}

export interface SourceReviewResult {
  source: ReviewSource;
  reviews: ReviewItem[];
}

export interface UnifiedReview extends ReviewItem {
  source: ReviewSource;
}

export interface ReviewsOutput {
  ownerAppId: string;
  app: string;
  appName: string;
  collectedAt: string;
  limitPerStore: number;
  ids: {
    play?: string;
    ios?: string;
  };
  links: {
    play?: string;
    ios?: string;
  };
  counts: {
    play: number;
    ios: number;
    total: number;
  };
  reviews: UnifiedReview[];
}

export interface AppTarget {
  name: string;
  displayName?: string;
  play?: string;
  ios?: string;
}

export interface OutputPaths {
  reviewsPath: string;
}

