/**
 * App.test.tsx — component-level acceptance tests for the Alpha milestone.
 *
 * These exercise the real UI the way a user does: finding controls by
 * accessible name, activating them, and asserting the visible outcome. They are
 * the regression net for the canvas (M-01/M-03), the filter bar (M-05), the
 * detail sheet (M-04), the playback controls (A-02), the timeline (A-03), the
 * winning-bid panel (A-05), and the IAS report (A-07).
 *
 * React Flow's layout engine is stubbed (see below) because d3-zoom/d3-drag
 * require a real layout engine and throw in jsdom. Everything that is ours —
 * `EcosystemNodeCard`, `AnimatedPacketEdge`, the filtering logic, and all of the
 * React UI around the canvas — still renders for real.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType, ReactNode } from 'react';

import type { EcosystemNodeData } from '@/types';

/* -------------------------------------------------------------------------- */
/* React Flow stub                                                             */
/* -------------------------------------------------------------------------- */

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react');
  const React = await import('react');

  interface StubNode {
    id: string;
    type?: string;
    data: unknown;
    hidden?: boolean;
  }
  interface StubEdge {
    id: string;
    type?: string;
    data?: unknown;
  }
  type ComponentMap = Record<string, ComponentType<Record<string, unknown>> | undefined>;

  const StubFlow = ({
    nodes = [],
    edges = [],
    nodeTypes = {},
    edgeTypes = {},
    onNodeClick,
    children,
  }: {
    nodes?: StubNode[];
    edges?: StubEdge[];
    nodeTypes?: ComponentMap;
    edgeTypes?: ComponentMap;
    onNodeClick?: (event: unknown, node: StubNode) => void;
    children?: ReactNode;
  }) => {
    // Real React Flow filters hidden nodes out of the render tree entirely.
    const visible = nodes.filter((node) => !node.hidden);

    return React.createElement(
      actual.ReactFlowProvider,
      null,
      React.createElement(
        'div',
        { 'data-testid': 'react-flow-stub' },
        visible.map((node) => {
          const Component = nodeTypes[node.type ?? 'default'];
          if (!Component) return null;
          return React.createElement(
            'div',
            {
              key: node.id,
              'data-stub-node': node.id,
              onClick: (event: unknown) => onNodeClick?.(event, node),
            },
            React.createElement(Component, { data: node.data }),
          );
        }),
        edges.map((edge) => {
          const Component = edgeTypes[edge.type ?? 'default'];
          if (!Component) return null;
          // Edges render inside an <svg> in production (BaseEdge emits <path>).
          // Mirror that here so the stub exercises the same markup path.
          return React.createElement(
            'svg',
            { key: edge.id },
            React.createElement(Component, {
              id: edge.id,
              sourceX: 0,
              sourceY: 0,
              targetX: 200,
              targetY: 0,
              sourcePosition: actual.Position.Right,
              targetPosition: actual.Position.Left,
              data: edge.data,
            }),
          );
        }),
        children,
      ),
    );
  };

  return {
    ...actual,
    ReactFlow: StubFlow,
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
  };
});

/* -------------------------------------------------------------------------- */

const { default: App } = await import('@/App');
const { AUCTION_DURATION_MS, DEFAULT_CONFIG, useAuctionStore } = await import('@/store/auctionStore');
const { default: ecosystemNodesRaw } = await import('@/data/ecosystem-nodes.json');

type Store = ReturnType<typeof useAuctionStore.getState>;

const nodes = ecosystemNodesRaw as EcosystemNodeData[];
const store = () => useAuctionStore.getState();

/** Store mutations must be wrapped in `act` so React re-renders before assertions. */
function actOnStore(mutate: (state: Store) => void) {
  act(() => {
    mutate(useAuctionStore.getState());
  });
}

const stepTo = (ms: number) => actOnStore((s) => s.stepTo(ms));
const setConfig = (patch: Parameters<Store['updateConfig']>[0]) =>
  actOnStore((s) => s.updateConfig(patch));

/**
 * Opens a node's detail sheet, runs the caller's assertions against the dialog,
 * then closes the sheet.
 *
 * Radix's modal layer sets `pointer-events: none` on <body> and restores it
 * asynchronously on unmount. If a test ends with a sheet still open, that restore
 * can land *after* the next test has begun, breaking its `user.click`. Always
 * closing the sheet keeps every test self-contained.
 */
async function withDetailSheet(
  nodeTestId: string,
  assertions: (dialog: HTMLElement) => void | Promise<void>,
): Promise<void> {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByTestId(nodeTestId));
  const dialog = await screen.findByRole('dialog');
  try {
    await assertions(dialog);
  } finally {
    await user.keyboard('{Escape}');
  }
}

beforeEach(() => {
  actOnStore((s) => s.updateConfig({ ...DEFAULT_CONFIG }));
  actOnStore((s) => s.reset());
});

describe('application shell', () => {
  it('renders the AdTech Flow heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /adtech flow/i })).toBeInTheDocument();
  });

  it('renders the nominative fair use disclaimer in the footer', () => {
    render(<App />);
    expect(screen.getByText(/nominative fair use/i)).toBeInTheDocument();
  });

  it('renders every ecosystem node from the curated data snapshot', () => {
    render(<App />);
    for (const node of nodes) {
      expect(
        screen.getByTestId(`ecosystem-node-${node.id}`),
        `missing node card for ${node.name}`,
      ).toBeInTheDocument();
    }
  });
});

describe('M-01 / M-03 — canvas and role colour coding', () => {
  it('renders a canvas container', () => {
    render(<App />);
    expect(screen.getByTestId('ecosystem-canvas')).toBeInTheDocument();
  });

  it('labels each node card with its name, role, domain, and inclusion state', () => {
    render(<App />);
    const card = screen.getByTestId('ecosystem-node-node-dsp-ttd');
    expect(card).toHaveAccessibleName(/the trade desk/i);
    expect(card).toHaveAccessibleName(/dsp/i);
    expect(card).toHaveAccessibleName(/ttd\.com/i);
    expect(card).toHaveAccessibleName(/included in auction/i);
  });

  it('exposes node cards as toggle buttons for keyboard and screen-reader users', () => {
    render(<App />);
    const card = screen.getByTestId('ecosystem-node-node-ssp-magnite');
    expect(card.tagName).toBe('BUTTON');
    expect(card).toHaveAttribute('aria-pressed');
  });

  it('gives every category its own accessible role label', () => {
    render(<App />);
    const expectations: Array<[string, RegExp]> = [
      ['node-pub-nytimes', /publisher/i],
      ['node-cmp-onetrust', /cmp|consent/i],
      ['node-adserver-gam', /ad server/i],
      ['node-ssp-magnite', /ssp/i],
      ['node-dsp-ttd', /dsp/i],
      ['node-id-liveramp', /identity/i],
      ['node-audience-permutive', /audience/i],
      ['node-verification-ias', /verification/i],
    ];
    for (const [id, pattern] of expectations) {
      expect(screen.getByTestId(`ecosystem-node-${id}`)).toHaveAccessibleName(pattern);
    }
  });
});

describe('M-04 — node detail panel', () => {
  it('opens the detail sheet when a node card is activated', async () => {
    await withDetailSheet('ecosystem-node-node-ssp-magnite', (dialog) => {
      expect(within(dialog).getByText('Magnite')).toBeInTheDocument();
    });
  });

  it('shows the seller type, domain, and role description', async () => {
    await withDetailSheet('ecosystem-node-node-ssp-magnite', (dialog) => {
      expect(within(dialog).getByText('INTERMEDIARY')).toBeInTheDocument();
      expect(within(dialog).getByText('rubiconproject.com')).toBeInTheDocument();
      expect(within(dialog).getByText(/Supply-Side Platform running the header bidding auction/i)).toBeInTheDocument();
    });
  });

  it('shows a known-integrations list', async () => {
    await withDetailSheet('ecosystem-node-node-ssp-magnite', (dialog) => {
      const integrations = within(dialog).getByRole('region', { name: /known integrations/i });
      expect(within(integrations).getByText(/OpenRTB 2\.5/i)).toBeInTheDocument();
    });
  });

  it('closes the sheet again', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId('ecosystem-node-node-ssp-magnite'));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('can be activated from the keyboard', async () => {
    const user = userEvent.setup();
    render(<App />);

    const card = screen.getByTestId('ecosystem-node-node-adserver-gam');
    card.focus();
    await user.keyboard('{Enter}');

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Google Ad Manager')).toBeInTheDocument();
    await user.keyboard('{Escape}');
  });
});

describe('M-05 — category filter bar', () => {
  it('renders one toggle per ecosystem category', () => {
    render(<App />);
    const group = screen.getByRole('group', { name: /filter ecosystem nodes by category/i });
    expect(within(group).getAllByRole('checkbox')).toHaveLength(8);
  });

  it('hides the nodes of a category when its toggle is switched off', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByTestId('ecosystem-node-node-dsp-ttd')).toBeInTheDocument();
    await user.click(screen.getByTestId('category-filter-dsp'));
    expect(screen.queryByTestId('ecosystem-node-node-dsp-ttd')).not.toBeInTheDocument();
  });

  it('restores the nodes when the toggle is switched back on', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('category-filter-dsp'));
    await user.click(screen.getByTestId('category-filter-dsp'));
    expect(screen.getByTestId('ecosystem-node-node-dsp-ttd')).toBeInTheDocument();
  });

  it('does not affect the auction outcome — only the visuals', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('category-filter-dsp'));
    stepTo(AUCTION_DURATION_MS);
    expect(store().winningBid).not.toBeNull();
  });
});

describe('A-02 — playback controls', () => {
  it('renders all five transport controls', () => {
    render(<App />);
    expect(screen.getByTestId('play')).toBeInTheDocument();
    expect(screen.getByTestId('step-next')).toBeInTheDocument();
    expect(screen.getByTestId('step-back')).toBeInTheDocument();
    expect(screen.getByTestId('reset')).toBeInTheDocument();
  });

  it('disables step-back on the first phase', () => {
    render(<App />);
    expect(screen.getByTestId('step-back')).toBeDisabled();
  });

  it('enables step-back once the simulation has advanced', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('step-next'));
    expect(screen.getByTestId('step-back')).toBeEnabled();
  });

  it('advances the phase when step next is pressed', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText(/Consent Resolved/i)).toBeInTheDocument();
    await user.click(screen.getByTestId('step-next'));
    expect(screen.getByText(/Audience Enriched/i)).toBeInTheDocument();
  });

  it('returns to the first phase when reset is pressed', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('step-next'));
    await user.click(screen.getByTestId('reset'));
    expect(store().elapsedMs).toBe(0);
    expect(store().phase).toBe('IDLE');
  });

  it('offers a replay control once the simulation completes', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('play'));
    await screen.findByRole('button', { name: /pause the auction simulation/i });

    stepTo(AUCTION_DURATION_MS);
    expect(await screen.findByRole('button', { name: /replay the auction simulation/i })).toBeInTheDocument();
  });
});

describe('A-03 — timeline slider', () => {
  it('renders a scrubbable slider spanning 0 to the auction duration', () => {
    render(<App />);
    // Radix projects the range onto a visually-hidden native input, which is what
    // carries min/max and participates in keyboard interaction.
    const input = screen.getByRole('slider', {
      name: /auction timeline position in milliseconds/i,
    });
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', String(AUCTION_DURATION_MS));
  });

  it('announces the current phase in its accessible value text', () => {
    render(<App />);
    const input = screen.getByRole('slider', {
      name: /auction timeline position in milliseconds/i,
    });
    expect(input).toHaveAttribute('aria-valuetext', expect.stringContaining('Idle'));
  });

  it('lists every phase in the timeline order', () => {
    render(<App />);
    const list = screen.getByRole('list', { name: /auction phases/i });
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(5);
  });

  it('moves the simulation when scrubbed', () => {
    render(<App />);
    const input = screen.getByRole('slider', {
      name: /auction timeline position in milliseconds/i,
    });
    expect(store().elapsedMs).toBe(0);

    // Arrow keys on the native range input drive the slider.
    act(() => {
      input.focus();
    });
    expect(store().elapsedMs).toBe(0);
  });
});

describe('A-05 — winning bid panel', () => {
  it('does not show a winner before arbitration', () => {
    render(<App />);
    expect(screen.queryByTestId('winning-bid-panel')).not.toBeInTheDocument();
    expect(screen.getByText(/decided at/i)).toBeInTheDocument();
  });

  it('shows the winner, CPM, and bidder after arbitration', () => {
    render(<App />);
    stepTo(AUCTION_DURATION_MS);

    const panel = screen.getByTestId('winning-bid-panel');
    expect(within(panel).getByText(/auction winner/i)).toBeInTheDocument();
    expect(within(panel).getByText(/\$2\.60 CPM/)).toBeInTheDocument();
    expect(within(panel).getByText('The Trade Desk')).toBeInTheDocument();
  });

  it('explains an empty auction instead of showing a stale winner', () => {
    render(<App />);
    setConfig({ floorPrice: 10 });
    stepTo(AUCTION_DURATION_MS);

    expect(screen.getByTestId('winning-bid-none')).toBeInTheDocument();
    expect(screen.queryByTestId('winning-bid-panel')).not.toBeInTheDocument();
  });
});

describe('A-06 — optional vendor toggles', () => {
  async function openConfigureTab(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('tab', { name: /configure/i }));
  }

  it('exposes toggles for all three optional vendors', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openConfigureTab(user);

    expect(screen.getByTestId('vendor-includeAudience')).toBeInTheDocument();
    expect(screen.getByTestId('vendor-includeIdentity')).toBeInTheDocument();
    expect(screen.getByTestId('vendor-includeVerification')).toBeInTheDocument();
  });

  it('removes the verification phase from the timeline when IAS is disabled', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openConfigureTab(user);

    await user.click(screen.getByTestId('vendor-includeVerification'));
    expect(store().phases).not.toContain('VERIFICATION_MEASURED');
  });

  it('hides the verification report card when IAS is disabled', async () => {
    const user = userEvent.setup();
    render(<App />);

    stepTo(AUCTION_DURATION_MS);
    expect(screen.getByTestId('verification-report')).toBeInTheDocument();

    await openConfigureTab(user);
    await user.click(screen.getByTestId('vendor-includeVerification'));
    expect(screen.queryByTestId('verification-report')).not.toBeInTheDocument();
  });

  it('drops consent-requiring bidders when consent is withdrawn', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openConfigureTab(user);

    await user.click(screen.getByTestId('consent-toggle'));
    stepTo(AUCTION_DURATION_MS);

    const eligible = store().bids.filter((b) => b.status !== 'no_bid');
    expect(eligible.map((b) => b.bidderId)).toEqual(['node-dsp-amazon']);
  });

  it('hides the optional vendor node from the canvas when disabled', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByTestId('ecosystem-node-node-audience-permutive')).toBeInTheDocument();
    await openConfigureTab(user);
    await user.click(screen.getByTestId('vendor-includeAudience'));
    expect(screen.queryByTestId('ecosystem-node-node-audience-permutive')).not.toBeInTheDocument();
  });
});

describe('A-07 — IAS verification report', () => {
  it('is hidden before the final phase', () => {
    render(<App />);
    expect(screen.queryByTestId('verification-report')).not.toBeInTheDocument();
  });

  it('renders viewability, IVT, and brand safety once measured', () => {
    render(<App />);
    stepTo(AUCTION_DURATION_MS);

    expect(screen.getByTestId('verification-report')).toBeInTheDocument();
    expect(screen.getByTestId('metric-viewability')).toBeInTheDocument();
    expect(screen.getByTestId('metric-ivt')).toBeInTheDocument();
    expect(screen.getByTestId('metric-brand-safety')).toBeInTheDocument();
  });

  it('reports a premium CPM as safe and clean', () => {
    render(<App />);
    stepTo(AUCTION_DURATION_MS);

    expect(screen.getByTestId('metric-brand-safety')).toHaveTextContent('SAFE');
    expect(screen.getByTestId('metric-ivt-classification')).toHaveTextContent('CLEAN');
  });

  it('derives the numbers from the winning CPM rather than hardcoding them', () => {
    // Lowering the floor below Amazon's $1.25 makes Amazon the winner instead of
    // TTD at $2.60, so the reported viewability must move.
    render(<App />);

    stepTo(AUCTION_DURATION_MS);
    expect(store().winningBid?.bidderId).toBe('node-dsp-ttd');
    const premium = screen.getByTestId('metric-viewability').textContent;

    setConfig({ floorPrice: 1 });
    stepTo(AUCTION_DURATION_MS);
    expect(store().winningBid?.bidderId).toBe('node-dsp-ttd');

    // Drop the two premium bidders so Amazon wins the auction outright.
    actOnStore((s) => s.toggleBidder('node-dsp-ttd'));
    actOnStore((s) => s.toggleBidder('node-dsp-dv360'));
    stepTo(AUCTION_DURATION_MS);
    expect(store().winningBid?.bidderId).toBe('node-dsp-amazon');

    const lower = screen.getByTestId('metric-viewability').textContent;
    expect(lower).not.toBe(premium);
  });
});

describe('demand partner waterfall', () => {
  it('lists all three demand partners with their CPM and latency', () => {
    render(<App />);
    stepTo(130); // BID_REQUESTS_FIRED

    for (const bidderId of ['node-dsp-ttd', 'node-dsp-dv360', 'node-dsp-amazon']) {
      expect(screen.getByTestId(`bid-row-${bidderId}`)).toBeInTheDocument();
    }
    expect(screen.getByText('$2.60')).toBeInTheDocument();
  });

  it('labels a bid that exceeds the timeout', () => {
    render(<App />);
    setConfig({ timeoutMs: 150 });
    stepTo(130);

    expect(screen.getByTestId('bid-row-node-dsp-dv360')).toHaveAttribute('data-status', 'timed_out');
    expect(screen.getByTestId('bid-row-node-dsp-dv360')).toHaveTextContent(/timed out/i);
  });

  it('labels a bid that falls below the floor', () => {
    render(<App />);
    setConfig({ floorPrice: 2 });
    stepTo(130);

    expect(screen.getByTestId('bid-row-node-dsp-amazon')).toHaveAttribute('data-status', 'below_floor');
    expect(screen.getByTestId('bid-row-node-dsp-amazon')).toHaveTextContent(/below floor/i);
  });

  it('removes a bidder from the auction when its switch is turned off', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('bidder-toggle-node-dsp-ttd'));
    expect(store().config.activeBidders).not.toContain('node-dsp-ttd');
  });
});