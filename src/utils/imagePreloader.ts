type FetchPriority = "high" | "low" | "auto";

const imageRequests = new Map<string, Promise<void>>();
const fileRequests = new Map<string, Promise<void>>();
const decodedImages = new Set<string>();

/** Allows scene renderers to swap an already-decoded frame before paint. */
export function isImagePreloaded(source: string) {
  return decodedImages.has(source);
}

/**
 * Fetch and decode an image once. Reusing the promise prevents separate
 * adventures and hover handlers from starting duplicate network requests.
 */
export function preloadImage(source: string, priority: FetchPriority = "low") {
  if (!source || typeof Image === "undefined") return Promise.resolve();

  const existing = imageRequests.get(source);
  if (existing) return existing;

  const request = new Promise<void>((resolve) => {
    let attempts = 0;
    const attemptLoad = () => {
      attempts += 1;
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = priority;
      let settled = false;

      const finish = async () => {
        if (settled) return;
        settled = true;
        try {
          await image.decode();
        } catch {
          // An image can still be paintable when decode() is unavailable or is
          // rejected by a browser after a successful load.
        }
        decodedImages.add(source);
        resolve();
      };

      image.onload = () => void finish();
      image.onerror = () => {
        if (settled) return;
        settled = true;
        if (attempts < 3) {
          // A momentary development-server or browser-cache miss must not turn
          // into a visible empty scene. Retry while the current frame remains.
          window.setTimeout(attemptLoad, attempts * 80);
          return;
        }
        // Do not permanently cache a failed request. A later scene visit can
        // try again after the external problem has cleared.
        imageRequests.delete(source);
        resolve();
      };
      image.src = source;

      // `complete` is also true for a failed cached request; naturalWidth keeps
      // that case out of the decoded-frame registry.
      if (image.complete && image.naturalWidth > 0) void finish();
    };

    attemptLoad();
  });

  imageRequests.set(source, request);
  return request;
}

/** Preload a short sequence without flooding the connection. */
export async function preloadImages(
  sources: readonly string[],
  options: { concurrency?: number; priority?: FetchPriority; onProgress?: (completed: number, total: number) => void } = {},
) {
  const uniqueSources = [...new Set(sources.filter(Boolean))];
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 2, uniqueSources.length));
  let cursor = 0;
  let completed = 0;

  const worker = async () => {
    while (cursor < uniqueSources.length) {
      const source = uniqueSources[cursor++];
      await preloadImage(source, options.priority ?? "low");
      completed += 1;
      options.onProgress?.(completed, uniqueSources.length);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
}

/** Download non-image media into the browser's HTTP cache without decoding it. */
export function preloadFile(source: string) {
  if (!source || typeof fetch === "undefined") return Promise.resolve();
  const existing = fileRequests.get(source);
  if (existing) return existing;
  const request = fetch(source, { cache: "force-cache" })
    // fetch() itself resolves after headers; consuming the body is what makes
    // the startup gate wait until the complete audio/video file is available.
    .then(response => response.ok ? response.arrayBuffer() : undefined)
    .then(() => undefined)
    .catch(() => undefined);
  fileRequests.set(source, request);
  return request;
}

export async function preloadFiles(
  sources: readonly string[],
  options: { concurrency?: number; onProgress?: (completed: number, total: number) => void } = {},
) {
  const uniqueSources = [...new Set(sources.filter(Boolean))];
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, uniqueSources.length));
  let cursor = 0;
  let completed = 0;
  const worker = async () => {
    while (cursor < uniqueSources.length) {
      await preloadFile(uniqueSources[cursor++]);
      completed += 1;
      options.onProgress?.(completed, uniqueSources.length);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}

/** Keep only the current frame and the next few frames decoded. */
export function preloadSceneWindow(
  sources: readonly string[],
  currentIndex: number,
  lookAhead = 12,
) {
  const safeIndex = Math.max(0, Math.min(currentIndex, sources.length - 1));
  const nearby = sources.slice(safeIndex, safeIndex + lookAhead + 1);
  if (!nearby.length) return;
  void preloadImage(nearby[0], "high");
  void preloadImages(nearby.slice(1), { concurrency: 4, priority: "low" });
}

/**
 * Use genuinely idle time for non-critical art. This avoids competing with the
 * current scene on slow/mobile connections.
 */
export function scheduleIdleImagePreload(sources: readonly string[]) {
  if (typeof window === "undefined" || !sources.length) return () => undefined;

  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (connection?.saveData || connection?.effectiveType === "2g") return () => undefined;

  const run = () => void preloadImages(sources, { concurrency: 1, priority: "low" });
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof idleWindow.requestIdleCallback === "function") {
    const id = idleWindow.requestIdleCallback(run, { timeout: 2500 });
    return () => idleWindow.cancelIdleCallback?.(id);
  }

  const id = globalThis.setTimeout(run, 900);
  return () => globalThis.clearTimeout(id);
}
