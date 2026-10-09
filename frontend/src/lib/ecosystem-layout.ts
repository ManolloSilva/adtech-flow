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

const COLUMN = 260;
const ROW = 130;

/** Column assignment per category. */
const COLUMN_INDEX: Record<string, number> = {
  publisher: 0,
  cmp: 1,
  audience: 1,
  identity: 1,
  ssp: 2,
  dsp: 3,
  adserver: 4,
  verification: 4,
};

/** Vertical offset per node so same-column nodes stack cleanly. */
const ROW_OFFSET: Record<string, number> = {
  'node-pub-nytimes': 1,
  'node-cmp-onetrust': -1.2,
  'node-audience-permutive': 0,
  'node-id-liveramp': 0.6,
  'node-id-sharedid': 1.4,
  'node-adserver-gam': 0.4,
  'node-verification-ias': 1.6,
};

/**
 * Computes a deterministic position for every node.
 * Grouped by category column, then ordered by id within the column for stability.
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
    bucket.sort((a, b) => a.id.localeCompare(b.id));

    bucket.forEach((node, index) => {
      const baseRow = index - (bucket.length - 1) / 2;
      const offset = ROW_OFFSET[node.id] ?? 0;
      positions.push({
        id: node.id,
        x: column * COLUMN,
        y: (baseRow + offset) * ROW,
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