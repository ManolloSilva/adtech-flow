/**
 * App.tsx — application shell for the Alpha milestone.
 *
 * Layout:
 *   Left  → Interactive ecosystem canvas (M-01) + category filter (M-05) + phase explainer
 *   Right → Playback controls (A-02), timeline (A-03), parameters, vendor toggles (A-06),
 *           winning bid panel (A-05), bid waterfall, and IAS report (A-07)
 */

import { useEffect, useMemo, useState } from 'react';
import { Layers, Network } from 'lucide-react';

import { AuctionConfigPanel } from '@/components/auction/AuctionConfigPanel';
import { BidWaterfall } from '@/components/auction/BidWaterfall';
import { PlaybackControls } from '@/components/auction/PlaybackControls';
import { TimelineSlider } from '@/components/auction/TimelineSlider';
import { VendorToggles } from '@/components/auction/VendorToggles';

import { WinningBidPanel } from '@/components/auction/WinningBidPanel';
import { OpenRTBInspector } from '@/components/auction/OpenRTBInspector';
import { CategoryFilterBar } from '@/components/ecosystem/CategoryFilterBar';
import { EcosystemCanvas } from '@/components/ecosystem/EcosystemCanvas';
import { NodeDetailSheet } from '@/components/ecosystem/NodeDetailSheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ecosystemNodesRaw from '@/data/ecosystem-nodes.json';
import { humanizePhase } from '@/lib/roleStyles';
import { saveSimulation } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AUCTION_DURATION_MS, useAuctionStore } from '@/store/auctionStore';
import type { EcosystemNodeData } from '@/types';

const ecosystemNodes = ecosystemNodesRaw as EcosystemNodeData[];

const PHASE_DESCRIPTIONS: Record<string, string> = {
  IDLE: 'Simulation ready. Press Play or step through the programmatic ad lifecycle.',
  CONSENT_RESOLVED:
    'The CMP decodes the IAB TCF v2.2 consent string and validates vendor purposes before any bid request is assembled.',
  AUDIENCE_ENRICHED:
    'Permutive evaluates on-device signals and injects privacy-safe Seller-Defined Audience segments into ortb2.user.data.',
  ID_MODULES_LOADED:
    'Universal ID modules (RampID, SharedID) resolve pseudonymous first-party envelope IDs for capping and matching.',
  BID_REQUESTS_FIRED:
    'The publisher sends an OpenRTB 2.5 bid request to each SSP adapter; the SSP forwards it to its demand partners.',
  BIDS_COLLECTED:
    'Demand partners return bid responses. The SSP applies the floor and the deal precedence rules.',
  TIMEOUT_APPLIED:
    'The auction timeout is enforced — bids that arrived after tmax are discarded regardless of price.',
  GAM_ARBITRATION:
    'Google Ad Manager evaluates the winning header bidding bid (hb_pb) against its direct line items.',
  AD_RENDERED: 'The winning creative renders in the publisher slot and the impression is logged.',
  VERIFICATION_MEASURED:
    'The IAS tag measures the rendered impression: viewability, brand safety, and invalid traffic.',
};

export default function App() {
  const {
    elapsedMs,
    phase,
    phases,
    playback,
    config,
    bids,
    winningBid,
    verificationReport,
    lastRequest,
    lastResponse,
    packets,
    selectedNodeId,
    visibleCategories,
    isInspectorOpen,
    canvasViewMode,
    activeVendorByCategory,
    play,
    pause,
    stepTo,
    stepNext,
    stepBack,
    reset,
    updateConfig,
    toggleBidder,
    setSelectedNodeId,
    setInspectorOpen,
    toggleCategory,
    setCanvasViewMode,
    setActiveVendorForCategory,
  } = useAuctionStore();

  const selectedNode = useMemo(
    () => ecosystemNodes.find((n) => n.id === selectedNodeId) ?? null,
    [selectedNodeId],
  );

  const selectedBid = useMemo(
    () => (selectedNodeId ? bids.find((b) => b.bidderId === selectedNodeId) : undefined),
    [bids, selectedNodeId],
  );

  const stepIndex = Math.max(0, phases.indexOf(phase));
  const eligibleBids = bids.filter((b) => b.status !== 'no_bid').length;

  const [listView, setListView] = useState(false);

  // Shareable simulation URLs (F-06): hydrate from URL on mount.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const patch: Parameters<typeof updateConfig>[0] = {};
      let has = false;
      const floor = params.get('floor');
      if (floor !== null) { patch.floorPrice = parseFloat(floor); has = true; }
      const timeout = params.get('timeout');
      if (timeout !== null) { patch.timeoutMs = parseInt(timeout, 10); has = true; }
      const gdpr = params.get('gdpr');
      if (gdpr !== null) { patch.gdprConsent = gdpr === '1'; has = true; }
      const deal = params.get('deal');
      if (deal) { patch.dealId = deal; has = true; }
      const dsp = params.get('dsp');
      if (dsp) {
        patch.activeBidders = dsp.split(',').filter(Boolean).map((c) => `node-dsp-${c}`);
        has = true;
      }
      if (has) updateConfig(patch);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push config changes back to the URL.
  useEffect(() => {
    try {
      const params = new URLSearchParams();
      params.set('floor', config.floorPrice.toFixed(2));
      params.set('timeout', String(config.timeoutMs));
      params.set('gdpr', config.gdprConsent ? '1' : '0');
      if (config.dealId) params.set('deal', config.dealId);
      params.set('dsp', config.activeBidders.map((id) => id.replace('node-dsp-', '')).join(','));
      const url = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, '', url);
    } catch {
      /* ignore */
    }
  }, [config.floorPrice, config.timeoutMs, config.gdprConsent, config.dealId, config.activeBidders]);

  // requestAnimationFrame is suspended while the tab is hidden, which would
  // otherwise freeze the simulation mid-flight and burn CPU on return. Pause
  // explicitly so the user returns to a stable, resumable state.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && useAuctionStore.getState().playback === 'playing') {
        useAuctionStore.getState().pause();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // Persist the completed simulation to the backend (best-effort, non-blocking).
  useEffect(() => {
    if (playback === 'completed') {
      const traceId = `auc-${Date.now()}`;
      void saveSimulation(config, { winningBid, verificationReport, bids }, traceId);
    }
  }, [playback, config, winningBid, verificationReport, bids]);

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-white shadow-lg shadow-blue-500/20"
              aria-hidden="true"
            >
              AF
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">AdTech Flow</h1>
              <p className="hidden text-xs text-slate-400 sm:block">
                Interactive Programmatic Auction &amp; Ecosystem Simulator
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
              Milestone Alpha
            </Badge>
            <Badge className="hidden border border-blue-500/20 bg-blue-500/10 text-blue-400 sm:inline-flex">
              Zero Media Spend
            </Badge>
            <button
              type="button"
              onClick={() => { void navigator.clipboard?.writeText(window.location.href); }}
              data-testid="copy-link"
              className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:text-white"
            >
              Copy Link
            </button>
          </div>
        </div>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-3 lg:gap-6 lg:p-6">
        {/* ----------------------------- Canvas ----------------------------- */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm">Programmatic Ecosystem Topology</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {ecosystemNodes.length} participants · curated from public{' '}
                    <code className="font-mono">sellers.json</code>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="flex items-center rounded-lg border border-slate-800 bg-slate-900/90 p-0.5 text-xs"
                    role="group"
                    aria-label="Canvas topology view mode"
                  >
                    <button
                      type="button"
                      onClick={() => setCanvasViewMode('stage')}
                      data-testid="view-mode-stage"
                      aria-pressed={canvasViewMode === 'stage'}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                        canvasViewMode === 'stage'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200',
                      )}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      <span>Stage Dropdowns</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCanvasViewMode('mesh')}
                      data-testid="view-mode-mesh"
                      aria-pressed={canvasViewMode === 'mesh'}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                        canvasViewMode === 'mesh'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200',
                      )}
                    >
                      <Network className="h-3.5 w-3.5" />
                      <span>Full Mesh ({ecosystemNodes.length})</span>
                    </button>
                  </div>

                  <Badge variant="outline" className="border-slate-700 bg-slate-800 font-mono text-[10px] text-slate-400">
                    {elapsedMs.toFixed(0)}ms / {AUCTION_DURATION_MS}ms
                  </Badge>
                  <button
                    type="button"
                    onClick={() => setListView((v) => !v)}
                    data-testid="view-mode-list"
                    aria-pressed={listView}
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:text-white"
                  >
                    {listView ? 'Canvas view' : 'List view'}
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <CategoryFilterBar
                nodes={ecosystemNodes}
                visibleCategories={visibleCategories}
                onToggle={toggleCategory}
              />
              {listView ? (
                <div className="h-[420px] overflow-auto lg:h-[560px]" data-testid="waterfall-list-view">
                  <BidWaterfall
                    bids={bids}
                    activeBidders={config.activeBidders}
                    onToggleBidder={toggleBidder}
                    latencyMs={config.latencyMs}
                    onLatencyChange={(bidderId, ms) =>
                      updateConfig({ latencyMs: { ...config.latencyMs, [bidderId]: ms } })
                    }
                  />
                </div>
              ) : (
                <EcosystemCanvas
                  nodes={ecosystemNodes}
                  config={config}
                  bids={bids}
                  winningBid={winningBid}
                  packets={packets}
                  visibleCategories={visibleCategories}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                  viewMode={canvasViewMode}
                  activeVendorByCategory={activeVendorByCategory}
                  onSelectVendorForCategory={setActiveVendorForCategory}
                  className="h-[420px] lg:h-[560px]"
                />
              )}
              <p className="text-[11px] text-slate-500">
                {canvasViewMode === 'stage'
                  ? 'Stage view: click any stage dropdown to switch entities (DSP, SSP, Publisher) or Details to inspect.'
                  : 'Click any node to inspect it. Tab moves between node cards; Enter or Space opens the detail panel.'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{humanizePhase(phase)}</CardTitle>
                <span className="font-mono text-xs text-slate-500">
                  Phase {stepIndex + 1} / {phases.length}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-slate-300">
                {PHASE_DESCRIPTIONS[phase] ?? 'Awaiting the next phase.'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ------------------------- Playback & results --------------------- */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Auction Playback</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PlaybackControls
                playback={playback}
                phase={phase}
                stepNumber={stepIndex + 1}
                totalSteps={phases.length}
                canStepBack={stepIndex > 0}
                canStepForward={stepIndex < phases.length - 1}
                onPlay={play}
                onPause={pause}
                onStepNext={stepNext}
                onStepBack={stepBack}
                onReset={reset}
              />
              <Separator />
              <TimelineSlider
                elapsedMs={elapsedMs}
                durationMs={AUCTION_DURATION_MS}
                phase={phase}
                phases={phases}
                onScrub={stepTo}
              />
            </CardContent>
          </Card>

          <Tabs defaultValue="results" className="flex-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="config">Configure</TabsTrigger>
            </TabsList>

            <TabsContent value="results" className="mt-2 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Winning Bid</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <WinningBidPanel
                    winningBid={winningBid}
                    phase={phase}
                    totalBids={bids.length}
                    eligibleBids={eligibleBids}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">OpenRTB</CardTitle>
                </CardHeader>
                <CardContent>
                  <OpenRTBInspector request={lastRequest} response={lastResponse} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Demand Partners</CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {eligibleBids}/{bids.length} eligible
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[420px] pr-3">
                    <BidWaterfall
                      bids={bids}
                      activeBidders={config.activeBidders}
                      onToggleBidder={toggleBidder}
                    latencyMs={config.latencyMs}
                    onLatencyChange={(bidderId, ms) =>
                      updateConfig({ latencyMs: { ...config.latencyMs, [bidderId]: ms } })
                    }
                    />
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="config" className="mt-2 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Auction Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <AuctionConfigPanel config={config} onChange={updateConfig} />
                  <Separator />
                  <VendorToggles config={config} onChange={updateConfig} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-950 px-4 py-3 text-center text-[11px] text-slate-500 sm:px-6">
        <p>
          <strong className="text-slate-400">Nominative Fair Use:</strong> all company names and
          trademarks (Google, The Trade Desk, Magnite, PubMatic, OpenX, Permutive, Integral Ad
          Science, LiveRamp and others) belong to their respective owners and are referenced here for
          educational and descriptive purposes only. No affiliation or endorsement is implied. All
          network traffic is intercepted by a mock service worker — no live ad server is ever
          contacted.
        </p>
      </footer>

      <NodeDetailSheet
        node={selectedNode}
        open={isInspectorOpen && selectedNode !== null}
        onOpenChange={setInspectorOpen}
        {...(selectedBid ? { bid: selectedBid } : {})}
      />
    </div>
  );
}