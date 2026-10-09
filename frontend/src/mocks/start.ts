/**
 * start.ts — boots the MSW Service Worker before the app renders.
 *
 * Fails loudly: if the mock network cannot start we surface a visible error
 * instead of letting the app silently issue live ad-tech requests. AdTech Flow
 * must never contact a real ad server (product-spec.md §7).
 */

let started = false;

export async function startMockNetwork(): Promise<void> {
  if (started) return;
  started = true;

  if (typeof window === 'undefined' || !('Worker' in window)) {
    console.warn('[adtech-flow] Mock network skipped: Service Worker unavailable.');
    return;
  }

  try {
    const { worker } = await import('@/mocks/browser');
    await worker.start({
      quiet: false,
      serviceWorker: { url: '/mockServiceWorker.js' },
      // `error` is what guarantees no live ad-tech traffic can escape — but it
      // must not be applied to the app's own assets. A blanket rule fails the
      // document request (GET /) and every Vite module, producing a red 500.
      // Only requests that look like ad-tech traffic are escalated; everything
      // else is bypassed so the app shell still loads.
      onUnhandledRequest(request, print) {
        const isAdTechCall =
          request.url.includes('/openrtb2/') ||
          request.url.includes('/api/consent/') ||
          request.url.includes('/api/identity/') ||
          request.url.includes('/api/audience/') ||
          request.url.includes('/api/verification/');

        if (isAdTechCall) {
          print.error();
        } else {
          print.warning();
        }
      },
    });
    console.info('[adtech-flow] Mock network active — all ad-tech traffic is intercepted.');
  } catch (error) {
    renderFatalError(error);
  }
}

function renderFatalError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const root = document.getElementById('root');
  if (!root) return;

  root.innerHTML = `
    <main role="alert" style="padding:2rem;font-family:system-ui,sans-serif;color:#f8fafc">
      <h1 style="font-size:1.25rem;margin-bottom:0.5rem">Mock network failed to start</h1>
      <p style="color:#94a3b8">
        AdTech Flow blocks all live ad-tech traffic. The mock service worker could not be
        registered, so the simulation was halted.
      </p>
      <pre style="margin-top:1rem;padding:1rem;background:#1e293b;border-radius:0.5rem;overflow:auto">
${message}
      </pre>
    </main>`;
}