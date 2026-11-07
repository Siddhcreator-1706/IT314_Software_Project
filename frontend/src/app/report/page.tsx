"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { isInGujarat, GUJARAT_CENTER, GUJARAT_BOUNDS, GUJARAT_DEFAULT_ZOOM } from "@/lib/geo";
import { createReport, fetchPublicIncidents, type PublicIncident, type Scenario } from "@/services/citizenApi";
import { findNearbyIncidents } from "@/services/duplicateDetection";
import { URGENT_NEEDS, preTriage } from "@/services/preTriage";

const SCENARIOS = [
  { id: "urban_flooding", label: "Urban Flooding", icon: "🌊", desc: "Waterlogging, rising flood water, stranded residents" },
  { id: "cyclone", label: "Cyclone / Storm", icon: "🌀", desc: "High winds, structural damage, coastal surges" },
  { id: "industrial_fire", label: "Fire Emergency", icon: "🔥", desc: "Building, chemical, or industrial fires" },
];

const URGENCIES = [
  { id: "LOW", label: "Low", color: "border-slate-600 text-slate-300" },
  { id: "MEDIUM", label: "Medium", color: "border-amber-600 text-amber-300" },
  { id: "HIGH", label: "High", color: "border-orange-600 text-orange-300" },
  { id: "CRITICAL", label: "Critical / Life Threat", color: "border-red-600 text-red-400 bg-red-950/30" },
];

interface SessionInfo {
  authenticated: boolean;
  role: string | null;
  name: string | null;
}

const DRAFT_STORAGE_KEY = "resq_incident_report_draft";

export default function ReportIncidentPage() {
  // Session State
  const [session, setSession] = useState<SessionInfo | null>(null);

  // Form State
  const [scenario, setScenario] = useState("urban_flooding");
  const [description, setDescription] = useState("");
  const [peopleAffected, setPeopleAffected] = useState(1);
  const [urgency, setUrgency] = useState("HIGH");
  const [latitude, setLatitude] = useState(GUJARAT_CENTER[0]);
  const [longitude, setLongitude] = useState(GUJARAT_CENTER[1]);
  const [addressText, setAddressText] = useState("");
  const [landmark, setLandmark] = useState("");
  const [locationSource, setLocationSource] = useState<"GPS" | "MAP_PIN" | "MANUAL">("MAP_PIN");

  const [needs, setNeeds] = useState<string[]>([]);
  const [publicIncidents, setPublicIncidents] = useState<PublicIncident[]>([]);

  // Map state
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const nearbyMarkersLayerRef = useRef<any>(null);

  // Idempotency key per form session (initialized lazily)
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  });

  // Address search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchCacheRef = useRef<Record<string, Array<{ display_name: string; lat: string; lon: string }>>>({});

  // Submission States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ reference: string; status: string } | null>(null);

  // Validation
  const validLocation = isInGujarat(latitude, longitude);

  // 1. Session check on mount & restore draft
  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setSession({
            authenticated: !!data.authenticated,
            role: data.role || null,
            name: data.name || null,
          });
        } else {
          setSession({ authenticated: false, role: null, name: null });
        }
      })
      .catch(() => setSession({ authenticated: false, role: null, name: null }));

    // Restore draft if saved
    try {
      const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.scenario) setScenario(d.scenario);
        if (d.description) setDescription(d.description);
        if (d.peopleAffected) setPeopleAffected(d.peopleAffected);
        if (d.urgency) setUrgency(d.urgency);
        if (d.latitude && d.longitude) {
          setLatitude(d.latitude);
          setLongitude(d.longitude);
        }
        if (d.addressText) setAddressText(d.addressText);
        if (d.landmark) setLandmark(d.landmark);
        if (Array.isArray(d.needs)) setNeeds(d.needs);
      }
    } catch {
      // Ignore sessionStorage errors
    }
  }, []);

  // Save draft whenever important fields change
  useEffect(() => {
    if (successResult) {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }
    try {
      sessionStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          scenario,
          description,
          peopleAffected,
          urgency,
          latitude,
          longitude,
          addressText,
          landmark,
          needs,
        })
      );
    } catch {
      // Ignore storage errors
    }
  }, [scenario, description, peopleAffected, urgency, latitude, longitude, addressText, landmark, needs, successResult]);

  // Advisory hints: verified incidents already reported nearby, and an instant rule-based urgency hint.
  useEffect(() => {
    fetchPublicIncidents().then((res) => res.data && setPublicIncidents(res.data));
  }, []);

  const nearby = validLocation ? findNearbyIncidents(latitude, longitude, scenario as Scenario, publicIncidents) : [];
  const hint = preTriage(scenario as Scenario, description, peopleAffected, needs);

  // Initialize Interactive Leaflet Pin-Picker Map
  useEffect(() => {
    let isCancelled = false;

    const initMap = async () => {
      try {
        const L = (await import("leaflet")).default;
        if (isCancelled || !mapContainerRef.current) return;

        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        const map = L.map(mapContainerRef.current, {
          zoomControl: true,
          attributionControl: false,
          minZoom: 6,
          maxZoom: 18,
          maxBounds: GUJARAT_BOUNDS,
          maxBoundsViscosity: 0.9,
        }).setView([latitude, longitude], 8);

        mapRef.current = map;

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        }).addTo(map);

        // Marker with custom pin icon
        const pinIcon = L.divIcon({
          className: "custom-incident-pin",
          html: `<div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center;">
            <div style="background: #ef4444; color: white; padding: 4px 8px; border-radius: 9999px; font-weight: bold; font-size: 11px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); border: 2px solid white; display: flex; align-items: center; gap: 4px;">
              <span>🚨</span><span>Incident Pin</span>
            </div>
            <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #ef4444;"></div>
          </div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([latitude, longitude], {
          draggable: true,
          icon: pinIcon,
        }).addTo(map);

        markerRef.current = marker;

        // On marker drag
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          const lat = Number(pos.lat.toFixed(5));
          const lon = Number(pos.lng.toFixed(5));
          setLatitude(lat);
          setLongitude(lon);
          setLocationSource("MAP_PIN");
        });

        // On map click, move marker
        map.on("click", (e: any) => {
          const lat = Number(e.latlng.lat.toFixed(5));
          const lon = Number(e.latlng.lng.toFixed(5));
          setLatitude(lat);
          setLongitude(lon);
          setLocationSource("MAP_PIN");
          marker.setLatLng([lat, lon]);
        });

        nearbyMarkersLayerRef.current = L.layerGroup().addTo(map);
      } catch {
        // Fallback gracefully if Leaflet fails to load
      }
    };

    initMap();

    return () => {
      isCancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // Run once on mount

  // Sync marker position when lat/lon changes from search, GPS, or manual input
  useEffect(() => {
    if (markerRef.current && mapRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
    }
  }, [latitude, longitude]);

  // Sync nearby incidents markers on the map
  useEffect(() => {
    const updateNearbyMarkers = async () => {
      if (!nearbyMarkersLayerRef.current || !mapRef.current) return;
      try {
        const L = (await import("leaflet")).default;
        nearbyMarkersLayerRef.current.clearLayers();

        nearby.forEach((item) => {
          const lat = item.incident.latitude;
          const lon = item.incident.longitude;
          if (typeof lat !== "number" || typeof lon !== "number") return;

          const circle = L.circleMarker([lat, lon], {
            radius: 8,
            fillColor: "#f59e0b",
            color: "#ffffff",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.85,
          });

          circle.bindPopup(
            `<div style="font-size: 12px; color: #1e293b;">
              <strong>${item.incident.reference || item.incident.id}</strong><br/>
              ${item.incident.scenario || "Incident"}<br/>
              <em>~${item.distanceMeters < 1000 ? `${item.distanceMeters}m` : `${(item.distanceMeters / 1000).toFixed(1)}km`} away</em>
            </div>`
          );

          circle.addTo(nearbyMarkersLayerRef.current);
        });
      } catch {
        // Ignore
      }
    };

    updateNearbyMarkers();
  }, [nearby]);

  // GPS Geolocation Handler
  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      setErrorMessage("Geolocation is not supported by your browser.");
      return;
    }
    setErrorMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const rawLat = pos.coords.latitude;
        const rawLon = pos.coords.longitude;
        if (!isInGujarat(rawLat, rawLon)) {
          setErrorMessage(
            `Your detected location (${rawLat.toFixed(4)}, ${rawLon.toFixed(4)}) is outside Gujarat. Pick the incident location on the map or search for an address in Gujarat.`
          );
          return;
        }
        const lat = Number(rawLat.toFixed(5));
        const lon = Number(rawLon.toFixed(5));
        setLatitude(lat);
        setLongitude(lon);
        setLocationSource("GPS");
        if (mapRef.current) {
          mapRef.current.flyTo([lat, lon], 13, { duration: 1.2 });
        }
      },
      (err) => {
        setErrorMessage(`Unable to retrieve GPS location: ${err.message}`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Debounced Address Search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 3) {
      return;
    }

    const queryKey = searchQuery.trim().toLowerCase();
    if (searchCacheRef.current[queryKey]) {
      const cached = searchCacheRef.current[queryKey];
      const timer = setTimeout(() => setSearchResults(cached), 0);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            searchQuery + ", Gujarat, India"
          )}&limit=5&countrycodes=in`,
          {
            headers: {
              "Accept-Language": "en",
            },
          }
        );
        if (res.ok) {
          const data = await res.json();
          searchCacheRef.current[queryKey] = data;
          setSearchResults(data);
        }
      } catch {
        // Fallback gracefully on search error
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectSearchResult = (result: { display_name: string; lat: string; lon: string }) => {
    const lat = Number(parseFloat(result.lat).toFixed(5));
    const lon = Number(parseFloat(result.lon).toFixed(5));
    if (!isInGujarat(lat, lon)) {
      setErrorMessage("Selected location falls outside Gujarat state boundaries.");
      return;
    }
    setLatitude(lat);
    setLongitude(lon);
    setAddressText(result.display_name);
    setLocationSource("MANUAL");
    setSearchResults([]);
    setSearchQuery("");
    if (mapRef.current) {
      mapRef.current.flyTo([lat, lon], 13, { duration: 1.2 });
    }
  };

  const handleFocusNearby = (item: { incident: PublicIncident }) => {
    const lat = item.incident.latitude;
    const lon = item.incident.longitude;
    if (typeof lat === "number" && typeof lon === "number" && mapRef.current) {
      mapRef.current.flyTo([lat, lon], 14, { duration: 1 });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!description.trim()) {
      setErrorMessage("Please describe the emergency incident.");
      return;
    }

    if (!validLocation) {
      setErrorMessage("Incident coordinates must be within Gujarat State boundaries.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        scenario: scenario as Scenario,
        description: needs.length
          ? `${description.trim()}\n\nUrgent needs: ${needs.join(", ")}`
          : description.trim(),
        reported_urgency: urgency as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        people_affected: Number(peopleAffected),
        location_source: locationSource,
        latitude,
        longitude,
        address_text: addressText.trim() || undefined,
        landmark: landmark.trim() || undefined,
      };

      const res = await createReport(payload, { idempotencyKey });

      if (res.error) {
        if (res.error.toLowerCase().includes("session") || res.error.toLowerCase().includes("authenticated")) {
          setErrorMessage(
            "Citizen sign-in required: You must be logged in to file an emergency report so responders can reach you."
          );
        } else {
          setErrorMessage(res.error);
        }
        setIsSubmitting(false);
        return;
      }

      const refNumber = res.data?.incident_ref;
      if (!refNumber) {
        setErrorMessage("The server did not confirm your report. Please try again.");
        return;
      }
      setSuccessResult({ reference: refNumber, status: res.data?.status || "SUBMITTED" });
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-y-auto">
      {/* Top Emergency Lifeline Banner */}
      <div className="bg-red-600 text-white px-4 py-2 text-xs md:text-sm font-semibold flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2 max-w-4xl mx-auto w-full justify-between">
          <span className="flex items-center gap-1.5">
            <span className="animate-pulse">🚨</span>
            <span>Immediate life threat or medical emergency?</span>
          </span>
          <a
            href="tel:112"
            className="bg-white text-red-700 px-3 py-1 rounded-md text-xs font-black hover:bg-red-50 transition shadow"
          >
            CALL 112 (TOLL FREE)
          </a>
        </div>
      </div>

      {/* Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition">
            <span className="text-xl">🛡️</span>
            <span className="font-bold text-white text-base tracking-wide">ResQ Gujarat</span>
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-xs uppercase tracking-wider font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
            Citizen Emergency Dispatch
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          {session?.authenticated ? (
            <span className="hidden md:inline text-slate-400">
              Signed in as <strong className="text-sky-300">{session.name || "Citizen"}</strong>
            </span>
          ) : (
            <Link
              href="/login?next=/report"
              className="text-sky-400 hover:text-sky-300 font-semibold underline"
            >
              Sign In
            </Link>
          )}
          <Link href="/my-reports" className="text-slate-300 hover:text-white transition flex items-center gap-1.5">
            📋 My Reports
          </Link>
          <Link href="/citizen/dashboard" className="text-slate-300 hover:text-white transition flex items-center gap-1.5">
            🏠 Citizen Dashboard
          </Link>
          <Link href="/" className="text-slate-400 hover:text-slate-200 transition">
            Public Map
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8">
        {/* Guest Warning if not authenticated */}
        {session && !session.authenticated && (
          <div className="mb-6 p-4 bg-sky-950/70 border border-sky-600/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs md:text-sm">
            <div className="flex items-start gap-2.5">
              <span className="text-xl">ℹ️</span>
              <div>
                <strong className="text-sky-200">You are browsing as a guest.</strong>
                <p className="text-slate-300 text-xs mt-0.5">
                  Your drafted inputs are saved locally. Please sign in or create an account so emergency responders can verify and track your report.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <Link
                href="/login?next=/report"
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs transition shadow"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs transition"
              >
                Register
              </Link>
            </div>
          </div>
        )}

        {successResult ? (
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-8 text-center shadow-xl space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-3xl">
              ✓
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Emergency Report Submitted</h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Your incident report has been securely registered in the Gujarat Disaster Response Operations Hub.
              </p>
            </div>

            <div className="inline-block bg-slate-950 border border-slate-800 rounded-xl px-6 py-4 text-left">
              <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">
                Incident Reference
              </div>
              <div className="text-xl font-mono font-bold text-sky-400">{successResult.reference}</div>
              <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Status: {successResult.status}
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 pt-4">
              <Link
                href="/my-reports"
                className="bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-sky-600/30 transition"
              >
                Track Status in My Reports →
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSuccessResult(null);
                  setDescription("");
                  if (typeof crypto !== "undefined" && crypto.randomUUID) {
                    setIdempotencyKey(crypto.randomUUID());
                  }
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium px-5 py-2.5 rounded-xl transition cursor-pointer"
              >
                File Another Report
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl">
            <div className="border-b border-slate-800 pb-5 mb-6">
              <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2.5">
                <span>📢</span> Report Emergency Incident
              </h1>
              <p className="text-slate-400 text-xs md:text-sm mt-1">
                Direct dispatch link to State Emergency Operations Center (SEOC) & Local Responders.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-6 p-4 bg-red-950/60 border border-red-700/60 rounded-xl text-red-200 text-sm flex items-start gap-3">
                <span className="text-lg">⚠️</span>
                <div>
                  <div className="font-semibold">Unable to submit report</div>
                  <div className="text-xs mt-0.5 text-red-300">{errorMessage}</div>
                  {errorMessage.includes("sign-in") && (
                    <div className="mt-2">
                      <Link
                        href="/login?next=/report"
                        className="inline-block bg-red-700 hover:bg-red-600 text-white font-bold px-3 py-1 rounded text-xs transition"
                      >
                        Sign in now →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Scenario Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
                  1. Disaster Scenario
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SCENARIOS.map((item) => {
                    const isSelected = scenario === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setScenario(item.id);
                          setNeeds([]);
                        }}
                        className={`p-3.5 rounded-xl border text-left flex flex-col gap-2 transition cursor-pointer ${
                          isSelected
                            ? "bg-sky-950/50 border-sky-500 shadow-md shadow-sky-500/10 ring-1 ring-sky-500/40"
                            : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{item.icon}</span>
                          <span className={`text-sm font-bold ${isSelected ? "text-white" : "text-slate-300"}`}>
                            {item.label}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 leading-tight">{item.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Urgency and People Affected */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    2. Urgency Level
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {URGENCIES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setUrgency(item.id)}
                        className={`px-3 py-2.5 rounded-lg text-xs font-semibold border text-center transition cursor-pointer ${
                          urgency === item.id
                            ? `${item.color} bg-slate-800 shadow font-bold`
                            : "border-slate-800 text-slate-500 hover:border-slate-700"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    3. Estimated People Affected
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={peopleAffected}
                      onChange={(e) => setPeopleAffected(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-28 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono text-center focus:outline-none focus:border-sky-500"
                    />
                    <div className="flex items-center gap-1.5">
                      {[1, 5, 10, 25].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setPeopleAffected(cnt)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition cursor-pointer"
                        >
                          {cnt}+
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  4. Situation Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the current hazard, trapped individuals, water depth, road blockages, or urgent medical needs..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition resize-none"
                />
              </div>

              {/* Urgent needs checklist */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Urgent needs (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {(URGENT_NEEDS[scenario as Scenario] || []).map((need) => (
                    <label
                      key={need}
                      className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition select-none ${
                        needs.includes(need)
                          ? "border-sky-500 bg-sky-950/40 text-white font-semibold"
                          : "border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={needs.includes(need)}
                        onChange={() =>
                          setNeeds(needs.includes(need) ? needs.filter((n) => n !== need) : [...needs, need])
                        }
                      />
                      {need}
                    </label>
                  ))}
                </div>
              </div>

              {hint.level && (
                <div className="p-4 bg-amber-950/40 border border-amber-700/50 rounded-xl text-xs text-amber-100" role="status">
                  <div className="font-semibold">
                    Automated hint: this may be {hint.level === "CRITICAL" ? "a life-threatening situation" : "a serious situation"}
                  </div>
                  <ul className="mt-1 list-disc pl-4 text-amber-200/90">
                    {hint.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <div className="mt-1 text-amber-300/80">
                    This is advisory only. Choose the urgency yourself; a dispatcher reviews every report. If someone is in immediate danger, call 112.
                  </div>
                </div>
              )}

              {nearby.length > 0 && (
                <div className="p-4 bg-sky-950/40 border border-sky-700/50 rounded-xl text-xs text-sky-100" role="status">
                  <div className="font-semibold flex items-center justify-between">
                    <span>Similar incidents are already on the public map nearby ({nearby.length})</span>
                    <span className="text-[11px] text-amber-300 font-normal">Click to locate on map</span>
                  </div>
                  <ul className="mt-2 space-y-1.5 text-sky-200/90">
                    {nearby.map((n) => (
                      <li
                        key={n.incident.id}
                        onClick={() => handleFocusNearby(n)}
                        className="p-2 rounded bg-slate-900/60 border border-slate-800 hover:border-sky-500 cursor-pointer transition flex items-center justify-between text-xs"
                      >
                        <span className="truncate pr-2">
                          <strong>{n.incident.reference || n.incident.id}</strong> · {n.incident.title || n.incident.district}
                        </span>
                        <span className="text-amber-300 shrink-0 font-mono">
                          ~{n.distanceMeters < 1000 ? `${n.distanceMeters} m` : `${(n.distanceMeters / 1000).toFixed(1)} km`}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 text-sky-300/80 text-[11px]">
                    You can still submit. Extra reports help dispatchers confirm what is happening.
                  </div>
                </div>
              )}

              {/* Location Picker Section */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                      5. Gujarat Location Verification & Interactive Map
                    </label>
                    <span className="text-xs text-slate-500">
                      Click map, drag pin, or search. Must be within Gujarat (20.1°N - 24.7°N, 68.1°E - 74.5°E)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleUseGPS}
                    className="flex items-center gap-1.5 bg-sky-950/80 hover:bg-sky-900 border border-sky-700/60 text-sky-200 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    <span>📍</span> Use Device GPS
                  </button>
                </div>

                {/* Address Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (!e.target.value.trim() || e.target.value.trim().length < 3) {
                        setSearchResults([]);
                      }
                    }}
                    placeholder="Search Gujarat city, locality, village or landmark (e.g. Navrangpura, Ahmedabad)..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-2.5 text-xs text-slate-400 animate-spin">⌛</div>
                  )}

                  {/* Search Dropdown */}
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-30 overflow-hidden">
                      {searchResults.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectSearchResult(item)}
                          className="w-full px-3.5 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white border-b border-slate-800/60 last:border-b-0 transition flex items-center gap-2 cursor-pointer"
                        >
                          <span>📌</span>
                          <span className="truncate">{item.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Interactive Leaflet Pin-Picker Map Container */}
                <div className="relative w-full h-64 md:h-72 rounded-xl overflow-hidden border border-slate-700 shadow-inner bg-slate-950">
                  <div ref={mapContainerRef} className="w-full h-full z-10" />
                  <div className="absolute top-2 right-2 z-[400] bg-slate-900/90 backdrop-blur px-2.5 py-1 rounded text-[11px] text-slate-300 border border-slate-700 pointer-events-none">
                    🎯 Click map to move incident pin
                  </div>
                </div>

                {/* Coordinate Fields & Verification Badge */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Latitude (°N)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={latitude}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setLatitude(val);
                        setLocationSource("MAP_PIN");
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Longitude (°E)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={longitude}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setLongitude(val);
                        setLocationSource("MAP_PIN");
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex items-center gap-2">
                    {validLocation ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        ✓ Inside Gujarat Boundary ({latitude.toFixed(4)}°N, {longitude.toFixed(4)}°E)
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1 font-medium">
                        ✕ Coordinates Outside Gujarat
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500 font-mono text-[11px]">
                    Source: {locationSource}
                  </span>
                </div>

                {/* Address Text & Landmark */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <input
                      type="text"
                      value={addressText}
                      onChange={(e) => setAddressText(e.target.value)}
                      placeholder="Address / Locality (e.g. Near Usmanpura Underpass)"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder="Landmark (e.g. Opposite Jain Temple)"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !validLocation}
                  className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-xl text-sm transition shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin text-base">⏳</span>
                      <span>Transmitting Report to SEOC...</span>
                    </>
                  ) : (
                    <>
                      <span>🚨</span>
                      <span>Dispatch Incident Report</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
