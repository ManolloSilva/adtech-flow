/**
 * EcosystemCanvas.tsx — the interactive React Flow canvas (BACKLOG M-01, M-03, M-06, A-04).
 *
 * Responsibilities:
 *  - Support Stage Dropdowns View (M-06, Option 1) as the clean macro pipeline.
 *  - Support Full Topology Mesh View (M-01) for detailed 28-node inspection.
 *  - Draw deterministic supply-chain edges for both views.
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
import { CategoryStageCard, type CategoryStageCardData } from './CategoryStageCard';
import { EcosystemNodeCard, type EcosystemNodeCardData } from './EcosystemNodeCard';
import {
  ECOSYSTEM_EDGES,
  STAGE_EDGES,
  STAGE_ID_BY_CATEGORY,
  STAGE_POSITIONS,
  computeLayout,
} from '@/lib/ecosystem-layout';
import { CATEGORY_ORDER, roleStyle } from '@/lib/roleStyles';
import { cn } from '@/lib/utils';
import type {
  AuctionConfig,
  BidderResult,
  CanvasViewMode,
  EcosystemNodeData,
  EntityCategory,
  Packet,
} from '@/types';

const nodeTypes: NodeTypes = {
  ecosystem: EcosystemNodeCard,
  stage: CategoryStageCard,
};

const edgeTypes = { packet: AnimatedPacketEdge };

export interface EcosystemCanvasProps {
  /** Curated ecosystem entities; view state (`isActive`/`isSelected`) is derived here. */
  nodes: EcosystemNodeData[];
  config: AuctionConfig;
  bids: BidderResult[];
  winningBid?: BidderResult | null;
  packets: Packet[];
  visibleCategories: Record<string, boolean>;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  viewMode?: CanvasViewMode;
  activeVendorByCategory?: Record<EntityCategory, string>;
  onSelectVendorForCategory?: (category: EntityCategory, vendorId: string) => void;
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
  winningBid,
  packets,
  visibleCategories,
  selectedNodeId,
  onSelectNode,
  viewMode = 'stage',
  activeVendorByCategory,
  onSelectVendorForCategory,
  className,
}: EcosystemCanvasProps) {
  /* -------------------------------------------------------------------------- */
  /* Mesh view setup (Alpha 28-node graph)                                      */
  /* -------------------------------------------------------------------------- */
  const layout = useMemo(() => computeLayout(nodes), [nodes]);
  const positionById = useMemo(
    () => new Map(layout.map((p) => [p.id, p])),
    [layout],
  );
  const bidById = useMemo(() => new Map(bids.map((b) => [b.bidderId, b])), [bids]);

  const visibleMeshIds = useMemo(() => {
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

  const meshFlowNodes = useMemo<Node[]>(
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
            isActive: visibleMeshIds.has(node.id),
            isSelected: selectedNodeId === node.id,
            ...visual,
          } satisfies EcosystemNodeCardData,
          hidden: !visibleMeshIds.has(node.id),
        };
      }),
    [nodes, positionById, bidById, visibleMeshIds, selectedNodeId],
  );

  const meshPacketsByEdge = useMemo(() => {
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

  const meshFlowEdges = useMemo<Edge<AnimatedPacketEdgeData>[]>(
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
          packets: meshPacketsByEdge.get(edge.id) ?? [],
          isDimmed: !visibleMeshIds.has(edge.source) || !visibleMeshIds.has(edge.target),
        } satisfies AnimatedPacketEdgeData,
      })),
    [meshPacketsByEdge, visibleMeshIds],
  );

  /* -------------------------------------------------------------------------- */
  /* Stage Dropdowns view setup (M-06 Option 1)                                  */
  /* -------------------------------------------------------------------------- */
  const nodeToStage = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) {
      map.set(n.id, STAGE_ID_BY_CATEGORY[n.category] ?? n.id);
    }
    return map;
  }, [nodes]);

  const stageFlowNodes = useMemo<Node[]>(() => {
    return CATEGORY_ORDER.map((category) => {
      const categoryVendors = nodes.filter((n) => n.category === category);
      const activeVendorId =
        activeVendorByCategory?.[category] ?? categoryVendors[0]?.id ?? '';

      const isCategoryVisible = visibleCategories[category] !== false;
      let isOptionalActive = true;
      if (category === 'audience' && !config.includeAudience) isOptionalActive = false;
      if (category === 'identity' && !config.includeIdentity) isOptionalActive = false;
      if (category === 'verification' && !config.includeVerification) isOptionalActive = false;

      const isStageActive = isCategoryVisible && isOptionalActive;
      const stageId = STAGE_ID_BY_CATEGORY[category] ?? `stage-${category}`;
      const position = STAGE_POSITIONS[category] ?? { x: 0, y: 0 };

      return {
        id: stageId,
        type: 'stage',
        position,
        data: {
          category,
          vendors: categoryVendors,
          activeVendorId,
          isActive: isStageActive,
          isSelected: selectedNodeId === activeVendorId,
          bids,
          winningBid: winningBid ?? null,
          onSelectVendor: (cat, vendorId) => {
            onSelectVendorForCategory?.(cat, vendorId);
            onSelectNode(vendorId);
          },
          onInspectVendor: (vendorId) => {
            onSelectNode(vendorId);
          },
        } satisfies CategoryStageCardData,
        hidden: !isStageActive,
      };
    });
  }, [
    nodes,
    activeVendorByCategory,
    visibleCategories,
    config,
    selectedNodeId,
    bids,
    winningBid,
    onSelectVendorForCategory,
    onSelectNode,
  ]);

  const stagePacketsByEdge = useMemo(() => {
    const map = new Map<string, Packet[]>();
    for (const packet of packets) {
      const stageSource = nodeToStage.get(packet.source) ?? packet.source;
      const stageTarget = nodeToStage.get(packet.target) ?? packet.target;
      const edge = STAGE_EDGES.find(
        (e) => e.source === stageSource && e.target === stageTarget,
      );
      if (!edge) continue;
      const bucket = map.get(edge.id) ?? [];
      bucket.push(packet);
      map.set(edge.id, bucket);
    }
    return map;
  }, [packets, nodeToStage]);

  const stageFlowEdges = useMemo<Edge<AnimatedPacketEdgeData>[]>(
    () =>
      STAGE_EDGES.map((edge) => {
        const sourceStage = Object.keys(STAGE_ID_BY_CATEGORY).find(
          (key) => STAGE_ID_BY_CATEGORY[key] === edge.source,
        );
        const targetStage = Object.keys(STAGE_ID_BY_CATEGORY).find(
          (key) => STAGE_ID_BY_CATEGORY[key] === edge.target,
        );

        let isSourceVisible = sourceStage ? visibleCategories[sourceStage] !== false : true;
        let isTargetVisible = targetStage ? visibleCategories[targetStage] !== false : true;

        if (sourceStage === 'audience' && !config.includeAudience) isSourceVisible = false;
        if (sourceStage === 'identity' && !config.includeIdentity) isSourceVisible = false;
        if (sourceStage === 'verification' && !config.includeVerification) isSourceVisible = false;

        if (targetStage === 'audience' && !config.includeAudience) isTargetVisible = false;
        if (targetStage === 'identity' && !config.includeIdentity) isTargetVisible = false;
        if (targetStage === 'verification' && !config.includeVerification) isTargetVisible = false;

        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'packet',
          label: edge.label,
          labelStyle: { fill: '#64748b', fontSize: 9 },
          labelBgStyle: { fill: 'transparent' },
          data: {
            packets: stagePacketsByEdge.get(edge.id) ?? [],
            isDimmed: !isSourceVisible || !isTargetVisible,
          } satisfies AnimatedPacketEdgeData,
        };
      }),
    [stagePacketsByEdge, visibleCategories, config],
  );

  /* -------------------------------------------------------------------------- */
  /* Active mode selection                                                      */
  /* -------------------------------------------------------------------------- */
  const isStageMode = viewMode === 'stage';
  const flowNodes = isStageMode ? stageFlowNodes : meshFlowNodes;
  const flowEdges = isStageMode ? stageFlowEdges : meshFlowEdges;

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === 'stage') {
        const stageData = node.data as unknown as CategoryStageCardData;
        const activeId = stageData.activeVendorId || stageData.vendors[0]?.id;
        if (activeId) {
          onSelectNode(activeId === selectedNodeId ? null : activeId);
        }
        return;
      }
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
        fitViewOptions={{ padding: 0.16 }}
        minZoom={0.2}
        maxZoom={1.75}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        // React Flow's own node wrapper is not keyboard-navigable, so the inner
        // buttons carry focus + aria semantics instead.
        nodesFocusable={false}
        edgesFocusable={false}
      >
        <Background color="#1e293b" gap={18} size={1} />
        <Controls showInteractive={false} className="!bg-slate-800 !border-slate-700 !fill-slate-300" />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            if (node.type === 'stage') {
              const data = node.data as unknown as CategoryStageCardData;
              return roleStyle(data.category).hex;
            }
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