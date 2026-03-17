import { createHash } from "node:crypto";
import { ReviewSource, UnifiedReview } from "./types";
import { normalizeText } from "./text";

export function createReviewFingerprint(
  review: Pick<UnifiedReview, "source" | "user" | "date" | "text">
): string {
  return [
    normalizeText(review.source).toLowerCase(),
    normalizeText(review.user).toLowerCase(),
    normalizeText(review.date),
    normalizeText(review.text)
  ].join("::");
}

function hashToken(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 20);
}

export function createReviewIdFromStore(
  source: ReviewSource,
  storeReviewId: string | undefined,
  fallbackReview: Pick<UnifiedReview, "source" | "user" | "date" | "text">
): string {
  const normalizedStoreReviewId = normalizeText(storeReviewId);
  if (normalizedStoreReviewId) {
    return `rvw_${hashToken(`${source}::${normalizedStoreReviewId}`)}`;
  }

  return `rvw_${hashToken(createReviewFingerprint(fallbackReview))}`;
}

export function ensureReviewId(review: UnifiedReview): UnifiedReview {
  const existing = normalizeText(review.reviewId);
  if (existing) {
    return {
      ...review,
      reviewId: existing
    };
  }

  return {
    ...review,
    reviewId: createReviewIdFromStore(review.source, review.storeReviewId, review)
  };
}

export function dedupeReviews(reviews: UnifiedReview[]): UnifiedReview[] {
  const seen = new Set<string>();
  const result: UnifiedReview[] = [];

  for (const review of reviews) {
    const normalized = ensureReviewId(review);
    const key = normalizeText(normalized.reviewId).toLowerCase() || createReviewFingerprint(normalized);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

