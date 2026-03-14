import { fetchJsonWithRetry, normalizeText, ReviewItem, SourceReviewResult, toIsoString } from "./utils";
import { DEFAULT_STORE_COUNTRY } from "./storeLocale";

interface AppStoreEntry {
  content?: { label?: string };
  updated?: { label?: string };
  author?: { name?: { label?: string } };
  "im:rating"?: { label?: string };
}

interface AppStoreFeed {
  feed?: {
    entry?: AppStoreEntry[] | AppStoreEntry;
  };
}

const APP_STORE_MAX_PAGES = 20;

interface FetchAppStoreReviewsOptions {
  country?: string;
}

function createAppStoreUrl(appId: string, page: number, country: string): string {
  return `https://itunes.apple.com/${encodeURIComponent(country.toLowerCase())}/rss/customerreviews/page=${page}/id=${appId}/sortby=mostrecent/json`;
}

function parseEntry(entry: AppStoreEntry): ReviewItem | null {
  const ratingRaw = entry["im:rating"]?.label;
  if (!ratingRaw) {
    return null;
  }

  const text = normalizeText(entry.content?.label);
  if (!text) {
    return null;
  }

  return {
    rating: Number(ratingRaw),
    text,
    date: toIsoString(entry.updated?.label),
    user: normalizeText(entry.author?.name?.label) || "anonymous"
  };
}

function toEntries(feed: AppStoreFeed): AppStoreEntry[] {
  const rawEntries = feed.feed?.entry;
  if (!rawEntries) {
    return [];
  }

  return Array.isArray(rawEntries) ? rawEntries : [rawEntries];
}

export async function fetchAppStoreReviews(
  appId: string,
  limit: number,
  options?: FetchAppStoreReviewsOptions
): Promise<SourceReviewResult> {
  const targetLimit = Math.max(1, limit);
  const country = normalizeText(options?.country).toLowerCase() || DEFAULT_STORE_COUNTRY;
  const reviews: ReviewItem[] = [];

  for (let page = 1; page <= APP_STORE_MAX_PAGES && reviews.length < targetLimit; page += 1) {
    const url = createAppStoreUrl(appId, page, country);

    let payload: AppStoreFeed;
    try {
      payload = await fetchJsonWithRetry<AppStoreFeed>(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Error requesting App Store page ${page}:${message}`);
    }

    const mapped = toEntries(payload).map(parseEntry).filter((item): item is ReviewItem => item !== null);

    reviews.push(...mapped);

    if (mapped.length === 0) {
      break;
    }
  }

  return {
    source: "ios",
    reviews: reviews.slice(0, targetLimit)
  };
}
