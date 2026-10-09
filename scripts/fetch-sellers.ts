/**
 * fetch-sellers.ts — Build-time ETL for IAB Tech Lab `sellers.json` transparency files.
 *
 * Pipeline:
 *   1. Fetch  public `sellers.json` from a curated list of canonical SSPs.
 *   2. Sanitise — strip PII (emails, personal names, phone numbers) and drop unknown fields.
 *   3. Normalise — map seller entries into our `EcosystemNode` shape with category tags.
 *   4. Merge with the curated seed list (which carries human-written `description` copy).
 *   5. Emit  `frontend/src/data/ecosystem-nodes.json`, enforcing the < 400 KB budget.
 *
 * The network layer is intentionally injectable so this script is unit-testable
 * and can run fully offline against the bundled fixtures.
 *
 * Usage:
 *   npx tsx scripts/fetch-sellers.ts                # live fetch, falls back to seed on failure
 *   npx tsx scripts/fetch-sellers.ts --offline      # seed only, no network
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURATED_ECOSYSTEM_NODES } from './ecosystem-seed';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

type EntityCategory =
  | 'publisher'
  | 'cmp'
  | 'audience'
  | 'identity'
  | 'ssp'
  | 'dsp'
  | 'adserver'
  | 'verification';

type SellerType = 'PUBLISHER' | 'INTERMEDIARY' | 'BOTH';

interface EcosystemNode {
  id: string;
  name: string;
  category: EntityCategory;
  domain: string;
  sellerType: SellerType;
  description: string;
  isOptional?: boolean;
  /** Present only when the entry came from a live sellers.json fetch. */
  sourceSsp?: string;
}

/** Raw IAB `sellers.json` shape — only the fields we care about. */
interface RawSeller {
  seller_id: string;
  name: string;
  seller_type: SellerType;
  domain: string;
  is_passthrough?: boolean;
}

interface RawSellersFile {
  sellers: RawSeller[];
}

const CANONICAL_SSPS: ReadonlyArray<{ name: string; url: string }> = [
  { name: 'Magnite', url: 'https://rubiconproject.com/sellers.json' },
  { name: 'PubMatic', url: 'https://pubmatic.com/sellers.json' },
  { name: 'OpenX', url: 'https://openx.com/sellers.json' },
];

const OUTPUT_PATH = path.resolve(__dirname, '../frontend/src/data/ecosystem-nodes.json');
const MAX_OUTPUT_BYTES = 400 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Maximum *new* nodes contributed per SSP source.
 *
 * Live sellers.json files are enormous (Magnite ~3.2k sellers, OpenX ~7.8k), so
 * ingesting them wholesale blows the 400 KB budget by ~3×. We keep a bounded,
 * deterministic slice per source — the curated seed still provides every entity
 * the Alpha simulation actually references.
 */
const MAX_NODES_PER_SOURCE = 60;

/* -------------------------------------------------------------------------- */
/* Sanitisation                                                                */
/* -------------------------------------------------------------------------- */

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;
/** IAB sellers.json personal-contact field names, all of which are dropped wholesale. */
const PII_FIELDS = ['contact_email', 'contact', 'contact_name', 'owner', 'email'];

/** Removes e-mail addresses and phone numbers from free-text fields. */
export function stripPii(input: string): string {
  return input.replace(EMAIL_RE, '[redacted]').replace(PHONE_RE, '[redacted]');
}

/** Narrows an arbitrary parsed JSON object to a valid `RawSeller`, or returns null. */
export function sanitiseSeller(raw: unknown): RawSeller | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Record<string, unknown>;

  const domain = typeof candidate.domain === 'string' ? candidate.domain.trim().toLowerCase() : '';
  const name = typeof candidate.name === 'string' ? stripPii(candidate.name).trim() : '';
  if (!domain || !name) return null;

  const sellerType: SellerType =
    candidate.seller_type === 'PUBLISHER' || candidate.seller_type === 'BOTH'
      ? candidate.seller_type
      : 'INTERMEDIARY';

  const seller: RawSeller = {
    seller_id:
      typeof candidate.seller_id === 'string' && candidate.seller_id
        ? candidate.seller_id
        : domain,
    name,
    seller_type: sellerType,
    domain,
  };

  // Defence in depth: never carry through a PII-named field even if the
  // normaliser above did not construct it explicitly.
  for (const field of PII_FIELDS) delete (seller as unknown as Record<string, unknown>)[field];

  return seller;
}

/** Parses and sanitises a `sellers.json` document. Unknown/malformed entries are dropped. */
export function parseSellersFile(payload: unknown): RawSeller[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const sellers = (payload as Partial<RawSellersFile>).sellers;
  if (!Array.isArray(sellers)) return [];

  return sellers
    .map(sanitiseSeller)
    .filter((s): s is RawSeller => s !== null);
}

/* -------------------------------------------------------------------------- */
/* Normalisation                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Maps a domain to the id used in the curated seed.
 *
 * This must stay in sync with `ecosystem-seed.ts`, otherwise a live fetch would
 * discover e.g. `ttd.com`, mint a *different* slug id, and emit a duplicate node
 * alongside the curated entry. Curated copy always wins on collision.
 */
const DOMAIN_TO_ID: Record<string, string> = {
  /* Publishers */
  'nytimes.com': 'node-pub-nytimes',
  'cnn.com': 'node-pub-cnn',
  'theguardian.com': 'node-pub-guardian',

  /* CMPs */
  'onetrust.com': 'node-cmp-onetrust',
  'cookiebot.com': 'node-cmp-cookiebot',
  'quantcast.mgr.consensu.org': 'node-cmp-quantcast',

  /* Audience */
  'permutive.com': 'node-audience-permutive',

  /* Identity */
  'liveramp.com': 'node-id-liveramp',
  'prebid.org': 'node-id-sharedid',

  /* SSPs */
  'rubiconproject.com': 'node-ssp-magnite',
  'pubmatic.com': 'node-ssp-pubmatic',
  'openx.com': 'node-ssp-openx',
  'indexexchange.com': 'node-ssp-index',
  'adform.net': 'node-ssp-adform',
  'smartadserver.com': 'node-ssp-smartadserver',
  'themoneytizer.com': 'node-ssp-moneytizer',
  'admanmedia.com': 'node-ssp-adman',
  'yieldmo.com': 'node-ssp-yieldmo',

  /* DSPs */
  'ttd.com': 'node-dsp-ttd',
  'doubleclick.com': 'node-dsp-dv360',
  'amazon.com': 'node-dsp-amazon',
  'criteo.com': 'node-dsp-criteo',
  'casalemedia.com': 'node-dsp-casale',
  'sharethrough.com': 'node-dsp-sharethrough',
  'smaato.net': 'node-dsp-smaato',

  /* Ad servers */
  'doubleclick.net': 'node-adserver-gam',
  'ad-server.example': 'node-adserver-mock',

  /* Verification */
  'adsafeprotected.com': 'node-verification-ias',
};

/** Stable, deterministic slug id derived from a domain. */
export function nodeIdFromDomain(domain: string): string {
  const known = DOMAIN_TO_ID[domain];
  if (known) return known;
  const slug = domain.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `node-${slug}`;
}

/* -------------------------------------------------------------------------- */
/* Fetching                                                                    */
/* -------------------------------------------------------------------------- */

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export async function fetchSellersJson(url: string, fetchImpl: FetchLike): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* Build                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Fetches every canonical SSP, sanitises the entries, and merges them into the
 * curated seed. Seed nodes always win on id collision so human-written copy
 * (and the `category` / `isOptional` flags the seed carries) is never lost.
 */
export async function buildEcosystemNodes(
  fetchImpl: FetchLike,
  ssps: ReadonlyArray<{ name: string; url: string }> = CANONICAL_SSPS,
): Promise<{ nodes: EcosystemNode[]; warnings: string[] }> {
  const byId = new Map<string, EcosystemNode>();
  for (const node of CURATED_ECOSYSTEM_NODES) {
    byId.set(node.id, { ...node });
  }

  const warnings: string[] = [];

  for (const ssp of ssps) {
    try {
      const payload = await fetchSellersJson(ssp.url, fetchImpl);
      const sellers = parseSellersFile(payload);
      // Deterministic slice: sort by domain so the retained set is stable across
      // runs regardless of upstream ordering, then cap it.
      const candidates = [...sellers].sort((a, b) => a.domain.localeCompare(b.domain));

      let added = 0;
      for (const seller of candidates) {
        if (added >= MAX_NODES_PER_SOURCE) break;
        const id = nodeIdFromDomain(seller.domain);
        if (byId.has(id)) continue; // curated copy takes precedence
        byId.set(id, {
          id,
          name: seller.name,
          category: seller.seller_type === 'PUBLISHER' ? 'publisher' : 'ssp',
          domain: seller.domain,
          sellerType: seller.seller_type,
          description: `Discovered from the ${ssp.name} sellers.json transparency file (IAB Tech Lab).`,
          sourceSsp: ssp.name,
        });
        added += 1;
      }
      console.log(
        `  ✅ ${ssp.name}: ${sellers.length} sellers parsed, ${added} new nodes added.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${ssp.name}: ${message}`);
      console.warn(`  ⚠️  ${ssp.name} unavailable (${message}) — continuing with curated seed.`);
    }
  }

  // Deterministic output ordering: category, then name.
  const nodes = [...byId.values()].sort((a, b) =>
    a.category === b.category ? a.name.localeCompare(b.name) : a.category.localeCompare(b.category),
  );

  return { nodes, warnings };
}

export async function runETL(options: { offline?: boolean } = {}): Promise<void> {
  console.log('🔄 Starting sellers.json ETL pipeline…');

  const offline = options.offline ?? process.argv.includes('--offline');

  let nodes: EcosystemNode[];
  let warnings: string[] = [];

  if (offline) {
    console.log('  ℹ️  --offline flag set — using curated seed only.');
    nodes = CURATED_ECOSYSTEM_NODES.map((n) => ({ ...n }));
  } else {
    ({ nodes, warnings } = await buildEcosystemNodes(fetch));
  }

  const serialised = `${JSON.stringify(nodes, null, 2)}\n`;
  const byteLength = Buffer.byteLength(serialised, 'utf8');

  if (byteLength > MAX_OUTPUT_BYTES) {
    throw new Error(
      `Output budget exceeded: ${byteLength} bytes > ${MAX_OUTPUT_BYTES} bytes (400 KB). ` +
        'Reduce CANONICAL_SSPS or the per-SSP cap.',
    );
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, serialised, 'utf8');

  console.log(`✅ Wrote ${nodes.length} ecosystem nodes to ${OUTPUT_PATH}`);
  console.log(`   Size: ${(byteLength / 1024).toFixed(1)} KB (budget 400 KB)`);
  if (warnings.length > 0) {
    console.log(`   ${warnings.length} source(s) degraded — curated seed preserved the output.`);
  }
  console.log('✨ ETL complete: canonical nodes scrubbed of PII and bundled.');
}

// Only run when invoked directly (`npx tsx scripts/fetch-sellers.ts`), not on import.
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  runETL()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error('❌ ETL failed:', err);
      process.exit(1);
    });
}