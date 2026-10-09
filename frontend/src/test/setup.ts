import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { server } from '@/mocks/server';

// jsdom does not implement matchMedia — used by Radix UI primitives (Sheet, Tooltip).
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom does not implement ResizeObserver — required by Radix UI slot measurement.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

/* ------------------------------------------------------------------------- */
/* Network guard: MSW intercepts every request.                               */
/* Any unhandled request fails loudly so a live call can never escape a test.  */
/* Safe to use a blanket `error` here — unlike the browser, tests issue no       */
/* navigation or asset requests, only explicit `fetch()` calls under test.      */
/* ------------------------------------------------------------------------- */

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

/**
 * Radix UI modal layers (Sheet, Dialog) set `pointer-events: none` on <body>
 * while open and restore it on unmount. Testing Library unmounts the tree only
 * *after* the test body has run, so a test that ends with a sheet still open can
 * leak the attribute into whichever hook happens to run last. Resetting in
 * `beforeEach` — before any component renders — makes each test independent of
 * hook ordering.
 */
beforeEach(() => {
  document.body.style.pointerEvents = '';
  document.body.style.overflow = '';
});

afterAll(() => {
  server.close();
});