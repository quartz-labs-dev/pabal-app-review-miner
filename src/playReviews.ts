import gplay, { IReviewsItem } from "google-play-scraper";
import { normalizeText, ReviewItem, SourceReviewResult, toIsoString } from "./utils";

const PLAY_MAX_PAGES = 20;
const PLAY_MAX_BATCH = 200;
const PLAY_SORT_NEWEST = 2;

function mapPlayReview(row: IReviewsItem): ReviewItem {
  return {
    rating: Number(row.score ?? 0),
    text: normalizeText(row.text),
    date: toIsoString(row.date),
    user: normalizeText(row.userName) || "anonymous"
  };
}

export async function fetchPlayReviews(appId: string, limit: number): Promise<SourceReviewResult> {
  const targetLimit = Math.max(1, limit);
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
        lang: "en",
        country: "us"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Error requesting Google Play:${message}`);
    }

    const mapped = response.data
      .map(mapPlayReview)
      .filter((item) => item.text.length > 0);

    reviews.push(...mapped);
    token = response.nextPaginationToken;
    page += 1;

    if (!token || mapped.length === 0) {
      break;
    }
  }

  return {
    source: "play",
    reviews: reviews.slice(0, targetLimit)
  };
}
