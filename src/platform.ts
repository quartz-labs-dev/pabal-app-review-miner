import { AppTarget } from "./utils";

export type PlatformMode = "both" | "ios" | "android";

export function includesPlay(platform: PlatformMode): boolean {
  return platform === "both" || platform === "android";
}

export function includesIos(platform: PlatformMode): boolean {
  return platform === "both" || platform === "ios";
}

export function applyPlatformFilter(target: AppTarget, platform: PlatformMode): AppTarget {
  return {
    ...target,
    play: includesPlay(platform) ? target.play : undefined,
    ios: includesIos(platform) ? target.ios : undefined
  };
}
