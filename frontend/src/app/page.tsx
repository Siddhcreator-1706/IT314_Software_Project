"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
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
import { IncidentRecord, PortalRoleCategory } from "../types/resq";

// Basemap layer configurations with maxNativeZoom to prevent labels disappearing at deep zoom
const TILE_LAYERS = {
  googleHybrid: {
    name: "Satellite + Street Names (Google Hybrid)",
    base: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    maxZoom: 21,
    maxNativeZoom: 19,
    isSatellite: true,
  },
  googleRoadmap: {
    name: "Detailed City & Road Map (Google Streets)",
    base: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    maxZoom: 21,
    maxNativeZoom: 19,
    isSatellite: false,
  },
  streets: {
    name: "OpenStreetMap (All Villages, Lanes & Roads)",
    base: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: ["a", "b", "c"],
    maxZoom: 20,
    maxNativeZoom: 19,
    isSatellite: false,
  },
  esriTopo: {
    name: "Topographic & Physical Map (Esri Topo)",
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    subdomains: ["a", "b", "c"],
    maxZoom: 20,
    maxNativeZoom: 19,
    isSatellite: false,
  },
  esriHybrid: {
    name: "Esri Satellite + World Boundaries",
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    overlay: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    subdomains: ["a", "b", "c"],
    maxZoom: 20,
    maxNativeZoom: 18,
    isSatellite: true,
  },
  satellitePure: {
    name: "Pure Satellite (No Labels)",
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    subdomains: ["a", "b", "c"],
    maxZoom: 20,
    maxNativeZoom: 18,
    isSatellite: true,
  },
};

// Permanent 100% watermark-free street & road labels overlay (Google Transparent Roads)
const STREET_LABELS_OVERLAY = "https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}";

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
  const [currentBaseLayer, setCurrentBaseLayer] = useState<keyof typeof TILE_LAYERS>("googleHybrid");
  const [streetOverlayActive, setStreetOverlayActive] = useState(false);
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measureDistance, setMeasureDistance] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState("English");
  const [mapReady, setMapReady] = useState(false);

  // Splash screen & Dashboard panel
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  // Auth & Role Modals visibility
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("login");
  const [authModalCategory] = useState<PortalRoleCategory>("user");
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

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

  // Helper to load Leaflet from CDN reliably
  const loadScript = useCallback((src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (src.includes("leaflet.js") && typeof window !== "undefined" && (window as any).L) {
        resolve();
        return;
      }
      if (src.includes("Control.MiniMap") && typeof window !== "undefined" && (window as any).L?.Control?.MiniMap) {
        resolve();
        return;
      }
      const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
      if (existing) {
        if (existing.dataset.loaded === "true" || (src.includes("leaflet.js") && (window as any).L)) {
          resolve();
          return;
        }
        existing.addEventListener("load", () => {
          existing.dataset.loaded = "true";
          resolve();
        }, { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.dataset.loaded = "true";
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
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
    let isCancelled = false;

    const initMap = async () => {
      try {
        await loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");
        await loadScript("https://unpkg.com/leaflet-minimap@3.6.1/dist/Control.MiniMap.min.js");

        // Wait for window.L to be present in case scripts are still evaluating
        let L = typeof window !== "undefined" ? (window as any).L : null;
        for (let i = 0; i < 30 && !L; i++) {
          await new Promise((r) => setTimeout(r, 100));
          L = typeof window !== "undefined" ? (window as any).L : null;
        }

        if (isCancelled || !mapContainerRef.current || !L) return;

        // Clean up previous instance or leaflet metadata if present
        if (mapRef.current) {
          try {
            mapRef.current.remove();
          } catch {}
          mapRef.current = null;
        }
        if (mapContainerRef.current && (mapContainerRef.current as any)._leaflet_id) {
          delete (mapContainerRef.current as any)._leaflet_id;
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
        }).setView([22, 78], 3);

        mapRef.current = map;

        // Base Layer: Google Hybrid with maxNativeZoom: 19 so labels NEVER disappear
        const initialCfg = TILE_LAYERS.googleHybrid;
        const baseLayer = L.tileLayer(initialCfg.base, {
          maxZoom: 21,
          maxNativeZoom: initialCfg.maxNativeZoom,
          subdomains: initialCfg.subdomains,
          updateWhenZooming: false,
          updateWhenIdle: true,
          keepBuffer: 2,
        }).addTo(map);
        baseLayerRef.current = baseLayer;

        // Watermark-Free Street & Place Names Overlay
        const streetOverlay = L.tileLayer(STREET_LABELS_OVERLAY, {
          subdomains: ["mt0", "mt1", "mt2", "mt3"],
          maxZoom: 21,
          maxNativeZoom: 19,
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

        // Signal that the map is ready so all marker layers populate
        setMapReady(true);
        setTimeout(() => {
          map.invalidateSize();
        }, 200);

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

        // Initial smooth glide into India
        setTimeout(() => {
          if (!isCancelled && mapRef.current) {
            mapRef.current.invalidateSize();
            mapRef.current.flyTo([23.5, 80.5], 5, {
              duration: 3.2,
              easeLinearity: 0.22,
              noMoveStart: true,
            });
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
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }
    };
  }, [loadScript, fetchRealPlaceName]);

  // Handle map navigation requests from context
  useEffect(() => {
    if (!mapFocusTarget || !mapRef.current) return;
    mapRef.current.flyTo([mapFocusTarget.lat, mapFocusTarget.lon], mapFocusTarget.zoom, {
      duration: 2.5,
      easeLinearity: 0.22,
    });
    setMapFocusTarget(null);
  }, [mapFocusTarget, setMapFocusTarget]);

  // Render Incident Markers on Map
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current || !incidentsLayerRef.current) return;

    incidentsLayerRef.current.clearLayers();

    incidents.forEach((inc) => {
      const getSeverityColor = () => {
        if (inc.severity === "CRITICAL") return "#ef4444";
        if (inc.severity === "HIGH") return "#f97316";
        if (inc.severity === "MODERATE") return "#f59e0b";
        return "#10b981";
      };

      const color = getSeverityColor();
      const iconHtml = `
        <div style="
          position: relative;
          width: 24px;
          height: 24px;
          cursor: pointer;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            background: ${color}25;
            border: 1px solid ${color}60;
          "></div>
          <div style="
            position: relative;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #0B111E;
            border: 2px solid ${color};
            box-shadow: 0 0 10px ${color}80;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="
              width: 5px;
              height: 5px;
              border-radius: 50%;
              background: ${color};
            "></span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: "resq-incident-marker",
        iconSize: [0, 0],
      });

      const marker = L.marker([inc.lat, inc.lon], { icon: customIcon });

      marker.bindTooltip(`
        <div style="font-family: var(--font-geist-mono), monospace; font-size: 11px; padding: 2px 4px; line-height: 1.4;">
          <div style="font-weight: 700; color: #fff;">${inc.id}</div>
          <div style="color: ${color}; font-size: 10px; text-transform: uppercase;">${inc.severity} • ${inc.lifecycleStatus}</div>
          <div style="color: #cbd5e1; font-size: 10px;">${inc.title}</div>
        </div>
      `, { direction: "top", offset: [0, -12], opacity: 0.95 });

      marker.on("click", () => {
        selectIncident(inc);
      });

      marker.addTo(incidentsLayerRef.current);
    });
  }, [incidents, selectIncident, mapReady]);

  // Render Responder Unit Markers on Map
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current || !respondersLayerRef.current) return;

    respondersLayerRef.current.clearLayers();

    responders.forEach((unit) => {
      const getStatusColor = () => {
        if (unit.status === "AVAILABLE") return "#10b981";
        if (unit.status === "EN ROUTE") return "#f59e0b";
        if (unit.status === "ON SCENE") return "#ef4444";
        return "#64748b";
      };

      const color = getStatusColor();
      const iconHtml = `
        <div style="
          position: relative;
          width: 20px;
          height: 20px;
          cursor: pointer;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #070b14;
            border: 1.5px solid ${color};
            box-shadow: 0 0 6px ${color}80;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="width: 4px; height: 4px; border-radius: 50%; background: ${color};"></span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: "resq-unit-marker",
        iconSize: [0, 0],
      });

      const marker = L.marker([unit.currentLat, unit.currentLon], { icon: customIcon });

      marker.bindTooltip(`
        <div style="font-family: var(--font-geist-mono), monospace; font-size: 10px;">
          <b style="color: #38bdf8;">${unit.callsign}</b> • <span style="color: ${color};">${unit.status}</span>
        </div>
      `, { direction: "top", offset: [0, -10], opacity: 0.95 });

      marker.bindPopup(`
        <div style="font-family: var(--font-geist-sans), sans-serif; font-size: 12px; padding: 4px; line-height: 1.5;">
          <div style="font-weight: 700; color: #38bdf8; font-size: 13px;">${unit.callsign} • ${unit.personnelName}</div>
          <div style="color: #cbd5e1; font-size: 11px;">Agency: <b style="color: #fff;">${unit.agency}</b></div>
          <div style="color: #cbd5e1; font-size: 11px;">Status: <b style="color: ${color};">${unit.status}</b></div>
          <div style="font-size: 10px; color: #94a3b8; font-family: monospace;">Vehicle: ${unit.vehicleType}</div>
        </div>
      `);

      marker.addTo(respondersLayerRef.current);
    });
  }, [responders, mapReady]);

  // Render Infrastructure Markers on Map (Hospitals, Shelters, Blocked Roads)
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current || !infrastructureLayerRef.current) return;

    infrastructureLayerRef.current.clearLayers();

    infrastructure.forEach((item) => {
      const getBadge = () => {
        if (item.type === "HOSPITAL") return { label: "HOSPITAL", color: "#38bdf8" };
        if (item.type === "SHELTER") return { label: "SHELTER", color: "#a855f7" };
        if (item.type === "FIRE_STATION") return { label: "FIRE STN", color: "#f97316" };
        if (item.type === "BLOCKED_ROAD") return { label: "BLOCKED", color: "#ef4444" };
        return { label: "FACILITY", color: "#64748b" };
      };

      const badge = getBadge();
      const iconHtml = `
        <div style="
          position: relative;
          width: 16px;
          height: 16px;
          cursor: pointer;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 10px;
            height: 10px;
            border-radius: 2px;
            background: #070b14;
            border: 1px solid ${badge.color};
            box-shadow: 0 0 4px ${badge.color}60;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="width: 3px; height: 3px; border-radius: 1px; background: ${badge.color};"></span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: "resq-infra-marker",
        iconSize: [0, 0],
      });

      const marker = L.marker([item.lat, item.lon], { icon: customIcon });

      marker.bindTooltip(`
        <div style="font-family: var(--font-geist-mono), monospace; font-size: 10px;">
          <b>${item.name}</b> • <span style="color:${badge.color}">${badge.label}</span>
        </div>
      `, { direction: "top", offset: [0, -8], opacity: 0.95 });

      marker.bindPopup(`
        <div style="font-family: var(--font-geist-sans), sans-serif; font-size: 12px; padding: 4px; line-height: 1.5;">
          <div style="font-weight: 700; color: #fff; font-size: 13px;">${item.name}</div>
          <div style="color: #94a3b8; font-size: 11px;">${item.address}</div>
          <div style="color: #10b981; font-weight: 600; font-size: 11px;">Status: ${item.status}</div>
          ${item.availableBeds ? `<div style="font-size: 11px; color: #38bdf8;">Available Beds: <b>${item.availableBeds}</b></div>` : ""}
          <div style="font-size: 10px; color: #94a3b8; font-family: monospace;">Tel: ${item.contactNumber}</div>
        </div>
      `);

      marker.addTo(infrastructureLayerRef.current);
    });
  }, [infrastructure, mapReady]);

  // Render Route Polylines for Active Dispatches
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current || !routesLayerRef.current) return;

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
  }, [dispatches, mapReady]);

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

  // 1-Click Toggle between Satellite and Detailed Street Map
  const toggleSatelliteOrStreets = () => {
    const isCurrentlySatellite = TILE_LAYERS[currentBaseLayer].isSatellite;
    if (isCurrentlySatellite) {
      switchBaseLayer("googleRoadmap");
    } else {
      switchBaseLayer("googleHybrid");
    }
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
      <div style="font-family: var(--font-geist-mono), monospace; padding:4px 6px; max-width:260px; color:#f1f5f9;">
        <div style="font-size:12px; font-weight:700; color:#38bdf8; text-transform:uppercase; letter-spacing:0.5px;">${title}</div>
        <span style="font-size:11px; color:#94a3b8; display:block; margin:4px 0; font-family:var(--font-geist-sans),sans-serif;">${fullDetails}</span>
        <div style="margin-top:6px; font-size:10px; color:#38bdf8; font-weight:600; background:rgba(12,20,36,0.9); padding:3px 6px; border-radius:4px; border:1px solid rgba(56,189,248,0.3);">
          LAT: ${lat.toFixed(5)}° | LON: ${lon.toFixed(5)}° (ZOOM ${zoom}X)
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

  // Fullscreen
  const handleFullscreen = () => {
    const el = mapContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch((err) => console.log(err));
    } else {
      document.exitFullscreen?.().catch((err) => console.log(err));
    }
  };

  const isCurrentLayerSatellite = TILE_LAYERS[currentBaseLayer].isSatellite;

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none font-sans bg-slate-900 text-slate-800">

      {/* ============ SPLASH SCREEN ============ */}
      {showSplash && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#060a12]"
          style={{
            transition: splashFading ? "opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)" : "none",
            opacity: splashFading ? 0 : 1,
            transform: splashFading ? "scale(1.03)" : "scale(1)",
          }}
          onTransitionEnd={() => {
            if (splashFading) setShowSplash(false);
          }}
        >
          {/* Background Grid & Radar Rings */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
            <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:32px_32px] opacity-20" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-sky-500/20 animate-ping [animation-duration:4s]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full border border-sky-400/30" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[260px] h-[260px] rounded-full border border-sky-300/40" />
          </div>

          {/* Main Splash Content */}
          <div className="relative z-10 flex flex-col items-center gap-6 max-w-md px-6 text-center">
            {/* Mission Logo Reticle */}
            <div className="relative w-20 h-20 rounded-2xl bg-slate-900/90 border border-sky-500/40 shadow-2xl shadow-sky-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18" />
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              </svg>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 ring-4 ring-slate-950 animate-pulse" />
            </div>

            {/* Typography */}
            <div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-4xl font-extrabold tracking-tight text-white font-sans">ResQ</span>
                <span className="text-sm font-mono font-bold text-sky-400 uppercase tracking-widest px-2 py-0.5 rounded bg-sky-950/80 border border-sky-800/60">
                  GeoPlatform
                </span>
              </div>
              <div className="text-[11px] font-mono tracking-wider text-slate-400 uppercase mt-2">
                NDMA Incident Triage &amp; Geospatial Operations Center
              </div>
            </div>

            {/* High-Tech Progress Bar */}
            <div className="w-64 h-1.5 rounded-full bg-slate-800/80 overflow-hidden border border-slate-700/50 mt-2">
              <div className="h-full bg-gradient-to-r from-sky-500 via-cyan-400 to-sky-500 rounded-full animate-[splashLoader_2.2s_ease-in-out_forwards]" />
            </div>

            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
              <span>SYNCHRONIZING POSTGIS &amp; REAL-TIME CAD FEEDS&hellip;</span>
            </div>
          </div>
        </div>
      )}

      {/* ============ HEADER (Tactical Command C2) ============ */}
      <header className="fixed top-0 left-0 right-0 h-13 z-[1000] glass-panel flex items-center justify-between px-3.5 text-slate-100 shadow-xl border-b border-slate-800/80">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => mapRef.current?.flyTo([23.5, 80.5], 5, { duration: 3, easeLinearity: 0.22 })}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-900/90 border border-sky-500/40 shadow-md shadow-sky-950/40 cursor-pointer transition-transform hover:scale-105 active:scale-95 group"
            title="ResQ • National Overview"
          >
            <svg className="w-4 h-4 text-sky-400 group-hover:text-sky-300 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18" />
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            </svg>
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold tracking-tight text-white font-sans">ResQ</span>
            <span className="text-[10px] font-mono font-bold text-sky-400 uppercase tracking-widest px-1.5 py-0.5 rounded bg-sky-950/70 border border-sky-800/40">
              GEO
            </span>
          </div>
        </div>

        {/* Tactical Actions Nav - Streamlined, Non-Crowded */}
        <nav className="flex items-center gap-2">
          {/* Emergency SOS Distress Beacon Button */}
          <button
            onClick={() => setShowCitizenReport(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white text-xs px-3 py-1.5 rounded-full cursor-pointer transition shadow-md shadow-red-950/50 border border-red-400/40 select-none active:scale-95 font-mono font-bold tracking-wider"
            title="Emergency SOS Reporting"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            <span>SOS</span>
          </button>

          {/* Emergency Alerts Bell */}
          <button
            onClick={() => setShowAlertsDrawer(true)}
            className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Emergency Alerts"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadAlertCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-mono font-bold rounded-full w-4 h-4 flex items-center justify-center ring-2 ring-slate-950">
                {unreadAlertCount}
              </span>
            )}
          </button>

          {/* Unified Profile & Workspace Capsule */}
          <div className="relative">
            {isAuthenticated ? (
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 bg-[#0B111E]/90 hover:bg-slate-800/80 border border-slate-700/80 px-2.5 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer"
                title="Account, Workspace & Persona Switcher"
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
                  {currentUser.assignedUnitCallsign || (roleCategory === "admin" ? "Command" : currentUser.name.split(" ")[0])}
                </span>
                <svg className={`w-3 h-3 text-slate-400 transition-transform ${showUserMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 transition cursor-pointer flex items-center gap-1.5 font-mono"
                  title="Quick Role Selector"
                >
                  <span>Role Preview</span>
                  <svg className={`w-3 h-3 text-slate-400 transition-transform ${showUserMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setAuthModalMode("login");
                    setShowAuthModal(true);
                  }}
                  className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition shadow-sm border border-sky-400/30"
                >
                  Sign In
                </button>
              </div>
            )}

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-72 glass-panel-elevated rounded-xl p-2 z-[1100] text-xs space-y-1.5 shadow-2xl border border-slate-700/80">
                {/* User Info Header */}
                {isAuthenticated ? (
                  <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 font-mono">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-white text-sm">{currentUser.name}</div>
                      <span className="text-[10px] text-sky-400 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800/50">
                        {currentUser.assignedUnitCallsign || roleCategory.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">{currentUser.agency}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{currentUser.role}</div>
                  </div>
                ) : (
                  <div className="p-2 bg-slate-900/60 rounded-lg text-slate-300 font-mono text-[11px]">
                    Guest Mode &bull; Switch Persona or Sign In
                  </div>
                )}

                {/* Main Action: Open Role Console */}
                <button
                  onClick={() => {
                    setShowRoleWorkspace(true);
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-200 border border-sky-500/30 font-medium flex items-center justify-between transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
                    <span>Open Operational Workspace</span>
                  </div>
                  <span className="text-[10px] font-mono text-sky-400">&rarr;</span>
                </button>

                {/* Secondary tools */}
                <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setShowAnalytics(true);
                      setShowUserMenu(false);
                    }}
                    className="px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer text-[11px]"
                  >
                    <svg className="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    <span>Analytics</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowSimulationBar((prev) => !prev);
                      setShowUserMenu(false);
                    }}
                    className="px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer text-[11px]"
                  >
                    <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    <span>Simulator</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowDashboard((prev) => !prev);
                      setShowUserMenu(false);
                    }}
                    className="px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer text-[11px]"
                  >
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    <span>Dashboard</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowAboutModal(true);
                      setShowUserMenu(false);
                    }}
                    className="px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer text-[11px]"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>About ResQ</span>
                  </button>
                </div>

                {/* Role Switcher */}
                <div className="pt-1.5 border-t border-slate-800">
                  <div className="px-2 pb-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    Switch Active Persona
                  </div>
                  <div className="space-y-0.5">
                    <button
                      onClick={() => {
                        switchRole("Public / Citizen");
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-sky-950/60 text-slate-300 hover:text-sky-300 flex items-center gap-2 transition cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      <span>Citizen / Public</span>
                    </button>
                    <button
                      onClick={() => {
                        switchRole("Command Officer / Incident Commander");
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-950/60 text-slate-300 hover:text-blue-300 flex items-center gap-2 transition cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l8 4v6c0 5.25-3.5 10-8 12-4.5-2-8-6.75-8-12V6l8-4z" /></svg>
                      <span>Incident Commander (NDMA)</span>
                    </button>
                    <button
                      onClick={() => {
                        switchRole("Medic / Ambulance Team");
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-amber-950/60 text-slate-300 hover:text-amber-300 flex items-center gap-2 transition cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14c1.66 0 3-1.34 3-3V6l-3-2H5L2 6v5c0 1.66 1.34 3 3 3m14 0v4a2 2 0 01-2 2H7a2 2 0 01-2-2v-4m14 0H5" /></svg>
                      <span>Medic / Ambulance (EMS 108)</span>
                    </button>
                    <button
                      onClick={() => {
                        switchRole("Firefighter / Fire Service Officer");
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-orange-950/60 text-slate-300 hover:text-orange-300 flex items-center gap-2 transition cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      <span>Fire &amp; Rescue Service</span>
                    </button>
                    <button
                      onClick={() => {
                        switchRole("NDRF / SDRF Team Leader or Responder");
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-teal-950/60 text-slate-300 hover:text-teal-300 flex items-center gap-2 transition cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      <span>NDRF Search &amp; Rescue</span>
                    </button>
                  </div>
                </div>

                {/* Language Row */}
                <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between px-2 py-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Language:</span>
                  <div className="flex gap-1 text-[11px] font-mono">
                    {["English", "हिन्दी", "বাংলা"].map((l) => (
                      <button
                        key={l}
                        onClick={() => setSelectedLang(l)}
                        className={`px-1.5 py-0.5 rounded ${selectedLang === l ? "bg-sky-500/20 text-sky-300 border border-sky-500/40" : "text-slate-400 hover:text-white"}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sign Out */}
                {isAuthenticated && (
                  <div className="pt-1 border-t border-slate-800">
                    <button
                      onClick={() => {
                        logout();
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-950/40 text-red-400 hover:text-red-300 flex items-center gap-2 transition cursor-pointer font-mono text-[11px]"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* ============ SEARCH PANEL ============ */}
      <div className="fixed top-[58px] left-3 z-[900] flex items-center glass-panel rounded-xl overflow-hidden shadow-lg border border-slate-800/80">
        <button
          onClick={() => setShowNavDrawer(true)}
          title="Open Portal Navigation"
          className="p-2 px-2.5 text-slate-400 hover:text-sky-300 hover:bg-white/5 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>

        <form onSubmit={handleSearch} className="flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search location or coordinates..."
            className="w-48 sm:w-64 px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none bg-transparent font-light"
          />
          <button
            type="submit"
            disabled={isSearching}
            title="Search"
            className="p-1.5 text-slate-400 hover:text-sky-300 hover:bg-white/5 transition-colors cursor-pointer rounded-lg"
          >
            {isSearching ? (
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" /></svg>
            )}
          </button>
        </form>

        <div className="w-[1px] h-4 bg-slate-800 mx-0.5" />

        <button
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          title="Basemap Layers"
          className={`p-2 transition-colors cursor-pointer rounded-r-xl ${
            showLayerMenu ? "bg-sky-500/15 text-sky-300" : "text-slate-400 hover:text-sky-300 hover:bg-white/5"
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
        </button>
      </div>

      {/* ============ BASEMAP SWITCHER ============ */}
      {showLayerMenu && (
        <div className="fixed top-[110px] left-3 z-[950] w-80 glass-panel-elevated rounded-xl p-3.5">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/60">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200 block">Basemap Views</span>
              <span className="text-[10px] text-sky-400 font-mono">Deep Zoom Supported (Up to 21x)</span>
            </div>
            <button
              onClick={() => setShowLayerMenu(false)}
              className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-1 rounded-lg hover:bg-white/5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Choose Basemap</div>
          <div className="space-y-0.5 mb-3">
            {Object.entries(TILE_LAYERS).map(([key, config]) => (
              <button
                key={key}
                onClick={() => switchBaseLayer(key as keyof typeof TILE_LAYERS)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-all cursor-pointer ${
                  currentBaseLayer === key
                    ? "bg-sky-500/15 text-sky-200 font-semibold border border-sky-500/30"
                    : "hover:bg-white/5 text-slate-300 border border-transparent"
                }`}
              >
                <span>{config.name}</span>
                {currentBaseLayer === key && (
                  <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                )}
              </button>
            ))}
          </div>

          <div className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Street Detail Overlays</div>
          <div className="space-y-1">
            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 cursor-pointer text-xs">
              <span className="flex items-center gap-2 font-medium text-slate-300">
                <svg className="w-3.5 h-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                Keep Street & Road Names Visible
              </span>
              <div className={`w-8 h-4.5 rounded-full transition-colors relative cursor-pointer ${streetOverlayActive ? 'bg-sky-500' : 'bg-slate-700'}`} onClick={toggleStreetOverlay}>
                <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${streetOverlayActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </label>
          </div>
        </div>
      )}

      {/* ============ 1-CLICK SATELLITE ⇄ STREETS QUICK SWITCHER ============ */}
      <div className="fixed bottom-3 left-3 z-[900] flex items-center gap-1.5 glass-panel p-1 rounded-xl shadow-lg border border-slate-800/80">
        <button
          onClick={toggleSatelliteOrStreets}
          className="flex items-center gap-1.5 hover:bg-white/10 text-slate-200 text-xs font-mono px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
          title="Toggle Satellite / Street View"
        >
          {isCurrentLayerSatellite ? (
            <svg className="w-3.5 h-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>
          )}
          <span>{isCurrentLayerSatellite ? "Streets" : "Satellite"}</span>
        </button>

        <div className="w-[1px] h-3.5 bg-slate-800" />

        <button
          onClick={toggleStreetOverlay}
          className={`px-2 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
            streetOverlayActive
              ? "text-sky-300 bg-sky-500/20 font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
          title="Toggle Road Labels"
        >
          Labels
        </button>
      </div>

      {/* ============ MAP CANVAS ============ */}
      <div id="map" ref={mapContainerRef} className="fixed inset-0 bg-[#b6b6b6]" />

      {/* Measurement Status */}
      {isMeasuring && (
        <div className="fixed top-[60px] left-1/2 -translate-x-1/2 z-[900] glass-panel-elevated text-white px-4 py-1.5 rounded-xl text-xs flex items-center gap-3">
          <svg className="w-3.5 h-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 21V3l4 4 4-4 4 4 4-4v18" /></svg>
          <span className="font-mono"><b className="text-sky-300">DIST:</b> {measureDistance}</span>
          <button
            onClick={toggleMeasurement}
            className="bg-sky-600 hover:bg-sky-500 px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-semibold cursor-pointer transition-colors"
          >
            DONE
          </button>
        </div>
      )}

      {/* ============ RIGHT TOOL STRIP ============ */}
      <div className="fixed right-3 top-1/2 -translate-y-1/2 z-[900] flex flex-col gap-1.5">
        <button
          onClick={handleFullscreen}
          title="Toggle Fullscreen"
          className="w-9 h-9 rounded-lg glass-panel hover:bg-white/10 text-slate-300 hover:text-sky-300 flex items-center justify-center transition-all cursor-pointer group"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" /></svg>
        </button>
        <button
          onClick={() => mapRef.current?.flyTo([22, 78], 3, { duration: 3.0, easeLinearity: 0.22 })}
          title="Reset Global View (Country Level)"
          className="w-9 h-9 rounded-lg glass-panel hover:bg-white/10 text-slate-300 hover:text-sky-300 flex items-center justify-center transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
        <button
          onClick={() => mapRef.current?.flyTo([23.5, 80.5], 5, { duration: 3.0, easeLinearity: 0.22 })}
          title="Zoom to India (National Level)"
          className="w-9 h-9 rounded-lg glass-panel hover:bg-white/10 text-slate-300 hover:text-sky-300 flex items-center justify-center transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
        </button>
        <div className="w-full h-[1px] bg-slate-700/40 my-0.5" />
        <button
          onClick={() => mapRef.current?.zoomIn(1, { animate: true })}
          title="Zoom In"
          className="w-9 h-9 rounded-lg glass-panel hover:bg-white/10 text-slate-300 hover:text-sky-300 flex items-center justify-center transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-6-6h12" /></svg>
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut(1, { animate: true })}
          title="Zoom Out"
          className="w-9 h-9 rounded-lg glass-panel hover:bg-white/10 text-slate-300 hover:text-sky-300 flex items-center justify-center transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12h12" /></svg>
        </button>
        <div className="w-full h-[1px] bg-slate-700/40 my-0.5" />
        <button
          onClick={handleLocateMe}
          title="My Location"
          className="w-9 h-9 rounded-lg glass-panel hover:bg-white/10 text-slate-300 hover:text-emerald-300 flex items-center justify-center transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4m0 12v4M2 12h4m12 0h4" /></svg>
        </button>
        <button
          onClick={toggleMeasurement}
          title="Measure Distance"
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
            isMeasuring
              ? "bg-sky-600/90 text-white shadow-lg shadow-sky-500/30 border border-sky-400/40"
              : "glass-panel hover:bg-white/10 text-slate-300 hover:text-sky-300"
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 21V3l4 4 4-4 4 4 4-4v18" /></svg>
        </button>
      </div>

      {/* ============ BOTTOM STATUS & AREA ============ */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[900] flex items-center gap-2 glass-panel text-white text-[11px] font-mono px-3 py-1 rounded-full pointer-events-none shadow-lg border border-slate-800/80">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        <span className="text-slate-200 font-sans font-medium truncate max-w-xs sm:max-w-md">{visibleAreaName}</span>
        <span className="text-[10px] text-sky-400 bg-sky-950/70 px-1.5 py-0.5 rounded border border-sky-800/40">{currentZoom}x</span>
        <span className="hidden sm:inline text-slate-500">&bull;</span>
        <span className="hidden sm:inline text-slate-400 text-[10px]">{coordsText}</span>
      </div>

      {/* ============ ABOUT RESQ MODAL ============ */}
      {showAboutModal && (
        <div className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-elevated rounded-2xl max-w-xl w-full p-6 relative">
            <button
              onClick={() => setShowAboutModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-1 rounded-lg hover:bg-white/5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center border border-sky-400/30 shadow-lg shadow-sky-950/40">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeOpacity="0.3" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="4" strokeWidth="1.75" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white leading-tight">
                  ResQ GeoPlatform
                </h2>
                <p className="text-xs text-sky-400 font-mono">
                  NDMA INCIDENT TRIAGE & GIS COORDINATION
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-300 leading-relaxed border-t border-slate-700/60 pt-3">
              <p>
                <b className="text-white">ResQ</b> provides operational emergency response across 8 operational agency roles, compliant with the National Disaster Management Authority (NDMA) Incident Response System (IRS).
              </p>
              <div className="bg-sky-950/60 border border-sky-800/40 rounded-lg p-3 text-xs text-slate-300 space-y-1">
                <p className="font-mono font-semibold text-sky-300 mb-1 uppercase tracking-wider text-[10px]">Supported Disasters</p>
                <div>• <b className="text-white">Flood / Urban Flood:</b> Inundation modeling, boat rescue deployment.</div>
                <div>• <b className="text-white">Cyclone / Coastal Flooding:</b> Surge tracking, storm shelters, evacuation.</div>
                <div>• <b className="text-white">Major Urban / Building Fire:</b> Smoke plume assessment, hydrants, hazmat.</div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowAboutModal(false)}
                className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-xs font-mono font-semibold shadow transition-colors cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ NAVIGATION DRAWER ============ */}
      {showNavDrawer && (
        <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-xs flex">
          <div className="bg-[#0B111E] w-80 max-w-full h-full shadow-2xl shadow-black/50 p-5 flex flex-col justify-between overflow-y-auto border-r border-slate-800/60">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/60 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-sky-500/30 flex items-center justify-center">
                    <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeOpacity="0.3" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="4" strokeWidth="1.75" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base leading-none">ResQ Hub</h3>
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Emergency Operations</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowNavDrawer(false)}
                  className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-1 rounded-lg hover:bg-white/5"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Operational Agency Workspaces
                  </h4>
                  <div className="space-y-0.5 text-sm">
                    <button
                      onClick={() => {
                        setShowNavDrawer(false);
                        switchRole("Command Officer / Incident Commander");
                        setShowRoleWorkspace(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 flex items-center gap-2.5 text-slate-300 hover:text-blue-300 transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2l8 4v6c0 5.25-3.5 10-8 12-4.5-2-8-6.75-8-12V6l8-4z" /></svg>
                      Command Officer / Commander
                    </button>
                    <button
                      onClick={() => {
                        setShowNavDrawer(false);
                        switchRole("Dispatcher");
                        setShowRoleWorkspace(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 flex items-center gap-2.5 text-slate-300 hover:text-sky-300 transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-sky-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                      Dispatcher & Report Queue
                    </button>
                    <button
                      onClick={() => {
                        setShowNavDrawer(false);
                        switchRole("NDRF / SDRF Team Leader or Responder");
                        setShowRoleWorkspace(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 flex items-center gap-2.5 text-slate-300 hover:text-teal-300 transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-teal-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66-1.5 3-5 3-9s-1.34-7.5-3-9m0 18c-1.66-1.5-3-5-3-9s1.34-7.5 3-9" /></svg>
                      NDRF / SDRF Search & Rescue
                    </button>
                    <button
                      onClick={() => {
                        setShowNavDrawer(false);
                        switchRole("Medic / Ambulance Team");
                        setShowRoleWorkspace(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 flex items-center gap-2.5 text-slate-300 hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 14c1.66 0 3-1.34 3-3V6l-3-2H5L2 6v5c0 1.66 1.34 3 3 3m14 0v4a2 2 0 01-2 2H7a2 2 0 01-2-2v-4m14 0H5" /></svg>
                      Field Medic & Hospital Triage
                    </button>
                    <button
                      onClick={() => {
                        setShowNavDrawer(false);
                        switchRole("Firefighter / Fire Service Officer");
                        setShowRoleWorkspace(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 flex items-center gap-2.5 text-slate-300 hover:text-orange-300 transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-orange-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2c1.5 2.5 5 5 5 9a5 5 0 01-10 0c0-4 3.5-6.5 5-9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a2 2 0 002-2c0-1.5-2-3-2-3s-2 1.5-2 3a2 2 0 002 2z" /></svg>
                      Firefighter & Water Hydrants
                    </button>
                    <button
                      onClick={() => {
                        setShowNavDrawer(false);
                        switchRole("Logistics Officer");
                        setShowRoleWorkspace(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 flex items-center gap-2.5 text-slate-300 hover:text-violet-300 transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-violet-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                      Logistics & Warehouse Supplies
                    </button>
                    <button
                      onClick={() => {
                        setShowNavDrawer(false);
                        switchRole("System Administrator");
                        setShowRoleWorkspace(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 flex items-center gap-2.5 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
                      System Admin & Audit Logs
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/60 text-xs text-slate-500">
              <div className="font-mono font-semibold text-slate-400 mb-1 uppercase tracking-wider text-[10px]">Emergency Helplines (India)</div>
              <div>• National Emergency: <b className="text-slate-300">112</b></div>
              <div>• Disaster Management (NDMA): <b className="text-slate-300">1070 / 1077</b></div>
              <div>• Ambulance Service: <b className="text-slate-300">108</b></div>
            </div>
          </div>
          <div className="flex-1" onClick={() => setShowNavDrawer(false)} />
        </div>
      )}

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
