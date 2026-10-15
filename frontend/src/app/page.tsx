"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ResQProvider, useResQ } from "../context/ResQContext";
import CitizenReportModal from "../components/CitizenReportModal";
import IncidentDetailPanel from "../components/IncidentDetailPanel";
import { DispatchModal } from "../components/DispatchModal";
import { RoleWorkspaceModal } from "../components/RoleWorkspaceModal";
import { AlertsDrawer } from "../components/AlertsDrawer";
import { AnalyticsModal } from "../components/AnalyticsModal";
import { SimulationBar } from "../components/SimulationBar";
import { AuthModal } from "../components/AuthModal";
import { GeneralPublicDashboardView } from "../components/role-views/GeneralPublicDashboardView";
import { CitizenDashboardView } from "../components/role-views/CitizenDashboardView";
import { AdminDashboardView } from "../components/role-views/AdminDashboardView";
import { ServiceProviderDashboardView } from "../components/role-views/ServiceProviderDashboardView";
import { LiveOperationsLayer } from "../components/dm/LiveOperationsLayer";
import { IncidentRecord, PortalRoleCategory } from "../types/resq";

// Basemap layer configurations with maxNativeZoom to prevent labels disappearing at deep zoom
const TILE_LAYERS = {
  streets: {
    name: "OpenStreetMap (All Roads, Villages & Towns - No Key Needed)",
    base: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: [],
    maxZoom: 19,
    maxNativeZoom: 19,
    isSatellite: false,
  },
  humanitarian: {
    name: "Humanitarian OSM (Disaster & Relief Focus - No Key Needed)",
    base: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    subdomains: ["a", "b"],
    maxZoom: 19,
    maxNativeZoom: 19,
    isSatellite: false,
  },
  esriStreets: {
    name: "Esri World Streets (Clean Cartography - No Key Needed)",
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    subdomains: ["a", "b", "c"],
    maxZoom: 19,
    maxNativeZoom: 18,
    isSatellite: false,
  },
  esriHybrid: {
    name: "Esri Satellite + World Boundaries (No Key Needed)",
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    overlay: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    subdomains: ["a", "b", "c"],
    maxZoom: 19,
    maxNativeZoom: 18,
    isSatellite: true,
  },
  esriTopo: {
    name: "Topographic & Elevation Map (Esri Topo - No Key Needed)",
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    subdomains: ["a", "b", "c"],
    maxZoom: 19,
    maxNativeZoom: 18,
    isSatellite: false,
  },
  satellitePure: {
    name: "Pure Satellite Imagery (No Labels - No Key Needed)",
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    subdomains: ["a", "b", "c"],
    maxZoom: 19,
    maxNativeZoom: 18,
    isSatellite: true,
  },
};

function CommandDashboard({
  incidents,
  responders,
  dispatches,
  unreadAlertCount,
  onMap,
  onReport,
  onAlerts,
  onWorkspace,
  onAnalytics,
  showCitizenReport,
  showRoleWorkspace,
  showAlertsDrawer,
  showAnalytics,
  showDispatchModal,
  dispatchIncident,
  onCloseReport,
  onCloseWorkspace,
  onCloseAlerts,
  onCloseAnalytics,
  onCloseDispatch,
  onOpenDispatch,
}: {
  incidents: IncidentRecord[];
  responders: unknown[];
  dispatches: unknown[];
  unreadAlertCount: number;
  onMap: () => void;
  onReport: () => void;
  onAlerts: () => void;
  onWorkspace: () => void;
  onAnalytics: () => void;
  showCitizenReport: boolean;
  showRoleWorkspace: boolean;
  showAlertsDrawer: boolean;
  showAnalytics: boolean;
  showDispatchModal: boolean;
  dispatchIncident: IncidentRecord | null;
  onCloseReport: () => void;
  onCloseWorkspace: () => void;
  onCloseAlerts: () => void;
  onCloseAnalytics: () => void;
  onCloseDispatch: () => void;
  onOpenDispatch: (incident: IncidentRecord) => void;
}) {
  const active = incidents.filter((incident) => !["RESOLVED", "CLOSED"].includes(incident.lifecycleStatus)).length;
  const critical = incidents.filter((incident) => incident.severity === "CRITICAL").length;
  const cards = [
    { label: "Active Incidents", value: String(active), detail: critical ? `${critical} critical threats` : "Normal monitoring", tone: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
    { label: "Units Deployed", value: String(responders.length), detail: `${dispatches.length} active dispatches`, tone: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    { label: "Operational Status", value: "Ready", detail: "Real-time sync online", tone: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    { label: "Critical Alerts", value: String(unreadAlertCount), detail: unreadAlertCount ? "Requires review" : "No pending warnings", tone: unreadAlertCount ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  ];

  return (
    <main className="h-screen overflow-y-auto bg-[#070d18] text-[#f8fafc] font-sans">
      {/* Top Banner */}
      <div className="flex h-8 items-center justify-between border-b border-[#062338] bg-[#093452] px-4 text-[11px] text-sky-100 sm:px-6">
        <span className="font-medium">NDMA Emergency Response &amp; Tactical Coordination Hub</span>
        <span className="flex items-center gap-3 sm:gap-5">
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold"><span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> All systems nominal</span>
          <span className="hidden sm:inline text-sky-200/80">Region: India (National Ops)</span>
        </span>
      </div>

      {/* Main Header */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-[#0b1324] px-4 sm:px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-xl text-sky-400 shadow-xs" aria-hidden>
            🛡️
          </div>
          <div>
            <div className="flex items-baseline gap-1.5 leading-tight">
              <h1 className="text-xl font-extrabold tracking-tight text-white">ResQ</h1>
              <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">Command</span>
            </div>
            <p className="text-[11px] text-muted">Integrated Emergency Management System</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onAnalytics}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:text-white hover:bg-surface-muted transition cursor-pointer"
          >
            Analytics
          </button>
          <button
            onClick={onReport}
            className="rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition cursor-pointer flex items-center gap-1.5"
          >
            <span>+</span> Situation Report
          </button>
        </div>
      </header>

      {/* Body Layout */}
      <div className="flex min-h-[calc(100vh-96px)]">
        {/* Sidebar Nav */}
        <aside className="hidden w-60 shrink-0 border-r border-border bg-[#0b1324] px-3 py-5 lg:block">
          <p className="mb-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-muted">Tactical Deck</p>
          <nav className="space-y-1 text-sm">
            <button aria-current="page" className="w-full rounded-lg bg-sky-500/15 border border-sky-500/30 px-3 py-2 text-left font-semibold text-sky-300 flex items-center justify-between">
              <span>▦ &nbsp; Overview</span>
              <span className="text-[10px] bg-sky-400/20 text-sky-300 px-1.5 py-0.2 rounded font-mono">LIVE</span>
            </button>
            <button onClick={onWorkspace} className="w-full rounded-lg px-3 py-2 text-left text-muted transition hover:bg-surface-muted hover:text-foreground flex items-center justify-between">
              <span>◉ &nbsp; Incidents</span>
              <span className="rounded bg-surface-muted border border-border px-1.5 text-xs text-muted font-mono">{active}</span>
            </button>
            <button onClick={onMap} className="w-full rounded-lg px-3 py-2 text-left text-muted transition hover:bg-surface-muted hover:text-foreground">
              ⌖ &nbsp; Incident Map
            </button>
            <button onClick={onWorkspace} className="w-full rounded-lg px-3 py-2 text-left text-muted transition hover:bg-surface-muted hover:text-foreground">
              ➤ &nbsp; Dispatch Center
            </button>
            <button onClick={onAlerts} className="w-full rounded-lg px-3 py-2 text-left text-muted transition hover:bg-surface-muted hover:text-foreground flex items-center justify-between">
              <span>♧ &nbsp; Emergency Alerts</span>
              {unreadAlertCount > 0 && <span className="rounded bg-red-950 text-red-400 border border-red-800/80 px-1.5 text-xs font-bold">{unreadAlertCount}</span>}
            </button>
            <button onClick={onWorkspace} className="w-full rounded-lg px-3 py-2 text-left text-muted transition hover:bg-surface-muted hover:text-foreground">
              ♙ &nbsp; Active Responders
            </button>
            <div className="my-2.5 border-t border-border" />
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-muted">Operations &amp; Admin</p>
            <button onClick={onWorkspace} className="w-full rounded-lg px-3 py-2 text-left text-muted transition hover:bg-surface-muted hover:text-foreground">
              ▣ &nbsp; Logistics &amp; Resources
            </button>
            <button onClick={onAnalytics} className="w-full rounded-lg px-3 py-2 text-left text-muted transition hover:bg-surface-muted hover:text-foreground">
              ▥ &nbsp; Analytics &amp; Reports
            </button>
          </nav>
        </aside>

        {/* Main Content Area */}
        <section className="min-w-0 flex-1 p-4 sm:p-6 lg:p-7">
          <nav aria-label="Dashboard mobile navigation" className="mb-4 flex gap-1.5 overflow-x-auto lg:hidden pb-1">
            <span aria-current="page" className="shrink-0 rounded-lg bg-sky-500/15 border border-sky-500/40 px-3 py-1.5 text-xs font-semibold text-sky-300">▦ Overview</span>
            <button onClick={onWorkspace} className="shrink-0 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted hover:text-foreground">◉ Incidents ({active})</button>
            <button onClick={onMap} className="shrink-0 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted hover:text-foreground">⌖ Map</button>
            <button onClick={onAlerts} className="shrink-0 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted hover:text-foreground">♧ Alerts</button>
          </nav>

          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Situational Awareness</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">Command Overview</h2>
              <p className="mt-1 text-xs text-muted">Real-time emergency monitoring and coordinated response deployment.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={onMap} className="rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition cursor-pointer flex items-center gap-1.5">
                <span>⌖</span> Launch Interactive GIS Map
              </button>
            </div>
          </div>

          {critical > 0 && (
            <button
              onClick={onWorkspace}
              className="mb-6 flex w-full items-center justify-between rounded-xl border border-critical/40 bg-critical-soft px-4 py-3.5 text-left text-sm text-critical shadow-sm transition hover:bg-critical-soft/80 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span className="text-base">🚨</span>
                <span><strong>Priority Attention Required:</strong> {critical} critical emergency incident{critical === 1 ? "" : "s"} currently active.</span>
              </span>
              <span className="font-semibold text-xs underline underline-offset-2">Review Tactical Queue →</span>
            </button>
          )}

          {/* Stat Cards */}
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((c) => (
              <article key={c.label} className="rounded-xl border border-border bg-surface p-4 shadow-sm transition hover:border-slate-700">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">{c.label}</p>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${c.tone}`}>STATUS</span>
                </div>
                <p className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl tabular-nums">{c.value}</p>
                <p className="mt-1.5 text-xs text-muted">{c.detail}</p>
              </article>
            ))}
          </div>

          {/* Split View: Map Overview + AI Triage */}
          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
            <article className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
              <div className="flex items-center justify-between border-b border-border bg-surface-muted/50 px-4 py-3 sm:px-5">
                <div>
                  <h3 className="font-semibold text-sm text-white">⌖ Live Incident Map Preview</h3>
                  <p className="mt-0.5 text-xs text-muted">Geographical distribution across operational sectors</p>
                </div>
                <button onClick={onMap} className="text-xs font-semibold text-sky-400 hover:text-sky-300 hover:underline cursor-pointer">
                  Full Interactive Map →
                </button>
              </div>
              <button
                onClick={onMap}
                aria-label="Open interactive incident map"
                className="relative grid h-60 w-full place-items-center overflow-hidden bg-[#071322] text-center cursor-pointer group"
              >
                <svg aria-hidden="true" viewBox="0 0 900 360" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full opacity-40">
                  <rect width="900" height="360" fill="#071322" />
                  <path d="M0 55 150 20 270 65 390 20 520 70 650 25 900 60M0 160 130 115 260 175 390 120 510 170 660 115 900 165M0 285 150 240 280 300 420 245 570 310 720 245 900 300" fill="none" stroke="#0f2b48" strokeWidth="24" />
                  <path d="M70-20 160 380M280-20 355 380M520-20 440 380M700-20 620 380M0 95 900 255M0 230 900 100" fill="none" stroke="#1e3a5f" strokeWidth="4" />
                  <path d="M0 340Q160 250 300 330T600 320T900 345" fill="none" stroke="#0284c7" strokeWidth="12" />
                </svg>
                {incidents.slice(0, 4).map((incident, index) => (
                  <span
                    key={incident.id}
                    className="absolute z-10 grid size-7 place-items-center rounded-full border-2 border-white bg-amber-500 text-xs font-bold text-white shadow-lg"
                    style={{ left: `${24 + index * 18}%`, top: `${28 + (index % 2) * 32}%` }}
                    aria-hidden
                  >
                    !
                  </span>
                ))}
                <span className="absolute bottom-3 left-3 z-10 rounded-lg border border-border bg-surface/90 px-3 py-1.5 text-[11px] font-semibold text-slate-200 shadow-md">
                  <span className="mr-2 text-emerald-400">●</span> India Regional Overview
                </span>
                <span className="relative z-10 rounded-full border border-sky-500/40 bg-sky-950/80 px-4 py-2 text-xs font-semibold text-sky-200 shadow-lg group-hover:scale-105 transition">
                  Click to Open Interactive Map
                </span>
              </button>
            </article>

            <article className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
              <div className="flex items-center justify-between border-b border-border bg-surface-muted/50 px-4 py-3 sm:px-5">
                <h3 className="font-semibold text-sm text-sky-300 flex items-center gap-1.5">
                  <span>✦</span> AI Incident Triage
                </h3>
                <span className="rounded-md border border-ai/30 bg-ai-soft px-2 py-0.5 text-[10px] font-bold text-ai">
                  ADVISORY
                </span>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-[11px] font-mono text-muted">{incidents[0]?.id || "INC-PREVIEW"}</p>
                <h4 className="text-base font-bold text-white leading-snug">{incidents[0]?.title || "Awaiting Incident Selection"}</h4>
                <p className="text-xs text-muted leading-relaxed">
                  Real-time algorithmic triage correlates severity indicators, casualty counts, and GIS terrain data to accelerate dispatcher decisions.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="rounded-md border border-critical/30 bg-critical-soft px-2 py-0.5 font-semibold text-critical">
                    {incidents[0]?.severity || "MONITORING"}
                  </span>
                  <span className="text-emerald-400 font-medium">✓ Verified Feed</span>
                </div>
                <button
                  onClick={onWorkspace}
                  className="mt-4 inline-flex items-center text-xs font-semibold text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
                >
                  Open Tactical Review Queue →
                </button>
              </div>
            </article>
          </div>
        </section>
      </div>

      <CitizenReportModal isOpen={showCitizenReport} onClose={onCloseReport} />
      <RoleWorkspaceModal
        isOpen={showRoleWorkspace}
        onClose={onCloseWorkspace}
        onOpenCitizenReport={onReport}
        onOpenDispatch={onOpenDispatch}
      />
      <AlertsDrawer isOpen={showAlertsDrawer} onClose={onCloseAlerts} />
      <AnalyticsModal isOpen={showAnalytics} onClose={onCloseAnalytics} />
      <DispatchModal
        incident={dispatchIncident}
        isOpen={showDispatchModal}
        onClose={onCloseDispatch}
      />
    </main>
  );
}

// Permanent 100% watermark-free street & road labels overlay (Esri Reference Labels)
const STREET_LABELS_OVERLAY = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

function ResQGeoPortalInner() {
  const {
    currentUser,
    roleCategory,
    isAuthenticated,
    switchRole,
    logout,
    incidents,
    selectedIncident,
    selectIncident,
    responders,
    dispatches,
    infrastructure,
    unreadAlertCount,
    mapFocusTarget,
    setMapFocusTarget,
  } = useResQ();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const baseLayerRef = useRef<any>(null);
  const secondaryOverlayRef = useRef<any>(null);
  const streetOverlayRef = useRef<any>(null);

  const activePinRef = useRef<any>(null);
  const measureLayerRef = useRef<any>(null);
  const locationLayerRef = useRef<any>(null);

  // Dynamic GIS feature layer groups
  const incidentsLayerRef = useRef<any>(null);
  const respondersLayerRef = useRef<any>(null);
  const routesLayerRef = useRef<any>(null);
  const infrastructureLayerRef = useRef<any>(null);

  // UI state
  const [coordsText, setCoordsText] = useState("Lat: -- | Lon: --");
  const [currentZoom, setCurrentZoom] = useState(5);
  const [visibleAreaName, setVisibleAreaName] = useState<string>("India");
  const [currentBaseLayer, setCurrentBaseLayer] = useState<keyof typeof TILE_LAYERS>("streets");
  const [streetOverlayActive, setStreetOverlayActive] = useState(false);
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measureDistance, setMeasureDistance] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState("English");

  // Splash screen & Dashboard panel
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showMapView, setShowMapView] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Auth & Role Modals visibility
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("login");
  const [authModalCategory] = useState<PortalRoleCategory>("user");
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  // Modals & Panels visibility
  const [showCitizenReport, setShowCitizenReport] = useState(false);
  const [showRoleWorkspace, setShowRoleWorkspace] = useState(false);
  const [showAlertsDrawer, setShowAlertsDrawer] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showSimulationBar, setShowSimulationBar] = useState(false);
  const [dispatchIncident, setDispatchIncident] = useState<IncidentRecord | null>(null);
  const [showDispatchModal, setShowDispatchModal] = useState(false);

  // Measurement ref
  const measurePointsRef = useRef<any[]>([]);
  const reverseGeocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Splash screen auto-dismiss
  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFading(true), 2800);
    return () => clearTimeout(fadeTimer);
  }, []);


  // Fetch real-world place name on zoom/move (0 API keys required)
  const fetchRealPlaceName = useCallback(async (lat: number, lon: number, zoom: number) => {
    if (zoom < 5) {
      setVisibleAreaName("India (National Overview)");
      return;
    }

    try {
      const zoomLevel = Math.min(Math.max(zoom, 8), 18);
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=${zoomLevel}&addressdetails=1`;
      const response = await fetch(url, { headers: { "Accept-Language": "en" } });
      if (!response.ok) return;

      const data = await response.json();
      if (data && data.address) {
        const addr = data.address;
        const parts = [
          addr.road || addr.suburb || addr.neighbourhood || addr.village || addr.hamlet || addr.town || addr.locality,
          addr.city || addr.county || addr.district,
          addr.state,
        ].filter(Boolean);

        const label = parts.length > 0 ? parts.join(", ") : data.display_name.split(",").slice(0, 3).join(",");
        setVisibleAreaName(label);
      }
    } catch {
      // Offline fallback
    }
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!showMapView) return;

    let isCancelled = false;

    const initMap = async () => {
      try {
        const L = (await import("leaflet")).default;
        (window as any).L = L;

        if (isCancelled || !mapContainerRef.current) return;

        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        // Initialize Map with Crisp Integer Zoom and deep zoom allowance (maxZoom: 21)
        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl: false,
          minZoom: 2,
          maxZoom: 21,
          worldCopyJump: true,
          fadeAnimation: true,
          zoomAnimation: true,
          zoomAnimationThreshold: 8,
          zoomSnap: 1,
          zoomDelta: 1,
          wheelPxPerZoomLevel: 100,
          wheelDebounceTime: 40,
          inertia: true,
          inertiaDeceleration: 3000,
          inertiaMaxSpeed: 2000,
          easeLinearity: 0.22,
        }).setView([22.6, 79.1], 5);

        mapRef.current = map;

        // Base Layer: OpenStreetMap (Standard 100% Free Open GIS - Zero Keys Required)
        const initialCfg = TILE_LAYERS.streets;
        const baseLayer = L.tileLayer(initialCfg.base, {
          maxZoom: 19,
          maxNativeZoom: 19,
          subdomains: initialCfg.subdomains,
          updateWhenZooming: false,
          updateWhenIdle: true,
          keepBuffer: 2,
        }).addTo(map);
        baseLayerRef.current = baseLayer;

        // Watermark-Free Street & Place Names Overlay
        const streetOverlay = L.tileLayer(STREET_LABELS_OVERLAY, {
          subdomains: ["a", "b", "c"],
          maxZoom: 19,
          maxNativeZoom: 18,
          opacity: 1.0,
        });
        streetOverlayRef.current = streetOverlay;

        // Scale bar in bottom-left
        L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

        // Feature Layer Groups
        measureLayerRef.current = L.layerGroup().addTo(map);
        locationLayerRef.current = L.layerGroup().addTo(map);
        incidentsLayerRef.current = L.layerGroup().addTo(map);
        respondersLayerRef.current = L.layerGroup().addTo(map);
        routesLayerRef.current = L.layerGroup().addTo(map);
        infrastructureLayerRef.current = L.layerGroup().addTo(map);

        // Coordinates mousemove tracking
        map.on("mousemove", (e: any) => {
          const lat = e.latlng.lat.toFixed(4);
          const lon = e.latlng.lng.toFixed(4);
          const latDir = e.latlng.lat >= 0 ? "N" : "S";
          const lonDir = e.latlng.lng >= 0 ? "E" : "W";
          setCoordsText(`Lat: ${Math.abs(Number(lat))}° ${latDir} | Lon: ${Math.abs(Number(lon))}° ${lonDir}`);
        });

        // Dynamic Zoom & Move event listener
        map.on("zoomend", () => {
          setCurrentZoom(map.getZoom());
        });

        map.on("moveend", () => {
          const center = map.getCenter();
          const zoom = map.getZoom();
          if (reverseGeocodeTimeoutRef.current) {
            clearTimeout(reverseGeocodeTimeoutRef.current);
          }
          reverseGeocodeTimeoutRef.current = setTimeout(() => {
            fetchRealPlaceName(center.lat, center.lng, zoom);
          }, 500);
        });

        setMapReady(true);

        // Ensure canvas dimensions are refreshed for the layout
        setTimeout(() => {
          if (!isCancelled && mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 100);

        setTimeout(() => {
          if (!isCancelled && mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 500);

        // Initial smooth glide into India
        setTimeout(() => {
          if (!isCancelled && mapRef.current) {
            mapRef.current.flyTo([23.5, 80.5], 5, {
              duration: 3.2,
              easeLinearity: 0.22,
              noMoveStart: true,
            });
            mapRef.current.invalidateSize();
          }
        }, 400);
      } catch (err) {
        console.error("Map initialization failed:", err);
      }
    };

    initMap();

    return () => {
      isCancelled = true;
      if (reverseGeocodeTimeoutRef.current) {
        clearTimeout(reverseGeocodeTimeoutRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [fetchRealPlaceName, showMapView]);

  // Handle map navigation requests from context
  useEffect(() => {
    if (!showMapView || !mapReady || !mapFocusTarget || !mapRef.current) return;
    mapRef.current.flyTo([mapFocusTarget.lat, mapFocusTarget.lon], mapFocusTarget.zoom, {
      duration: 2.5,
      easeLinearity: 0.22,
    });
    setMapFocusTarget(null);
  }, [mapFocusTarget, setMapFocusTarget, mapReady, showMapView]);

  // Render Incident Markers on Map
  useEffect(() => {
    const L = (window as any).L;
    if (!showMapView || !mapReady || !L || !mapRef.current || !incidentsLayerRef.current) return;

    incidentsLayerRef.current.clearLayers();

    incidents.forEach((inc) => {
      const getCategoryIcon = () => {
        if (inc.category === "Major Urban / Building Fire") return "🔥";
        if (inc.category === "Cyclone / Coastal Flooding") return "🌀";
        return "🌊";
      };

      const getSeverityColor = () => {
        if (inc.severity === "CRITICAL") return "#dc2626";
        if (inc.severity === "HIGH") return "#ea580c";
        if (inc.severity === "MODERATE") return "#d97706";
        return "#16a34a";
      };

      const iconHtml = `
        <div style="
          background: ${getSeverityColor()};
          color: white;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 9999px;
          border: 2px solid white;
          box-shadow: 0 4px 10px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          cursor: pointer;
          transform: translate(-50%, -50%);
        ">
          <span>${getCategoryIcon()}</span>
          <span>${inc.id}</span>
          <span style="font-size: 9px; opacity: 0.9; background: rgba(0,0,0,0.25); padding: 1px 4px; border-radius: 4px;">
            ${inc.lifecycleStatus}
          </span>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: "resq-incident-marker",
        iconSize: [0, 0],
      });

      const marker = L.marker([inc.lat, inc.lon], { icon: customIcon });

      marker.on("click", () => {
        selectIncident(inc);
      });

      marker.addTo(incidentsLayerRef.current);
    });
  }, [incidents, selectIncident, mapReady, showMapView]);

  // Render Responder Unit Markers on Map
  useEffect(() => {
    const L = (window as any).L;
    if (!showMapView || !mapReady || !L || !mapRef.current || !respondersLayerRef.current) return;

    respondersLayerRef.current.clearLayers();

    responders.forEach((unit) => {
      const getUnitIcon = () => {
        if (unit.callsign.includes("AMB")) return "🚑";
        if (unit.callsign.includes("FIRE")) return "🚒";
        if (unit.callsign.includes("RESCUE")) return "🚤";
        return "🚁";
      };

      const getStatusColor = () => {
        if (unit.status === "AVAILABLE") return "#10b981";
        if (unit.status === "EN ROUTE") return "#f59e0b";
        if (unit.status === "ON SCENE") return "#ef4444";
        return "#64748b";
      };

      const iconHtml = `
        <div style="
          background: #0f172a;
          color: #f8fafc;
          font-family: monospace;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 6px;
          border: 1.5px solid ${getStatusColor()};
          box-shadow: 0 2px 8px rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          gap: 3px;
          white-space: nowrap;
          cursor: pointer;
          transform: translate(-50%, -50%);
        ">
          <span>${getUnitIcon()}</span>
          <span style="color: #38bdf8;">${unit.callsign}</span>
          <span style="font-size: 8px; color: ${getStatusColor()};">●</span>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: "resq-unit-marker",
        iconSize: [0, 0],
      });

      const marker = L.marker([unit.currentLat, unit.currentLon], { icon: customIcon });

      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; font-size: 12px; padding: 3px;">
          <b style="color: #0f172a;">${unit.callsign} (${unit.personnelName})</b><br/>
          <span style="color: #475569;">Agency: ${unit.agency}</span><br/>
          <span style="color: #0284c7; font-weight: 600;">Status: ${unit.status}</span><br/>
          <span style="font-size: 10px; color: #64748b;">Vehicle: ${unit.vehicleType}</span>
        </div>
      `);

      marker.addTo(respondersLayerRef.current);
    });
  }, [responders, mapReady, showMapView]);

  // Render Infrastructure Markers on Map (Hospitals, Shelters, Blocked Roads)
  useEffect(() => {
    const L = (window as any).L;
    if (!showMapView || !mapReady || !L || !mapRef.current || !infrastructureLayerRef.current) return;

    infrastructureLayerRef.current.clearLayers();

    infrastructure.forEach((item) => {
      const getIcon = () => {
        if (item.type === "HOSPITAL") return "🏥";
        if (item.type === "SHELTER") return "⛺";
        if (item.type === "FIRE_STATION") return "🚒";
        if (item.type === "BLOCKED_ROAD") return "🚧";
        return "🏢";
      };

      const iconHtml = `
        <div style="
          background: #1e293b;
          color: white;
          font-size: 11px;
          padding: 2px 4px;
          border-radius: 6px;
          border: 1px solid #475569;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          cursor: pointer;
          transform: translate(-50%, -50%);
        ">
          ${getIcon()}
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: "resq-infra-marker",
        iconSize: [0, 0],
      });

      const marker = L.marker([item.lat, item.lon], { icon: customIcon });

      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; font-size: 12px; padding: 2px;">
          <b style="color: #0f172a;">${getIcon()} ${item.name}</b><br/>
          <span style="color: #475569;">${item.address}</span><br/>
          <span style="color: #059669; font-weight: 600;">Status: ${item.status}</span><br/>
          ${item.availableBeds ? `<span style="font-size: 11px; color: #0284c7;">Available Beds: ${item.availableBeds}</span><br/>` : ""}
          <span style="font-size: 10px; color: #64748b;">Phone: ${item.contactNumber}</span>
        </div>
      `);

      marker.addTo(infrastructureLayerRef.current);
    });
  }, [infrastructure, mapReady, showMapView]);

  // Render Route Polylines for Active Dispatches
  useEffect(() => {
    const L = (window as any).L;
    if (!showMapView || !mapReady || !L || !mapRef.current || !routesLayerRef.current) return;

    routesLayerRef.current.clearLayers();

    dispatches.forEach((d) => {
      if (d.status !== "COMPLETED" && d.status !== "CANCELLED" && d.routeCoordinates.length > 1) {
        L.polyline(d.routeCoordinates, {
          color: "#38bdf8",
          weight: 4,
          opacity: 0.85,
          dashArray: "6, 6",
        }).addTo(routesLayerRef.current);
      }
    });
  }, [dispatches, mapReady, showMapView]);

  // Switch Base Layer
  const switchBaseLayer = (key: keyof typeof TILE_LAYERS) => {
    const L = (window as any).L;
    if (!L || !mapRef.current || !baseLayerRef.current) return;

    mapRef.current.removeLayer(baseLayerRef.current);
    if (secondaryOverlayRef.current) {
      mapRef.current.removeLayer(secondaryOverlayRef.current);
      secondaryOverlayRef.current = null;
    }

    const layerCfg = TILE_LAYERS[key] as any;
    const newLayer = L.tileLayer(layerCfg.base, {
      maxZoom: 21,
      maxNativeZoom: layerCfg.maxNativeZoom || 19,
      subdomains: layerCfg.subdomains,
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 2,
    }).addTo(mapRef.current);

    baseLayerRef.current = newLayer;
    newLayer.bringToBack();

    if (layerCfg.overlay) {
      const newOverlay = L.tileLayer(layerCfg.overlay, {
        maxZoom: 21,
        maxNativeZoom: layerCfg.maxNativeZoom || 18,
        subdomains: layerCfg.subdomains,
        updateWhenZooming: false,
        updateWhenIdle: true,
        keepBuffer: 2,
      }).addTo(mapRef.current);
      secondaryOverlayRef.current = newOverlay;
    }

    setCurrentBaseLayer(key);
    setShowLayerMenu(false);
  };

  // Toggle Street Names Overlay
  const toggleStreetOverlay = () => {
    if (!mapRef.current || !streetOverlayRef.current) return;
    if (streetOverlayActive) {
      mapRef.current.removeLayer(streetOverlayRef.current);
      setStreetOverlayActive(false);
    } else {
      streetOverlayRef.current.addTo(mapRef.current);
      streetOverlayRef.current.bringToFront();
      setStreetOverlayActive(true);
    }
  };

  // Real-time Search using OpenStreetMap Nominatim
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query || !mapRef.current) return;

    const coordMatch = query.match(/^([-+]?[0-9]*\.?[0-9]+)[,\s]+([-+]?[0-9]*\.?[0-9]+)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        flyToAndPin(lat, lon, 16, `Coordinates (${lat.toFixed(4)}, ${lon.toFixed(4)})`, `Direct GPS input: ${lat}, ${lon}`);
        return;
      }
    }

    setIsSearching(true);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=1&q=${encodeURIComponent(
        query
      )}`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });

      if (res.ok) {
        const results = await res.json();
        if (results && results.length > 0) {
          const item = results[0];
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);
          const displayName = item.display_name;
          const shortTitle = displayName.split(",")[0];

          let zoomLevel = 15;
          if (item.type === "administrative" || item.addresstype === "state") zoomLevel = 7;
          else if (item.addresstype === "city" || item.addresstype === "district") zoomLevel = 11;
          else zoomLevel = 16;

          flyToAndPin(lat, lon, zoomLevel, shortTitle, displayName);
          setIsSearching(false);
          return;
        }
      }
    } catch {
      // Offline fallback
    }

    alert(`Location "${searchQuery}" not found. Try searching a major city or road name.`);
    setIsSearching(false);
  };

  // Fly to location with a clean interactive highlight pin
  const flyToAndPin = (lat: number, lon: number, zoom: number, title: string, fullDetails: string) => {
    const L = (window as any).L;
    if (!mapRef.current || !L) return;

    mapRef.current.flyTo([lat, lon], zoom, {
      duration: 2.8,
      easeLinearity: 0.22,
      noMoveStart: true,
    });

    if (activePinRef.current) {
      mapRef.current.removeLayer(activePinRef.current);
    }

    const pinMarker = L.circleMarker([lat, lon], {
      radius: 8,
      color: "#ffffff",
      weight: 2.5,
      fillColor: "#0284c7",
      fillOpacity: 1,
    });

    pinMarker.bindPopup(`
      <div style="font-family:'Segoe UI',sans-serif; padding:4px 6px; max-width:260px;">
        <b style="font-size:13.5px; color:#0f172a;">📍 ${title}</b><br/>
        <span style="font-size:11px; color:#475569; display:block; margin:4px 0;">${fullDetails}</span>
        <div style="margin-top:6px; font-size:10.5px; color:#0369a1; font-weight:600; background:#f0f9ff; padding:2px 6px; border-radius:4px; border:1px solid #bae6fd;">
          Lat: ${lat.toFixed(5)}° | Lon: ${lon.toFixed(5)}° (Zoom ${zoom}x)
        </div>
      </div>
    `);

    pinMarker.addTo(mapRef.current);
    setTimeout(() => pinMarker.openPopup(), 1200);
    activePinRef.current = pinMarker;
  };

  // Geodesic measurement tool
  const toggleMeasurement = () => {
    const L = (window as any).L;
    if (!mapRef.current || !measureLayerRef.current || !L) return;

    if (isMeasuring) {
      setIsMeasuring(false);
      measureLayerRef.current.clearLayers();
      measurePointsRef.current = [];
      setMeasureDistance(null);
      mapRef.current.off("click", onMeasureClick);
    } else {
      setIsMeasuring(true);
      measureLayerRef.current.clearLayers();
      measurePointsRef.current = [];
      setMeasureDistance("Click any 2 or more points to measure distance");
      mapRef.current.on("click", onMeasureClick);
    }
  };

  const onMeasureClick = (e: any) => {
    const L = (window as any).L;
    if (!L || !measureLayerRef.current) return;

    const latlng = e.latlng;
    measurePointsRef.current.push(latlng);

    L.circleMarker(latlng, {
      radius: 5,
      color: "#0284c7",
      fillColor: "#fff",
      fillOpacity: 1,
      weight: 2,
    }).addTo(measureLayerRef.current);

    if (measurePointsRef.current.length > 1) {
      L.polyline(measurePointsRef.current, {
        color: "#0284c7",
        weight: 3,
        dashArray: "6, 6",
      }).addTo(measureLayerRef.current);

      let totalMeters = 0;
      for (let i = 0; i < measurePointsRef.current.length - 1; i++) {
        totalMeters += measurePointsRef.current[i].distanceTo(measurePointsRef.current[i + 1]);
      }

      const km = (totalMeters / 1000).toFixed(2);
      setMeasureDistance(`Total Distance: ${km} km (${Math.round(totalMeters)} m)`);
    }
  };

  // User Geolocation
  const handleLocateMe = () => {
    const L = (window as any).L;
    if (!mapRef.current || !locationLayerRef.current || !navigator.geolocation) {
      alert("Geolocation is not permitted or supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        locationLayerRef.current.clearLayers();

        L.circle([latitude, longitude], {
          radius: accuracy,
          color: "#0284c7",
          fillColor: "#38bdf8",
          fillOpacity: 0.25,
          weight: 1.5,
        }).addTo(locationLayerRef.current);

        const marker = L.circleMarker([latitude, longitude], {
          radius: 8,
          color: "#ffffff",
          weight: 2.5,
          fillColor: "#0284c7",
          fillOpacity: 1,
        }).addTo(locationLayerRef.current);

        marker.bindPopup(`<b>Your Current Location</b><br/>Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}<br/>Accuracy: ±${Math.round(accuracy)}m`).openPopup();
        mapRef.current.flyTo([latitude, longitude], 16, { duration: 2.5, easeLinearity: 0.22 });
      },
      (err) => alert(`Location error: ${err.message}`),
      { enableHighAccuracy: true }
    );
  };

  if (!showMapView) {
    return <CommandDashboard
      incidents={incidents}
      responders={responders}
      dispatches={dispatches}
      unreadAlertCount={unreadAlertCount}
      onMap={() => {
        setMapReady(false);
        setShowMapView(true);
      }}
      onReport={() => setShowCitizenReport(true)}
      onAlerts={() => setShowAlertsDrawer(true)}
      onWorkspace={() => setShowRoleWorkspace(true)}
      onAnalytics={() => setShowAnalytics(true)}
      showCitizenReport={showCitizenReport}
      showRoleWorkspace={showRoleWorkspace}
      showAlertsDrawer={showAlertsDrawer}
      showAnalytics={showAnalytics}
      showDispatchModal={showDispatchModal}
      dispatchIncident={dispatchIncident}
      onCloseReport={() => setShowCitizenReport(false)}
      onCloseWorkspace={() => setShowRoleWorkspace(false)}
      onCloseAlerts={() => setShowAlertsDrawer(false)}
      onCloseAnalytics={() => setShowAnalytics(false)}
      onCloseDispatch={() => {
        setShowDispatchModal(false);
        setDispatchIncident(null);
      }}
      onOpenDispatch={(incident) => {
        setDispatchIncident(incident);
        setShowDispatchModal(true);
      }}
    />;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none font-sans bg-slate-900 text-slate-800">

      {/* ============ SPLASH SCREEN ============ */}
      {showSplash && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #020d1a 0%, #0c2340 40%, #0c4a75 70%, #0369a1 100%)",
            transition: splashFading ? "opacity 0.8s ease-out, transform 0.8s ease-out" : "none",
            opacity: splashFading ? 0 : 1,
            transform: splashFading ? "scale(1.04)" : "scale(1)",
          }}
          onTransitionEnd={() => {
            if (splashFading) setShowSplash(false);
          }}
        >
          {/* Animated glowing rings */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: 700, height: 700,
              borderRadius: "50%",
              border: "1.5px solid rgba(56,189,248,0.12)",
              animation: "splashRing 4s ease-in-out infinite",
            }} />
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: 500, height: 500,
              borderRadius: "50%",
              border: "1.5px solid rgba(56,189,248,0.18)",
              animation: "splashRing 3s ease-in-out infinite 0.5s",
            }} />
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: 320, height: 320,
              borderRadius: "50%",
              border: "1.5px solid rgba(56,189,248,0.25)",
              animation: "splashRing 2.5s ease-in-out infinite 1s",
            }} />
          </div>

          {/* Main content */}
          <div
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 24,
              animation: "splashFadeUp 0.9s cubic-bezier(0.22,1,0.36,1) both",
            }}
          >
            {/* Shield logo */}
            <div style={{
              width: 100, height: 100, borderRadius: "50%",
              background: "radial-gradient(circle at 35% 35%, #38bdf8, #0369a1 70%)",
              border: "3px solid rgba(255,255,255,0.25)",
              boxShadow: "0 0 60px rgba(56,189,248,0.5), 0 0 120px rgba(56,189,248,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 48,
              animation: "splashPulse 2s ease-in-out infinite",
            }}>🛡️</div>

            {/* Brand */}
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontSize: 52, fontWeight: 900, letterSpacing: "-2px",
                color: "#ffffff",
                lineHeight: 1,
                textShadow: "0 0 40px rgba(56,189,248,0.6)",
              }}>ResQ</div>
              <div style={{
                fontSize: 18, fontWeight: 300, letterSpacing: 8,
                color: "#7dd3fc",
                textTransform: "uppercase",
                marginTop: 4,
              }}>GeoPlatform</div>
              <div style={{
                fontSize: 12, fontWeight: 500, letterSpacing: 2,
                color: "rgba(186,230,253,0.7)",
                textTransform: "uppercase",
                marginTop: 10,
                padding: "5px 16px",
                border: "1px solid rgba(56,189,248,0.25)",
                borderRadius: 999,
                background: "rgba(56,189,248,0.08)",
              }}>NDMA Incident Triage &amp; GIS Coordination</div>
            </div>

            {/* Loading bar */}
            <div style={{
              width: 240, height: 3, borderRadius: 99,
              background: "rgba(56,189,248,0.15)",
              overflow: "hidden",
              marginTop: 12,
            }}>
              <div style={{
                height: "100%",
                background: "linear-gradient(90deg, #38bdf8, #0ea5e9, #38bdf8)",
                backgroundSize: "200% 100%",
                borderRadius: 99,
                animation: "splashLoader 2.2s ease-in-out forwards, splashLoaderShimmer 1.5s linear infinite",
              }} />
            </div>

            {/* Tagline */}
            <div style={{
              fontSize: 12, color: "rgba(148,163,184,0.8)",
              fontStyle: "italic",
              animation: "splashFadeUp 1.2s 0.3s cubic-bezier(0.22,1,0.36,1) both",
            }}>Initializing emergency operations dashboard&hellip;</div>
          </div>

          {/* Splash keyframes via style tag */}
          <style>{`
            @keyframes splashRing {
              0%, 100% { opacity: 0.3; transform: translate(-50%,-50%) scale(1); }
              50% { opacity: 0.7; transform: translate(-50%,-50%) scale(1.04); }
            }
            @keyframes splashFadeUp {
              from { opacity: 0; transform: translateY(28px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes splashPulse {
              0%, 100% { box-shadow: 0 0 60px rgba(56,189,248,0.5), 0 0 120px rgba(56,189,248,0.2); }
              50% { box-shadow: 0 0 90px rgba(56,189,248,0.8), 0 0 180px rgba(56,189,248,0.35); }
            }
            @keyframes splashLoader {
              from { width: 0%; }
              to { width: 100%; }
            }
            @keyframes splashLoaderShimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateY(16px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}
      {/* ============ HEADER (ResQ Bhuvan-Style) ============ */}
      <header className="fixed top-3 left-3 right-3 h-12 z-[1000] rounded-2xl bg-slate-950/90 backdrop-blur-xl flex items-center justify-between px-3 text-white shadow-2xl border border-white/10">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => mapRef.current?.flyTo([23.5, 80.5], 5, { duration: 3, easeLinearity: 0.22 })}
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-lg shadow transition-transform hover:scale-105"
            style={{
              background: "radial-gradient(circle at 35% 35%, #38bdf8, #0369a1 70%)",
            }}
            title="Center map on India"
            aria-label="Center map on India"
          >
            🛡️
          </button>

          <div>
            <div className="flex items-baseline gap-1.5 leading-tight">
              <span className="text-[18px] font-extrabold tracking-tight text-white">ResQ</span>
              <span className="text-[12px] font-medium tracking-wide text-sky-300">Operations</span>
            </div>
          </div>
        </div>

        <nav className="hidden">
          <button
            onClick={() => {
              setShowMapView(false);
              setShowDashboard(false);
            }}
            className="hidden md:flex items-center gap-1.5 rounded-full border border-sky-700/60 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-sky-500/70 hover:text-white"
            title="Return to the command dashboard"
          >
            <span aria-hidden>▦</span>
            <span>Dashboard</span>
          </button>
          {/* Role-specific dashboard panel */}
          <button
            onClick={() => setShowDashboard((prev) => !prev)}
            className={`hidden md:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition cursor-pointer ${
              showDashboard
                ? "bg-sky-500/30 border-sky-400/60 text-sky-200"
                : "bg-slate-900/60 border-slate-700/60 text-slate-300 hover:text-white hover:border-sky-600/50"
            }`}
            title="Toggle role-specific dashboard panel"
          >
            <span>📊</span>
            <span>My workspace</span>
          </button>
          {/* If NOT Authenticated: Guest Mode Controls */}
          {!isAuthenticated ? (
            <>
              {/* Quick Role Switcher Pills for Instant Testing */}
              <div className="hidden items-center gap-1.5 bg-slate-900/80 p-1 rounded-full border border-sky-800/50">
                <span className="text-[10px] text-sky-300 font-bold px-2 uppercase tracking-wider">Preview View:</span>
                <button
                  onClick={() => switchRole("Public / Citizen")}
                  className="text-xs bg-slate-800 hover:bg-sky-700 text-sky-200 hover:text-white px-2.5 py-0.5 rounded-full transition cursor-pointer flex items-center gap-1"
                  title="Switch to Citizen / User view"
                >
                  <span>👤</span> Citizen
                </button>
                <button
                  onClick={() => switchRole("Command Officer / Incident Commander")}
                  className="text-xs bg-slate-800 hover:bg-blue-700 text-blue-200 hover:text-white px-2.5 py-0.5 rounded-full transition cursor-pointer flex items-center gap-1"
                  title="Switch to Administrator view"
                >
                  <span>🛡️</span> Admin
                </button>
                <button
                  onClick={() => switchRole("Medic / Ambulance Team")}
                  className="text-xs bg-slate-800 hover:bg-amber-700 text-amber-200 hover:text-white px-2.5 py-0.5 rounded-full transition cursor-pointer flex items-center gap-1"
                  title="Switch to Service Provider view"
                >
                  <span>🚑</span> Responder
                </button>
              </div>

              {/* Login / Register Button */}
              <button
                onClick={() => {
                  setAuthModalMode("login");
                  setShowAuthModal(true);
                }}
                className="bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold px-3 py-1.5 rounded-full cursor-pointer transition shadow-md flex items-center gap-1.5"
                title="Sign In or Register"
              >
                <span>🔐</span>
                <span>Sign in</span>
              </button>
            </>
          ) : (
            /* If Authenticated: Tailored Role Badges & Actions */
            <>
              {/* Active Role Workspace Button */}
              <button
                onClick={() => setShowRoleWorkspace(true)}
                className={`bg-slate-900/90 hover:bg-slate-900 border px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 shadow-sm transition ${
                  roleCategory === "user"
                    ? "border-sky-500/70 text-sky-200"
                    : roleCategory === "admin"
                    ? "border-blue-500/70 text-blue-200"
                    : "border-amber-500/70 text-amber-200"
                }`}
                title="Open Operational Role Workspace"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    roleCategory === "user"
                      ? "bg-sky-400"
                      : roleCategory === "admin"
                      ? "bg-blue-400 animate-pulse"
                      : "bg-amber-400 animate-pulse"
                  }`}
                />
                <span className="font-semibold text-white">
                  {roleCategory === "user"
                    ? "Citizen Portal"
                    : roleCategory === "admin"
                    ? "Command HQ"
                    : "Field Console"}
                </span>
                <span className="text-[10px] opacity-80">
                  ({currentUser.name.split(" ")[0]}
                  {currentUser.assignedUnitCallsign ? ` • ${currentUser.assignedUnitCallsign}` : ""})
                </span>
              </button>

              {/* Administrator Quick Controls */}
              {roleCategory === "admin" && (
                <>
                  <button
                    onClick={() => setShowSimulationBar((prev) => !prev)}
                    className="hidden sm:flex items-center gap-1.5 bg-amber-600/90 hover:bg-amber-600 text-white text-xs px-2.5 py-1 rounded-full cursor-pointer transition shadow"
                    title="Toggle Disaster Scenario Simulation Engine"
                  >
                    <span>🎯</span>
                    <span className="font-semibold">Sim Scenario</span>
                  </button>

                  <button
                    onClick={() => setShowAnalytics(true)}
                    className="hidden md:flex items-center gap-1 text-white hover:text-sky-200 transition-colors cursor-pointer text-xs font-semibold px-2 py-1 rounded hover:bg-sky-900/50"
                    title="Open Situation Report & Metrics"
                  >
                    <span>📊</span> Analytics
                  </button>
                </>
              )}

              {/* Service Provider Quick Status Indicator */}
              {roleCategory === "service_provider" && (
                <div className="hidden sm:flex items-center gap-1 text-[11px] bg-slate-900/80 px-2 py-0.5 rounded-full border border-amber-600/50 text-amber-300 font-mono">
                  <span>Unit:</span>
                  <span className="font-bold text-white">{currentUser.assignedUnitCallsign || "RESCUE"}</span>
                </div>
              )}

              {/* Switch Role Quick Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowRoleMenu(!showRoleMenu)}
                  className="bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 cursor-pointer transition"
                  title="Switch Persona / Account"
                >
                  <span className="text-xs">🔄</span>
                  <span className="hidden md:inline">Switch Role</span>
                  <span className="text-[9px]">▼</span>
                </button>

                {showRoleMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl p-2 z-[1100] text-xs space-y-1">
                    <div className="px-2 py-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                      Switch Role View
                    </div>
                    <button
                      onClick={() => {
                        switchRole("Public / Citizen");
                        setShowRoleMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-sky-950 text-slate-200 hover:text-sky-300 flex items-center gap-2 transition cursor-pointer"
                    >
                      <span>👤</span> Citizen / User
                    </button>
                    <button
                      onClick={() => {
                        switchRole("Command Officer / Incident Commander");
                        setShowRoleMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-950 text-slate-200 hover:text-blue-300 flex items-center gap-2 transition cursor-pointer"
                    >
                      <span>🛡️</span> Incident Commander (Admin)
                    </button>
                    <button
                      onClick={() => {
                        switchRole("Medic / Ambulance Team");
                        setShowRoleMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-amber-950 text-slate-200 hover:text-amber-300 flex items-center gap-2 transition cursor-pointer"
                    >
                      <span>🚑</span> Paramedic Medic (Service Provider)
                    </button>
                    <button
                      onClick={() => {
                        switchRole("Firefighter / Fire Service Officer");
                        setShowRoleMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-amber-950 text-slate-200 hover:text-amber-300 flex items-center gap-2 transition cursor-pointer"
                    >
                      <span>🚒</span> Firefighter (Service Provider)
                    </button>
                    <button
                      onClick={() => {
                        switchRole("NDRF / SDRF Team Leader or Responder");
                        setShowRoleMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-amber-950 text-slate-200 hover:text-amber-300 flex items-center gap-2 transition cursor-pointer"
                    >
                      <span>🚤</span> NDRF Rescue (Service Provider)
                    </button>
                    <div className="pt-1 border-t border-slate-800">
                      <button
                        onClick={() => {
                          logout();
                          setShowRoleMenu(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-950 text-red-400 hover:text-red-300 flex items-center gap-2 transition cursor-pointer font-semibold"
                      >
                        <span>🚪</span> Sign Out to Guest Portal
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Sign Out Button */}
              <button
                onClick={logout}
                className="hidden sm:flex items-center gap-1 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800/60 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition"
                title="Sign Out to General Public View"
              >
                <span>🚪</span>
                <span>Sign Out</span>
              </button>
            </>
          )}

          {/* Emergency SOS Distress Intake (Available to All) */}
          <div
            onClick={() => setShowCitizenReport(true)}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded-full cursor-pointer transition-colors shadow"
            title="Citizen Distress & SOS Reporting"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-white animate-ping" />
            <span className="font-bold tracking-wider">REPORT SOS</span>
          </div>

          {/* Notifications Bell */}
          <button
            onClick={() => setShowAlertsDrawer(true)}
            className="relative p-1.5 text-white hover:text-sky-200 transition-colors cursor-pointer"
            title="Open Emergency Alerts"
          >
            <span className="text-base">🔔</span>
            {unreadAlertCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {unreadAlertCount}
              </span>
            )}
          </button>

          {/* Language Selector */}
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            className="bg-white text-slate-800 border-none rounded px-2 py-1 text-xs font-medium cursor-pointer shadow-sm outline-none hidden sm:block"
          >
            <option>English</option>
            <option>हिन्दी</option>
            <option>বাংলা</option>
            <option>தமிழ்</option>
            <option>తెలుగు</option>
            <option>मराठी</option>
          </select>
        </nav>
        <nav aria-label="Quick actions" className="flex items-center gap-2">
          {!isAuthenticated && (
            <button
              onClick={() => {
                setAuthModalMode("login");
                setShowAuthModal(true);
              }}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Sign in
            </button>
          )}
          <button
            onClick={() => setShowCitizenReport(true)}
            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700"
            title="Report an emergency"
          >
            Report SOS
          </button>
          <button
            onClick={() => setShowAlertsDrawer(true)}
            aria-label={`Open alerts${unreadAlertCount ? `, ${unreadAlertCount} unread` : ""}`}
            className="relative grid size-9 place-items-center rounded-lg text-white transition hover:bg-white/10"
            title="Alerts"
          >
            <span aria-hidden>🔔</span>
            {unreadAlertCount > 0 && (
              <span className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {unreadAlertCount}
              </span>
            )}
          </button>
        </nav>
      </header>

      {/* ============ SEARCH PANEL ============ */}
      <button
        onClick={() => setShowNavDrawer(true)}
        aria-label="Open navigation sidebar"
        title="Open navigation"
        className="fixed left-0 top-1/2 z-[950] grid h-12 w-7 -translate-y-1/2 place-items-center rounded-r-xl border border-l-0 border-border bg-[#0b1324]/95 text-lg font-semibold text-sky-400 shadow-xl transition hover:w-9 hover:bg-[#111c33] cursor-pointer"
      >
        ›
      </button>
      <div className="fixed left-4 top-[72px] z-[900] flex items-center overflow-hidden rounded-xl border border-border bg-[#0b1324]/95 shadow-2xl backdrop-blur-md">
        <form onSubmit={handleSearch} className="flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search city, district, village, or coordinates..."
            className="w-52 sm:w-72 px-3 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted/60 outline-none bg-transparent"
          />
          <button
            type="submit"
            disabled={isSearching}
            title="Search Real Location"
            className="p-2.5 text-muted hover:text-foreground hover:bg-surface-muted transition-colors text-xs sm:text-sm cursor-pointer"
          >
            {isSearching ? "⏳" : "🔍"}
          </button>
        </form>

        <button
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          title="Choose map layer"
          aria-label="Choose map layer"
          className={`p-2.5 px-3 transition-colors text-sm font-bold cursor-pointer border-l border-border ${
            showLayerMenu ? "bg-sky-500/20 text-sky-300" : "text-sky-400 hover:bg-surface-muted"
          }`}
        >
          ◆
        </button>
      </div>

      {/* ============ BASEMAP SWITCHER ============ */}
      {showLayerMenu && (
        <div className="fixed top-[116px] left-4 z-[950] w-84 bg-[#0b1324] rounded-2xl shadow-2xl border border-border p-4 animate-fadeIn text-foreground">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-white block">Basemap Views</span>
              <span className="text-[10px] text-sky-400 font-medium">Deep Zoom Supported (Up to 21x)</span>
            </div>
            <button
              onClick={() => setShowLayerMenu(false)}
              className="text-muted hover:text-white text-sm font-bold cursor-pointer rounded p-1 hover:bg-surface-muted"
            >
              ✕
            </button>
          </div>

          <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">CHOOSE BASEMAP</div>
          <div className="space-y-1 mb-3">
            {Object.entries(TILE_LAYERS).map(([key, config]) => (
              <button
                key={key}
                onClick={() => switchBaseLayer(key as keyof typeof TILE_LAYERS)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                  currentBaseLayer === key
                    ? "bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/40"
                    : "hover:bg-surface-muted text-muted hover:text-foreground"
                }`}
              >
                <span>{config.name}</span>
                {currentBaseLayer === key && <span className="text-sky-400 font-bold">✓</span>}
              </button>
            ))}
          </div>

          <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">STREET DETAIL OVERLAYS</div>
          <div className="space-y-1">
            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-muted cursor-pointer text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <span>🏷️</span> Keep Street &amp; Road Names Visible
              </span>
              <input
                type="checkbox"
                checked={streetOverlayActive}
                onChange={toggleStreetOverlay}
                className="rounded text-sky-500 w-4 h-4 cursor-pointer accent-sky-500"
              />
            </label>
          </div>
        </div>
      )}

      {/* ============ MAP CANVAS ============ */}
      <div id="map" ref={mapContainerRef} className="fixed inset-0 bg-[#070d18]" />

      {/* Measurement Status */}
      {isMeasuring && (
        <div className="fixed top-[68px] left-1/2 -translate-x-1/2 z-[900] bg-[#093452]/95 text-white backdrop-blur-md px-4 py-2 rounded-full shadow-2xl border border-sky-500/40 text-xs flex items-center gap-3">
          <span>📏 <b>Measuring:</b> {measureDistance}</span>
          <button
            onClick={toggleMeasurement}
            className="bg-sky-600 hover:bg-sky-500 px-3 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer transition shadow-xs"
          >
            Done
          </button>
        </div>
      )}

      {/* ============ MAP TOOLS ============ */}
      <div className="fixed right-4 top-1/2 z-[900] flex -translate-y-1/2 flex-col gap-1 rounded-2xl border border-border bg-[#0b1324]/95 p-1.5 shadow-2xl backdrop-blur-md">
        <button
          onClick={() => mapRef.current?.zoomIn(1, { animate: true })}
          title="Zoom In"
          aria-label="Zoom in"
          className="grid size-9 place-items-center rounded-xl text-lg font-semibold text-muted transition hover:bg-surface-muted hover:text-white cursor-pointer"
        >
          ＋
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut(1, { animate: true })}
          title="Zoom Out"
          aria-label="Zoom out"
          className="grid size-9 place-items-center rounded-xl text-lg font-semibold text-muted transition hover:bg-surface-muted hover:text-white cursor-pointer"
        >
          －
        </button>
        <button
          onClick={handleLocateMe}
          title="My Location"
          aria-label="Show my location"
          className="grid size-9 place-items-center rounded-xl text-base text-muted transition hover:bg-surface-muted hover:text-white cursor-pointer"
        >
          📍
        </button>
      </div>

      {/* ============ BOTTOM STATUS & AREA ============ */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[900] hidden sm:flex items-center gap-2.5 bg-[#0b1324]/90 backdrop-blur-md text-white text-[11px] px-4 py-2 rounded-full shadow-2xl border border-border pointer-events-none">
        <div className="flex items-center gap-2 text-sky-300 font-semibold">
          <span>📍 Sector:</span>
          <span className="text-white font-normal truncate max-w-xs sm:max-w-md">{visibleAreaName}</span>
          <span className="text-[10px] text-sky-400 font-mono bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/40">[{currentZoom}x Zoom]</span>
        </div>
        <div className="hidden sm:block w-[1px] h-3.5 bg-border mx-1" />
        <div className="font-mono text-muted text-[11px]">{coordsText}</div>
      </div>

      {/* ============ NAVIGATION DRAWER ============ */}
      {showNavDrawer && (
        <div className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-xs flex">
          <div className="bg-[#0b1324] border-r border-border w-80 max-w-full h-full shadow-2xl p-5 flex flex-col justify-between overflow-y-auto text-foreground">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🛡️</span>
                  <div>
                    <h3 className="font-bold text-white text-base leading-none">ResQ Command</h3>
                    <span className="text-[11px] text-sky-300">NDMA Operations Deck</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowNavDrawer(false)}
                  aria-label="Close navigation sidebar"
                  title="Close navigation"
                  className="grid size-8 place-items-center rounded-lg bg-surface-muted text-base font-bold text-muted hover:text-white transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">Navigation</h4>
                  <div className="space-y-1 text-sm">
                    <button
                      onClick={() => {
                        setShowNavDrawer(false);
                        setShowDashboard(false);
                        setMapReady(false);
                        setShowMapView(false);
                      }}
                      className="w-full cursor-pointer rounded-lg px-3 py-2.5 text-left font-medium text-muted transition-colors hover:bg-surface-muted hover:text-white"
                    >
                      <span aria-hidden className="mr-2 text-sky-400">⌂</span> Command Overview
                    </button>
                    <div aria-current="page" className="w-full rounded-lg bg-sky-500/15 border border-sky-500/30 px-3 py-2.5 font-semibold text-sky-300">
                      <span aria-hidden className="mr-2">⌖</span> Interactive GIS Map
                    </div>
                    <button onClick={() => { setShowNavDrawer(false); setShowRoleWorkspace(true); }} className="w-full rounded-lg px-3 py-2.5 text-left font-medium text-muted transition-colors hover:bg-surface-muted hover:text-white cursor-pointer"><span aria-hidden className="mr-2">▤</span> Operations Workspace</button>
                    <button onClick={() => { setShowNavDrawer(false); setShowAnalytics(true); }} className="w-full rounded-lg px-3 py-2.5 text-left font-medium text-muted transition-colors hover:bg-surface-muted hover:text-white cursor-pointer"><span aria-hidden className="mr-2">▥</span> Analytics &amp; Reports</button>
                    <button onClick={() => { setShowNavDrawer(false); setShowAlertsDrawer(true); }} className="w-full rounded-lg px-3 py-2.5 text-left font-medium text-muted transition-colors hover:bg-surface-muted hover:text-white flex items-center justify-between cursor-pointer">
                      <span><span aria-hidden className="mr-2">♧</span> Alerts</span>
                      {unreadAlertCount > 0 && <span className="rounded-full bg-red-950 border border-red-800 text-red-400 px-2 text-xs font-bold">{unreadAlertCount}</span>}
                    </button>
                    <button onClick={() => { setShowNavDrawer(false); setShowCitizenReport(true); }} className="w-full rounded-lg px-3 py-2.5 text-left font-semibold text-red-400 border border-red-900/50 bg-red-950/40 transition-colors hover:bg-red-950/80 cursor-pointer"><span aria-hidden className="mr-2">!</span> Report an Emergency (SOS)</button>
                  </div>
                </div>

                <div className="pt-2 border-t border-border">
                  <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">Direct Operational Modules</h4>
                  <div className="space-y-1 text-xs">
                    <Link href="/dm" className="block px-3 py-2 rounded-lg text-muted hover:bg-surface-muted hover:text-sky-300 transition">
                      → Command Center Dashboard (/dm)
                    </Link>
                    <Link href="/dm/incidents" className="block px-3 py-2 rounded-lg text-muted hover:bg-surface-muted hover:text-sky-300 transition">
                      → Verified Incidents Queue
                    </Link>
                    <Link href="/dm/dispatches" className="block px-3 py-2 rounded-lg text-muted hover:bg-surface-muted hover:text-sky-300 transition">
                      → Dispatch Orders &amp; Acknowledgements
                    </Link>
                    <Link href="/dm/resources" className="block px-3 py-2 rounded-lg text-muted hover:bg-surface-muted hover:text-sky-300 transition">
                      → Emergency Resources &amp; Units
                    </Link>
                    <Link href="/dm/aid" className="block px-3 py-2 rounded-lg text-muted hover:bg-surface-muted hover:text-sky-300 transition">
                      → Aid &amp; Relief Fulfillment
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-4 text-xs text-muted">
              {isAuthenticated ? (
                <div>
                  <p className="font-semibold text-white">{currentUser.name}</p>
                  <p className="mt-0.5 text-muted">{currentUser.agency}</p>
                  <button onClick={() => { logout(); setShowNavDrawer(false); }} className="mt-2 font-semibold text-red-400 hover:text-red-300 cursor-pointer">Sign out</button>
                </div>
              ) : (
                <button onClick={() => { setShowNavDrawer(false); setAuthModalMode("login"); setShowAuthModal(true); }} className="font-semibold text-sky-400 hover:text-sky-300 hover:underline cursor-pointer">Sign in to your account</button>
              )}
              <div className="font-semibold text-slate-300 mb-1">Emergency Helplines (India):</div>
              <div className="space-y-0.5 text-[11px] text-muted">
                <div>• National Emergency: <strong className="text-white">112</strong></div>
                <div>• Disaster Management (NDMA): <strong className="text-white">1070 / 1077</strong></div>
                <div>• Ambulance Service: <strong className="text-white">108</strong></div>
              </div>
            </div>
          </div>
          <div className="flex-1 cursor-pointer" onClick={() => setShowNavDrawer(false)} />
        </div>
      )}

      {/* Disaster Management: real incidents from the operations database (DM staff only) */}
      <LiveOperationsLayer mapRef={mapRef} />

      {/* ============ CITIZEN REPORT MODAL ============ */}
      <CitizenReportModal
        isOpen={showCitizenReport}
        onClose={() => setShowCitizenReport(false)}
      />

      {/* ============ INCIDENT DETAIL & COMMAND PANEL ============ */}
      <IncidentDetailPanel
        incident={selectedIncident}
        onClose={() => selectIncident(null)}
        onOpenDispatch={(incidentId: string) => {
          const inc = incidents.find((i) => i.id === incidentId) || selectedIncident;
          setDispatchIncident(inc);
          setShowDispatchModal(true);
        }}
      />

      {/* ============ DISPATCH MODAL ============ */}
      <DispatchModal
        incident={dispatchIncident}
        isOpen={showDispatchModal}
        onClose={() => {
          setShowDispatchModal(false);
          setDispatchIncident(null);
        }}
      />

      {/* ============ ROLE CONTEXTUAL WORKSPACE ============ */}
      <RoleWorkspaceModal
        isOpen={showRoleWorkspace}
        onClose={() => setShowRoleWorkspace(false)}
        onOpenCitizenReport={() => setShowCitizenReport(true)}
        onOpenDispatch={(inc) => {
          setDispatchIncident(inc);
          setShowDispatchModal(true);
        }}
      />

      {/* ============ ALERTS DRAWER ============ */}
      <AlertsDrawer
        isOpen={showAlertsDrawer}
        onClose={() => setShowAlertsDrawer(false)}
      />

      {/* ============ ANALYTICS MODAL ============ */}
      <AnalyticsModal
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(false)}
      />

      {/* ============ 12-STEP SIMULATION CONTROLLER ============ */}
      <SimulationBar
        isOpen={showSimulationBar}
        onClose={() => setShowSimulationBar(false)}
      />

      {/* ============ DYNAMIC ROLE-BASED DASHBOARD VIEWS ============ */}
      {/* Only show when user explicitly opens via nav Dashboard button */}
      {showDashboard && !isAuthenticated && (
        <GeneralPublicDashboardView
          onOpenAuth={() => {
            setAuthModalMode("login");
            setShowAuthModal(true);
          }}
          onOpenCitizenReport={() => setShowCitizenReport(true)}
          onClose={() => setShowDashboard(false)}
        />
      )}

      {showDashboard && isAuthenticated && roleCategory === "user" && (
        <CitizenDashboardView
          onOpenCitizenReport={() => setShowCitizenReport(true)}
          onClose={() => setShowDashboard(false)}
        />
      )}

      {showDashboard && isAuthenticated && roleCategory === "admin" && (
        <AdminDashboardView
          onOpenWorkspace={() => setShowRoleWorkspace(true)}
          onOpenDispatch={(inc) => {
            setDispatchIncident(inc);
            setShowDispatchModal(true);
          }}
          onOpenSimulation={() => setShowSimulationBar(true)}
          onOpenAnalytics={() => setShowAnalytics(true)}
          onClose={() => setShowDashboard(false)}
        />
      )}

      {showDashboard && isAuthenticated && roleCategory === "service_provider" && (
        <ServiceProviderDashboardView
          onOpenWorkspace={() => setShowRoleWorkspace(true)}
          onClose={() => setShowDashboard(false)}
        />
      )}

      {/* ============ AUTHENTICATION MODAL ============ */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authModalMode}
        initialRoleCategory={authModalCategory}
      />
    </div>
  );
}

export default function ResQGeoPortal() {
  return (
    <ResQProvider>
      <ResQGeoPortalInner />
    </ResQProvider>
  );
}
