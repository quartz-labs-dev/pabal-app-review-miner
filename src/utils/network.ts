import fetch, { RequestInit } from "node-fetch";

const FETCH_TIMEOUT_MS = 15_000;

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function requestWithRetry<T>(
  url: string,
  parser: (response: Awaited<ReturnType<typeof fetch>>) => Promise<T>,
  options?: RequestInit,
  retries = 3,
  retryDelayMs = 500
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const requestOptions: RequestInit = {
        ...(options ?? {})
      };
      let timeoutHandle: NodeJS.Timeout | undefined;

      if (!requestOptions.signal) {
        const controller = new AbortController();
        timeoutHandle = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        requestOptions.signal = controller.signal;
      }

      const response = await fetch(url, requestOptions);
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      if (!response.ok) {
        const body = (await response.text()).slice(0, 300);
        throw new Error(`Request failed (${response.status}) for ${url}. ${body}`);
      }

      return await parser(response);
    } catch (error) {
      lastError = error;

      if (attempt < retries - 1) {
        await sleep(retryDelayMs * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown fetch error");
}

export async function fetchJsonWithRetry<T>(
  url: string,
  options?: RequestInit,
  retries = 3
): Promise<T> {
  return requestWithRetry<T>(url, async (response) => (await response.json()) as T, options, retries);
}

export async function fetchTextWithRetry(
  url: string,
  options?: RequestInit,
  retries = 3
): Promise<string> {
  return requestWithRetry<string>(url, async (response) => await response.text(), options, retries);
}

