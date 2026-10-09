/**
 * AnimatedPacketEdge.tsx — the base edge rendered under every connection,
 * plus animated bid packets that travel along it (BACKLOG A-04).
 *
 * Design: React Flow owns the path geometry. The curve is sampled into
 * keyframes and Framer Motion interpolates a glowing dot along them, so the
 * packet follows the exact rendered path at any resolution and several packets
 * can share one edge concurrently.
 *
 * Note: `offsetDistance` is deliberately avoided — React does not recognise it
 * as an animatable style prop and warns on every frame.
 */

import { memo } from 'react';
import { BaseEdge, getBezierPath, Position, type EdgeProps } from '@xyflow/react';
import { motion } from 'framer-motion';

import { ROLE_STYLES } from '@/lib/roleStyles';
import type { Packet } from '@/types';

const PACKET_COLORS: Record<Packet['kind'], string> = {
  consent: ROLE_STYLES.cmp.hex,
  data: ROLE_STYLES.audience.hex,
  'bid-request': ROLE_STYLES.dsp.hex,
  'bid-response': ROLE_STYLES.ssp.hex,
  timeout: '#f87171',
  render: ROLE_STYLES.adserver.hex,
  measurement: ROLE_STYLES.verification.hex,
};

/** Seconds for one packet to traverse the edge. */
const PACKET_DURATION_S = 1.4;
/** Delay between packets sharing the same edge. */
const PACKET_STAGGER_S = 0.18;
/** Keyframes sampled along the curve. */
const PATH_SAMPLES = 24;

/**
 * React Flow constrains `edgeTypes` to `Edge<Record<string, unknown>>`, so any
 * custom edge data must be structurally assignable to that record shape. The
 * index signature makes `AnimatedPacketEdgeData` satisfy it without weakening
 * the component's own props.
 */
export interface AnimatedPacketEdgeData {
  /** Packets currently in flight along this edge. */
  packets: Packet[];
  /** Dims the edge when neither endpoint is visible. */
  isDimmed?: boolean;
  [key: string]: unknown;
}

type PacketEdgeProps = EdgeProps & { data?: AnimatedPacketEdgeData };

interface Point {
  x: number;
  y: number;
}

/** Solves a cubic Bézier at `t` — matches the curve `getBezierPath` produces. */
function cubicPoint(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/** A single glowing packet travelling source → target. */
function PacketDot({
  color,
  delay,
  controlPoints,
}: {
  color: string;
  delay: number;
  controlPoints: [Point, Point, Point, Point];
}) {
  const samples = Array.from({ length: PATH_SAMPLES + 1 }, (_, i) =>
    cubicPoint(i / PATH_SAMPLES, ...controlPoints),
  );

  return (
    <motion.circle
      r={4}
      fill={color}
      style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      animate={{
        cx: samples.map((p) => p.x),
        cy: samples.map((p) => p.y),
        opacity: [0, 1, 1, 0],
      }}
      transition={{
        duration: PACKET_DURATION_S,
        ease: 'linear',
        delay,
        repeat: Infinity,
        repeatDelay: 0.4,
      }}
    />
  );
}

function AnimatedPacketEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}: PacketEdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const packets = data?.packets ?? [];
  const dimmed = data?.isDimmed ?? false;

  // Mirror React Flow's handle-offset heuristics so the sampled curve matches
  // the rendered path exactly.
  const horizontalSource = sourcePosition === Position.Left || sourcePosition === Position.Right;
  const horizontalTarget = targetPosition === Position.Left || targetPosition === Position.Right;
  const midX = sourceX + (targetX - sourceX) * 0.5;

  const controlPoints: [Point, Point, Point, Point] = [
    { x: sourceX, y: sourceY },
    horizontalSource ? { x: midX, y: sourceY } : { x: sourceX, y: sourceY + (targetY - sourceY) * 0.5 },
    horizontalTarget ? { x: midX, y: targetY } : { x: targetX, y: targetY + (sourceY - targetY) * 0.5 },
    { x: targetX, y: targetY },
  ];

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: dimmed ? '#334155' : '#475569',
          strokeWidth: dimmed ? 1 : 1.5,
          opacity: dimmed ? 0.25 : 0.6,
          transition: 'opacity 200ms ease, stroke 200ms ease',
        }}
      />

      {packets.map((packet, index) => (
        <PacketDot
          key={packet.id}
          color={PACKET_COLORS[packet.kind]}
          delay={index * PACKET_STAGGER_S}
          controlPoints={controlPoints}
        />
      ))}
    </>
  );
}

export const AnimatedPacketEdge = memo(AnimatedPacketEdgeComponent);