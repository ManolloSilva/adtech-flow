/**
 * ecosystem-layout.ts — canvas layout for the ecosystem map.
 *
 * Nodes are arranged left-to-right along the supply path so the auction reads
 * as a flow: Publisher → CMP / Audience / Identity → SSP → DSP → Ad Server.
 * Positions are deterministic (no dagre/auto-layout dependency) which keeps the
 * canvas stable and the snapshots reproducible.
 */

import type { EcosystemNodeData } from '@/types';

export interface NodePosition {
  id: string;
  x: number;
  y: number;
}

/** Horizontal spacing between supply-chain columns, in canvas units. */
export const COLUMN_SPACING = 260;
/** Vertical spacing between nodes within a column, in canvas units. */
export const ROW_SPACING = 130;

const COLUMN = COLUMN_SPACING;
const ROW = ROW_SPACING;

/** Column assignment per category. */
export const COLUMN_INDEX: Record<string, number> = {
  publisher: 0,
  cmp: 1,
  audience: 1,
  identity: 1,
  ssp: 2,
  dsp: 3,
  adserver: 4,
  verification: 4,
};

/**
 * Intra-column ordering.
 *
 * Nodes within a column are listed in reading order so the supply chain reads
 * top-to-bottom consistently. Previously this was expressed as per-node pixel
 * `ROW_OFFSET`s, which silently stacked OneTrust on top of Usercentrics whenever
 * the two landed adjacent — the layout must not depend on a node's index
 * matching a hardcoded constant.
 */
const COLUMN_ORDER: Record<string, string[]> = {
  publisher: ['node-pub-nytimes', 'node-pub-cnn', 'node-pub-guardian'],
  cmp: ['node-cmp-onetrust', 'node-cmp-cookiebot', 'node-cmp-quantcast'],
  audience: ['node-audience-permutive'],
  identity: ['node-id-liveramp', 'node-id-sharedid'],
  adserver: ['node-adserver-gam', 'node-adserver-mock'],
  verification: ['node-verification-ias'],
};

/**
 * Computes a deterministic, overlap-free position for every node.
 *
 * Each column is laid out as an evenly spaced stack, so no two nodes can ever
 * collide regardless of how many categories share the column or how many nodes
 * are present.
 */
export function computeLayout(nodes: EcosystemNodeData[]): NodePosition[] {
  const byColumn = new Map<number, EcosystemNodeData[]>();

  for (const node of nodes) {
    const column = COLUMN_INDEX[node.category] ?? 0;
    const bucket = byColumn.get(column) ?? [];
    bucket.push(node);
    byColumn.set(column, bucket);
  }

  const positions: NodePosition[] = [];

  for (const [column, bucket] of [...byColumn.entries()].sort((a, b) => a[0] - b[0])) {
    // Known nodes first, in curated order. Iterate each *category* once (not each
    // node) so a category's list is not repeated for every node it contains.
    const presentIds = new Set(bucket.map((n) => n.id));
    const seen = new Set<string>();
    const order: EcosystemNodeData[] = [];

    for (const node of bucket) {
      for (const id of COLUMN_ORDER[node.category] ?? []) {
        if (presentIds.has(id) && !seen.has(id)) {
          seen.add(id);
          order.push(bucket.find((n) => n.id === id)!);
        }
      }
    }

    // Anything the curated order does not know about sorts after, alphabetically,
    // so the layout stays deterministic as the ETL discovers new entities.
    const remaining = bucket
      .filter((n) => !seen.has(n.id))
      .sort((a, b) => a.id.localeCompare(b.id));

    const ordered = [...order, ...remaining];

    ordered.forEach((node, index) => {
      const row = index - (ordered.length - 1) / 2;
      positions.push({
        id: node.id,
        x: column * COLUMN,
        y: row * ROW,
      });
    });
  }

  return positions;
}

/** Static supply-chain edges drawn on the canvas (BACKLOG M-01). */
export const ECOSYSTEM_EDGES: ReadonlyArray<{ id: string; source: string; target: string; label: string }> = [
  { id: 'e-pub-cmp', source: 'node-pub-nytimes', target: 'node-cmp-onetrust', label: 'consent' },
  { id: 'e-cmp-pub', source: 'node-cmp-onetrust', target: 'node-pub-nytimes', label: 'TCF string' },
  { id: 'e-pub-aud', source: 'node-pub-nytimes', target: 'node-audience-permutive', label: 'cohorts' },
  { id: 'e-pub-id', source: 'node-pub-nytimes', target: 'node-id-liveramp', label: 'euid' },
  { id: 'e-pub-ssp-mag', source: 'node-pub-nytimes', target: 'node-ssp-magnite', label: 'prebid' },
  { id: 'e-pub-ssp-pub', source: 'node-pub-nytimes', target: 'node-ssp-pubmatic', label: 'prebid' },
  { id: 'e-pub-ssp-openx', source: 'node-pub-nytimes', target: 'node-ssp-openx', label: 'prebid' },
  { id: 'e-mag-ttd', source: 'node-ssp-magnite', target: 'node-dsp-ttd', label: 'bid req' },
  { id: 'e-pubmatic-dv', source: 'node-ssp-pubmatic', target: 'node-dsp-dv360', label: 'bid req' },
  { id: 'e-openx-amz', source: 'node-ssp-openx', target: 'node-dsp-amazon', label: 'bid req' },
  { id: 'e-ssp-gam', source: 'node-ssp-magnite', target: 'node-adserver-gam', label: 'hb_pb' },
  { id: 'e-pubmatic-gam', source: 'node-ssp-pubmatic', target: 'node-adserver-gam', label: 'hb_pb' },
  { id: 'e-openx-gam', source: 'node-ssp-openx', target: 'node-adserver-gam', label: 'hb_pb' },
  { id: 'e-gam-pub', source: 'node-adserver-gam', target: 'node-pub-nytimes', label: 'render' },
  { id: 'e-ias-pub', source: 'node-verification-ias', target: 'node-pub-nytimes', label: 'measure' },
];