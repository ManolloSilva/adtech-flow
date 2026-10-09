/**
 * EcosystemCanvas.tsx — the interactive React Flow canvas (BACKLOG M-01, M-03, A-04).
 *
 * Responsibilities:
 *  - Render ecosystem nodes from `ecosystem-nodes.json` at deterministic positions.
 *  - Draw the static supply-chain edges.
 *  - Overlay animated packets for the current auction phase.
 *  - Reflect bid status on DSP node cards (timed out / below floor / winner).
 *  - Apply the category filter (M-05) and optional-vendor toggles (A-06).
 */

import { useCallback, useMemo } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
} from '@xyflow/react';

import { AnimatedPacketEdge, type AnimatedPacketEdgeData } from './AnimatedPacketEdge';
import { EcosystemNodeCard, type EcosystemNodeCardData } from './EcosystemNodeCard';
import { ECOSYSTEM_EDGES, computeLayout } from '@/lib/ecosystem-layout';
import { roleStyle } from '@/lib/roleStyles';
import { cn } from '@/lib/utils';
import type { AuctionConfig, BidderResult, EcosystemNodeData, Packet } from '@/types';

const nodeTypes: NodeTypes = { ecosystem: EcosystemNodeCard };
const edgeTypes = { packet: AnimatedPacketEdge };

export interface EcosystemCanvasProps {
  /** Curated ecosystem entities; view state (`isActive`/`isSelected`) is derived here. */
  nodes: EcosystemNodeData[];
  config: AuctionConfig;
  bids: BidderResult[];
  packets: Packet[];
  visibleCategories: Record<string, boolean>;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  className?: string;
}

interface BidVisual {
  statusLabel?: string;
  statusTone?: EcosystemNodeCardData['statusTone'];
}

/** Maps a DSP's bid status to a compact badge on its node card (design-system §3). */
function bidVisual(bid: BidderResult | undefined): BidVisual {
  if (!bid) return {};
  switch (bid.status) {
    case 'won':
      return { statusLabel: 'Winner', statusTone: 'win' };
    case 'timed_out':
      return { statusLabel: 'Timed out', statusTone: 'danger' };
    case 'below_floor':
      return { statusLabel: 'Below floor', statusTone: 'warning' };
    case 'no_bid':
      return { statusLabel: 'No bid', statusTone: 'neutral' };
    default:
      return {};
  }
}

export function EcosystemCanvas({
  nodes,
  config,
  bids,
  packets,
  visibleCategories,
  selectedNodeId,
  onSelectNode,
  className,
}: EcosystemCanvasProps) {
  const layout = useMemo(() => computeLayout(nodes), [nodes]);
  const positionById = useMemo(
    () => new Map(layout.map((p) => [p.id, p])),
    [layout],
  );
  const bidById = useMemo(() => new Map(bids.map((b) => [b.bidderId, b])), [bids]);

  const visibleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const node of nodes) {
      if (visibleCategories[node.category] === false) continue;
      // Optional vendors are hidden entirely when disabled (A-06).
      if (node.isOptional) {
        if (node.category === 'audience' && !config.includeAudience) continue;
        if (node.category === 'identity' && !config.includeIdentity) continue;
        if (node.category === 'verification' && !config.includeVerification) continue;
      }
      ids.add(node.id);
    }
    return ids;
  }, [nodes, visibleCategories, config]);

  const flowNodes = useMemo<Node[]>(
    () =>
      nodes.map((node) => {
        const position = positionById.get(node.id) ?? { x: 0, y: 0 };
        const bid = bidById.get(node.id);
        const visual = bidVisual(bid);
        return {
          id: node.id,
          type: 'ecosystem',
          position,
          data: {
            ...node,
            isActive: visibleIds.has(node.id),
            isSelected: selectedNodeId === node.id,
            ...visual,
          } satisfies EcosystemNodeCardData,
          hidden: !visibleIds.has(node.id),
        };
      }),
    [nodes, positionById, bidById, visibleIds, selectedNodeId],
  );

  /**
   * Groups in-flight packets by the edge they travel along.
   *
   * Packets render for the current phase regardless of playback state: someone
   * stepping through the auction manually should still see the bid pulses, not
   * only someone who pressed Play.
   */
  const packetsByEdge = useMemo(() => {
    const map = new Map<string, Packet[]>();

    for (const packet of packets) {
      const edge = ECOSYSTEM_EDGES.find(
        (e) => e.source === packet.source && e.target === packet.target,
      );
      if (!edge) continue;
      const bucket = map.get(edge.id) ?? [];
      bucket.push(packet);
      map.set(edge.id, bucket);
    }
    return map;
  }, [packets]);

  const flowEdges = useMemo<Edge<AnimatedPacketEdgeData>[]>(
    () =>
      ECOSYSTEM_EDGES.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'packet',
        label: edge.label,
        labelStyle: { fill: '#64748b', fontSize: 9 },
        labelBgStyle: { fill: 'transparent' },
        data: {
          packets: packetsByEdge.get(edge.id) ?? [],
          isDimmed: !visibleIds.has(edge.source) || !visibleIds.has(edge.target),
        } satisfies AnimatedPacketEdgeData,
      })),
    [packetsByEdge, visibleIds],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onSelectNode(node.id === selectedNodeId ? null : node.id);
    },
    [onSelectNode, selectedNodeId],
  );

  return (
    <div
      className={cn(
        'h-full w-full overflow-hidden rounded-xl border bg-slate-950',
        className,
      )}
      data-testid="ecosystem-canvas"
    >
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={() => onSelectNode(null)}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.25}
        maxZoom={1.75}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        // React Flow's own node wrapper is not keyboard-navigable, so the inner
        // <button> in EcosystemNodeCard carries focus + aria semantics instead.
        nodesFocusable={false}
        edgesFocusable={false}
      >
        <Background color="#1e293b" gap={18} size={1} />
        <Controls showInteractive={false} className="!bg-slate-800 !border-slate-700 !fill-slate-300" />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            // MiniMap types `node.data` as a loose record; narrow it to our payload.
            const data = node.data as unknown as EcosystemNodeCardData;
            return roleStyle(data.category).hex;
          }}
          maskColor="rgb(2 6 23 / 0.7)"
          className="!bg-slate-900 !border-slate-700"
        />
      </ReactFlow>
    </div>
  );
}