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
import { AdminManagementWorkspace } from "../components/role-views/AdminManagementWorkspace";
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

  // Splash screen & Dashboard panel
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

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
  const [showAdminWorkspace, setShowAdminWorkspace] = useState(false);
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

  // Helper to load Leaflet from CDN
  const loadScript = useCallback((src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
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

        if (isCancelled || !mapContainerRef.current) return;
        const L = (window as any).L;
        if (!L) return;

        if (mapRef.current) {
          mapRef.current.remove();
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

        // MiniMap control in bottom-left
        if (L.Control && L.Control.MiniMap) {
          const miniLayer = L.tileLayer(TILE_LAYERS.streets.base, { maxZoom: 19 });
          new L.Control.MiniMap(miniLayer, {
            position: "bottomleft",
            toggleDisplay: true,
            width: 140,
            height: 105,
            zoomLevelFixed: 2,
            aimingRectOptions: { color: "#0284c7", weight: 2 },
          }).addTo(map);
        }

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

        // Initial smooth glide into India
        setTimeout(() => {
          if (!isCancelled && mapRef.current) {
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
        mapRef.current.remove();
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
  }, [incidents, selectIncident]);

  // Render Responder Unit Markers on Map
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current || !respondersLayerRef.current) return;

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
  }, [responders]);

  // Render Infrastructure Markers on Map (Hospitals, Shelters, Blocked Roads)
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current || !infrastructureLayerRef.current) return;

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
  }, [infrastructure]);

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
  }, [dispatches]);

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
      <header className="fixed top-0 left-0 right-0 h-12 z-[1000] bg-[#0c4a75] flex items-center justify-between px-3.5 text-white shadow-md border-b border-[#093554]">
        <div className="flex items-center gap-2.5">
          <div
            onClick={() => mapRef.current?.flyTo([23.5, 80.5], 5, { duration: 3, easeLinearity: 0.22 })}
            className="w-9 h-9 rounded-full flex items-center justify-center text-lg border-2 border-white shadow cursor-pointer transition-transform hover:scale-105"
            style={{
              background: "radial-gradient(circle at 35% 35%, #38bdf8, #0369a1 70%)",
            }}
            title="ResQ Platform • Click to view all of India"
          >
            🛡️
          </div>

          <div>
            <div className="flex items-baseline gap-1.5 leading-tight">
              <span className="text-[20px] font-extrabold tracking-tight text-white">ResQ</span>
              <span className="text-[13px] font-light tracking-wide text-sky-200">GeoPlatform</span>
              <span className="hidden md:inline-block text-[10px] uppercase font-semibold bg-sky-900/90 text-sky-200 px-1.5 py-0.5 rounded ml-1 border border-sky-700/50">
                NDMA Command & Triage GIS
              </span>
            </div>
            <div className="text-[9.5px] font-normal text-sky-200 opacity-90 leading-none">
              Disaster Response Coordination Hub • Real-Time Emergency Operations
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-2.5 text-[13px]">
          {/* Dashboard Panel Toggle */}
          <button
            onClick={() => setShowDashboard((prev) => !prev)}
            className={`hidden md:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition cursor-pointer ${
              showDashboard
                ? "bg-sky-500/30 border-sky-400/60 text-sky-200"
                : "bg-slate-900/60 border-slate-700/60 text-slate-300 hover:text-white hover:border-sky-600/50"
            }`}
            title="Toggle role dashboard panel"
          >
            <span>📊</span>
            <span>Dashboard</span>
          </button>
          {/* If NOT Authenticated: Guest Mode Controls */}
          {!isAuthenticated ? (
            <>
              {/* Quick Role Switcher Pills for Instant Testing */}
              <div className="hidden xl:flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-full border border-sky-800/50">
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
                <span>Sign In / Register</span>
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

                  <button
                    onClick={() => setShowAdminWorkspace(true)}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-2.5 py-1 rounded-full cursor-pointer transition shadow border border-indigo-400/40"
                    title="Open Application Management Console (AM-FR-01 to 11)"
                  >
                    <span>⚙️</span>
                    <span className="font-semibold">App Admin</span>
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
      </header>

      {/* ============ SEARCH PANEL ============ */}
      <div className="fixed top-[58px] left-3 z-[900] flex items-center bg-white rounded-full shadow-lg border border-slate-200/80 overflow-hidden backdrop-blur-sm">
        <button
          onClick={() => setShowNavDrawer(true)}
          title="Open Portal Navigation Menu"
          className="p-2.5 px-3 text-slate-700 hover:bg-slate-100 transition-colors text-base cursor-pointer"
        >
          ☰
        </button>

        <form onSubmit={handleSearch} className="flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search city, district, village, or coordinates..."
            className="w-64 sm:w-80 px-2 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none bg-transparent"
          />
          <button
            type="submit"
            disabled={isSearching}
            title="Search Real Location"
            className="p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors text-sm cursor-pointer"
          >
            {isSearching ? "⏳" : "🔍"}
          </button>
        </form>

        <div className="w-[1px] h-6 bg-slate-200 mx-0.5" />

        <button
          onClick={() => {
            alert("Voice Search: Please speak destination or incident area.");
          }}
          title="Voice Search"
          className="p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors text-sm cursor-pointer"
        >
          🎙️
        </button>

        <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded mx-1.5 border border-slate-200">
          {selectedLang === "हिन्दी" ? "HI" : "EN"}
        </span>

        <button
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          title="Basemap Views"
          className={`p-2.5 px-3 transition-colors text-sm font-bold cursor-pointer ${
            showLayerMenu ? "bg-sky-100 text-[#0c4a75]" : "text-[#0c4a75] hover:bg-slate-100"
          }`}
        >
          ◆
        </button>
      </div>

      {/* ============ BASEMAP SWITCHER ============ */}
      {showLayerMenu && (
        <div className="fixed top-[110px] left-3 z-[950] w-84 bg-white rounded-xl shadow-2xl border border-slate-200 p-3.5 animate-fadeIn">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">Basemap Views</span>
              <span className="text-[10px] text-sky-600 font-medium">Deep Zoom Supported (Up to 21x)</span>
            </div>
            <button
              onClick={() => setShowLayerMenu(false)}
              className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="text-xs font-semibold text-slate-500 mb-1.5">CHOOSE BASEMAP</div>
          <div className="space-y-1 mb-3">
            {Object.entries(TILE_LAYERS).map(([key, config]) => (
              <button
                key={key}
                onClick={() => switchBaseLayer(key as keyof typeof TILE_LAYERS)}
                className={`w-full text-left px-2.5 py-2 rounded text-xs flex items-center justify-between transition-colors cursor-pointer ${
                  currentBaseLayer === key
                    ? "bg-sky-50 text-[#0c4a75] font-semibold border border-sky-200"
                    : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span>{config.name}</span>
                {currentBaseLayer === key && <span className="text-sky-600 font-bold">✓</span>}
              </button>
            ))}
          </div>

          <div className="text-xs font-semibold text-slate-500 mb-1.5">STREET DETAIL OVERLAYS</div>
          <div className="space-y-1">
            <label className="flex items-center justify-between p-1.5 rounded hover:bg-slate-50 cursor-pointer text-xs">
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <span>🏷️</span> Keep Street & Road Names Visible
              </span>
              <input
                type="checkbox"
                checked={streetOverlayActive}
                onChange={toggleStreetOverlay}
                className="rounded text-sky-600 w-4 h-4 cursor-pointer"
              />
            </label>
          </div>
        </div>
      )}

      {/* ============ 1-CLICK SATELLITE ⇄ STREETS QUICK SWITCHER ============ */}
      <div className="fixed bottom-12 left-3 z-[900] flex items-center gap-2">
        <button
          onClick={toggleSatelliteOrStreets}
          className="flex items-center gap-2 bg-white/95 hover:bg-white text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg shadow-lg border border-slate-300 backdrop-blur transition-all hover:scale-105 cursor-pointer"
          title="Toggle between Satellite Imagery and Detailed Street Map"
        >
          <span className="text-base">{isCurrentLayerSatellite ? "🗺️" : "🛰️"}</span>
          <span>Switch to {isCurrentLayerSatellite ? "Street View" : "Satellite"}</span>
        </button>

        <button
          onClick={toggleStreetOverlay}
          className={`px-2.5 py-2 rounded-lg text-xs font-medium border shadow backdrop-blur transition-colors cursor-pointer ${
            streetOverlayActive
              ? "bg-sky-100 text-sky-800 border-sky-300"
              : "bg-white/90 text-slate-600 border-slate-200"
          }`}
          title="Toggle Street Names & Roads Overlay"
        >
          🏷️ Street Labels: {streetOverlayActive ? "ON" : "OFF"}
        </button>
      </div>

      {/* ============ MAP CANVAS ============ */}
      <div id="map" ref={mapContainerRef} className="fixed inset-0 bg-[#b6b6b6]" />

      {/* Measurement Status */}
      {isMeasuring && (
        <div className="fixed top-[60px] left-1/2 -translate-x-1/2 z-[900] bg-blue-900/90 text-white backdrop-blur px-4 py-1.5 rounded-full shadow-lg border border-blue-400/40 text-xs flex items-center gap-3">
          <span>📏 <b>Measuring:</b> {measureDistance}</span>
          <button
            onClick={toggleMeasurement}
            className="bg-blue-600 hover:bg-blue-500 px-2.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer"
          >
            Done
          </button>
        </div>
      )}

      {/* ============ RIGHT TOOL STRIP ============ */}
      <div className="fixed right-3 top-1/2 -translate-y-1/2 z-[900] flex flex-col gap-2">
        <button
          onClick={handleFullscreen}
          title="Toggle Fullscreen"
          className="w-10 h-10 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-base shadow-md flex items-center justify-center transition-all border border-slate-200/80 hover:shadow-lg cursor-pointer"
        >
          ⛶
        </button>
        <button
          onClick={() => mapRef.current?.flyTo([22, 78], 3, { duration: 3.0, easeLinearity: 0.22 })}
          title="Reset Global View (Country Level)"
          className="w-10 h-10 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-base shadow-md flex items-center justify-center transition-all border border-slate-200/80 hover:shadow-lg cursor-pointer"
        >
          ⟲
        </button>
        <button
          onClick={() => mapRef.current?.flyTo([23.5, 80.5], 5, { duration: 3.0, easeLinearity: 0.22 })}
          title="Zoom to India (National Level)"
          className="w-10 h-10 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-base shadow-md flex items-center justify-center transition-all border border-slate-200/80 hover:shadow-lg cursor-pointer"
        >
          🏠
        </button>
        <button
          onClick={() => mapRef.current?.zoomIn(1, { animate: true })}
          title="Zoom In"
          className="w-10 h-10 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-lg font-bold shadow-md flex items-center justify-center transition-all border border-slate-200/80 hover:shadow-lg cursor-pointer"
        >
          ＋
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut(1, { animate: true })}
          title="Zoom Out"
          className="w-10 h-10 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-lg font-bold shadow-md flex items-center justify-center transition-all border border-slate-200/80 hover:shadow-lg cursor-pointer"
        >
          －
        </button>
        <button
          onClick={handleLocateMe}
          title="My Location"
          className="w-10 h-10 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-base shadow-md flex items-center justify-center transition-all border border-slate-200/80 hover:shadow-lg cursor-pointer"
        >
          📍
        </button>
        <button
          onClick={toggleMeasurement}
          title="Measure Distance"
          className={`w-10 h-10 rounded-lg text-base shadow-md flex items-center justify-center transition-all border cursor-pointer ${
            isMeasuring
              ? "bg-blue-600 text-white border-blue-700 shadow-blue-500/50"
              : "bg-white hover:bg-slate-100 text-slate-800 border-slate-200/80"
          }`}
        >
          📏
        </button>
        <button
          onClick={toggleSatelliteOrStreets}
          title={`Switch to ${isCurrentLayerSatellite ? "Street View" : "Satellite"}`}
          className="w-10 h-10 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-base shadow-md flex items-center justify-center transition-all border border-slate-200/80 hover:shadow-lg cursor-pointer"
        >
          {isCurrentLayerSatellite ? "🗺️" : "🛰️"}
        </button>
      </div>

      {/* ============ BOTTOM STATUS & AREA ============ */}
      <div className="fixed bottom-2.5 left-1/2 -translate-x-1/2 z-[900] flex flex-col sm:flex-row items-center gap-2 bg-slate-900/90 backdrop-blur text-white text-[12px] px-3.5 py-1.5 rounded-lg shadow-xl border border-slate-700/60 pointer-events-none">
        <div className="flex items-center gap-1.5 text-sky-300 font-semibold">
          <span>📍 Viewing:</span>
          <span className="text-white font-normal truncate max-w-xs sm:max-w-md">{visibleAreaName}</span>
          <span className="text-[10.5px] text-sky-400 font-mono">[{currentZoom}x Zoom]</span>
        </div>
        <div className="hidden sm:block w-[1px] h-3.5 bg-slate-600 mx-1" />
        <div className="font-mono text-slate-300 text-[11px]">{coordsText}</div>
      </div>

      {/* ============ ABOUT RESQ MODAL ============ */}
      {showAboutModal && (
        <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 relative animate-scaleUp">
            <button
              onClick={() => setShowAboutModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-lg font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-linear-to-tr from-[#0284c7] to-[#38bdf8] flex items-center justify-center text-2xl border-2 border-white shadow">
                🛡️
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 leading-tight">
                  ResQ GeoPlatform
                </h2>
                <p className="text-xs text-sky-700 font-medium">
                  NDMA Incident Triage & GIS Coordination
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
              <p>
                <b>ResQ</b> provides operational emergency response across 8 operational agency roles, compliant with the National Disaster Management Authority (NDMA) Incident Response System (IRS).
              </p>
              <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs text-sky-950 space-y-1">
                <p className="font-semibold text-sky-900 mb-1">🗺️ Supported Disasters:</p>
                <div>• <b>Flood / Urban Flood:</b> Inundation modeling, boat rescue deployment.</div>
                <div>• <b>Cyclone / Coastal Flooding:</b> Surge tracking, storm shelters, evacuation.</div>
                <div>• <b>Major Urban / Building Fire:</b> Smoke plume assessment, hydrants, hazmat.</div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowAboutModal(false)}
                className="bg-[#0c4a75] hover:bg-[#083452] text-white px-4 py-2 rounded-lg text-xs font-semibold shadow transition-colors cursor-pointer"
              >
                Close Info
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ NAVIGATION DRAWER ============ */}
      {showNavDrawer && (
        <div className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-xs flex">
          <div className="bg-white w-80 max-w-full h-full shadow-2xl p-5 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🛡️</span>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-none">ResQ Hub</h3>
                    <span className="text-[11px] text-slate-500">Emergency Operations</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowNavDrawer(false)}
                  className="text-slate-400 hover:text-slate-700 text-lg font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Operational Agency Workspaces
                  </h4>
                  <div className="space-y-1.5 text-sm">
                    <button
                      onClick={() => {
                        setShowNavDrawer(false);
                        switchRole("Command Officer / Incident Commander");
                        setShowRoleWorkspace(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-2.5 text-slate-700 transition-colors cursor-pointer"
                    >
                      <span>🎖️</span> Command Officer / Commander
                    </button>
                    <button
                      onClick={() => {
                        setShowNavDrawer(false);
                        switchRole("Dispatcher");
                        setShowRoleWorkspace(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-2.5 text-slate-700 transition-colors cursor-pointer"
                    >
                      <span>🗺️</span> Dispatcher & Report Queue
                    </button>
                    <button
                      onClick={() => {
                        setShowNavDrawer(false);
                        switchRole("NDRF / SDRF Team Leader or Responder");
                        setShowRoleWorkspace(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-2.5 text-slate-700 transition-colors cursor-pointer"
                    >
                      <span>🚤</span> NDRF / SDRF Search & Rescue
                    </button>
                    <button
                      onClick={() => {
                        setShowNavDrawer(false);
                        switchRole("Medic / Ambulance Team");
                        setShowRoleWorkspace(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-2.5 text-slate-700 transition-colors cursor-pointer"
                    >
                      <span>🚑</span> Field Medic & Hospital Triage
                    </button>
                    <button
                      onClick={() => {
                        setShowNavDrawer(false);
                        switchRole("Firefighter / Fire Service Officer");
                        setShowRoleWorkspace(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-2.5 text-slate-700 transition-colors cursor-pointer"
                    >
                      <span>🚒</span> Firefighter & Water Hydrants
                    </button>
                    <button
                      onClick={() => {
                        setShowNavDrawer(false);
                        switchRole("Logistics Officer");
                        setShowRoleWorkspace(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-2.5 text-slate-700 transition-colors cursor-pointer"
                    >
                      <span>📦</span> Logistics & Warehouse Supplies
                    </button>
                    <button
                      onClick={() => {
                        setShowNavDrawer(false);
                        switchRole("System Administrator");
                        setShowRoleWorkspace(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-2.5 text-slate-700 transition-colors cursor-pointer"
                    >
                      <span>⚙️</span> System Admin & Audit Logs
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 text-xs text-slate-500">
              <div className="font-semibold text-slate-700 mb-1">Emergency Helplines (India):</div>
              <div>• National Emergency: <b>112</b></div>
              <div>• Disaster Management (NDMA): <b>1070 / 1077</b></div>
              <div>• Ambulance Service: <b>108</b></div>
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

      {/* ============ APPLICATION MANAGEMENT CONSOLE ============ */}
      {showAdminWorkspace && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/85 backdrop-blur-xs p-3 animate-in fade-in">
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto p-5 shadow-2xl">
            <AdminManagementWorkspace onClose={() => setShowAdminWorkspace(false)} />
          </div>
        </div>
      )}

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
