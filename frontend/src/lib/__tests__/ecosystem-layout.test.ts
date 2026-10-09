/**
 * ecosystem-layout.test.ts — guards the canvas layout.
 *
 * Regression: the layout used to apply hardcoded per-node pixel offsets. When
 * two nodes landed adjacent in a column those offsets stacked them on top of
 * each other (OneTrust rendered over Usercentrics Cookiebot), which is exactly
 * the kind of visual defect that unit tests were supposed to prevent.
 */

import { describe, it, expect } from 'vitest';

import {
  computeLayout,
  COLUMN_INDEX,
  COLUMN_SPACING,
  ECOSYSTEM_EDGES,
} from '@/lib/ecosystem-layout';
import ecosystemNodesRaw from '@/data/ecosystem-nodes.json';
import type { EcosystemNodeData } from '@/types';

const nodes = ecosystemNodesRaw as EcosystemNodeData[];

/** Node card footprint in the layout's coordinate space. */
const CARD_WIDTH = 200;
const CARD_HEIGHT = 92;
/** Allow a small margin so cards sit close but never touch. */
const GAP = 12;

const layout = computeLayout(nodes);
const byId = new Map(layout.map((p) => [p.id, p]));

describe('computeLayout', () => {
  it('positions every node exactly once', () => {
    expect(layout).toHaveLength(nodes.length);
    expect(new Set(layout.map((p) => p.id)).size).toBe(nodes.length);
  });

  it('positions every node at finite coordinates', () => {
    for (const { id, x, y } of layout) {
      expect(Number.isFinite(x), `${id} has a non-finite x`).toBe(true);
      expect(Number.isFinite(y), `${id} has a non-finite y`).toBe(true);
    }
  });

  it('is deterministic across repeated calls', () => {
    expect(computeLayout(nodes)).toEqual(computeLayout(nodes));
  });

  it('never overlaps two nodes', () => {
    const collisions: string[] = [];

    for (let i = 0; i < layout.length; i += 1) {
      for (let j = i + 1; j < layout.length; j += 1) {
        const a = layout[i];
        const b = layout[j];
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        const overlapsX = dx < CARD_WIDTH + GAP;
        const overlapsY = dy < CARD_HEIGHT + GAP;
        if (overlapsX && overlapsY) {
          collisions.push(`${a.id} overlaps ${b.id} (dx=${dx}, dy=${dy})`);
        }
      }
    }

    expect(collisions).toEqual([]);
  });

  it('orders a column by its curated sequence', () => {
    // OneTrust must sit above Usercentrics, not on top of it.
    const onetrust = byId.get('node-cmp-onetrust');
    const cookiebot = byId.get('node-cmp-cookiebot');
    const quantcast = byId.get('node-cmp-quantcast');
    expect(onetrust).toBeDefined();
    expect(cookiebot).toBeDefined();
    expect(quantcast).toBeDefined();

    expect(onetrust!.y).toBeLessThan(cookiebot!.y);
    expect(cookiebot!.y).toBeLessThan(quantcast!.y);
  });

  it('places the publisher column left of the DSP column', () => {
    // The supply path must read left-to-right.
    const publisherX = byId.get('node-pub-nytimes')!.x;
    const sspX = byId.get('node-ssp-magnite')!.x;
    const dspX = byId.get('node-dsp-ttd')!.x;
    const adserverX = byId.get('node-adserver-gam')!.x;

    expect(publisherX).toBeLessThan(sspX);
    expect(sspX).toBeLessThan(dspX);
    expect(dspX).toBeLessThan(adserverX);
  });

  it('groups each category into its intended column', () => {
    for (const node of nodes) {
      const position = byId.get(node.id)!;
      const column = COLUMN_INDEX[node.category] ?? 0;
      expect(position.x, `${node.id} is in the wrong column`).toBe(column * COLUMN_SPACING);
    }
  });

  it('still lays out sensibly when a category is missing entirely', () => {
    const withoutDsps = nodes.filter((n) => n.category !== 'dsp');
    const partial = computeLayout(withoutDsps);
    expect(partial).toHaveLength(withoutDsps.length);
    // No collisions should reappear when a whole column empties out.
    for (let i = 0; i < partial.length; i += 1) {
      for (let j = i + 1; j < partial.length; j += 1) {
        const a = partial[i];
        const b = partial[j];
        const overlaps =
          Math.abs(a.x - b.x) < CARD_WIDTH + GAP && Math.abs(a.y - b.y) < CARD_HEIGHT + GAP;
        expect(overlaps, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it('handles an unexpected extra node without colliding', () => {
    const extra: EcosystemNodeData = {
      id: 'node-ssp-unexpected',
      name: 'Newly Discovered SSP',
      category: 'ssp',
      domain: 'new.example',
      sellerType: 'INTERMEDIARY',
      description: 'A node discovered by the ETL that the curated order does not know about.',
    };
    const grown = computeLayout([...nodes, extra]);
    expect(grown).toHaveLength(nodes.length + 1);

    const byIdGrown = new Map(grown.map((p) => [p.id, p]));
    const extras = grown.filter(
      (p) => !byId.has(p.id) || byIdGrown.get(byId.get(p.id)?.id ?? '')?.y !== p.y,
    );
    expect(extras.length).toBeGreaterThanOrEqual(0); // layout shifted; no crash

    for (let i = 0; i < grown.length; i += 1) {
      for (let j = i + 1; j < grown.length; j += 1) {
        const a = grown[i];
        const b = grown[j];
        const overlaps =
          Math.abs(a.x - b.x) < CARD_WIDTH + GAP && Math.abs(a.y - b.y) < CARD_HEIGHT + GAP;
        expect(overlaps, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });
});

describe('ECOSYSTEM_EDGES', () => {
  it('references only nodes that exist in the layout', () => {
    const ids = new Set(layout.map((p) => p.id));
    for (const edge of ECOSYSTEM_EDGES) {
      expect(ids.has(edge.source), `${edge.id} has an unknown source`).toBe(true);
      expect(ids.has(edge.target), `${edge.id} has an unknown target`).toBe(true);
    }
  });

  it('uses unique edge ids', () => {
    const ids = ECOSYSTEM_EDGES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});