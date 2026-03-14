import gplay from "google-play-scraper";
import { AppTarget, fetchJsonWithRetry, normalizeText } from "./utils";

interface ITunesLookupResponse {
  results?: Array<{
    trackName?: string;
  }>;
}

function createIosLookupUrl(appId: string, country: string): string {
  return `https://itunes.apple.com/lookup?id=${encodeURIComponent(appId)}&country=${encodeURIComponent(country)}`;
}

async function lookupPlayAppName(appId: string, country: string, lang: string): Promise<string | undefined> {
  const normalized = normalizeText(appId);
  if (!normalized) {
    return undefined;
  }

  try {
    const app = await gplay.app({
      appId: normalized,
      country,
      lang
    });

    const title = normalizeText(app.title);
    return title || undefined;
  } catch {
    return undefined;
  }
}

async function lookupIosAppName(appId: string, country: string): Promise<string | undefined> {
  const normalized = normalizeText(appId);
  if (!normalized) {
    return undefined;
  }

  try {
    const payload = await fetchJsonWithRetry<ITunesLookupResponse>(createIosLookupUrl(normalized, country));
    const trackName = normalizeText(payload.results?.[0]?.trackName);
    return trackName || undefined;
  } catch {
    return undefined;
  }
}

export async function enrichTargetsWithDisplayNames(
  targets: AppTarget[],
  country: string,
  lang: string
): Promise<AppTarget[]> {
  const playNameCache = new Map<string, string | undefined>();
  const iosNameCache = new Map<string, string | undefined>();

  const resolvePlayName = async (appId: string): Promise<string | undefined> => {
    if (!playNameCache.has(appId)) {
      const name = await lookupPlayAppName(appId, country, lang);
      playNameCache.set(appId, name);
    }

    return playNameCache.get(appId);
  };

  const resolveIosName = async (appId: string): Promise<string | undefined> => {
    if (!iosNameCache.has(appId)) {
      const name = await lookupIosAppName(appId, country);
      iosNameCache.set(appId, name);
    }

    return iosNameCache.get(appId);
  };

  return Promise.all(
    targets.map(async (target) => {
      if (normalizeText(target.displayName)) {
        return target;
      }

      let displayName: string | undefined;

      if (target.play) {
        displayName = await resolvePlayName(target.play);
      }

      if (!displayName && target.ios) {
        displayName = await resolveIosName(target.ios);
      }

      return {
        ...target,
        displayName
      };
    })
  );
}

