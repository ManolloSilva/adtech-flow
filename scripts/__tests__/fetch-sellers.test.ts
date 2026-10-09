/**
 * fetch-sellers.test.ts — unit tests for the build-time sellers.json ETL.
 *
 * The network layer is injected, so the whole pipeline (sanitise → normalise →
 * merge → budget) is verified offline and deterministically.
 */

import { describe, it, expect, vi } from 'vitest';

import {
  buildEcosystemNodes,
  nodeIdFromDomain,
  parseSellersFile,
  sanitiseSeller,
  stripPii,
} from '../fetch-sellers';
import { CURATED_ECOSYSTEM_NODES } from '../ecosystem-seed';

const SSP = [{ name: 'Magnite', url: 'https://example.test/sellers.json' }];

/** A fetch stub that returns the supplied payload for known URLs. */
function fetchStub(payload: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

describe('stripPii', () => {
  it('redacts email addresses', () => {
    expect(stripPii('Contact data-team@example.com')).toBe('Contact [redacted]');
  });

  it('redacts phone numbers', () => {
    expect(stripPii('Call +1 (555) 123-4567 now')).toContain('[redacted]');
  });

  it('leaves ordinary text untouched', () => {
    expect(stripPii('Supply-Side Platform')).toBe('Supply-Side Platform');
  });
});

describe('sanitiseSeller', () => {
  it('normalises a valid entry', () => {
    const seller = sanitiseSeller({
      seller_id: 'pub-1',
      name: 'Example News',
      seller_type: 'PUBLISHER',
      domain: 'ExampleNews.COM',
    });
    expect(seller).toEqual({
      seller_id: 'pub-1',
      name: 'Example News',
      seller_type: 'PUBLISHER',
      domain: 'examplenews.com',
    });
  });

  it('rejects entries without a domain', () => {
    expect(sanitiseSeller({ name: 'No Domain' })).toBeNull();
  });

  it('rejects entries without a name', () => {
    expect(sanitiseSeller({ domain: 'x.com' })).toBeNull();
  });

  it('defaults an unknown seller_type to INTERMEDIARY', () => {
    expect(sanitiseSeller({ name: 'X', domain: 'x.com', seller_type: 'WAT' })?.seller_type).toBe('INTERMEDIARY');
  });

  it('never carries a PII-named field through', () => {
    const seller = sanitiseSeller({
      name: 'X',
      domain: 'x.com',
      contact_email: 'leak@example.com',
      owner: 'Jane Doe',
    }) as Record<string, unknown>;
    expect(seller.contact_email).toBeUndefined();
    expect(seller.owner).toBeUndefined();
  });

  it('redacts PII embedded in the seller name', () => {
    expect(sanitiseSeller({ name: 'Reach us at a@b.com', domain: 'x.com' })?.name).toBe('Reach us at [redacted]');
  });
});

describe('parseSellersFile', () => {
  it('parses a well-formed document', () => {
    const parsed = parseSellersFile({
      sellers: [{ name: 'A', domain: 'a.com', seller_type: 'PUBLISHER' }],
    });
    expect(parsed).toHaveLength(1);
  });

  it('returns an empty array for malformed documents', () => {
    expect(parseSellersFile(null)).toEqual([]);
    expect(parseSellersFile({})).toEqual([]);
    expect(parseSellersFile({ sellers: 'nope' })).toEqual([]);
    expect(parseSellersFile({ sellers: [null, 42, { noDomain: true }] })).toEqual([]);
  });
});

describe('nodeIdFromDomain', () => {
  it('maps known domains to their curated ids', () => {
    expect(nodeIdFromDomain('rubiconproject.com')).toBe('node-ssp-magnite');
    expect(nodeIdFromDomain('ttd.com')).toBe('node-dsp-ttd');
  });

  it('derives a stable slug for unknown domains', () => {
    expect(nodeIdFromDomain('unknown.example')).toBe('node-unknown-example');
    expect(nodeIdFromDomain('unknown.example')).toBe(nodeIdFromDomain('unknown.example'));
  });
});

describe('buildEcosystemNodes', () => {
  it('merges fetched sellers alongside the curated seed', async () => {
    const { nodes } = await buildEcosystemNodes(
      fetchStub({ sellers: [{ name: 'New SSP Member', domain: 'newss.example', seller_type: 'INTERMEDIARY' }] }),
      SSP,
    );
    expect(nodes.some((n) => n.domain === 'newss.example')).toBe(true);
    // Curated entries survive the merge.
    expect(nodes.some((n) => n.id === 'node-ssp-magnite')).toBe(true);
  });

  it('attributes discovered nodes to their source SSP', async () => {
    const { nodes } = await buildEcosystemNodes(
      fetchStub({ sellers: [{ name: 'New SSP Member', domain: 'newss.example' }] }),
      SSP,
    );
    const discovered = nodes.find((n) => n.domain === 'newss.example');
    expect(discovered?.sourceSsp).toBe('Magnite');
  });

  it('never overrides a curated node with fetched data', async () => {
    const { nodes } = await buildEcosystemNodes(
      fetchStub({ sellers: [{ name: 'HIJACKED', domain: 'rubiconproject.com' }] }),
      SSP,
    );
    const magnite = nodes.find((n) => n.id === 'node-ssp-magnite');
    expect(magnite?.name).toBe('Magnite');
  });

  it('degrades gracefully when a source is unreachable', async () => {
    const failing = vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    const { nodes, warnings } = await buildEcosystemNodes(failing, SSP);
    expect(warnings).toHaveLength(1);
    expect(nodes).toHaveLength(CURATED_ECOSYSTEM_NODES.length);
  });

  it('degrades gracefully when a source returns malformed JSON', async () => {
    const failing = vi.fn(async () => new Response('not json', { status: 200 })) as unknown as typeof fetch;
    const { nodes, warnings } = await buildEcosystemNodes(failing, SSP);
    expect(warnings.length).toBeGreaterThan(0);
    expect(nodes.length).toBeGreaterThan(0);
  });

  it('produces deterministic ordering by category then name', async () => {
    const { nodes } = await buildEcosystemNodes(fetchStub({ sellers: [] }), []);
    const keys = nodes.map((n) => `${n.category}:${n.name}`);
    expect(keys).toEqual([...keys].sort());
  });

  it('emits output comfortably under the 400 KB budget', async () => {
    const { nodes } = await buildEcosystemNodes(fetchStub({ sellers: [] }), []);
    expect(Buffer.byteLength(JSON.stringify(nodes, null, 2), 'utf8')).toBeLessThan(400 * 1024);
  });

  it('contains no PII in the emitted seed', () => {
    const serialised = JSON.stringify(CURATED_ECOSYSTEM_NODES);
    expect(serialised).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  it('gives every node a unique id', () => {
    const ids = CURATED_ECOSYSTEM_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every node a unique domain', () => {
    const domains = CURATED_ECOSYSTEM_NODES.map((n) => n.domain);
    expect(new Set(domains).size).toBe(domains.length);
  });

  it('maps every curated domain to its curated id', () => {
    // Guards DOMAIN_TO_ID against drifting out of sync with ecosystem-seed.ts.
    // A mismatch would let a live fetch mint a second, duplicate node.
    for (const node of CURATED_ECOSYSTEM_NODES) {
      expect(nodeIdFromDomain(node.domain), `domain not mapped: ${node.domain}`).toBe(node.id);
    }
  });
});