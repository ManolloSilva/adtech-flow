/**
 * mocks/browser.ts — MSW in the browser (Service Worker mode).
 *
 * The Service Worker intercepts at the network layer, so requests appear in the
 * Chrome DevTools Network tab as real HTTP POSTs — the authentic DevTools
 * experience described in docs/architecture.md §2 — while never leaving the machine.
 */

import { setupWorker } from 'msw/browser';

import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

export const MOCK_API_BASE = '/openrtb2/auction';