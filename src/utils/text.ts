import { MIN_REVIEW_TEXT_LENGTH_EXCLUSIVE } from "./constants";

export function normalizeText(input: string | undefined | null): string {
  return (input ?? "").replace(/\s+/g, " ").trim();
}

export function hasMeaningfulReviewText(input: string | undefined | null): boolean {
  return normalizeText(input).length > MIN_REVIEW_TEXT_LENGTH_EXCLUSIVE;
}

export function toIsoString(input: string | Date | undefined | null): string {
  if (!input) {
    return new Date().toISOString();
  }

  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

export function safeFileName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "app"
  );
}

