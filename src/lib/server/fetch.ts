export async function fetchWithRetry(url: string, init?: RequestInit, retries = 3, backoffMs = 300) {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt <= retries) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    } catch (e: unknown) {
      lastErr = e;
      const delay = backoffMs * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
      await new Promise(r => setTimeout(r, delay));
      attempt++;
    }
  }
  throw lastErr;
}
