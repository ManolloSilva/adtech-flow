/**
 * mocks/server.ts — MSW in Node/jsdom (test mode).
 *
 * jsdom cannot register a Service Worker, so tests use the Node interceptor
 * instead. It exercises the exact same handlers, which guarantees the test
 * environment and the browser environment cannot drift apart.
 */

import { setupServer } from 'msw/node';

import { handlers } from './handlers';

export const server = setupServer(...handlers);