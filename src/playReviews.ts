import gplay, { IReviewsItem } from "google-play-scraper";
import { DEFAULT_STORE_COUNTRY, DEFAULT_STORE_LANG } from "./storeLocale";
import { hasMeaningfulReviewText, normalizeText, ReviewItem, SourceReviewResult, toIsoString } from "./utils";

const PLAY_MAX_PAGES = 20;
const PLAY_MAX_BATCH = 200;
const PLAY_SORT_NEWEST = 2;

interface FetchPlayReviewsOptions {
  country?: string;
  lang?: string;
}

function mapPlayReview(row: IReviewsItem): ReviewItem {
  return {
    rating: Number(row.score ?? 0),
    text: normalizeText(row.text),
    date: toIsoString(row.date),
    user: normalizeText(row.userName) || "anonymous",
    storeReviewId: normalizeText(row.id)
  };
}

export async function fetchPlayReviews(
  appId: string,
  limit: number,
  options?: FetchPlayReviewsOptions
): Promise<SourceReviewResult> {
  const targetLimit = Math.max(1, limit);
  const country = options?.country ?? DEFAULT_STORE_COUNTRY;
  const lang = options?.lang ?? DEFAULT_STORE_LANG;
  const reviews: ReviewItem[] = [];
  let token: string | undefined;
  let page = 0;

  while (reviews.length < targetLimit && page < PLAY_MAX_PAGES) {
    const batchSize = Math.min(PLAY_MAX_BATCH, targetLimit - reviews.length);

    let response;
    try {
      response = await gplay.reviews({
        appId,
        sort: PLAY_SORT_NEWEST,
        num: batchSize,
        paginate: true,
        nextPaginationToken: token,
        lang,
        country
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Error requesting Google Play:${message}`);
    }

    const mapped = response.data
      .map(mapPlayReview)
      .filter((item) => hasMeaningfulReviewText(item.text));

    reviews.push(...mapped);
    token = response.nextPaginationToken;
    page += 1;

    if (!token || response.data.length === 0) {
      break;
    }
  }

  return {
    source: "play",
    reviews: reviews.slice(0, targetLimit)
  };
}
