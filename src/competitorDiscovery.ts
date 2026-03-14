import gplay, { IAppItem } from "google-play-scraper";
import { DEFAULT_STORE_COUNTRY, DEFAULT_STORE_LANG } from "./storeLocale";
import { AppTarget, fetchJsonWithRetry, fetchTextWithRetry, normalizeText } from "./utils";

interface ITunesApp {
  trackId?: number;
  trackName?: string;
  artistId?: number;
  primaryGenreName?: string;
  userRatingCount?: number;
}

interface ITunesResponse {
  results?: ITunesApp[];
}

interface DiscoverCompetitorsOptions {
  ownerPlayAppId?: string;
  ownerIosAppId?: string;
  top: number;
  country?: string;
  lang?: string;
}

interface RankedIosCandidate {
  app: ITunesApp;
  rank: number;
}

interface RankedIosRecommendation {
  appId: string;
  app?: ITunesApp;
  rank: number;
}

const IOS_SEARCH_LIMIT = 50;
const PLAY_SEARCH_LIMIT = 50;

function createLookupUrl(appId: string, country: string): string {
  return `https://itunes.apple.com/lookup?id=${encodeURIComponent(appId)}&country=${encodeURIComponent(country)}`;
}

function createBulkLookupUrl(appIds: string[], country: string): string {
  return `https://itunes.apple.com/lookup?id=${encodeURIComponent(appIds.join(","))}&country=${encodeURIComponent(
    country
  )}`;
}

function createSearchUrl(term: string, country: string): string {
  return (
    `https://itunes.apple.com/search?entity=software` +
    `&term=${encodeURIComponent(term)}` +
    `&country=${encodeURIComponent(country)}` +
    `&limit=${IOS_SEARCH_LIMIT}`
  );
}

function createAppStorePageUrl(appId: string, country: string): string {
  return `https://apps.apple.com/${encodeURIComponent(country.toLowerCase())}/app/id${encodeURIComponent(appId)}`;
}

function normalizeTop(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value));
}

function dedupeIds(ids: string[]): string[] {
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    const normalized = normalizeText(id);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(normalized);
  }

  return deduped;
}

function toPlayTargetWithName(app: IAppItem): AppTarget {
  const appId = normalizeText(app.appId);
  return {
    name: `play-${appId}`,
    displayName: normalizeText(app.title) || `play-${appId}`,
    play: appId
  };
}

function toIosTarget(appId: string, trackName?: string): AppTarget {
  return {
    name: `ios-${appId}`,
    displayName: normalizeText(trackName) || `ios-${appId}`,
    ios: appId
  };
}

function getPackageNamespace(packageName: string, depth = 2): string {
  const normalized = normalizeText(packageName).toLowerCase();
  if (!normalized) {
    return "";
  }

  const parts = normalized.split(".").filter(Boolean);
  if (parts.length <= 1) {
    return normalized;
  }

  return parts.slice(0, Math.min(depth, parts.length)).join(".");
}

function isSameNamespaceApp(ownerNamespace: string, candidateAppId: string): boolean {
  if (!ownerNamespace) {
    return false;
  }

  const candidate = normalizeText(candidateAppId).toLowerCase();
  return candidate === ownerNamespace || candidate.startsWith(`${ownerNamespace}.`);
}

function getIosTargetId(target: AppTarget): string {
  return normalizeText(target.ios);
}

function dedupeTargetsByName(targets: AppTarget[]): AppTarget[] {
  const deduped: AppTarget[] = [];
  const seenNames = new Set<string>();

  for (const target of targets) {
    const name = normalizeText(target.name).toLowerCase();
    if (!name || seenNames.has(name)) {
      continue;
    }

    seenNames.add(name);
    deduped.push(target);
  }

  return deduped;
}

async function discoverPlayTargets(
  ownerPlayAppId: string,
  top: number,
  country: string,
  lang: string
): Promise<AppTarget[]> {
  let ownerApp: IAppItem | undefined;
  try {
    ownerApp = await gplay.app({
      appId: ownerPlayAppId,
      country,
      lang
    });
  } catch {
    ownerApp = undefined;
  }
  const ownerDeveloperId = normalizeText(ownerApp?.developerId).toLowerCase();
  const ownerSearchTerms = dedupeIds([normalizeText(ownerApp?.title), normalizeText(ownerApp?.summary)]);

  let similarApps: IAppItem[];
  try {
    similarApps = await gplay.similar({
      appId: ownerPlayAppId,
      country,
      lang
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Google Play competitor discovery failed: ${message}`);
  }

  const owner = normalizeText(ownerPlayAppId).toLowerCase();
  const ownerNamespace = getPackageNamespace(ownerPlayAppId);
  const targets: AppTarget[] = [];
  const seen = new Set<string>();

  const appendCandidate = (app: IAppItem): void => {
    const appId = normalizeText(app.appId);
    if (!appId) {
      return;
    }

    const normalized = appId.toLowerCase();
    if (normalized === owner || seen.has(normalized)) {
      return;
    }

    const candidateDeveloperId = normalizeText(app.developerId).toLowerCase();
    if (ownerDeveloperId && candidateDeveloperId && ownerDeveloperId === candidateDeveloperId) {
      return;
    }

    if (isSameNamespaceApp(ownerNamespace, appId)) {
      return;
    }

    seen.add(normalized);
    targets.push(toPlayTargetWithName(app));
  };

  for (const app of similarApps) {
    appendCandidate(app);

    if (targets.length >= top) {
      break;
    }
  }

  if (targets.length < top) {
    for (const term of ownerSearchTerms) {
      let searchApps: IAppItem[] = [];
      try {
        searchApps = await gplay.search({
          term,
          num: PLAY_SEARCH_LIMIT,
          country,
          lang
        });
      } catch {
        searchApps = [];
      }

      for (const app of searchApps) {
        appendCandidate(app);
        if (targets.length >= top) {
          break;
        }
      }

      if (targets.length >= top) {
        break;
      }
    }
  }

  return targets;
}

function extractRecommendationIdsFromAppPage(html: string): string[] {
  const similarSectionMatch = html.match(/<section id="similarItems"[\s\S]*?<\/section>/i);
  if (!similarSectionMatch) {
    return [];
  }

  const ids: string[] = [];
  const idPattern = /\/id(\d{6,})\b/g;
  let match: RegExpExecArray | null = null;

  while ((match = idPattern.exec(similarSectionMatch[0])) !== null) {
    ids.push(match[1]);
  }

  return dedupeIds(ids);
}

async function fetchIosRecommendationIds(ownerIosAppId: string, country: string): Promise<string[]> {
  const html = await fetchTextWithRetry(createAppStorePageUrl(ownerIosAppId, country));
  return extractRecommendationIdsFromAppPage(html);
}

async function lookupIosApps(appIds: string[], country: string): Promise<Map<string, ITunesApp>> {
  const ids = dedupeIds(appIds);
  if (!ids.length) {
    return new Map();
  }

  const payload = await fetchJsonWithRetry<ITunesResponse>(createBulkLookupUrl(ids, country));
  const map = new Map<string, ITunesApp>();

  for (const app of payload.results ?? []) {
    const trackId = app.trackId;
    if (!trackId) {
      continue;
    }

    map.set(String(trackId), app);
  }

  return map;
}

function shouldSkipIosApp(
  appId: string,
  ownerId: string,
  seen: Set<string>,
  ownerArtistId: number | undefined,
  app: ITunesApp | undefined
): boolean {
  if (!appId || appId === ownerId || seen.has(appId)) {
    return true;
  }

  if (ownerArtistId && app?.artistId && app.artistId === ownerArtistId) {
    return true;
  }

  return false;
}

function scoreIosCandidate(a: RankedIosCandidate, b: RankedIosCandidate): number {
  if (a.rank !== b.rank) {
    return a.rank - b.rank;
  }

  const aCount = a.app.userRatingCount ?? 0;
  const bCount = b.app.userRatingCount ?? 0;

  return bCount - aCount;
}

function scoreIosRecommendation(a: RankedIosRecommendation, b: RankedIosRecommendation): number {
  const aCount = a.app?.userRatingCount ?? 0;
  const bCount = b.app?.userRatingCount ?? 0;
  if (aCount !== bCount) {
    return bCount - aCount;
  }

  return a.rank - b.rank;
}

async function discoverIosTargetsBySearch(ownerEntry: ITunesApp, top: number, country: string): Promise<AppTarget[]> {
  const searchTerms = [normalizeText(ownerEntry.trackName), normalizeText(ownerEntry.primaryGenreName)].filter(
    (term): term is string => term.length > 0
  );

  if (!searchTerms.length) {
    throw new Error(`App Store owner app is missing searchable metadata for id ${ownerEntry.trackId ?? "unknown"}`);
  }

  const ownerArtistId = ownerEntry.artistId;
  const ranked = new Map<number, RankedIosCandidate>();

  for (let termIndex = 0; termIndex < searchTerms.length; termIndex += 1) {
    const term = searchTerms[termIndex];
    let payload: ITunesResponse;

    try {
      payload = await fetchJsonWithRetry<ITunesResponse>(createSearchUrl(term, country));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`App Store competitor search failed for term "${term}": ${message}`);
    }

    const apps = payload.results ?? [];
    for (let index = 0; index < apps.length; index += 1) {
      const app = apps[index];
      const trackId = app.trackId;

      if (!trackId || trackId === ownerEntry.trackId) {
        continue;
      }

      if (ownerArtistId && app.artistId && app.artistId === ownerArtistId) {
        continue;
      }

      const rank = termIndex * 1000 + index;
      const existing = ranked.get(trackId);
      if (!existing || rank < existing.rank) {
        ranked.set(trackId, { app, rank });
      }
    }
  }

  return Array.from(ranked.values())
    .sort(scoreIosCandidate)
    .slice(0, top)
    .map((candidate) => candidate.app)
    .filter((app): app is ITunesApp & { trackId: number } => Number.isFinite(app.trackId))
    .map((app) => toIosTarget(String(app.trackId), app.trackName));
}

async function discoverIosTargetsByRecommendations(
  ownerId: string,
  ownerArtistId: number | undefined,
  top: number,
  country: string
): Promise<AppTarget[]> {
  let recommendationIds: string[] = [];
  try {
    recommendationIds = await fetchIosRecommendationIds(ownerId, country);
  } catch {
    recommendationIds = [];
  }

  if (!recommendationIds.length) {
    return [];
  }

  let recommendationApps = new Map<string, ITunesApp>();
  try {
    recommendationApps = await lookupIosApps(recommendationIds, country);
  } catch {
    recommendationApps = new Map<string, ITunesApp>();
  }

  const targets: AppTarget[] = [];
  const seen = new Set<string>();
  const ranked: RankedIosRecommendation[] = [];

  for (let index = 0; index < recommendationIds.length; index += 1) {
    const appId = recommendationIds[index];
    const app = recommendationApps.get(appId);
    if (shouldSkipIosApp(appId, ownerId, seen, ownerArtistId, app)) {
      continue;
    }

    ranked.push({
      appId,
      app,
      rank: index
    });
  }

  ranked.sort(scoreIosRecommendation);

  for (const candidate of ranked) {
    seen.add(candidate.appId);
    targets.push(toIosTarget(candidate.appId, candidate.app?.trackName));
    if (targets.length >= top) {
      break;
    }
  }

  return targets;
}

async function discoverIosTargets(ownerIosAppId: string, top: number, country: string): Promise<AppTarget[]> {
  let ownerPayload: ITunesResponse;
  try {
    ownerPayload = await fetchJsonWithRetry<ITunesResponse>(createLookupUrl(ownerIosAppId, country));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`App Store owner lookup failed: ${message}`);
  }

  const ownerTrackId = Number(ownerIosAppId);
  const ownerEntry =
    ownerPayload.results?.find((item) => item.trackId === ownerTrackId) ?? ownerPayload.results?.[0];

  if (!ownerEntry?.trackId) {
    throw new Error(`App Store owner app not found for id ${ownerIosAppId}`);
  }

  const ownerId = String(ownerEntry.trackId);
  const ownerArtistId = ownerEntry.artistId;
  const targets = await discoverIosTargetsByRecommendations(ownerId, ownerArtistId, top, country);
  if (targets.length >= top) {
    return targets;
  }

  const seen = new Set<string>(
    targets.map(getIosTargetId).filter((appId): appId is string => Boolean(appId))
  );
  const searchTargets = await discoverIosTargetsBySearch(ownerEntry, top, country);
  for (const target of searchTargets) {
    const appId = getIosTargetId(target);
    if (shouldSkipIosApp(appId, ownerId, seen, ownerArtistId, undefined)) {
      continue;
    }

    seen.add(appId);
    targets.push(target);

    if (targets.length >= top) {
      break;
    }
  }

  return targets;
}

export async function discoverCompetitorTargets(options: DiscoverCompetitorsOptions): Promise<AppTarget[]> {
  const top = normalizeTop(options.top);
  const country = options.country ?? DEFAULT_STORE_COUNTRY;
  const lang = options.lang ?? DEFAULT_STORE_LANG;
  const ownerPlayAppId = normalizeText(options.ownerPlayAppId);
  const ownerIosAppId = normalizeText(options.ownerIosAppId);

  if (!ownerPlayAppId && !ownerIosAppId) {
    throw new Error(
      "Auto discovery requires at least one owner store id in registered-apps.json " +
        "(googlePlay.packageName or appStore.appId)."
    );
  }

  const targets: AppTarget[] = [];

  if (ownerPlayAppId) {
    const playTargets = await discoverPlayTargets(ownerPlayAppId, top, country, lang);
    targets.push(...playTargets);
  }

  if (ownerIosAppId) {
    const iosTargets = await discoverIosTargets(ownerIosAppId, top, country);
    targets.push(...iosTargets);
  }

  return dedupeTargetsByName(targets);
}
