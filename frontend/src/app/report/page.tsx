"use client";

import React, { useState, useEffect, useRef } from "react";
import { SiteHeader, NavLink } from "@/components/Brand";
import Link from "next/link";
import { isInGujarat, GUJARAT_CENTER } from "@/lib/geo";
import { createReport, fetchPublicIncidents, type PublicIncident, type Scenario } from "@/services/citizenApi";
import { findNearbyIncidents } from "@/services/duplicateDetection";
import { URGENT_NEEDS, preTriage } from "@/services/preTriage";

/** ARIA radio pattern: arrow keys move the selection and focus inside a group; only one option is a tab stop. */
function moveRadioSelection(
  event: React.KeyboardEvent<HTMLElement>,
  ids: readonly string[],
  current: string,
  select: (id: string) => void,
) {
  const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
  const backward = event.key === "ArrowLeft" || event.key === "ArrowUp";
  if (!forward && !backward) return;
  event.preventDefault();
  const index = Math.max(ids.indexOf(current), 0);
  const next = ids[(index + (forward ? 1 : -1) + ids.length) % ids.length];
  select(next);
  event.currentTarget.querySelector<HTMLElement>(`[data-radio-id="${next}"]`)?.focus();
}

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

export default function ReportIncidentPage() {
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

  // Advisory hints: verified incidents already reported nearby, and an instant rule-based urgency hint.
  useEffect(() => {
    fetchPublicIncidents().then((res) => res.data && setPublicIncidents(res.data));
  }, []);
  const nearby = validLocation ? findNearbyIncidents(latitude, longitude, scenario as Scenario, publicIncidents) : [];
  const hint = preTriage(scenario as Scenario, description, peopleAffected, needs);

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
          // Never move the reporter: a report from the wrong place would send responders to the wrong place.
          setErrorMessage(
            `Your detected location (${rawLat.toFixed(4)}, ${rawLon.toFixed(4)}) is outside Gujarat. Pick the incident location on the map or search for an address in Gujarat.`
          );
          return;
        } else {
          setLatitude(Number(rawLat.toFixed(5)));
          setLongitude(Number(rawLon.toFixed(5)));
        }
        setLocationSource("GPS");
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
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
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
        description: needs.length ? `${description.trim()}

Urgent needs: ${needs.join(", ")}` : description.trim(),
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
        setErrorMessage(res.error);
        setIsSubmitting(false);
        return;
      }

      const refNumber = res.data?.incident_ref;
      if (!refNumber) {
        // Never invent a reference number: without one the report was not confirmed by the server.
        setErrorMessage("The server did not confirm your report. Please try again.");
        return;
      }
      setSuccessResult({ reference: refNumber, status: res.data?.status || "SUBMITTED" });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <SiteHeader subtitle="Citizen Emergency Dispatch" maxWidth="max-w-5xl">
        <NavLink href="/my-reports">My Reports</NavLink>
        <NavLink href="/citizen/dashboard" hideBelow="sm">Dashboard</NavLink>
        <NavLink href="/" hideBelow="sm">Public Map</NavLink>
      </SiteHeader>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {successResult ? (
          <div role="status" aria-live="polite" className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 text-center shadow-xl space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-3xl font-bold" aria-hidden="true">
              ✓
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Emergency Report Submitted</h2>
              <p className="text-slate-300 text-sm max-w-md mx-auto">
                Your incident report has been securely registered in the Gujarat Disaster Response Operations Hub.
              </p>
            </div>

            <div className="inline-block bg-slate-950 border border-slate-800 rounded-xl px-6 py-4 text-left">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">
                Incident Reference
              </div>
              <div className="text-xl font-mono font-bold text-sky-400">{successResult.reference}</div>
              <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                Status: {successResult.status}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link
                href="/my-reports"
                className="min-h-[44px] bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-sky-600/30 transition flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
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
                className="min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-5 py-2.5 rounded-xl transition flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 cursor-pointer"
              >
                File Another Report
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 md:p-8 shadow-xl">
            <div className="border-b border-slate-800 pb-5 mb-6">
              <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2.5">
                <span aria-hidden="true">📢</span> Report Emergency Incident
              </h1>
              <p className="text-slate-300 text-xs md:text-sm mt-1">
                Direct dispatch link to State Emergency Operations Center (SEOC) & Local Responders.
              </p>
            </div>

            {errorMessage && (
              <div role="alert" aria-live="assertive" className="mb-6 p-4 bg-red-950/60 border border-red-700/60 rounded-xl text-red-200 text-sm flex items-start gap-3">
                <span className="text-lg" aria-hidden="true">⚠️</span>
                <div>
                  <div className="font-semibold">Unable to submit report</div>
                  <div className="text-xs mt-0.5 text-red-300">{errorMessage}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Scenario Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2.5">
                  1. Disaster Scenario
                </label>
                <div
                  role="radiogroup"
                  aria-label="Disaster Scenario"
                  onKeyDown={(e) =>
                    moveRadioSelection(e, SCENARIOS.map((x) => x.id), scenario, (id) => {
                      setScenario(id as typeof scenario);
                      setNeeds([]);
                    })
                  }
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  {SCENARIOS.map((item) => {
                    const isSelected = scenario === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        data-radio-id={item.id}
                        tabIndex={isSelected ? 0 : -1}
                        aria-checked={isSelected}
                        onClick={() => { setScenario(item.id); setNeeds([]); }}
                        className={`min-h-[56px] p-3.5 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                          isSelected
                            ? "bg-sky-950/40 border-sky-500 shadow-md shadow-sky-500/10"
                            : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
                        }`}
                      >
                        <span className="text-2xl" aria-hidden="true">{item.icon}</span>
                        <div>
                          <div className={`text-sm font-bold ${isSelected ? "text-white" : "text-slate-200"}`}>
                            {item.label}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">{item.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Urgency and People Affected */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                    2. Urgency Level
                  </label>
                  <div
                    role="radiogroup"
                    aria-label="Urgency Level"
                    onKeyDown={(e) => moveRadioSelection(e, URGENCIES.map((x) => x.id), urgency, (id) => setUrgency(id as typeof urgency))}
                    className="grid grid-cols-2 gap-2"
                  >
                    {URGENCIES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        data-radio-id={item.id}
                        tabIndex={urgency === item.id ? 0 : -1}
                        aria-checked={urgency === item.id}
                        onClick={() => setUrgency(item.id)}
                        className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-semibold border text-center transition flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950 ${
                          urgency === item.id
                            ? `${item.color} bg-slate-800 shadow ring-1 ring-sky-500/50`
                            : "border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="people-affected" className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                    3. Estimated People Affected
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      id="people-affected"
                      type="number"
                      min={1}
                      max={10000}
                      value={peopleAffected}
                      onChange={(e) => setPeopleAffected(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 sm:w-28 min-h-[40px] bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono text-center focus:outline-none focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-400"
                    />
                    <div className="flex items-center gap-1.5" role="group" aria-label="Quick select people affected">
                      {[1, 5, 10, 25].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setPeopleAffected(cnt)}
                          className="min-h-[38px] min-w-[38px] px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
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
                <label htmlFor="incident-description" className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                  4. Situation Description <span className="text-amber-400" aria-hidden="true">*</span>
                </label>
                <textarea
                  id="incident-description"
                  rows={3}
                  required
                  aria-required="true"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the current hazard, trapped individuals, water depth, road blockages, or urgent medical needs..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-400 transition resize-none"
                />
              </div>

              {/* Urgent needs checklist */}
              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                  Urgent needs (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {URGENT_NEEDS[scenario as Scenario].map((need) => (
                    <label
                      key={need}
                      className={`min-h-[40px] px-3.5 py-2 rounded-lg border text-xs cursor-pointer transition select-none flex items-center focus-within:ring-2 focus-within:ring-sky-400 focus-within:ring-offset-1 focus-within:ring-offset-slate-950 ${
                        needs.includes(need)
                          ? "border-sky-500 bg-sky-950/40 text-white font-medium shadow-sm"
                          : "border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={needs.includes(need)}
                        onChange={() => setNeeds(needs.includes(need) ? needs.filter((n) => n !== need) : [...needs, need])}
                      />
                      <span className="mr-1.5 text-sky-400" aria-hidden="true">{needs.includes(need) ? "✓" : "+"}</span>
                      {need}
                    </label>
                  ))}
                </div>
              </div>

              {hint.level && (
                <div className="p-4 bg-amber-950/40 border border-amber-700/50 rounded-xl text-xs text-amber-100" role="status" aria-live="polite">
                  <div className="font-semibold text-amber-200">
                    Automated hint: this may be {hint.level === "CRITICAL" ? "a life-threatening situation" : "a serious situation"}
                  </div>
                  <ul className="mt-1 list-disc pl-4 text-amber-200/90 space-y-0.5">
                    {hint.reasons.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                  <div className="mt-1.5 text-amber-300/80">
                    This is advisory only. Choose the urgency yourself; a dispatcher reviews every report. If someone is in immediate danger, call 112.
                  </div>
                </div>
              )}

              {nearby.length > 0 && (
                <div className="p-4 bg-sky-950/40 border border-sky-700/50 rounded-xl text-xs text-sky-100" role="status" aria-live="polite">
                  <div className="font-semibold text-sky-200">Similar incidents are already on the public map nearby</div>
                  <ul className="mt-1 text-sky-200/90 space-y-0.5">
                    {nearby.map((n) => (
                      <li key={n.incident.id}>
                        {n.incident.id} · {n.incident.title} · about {n.distanceMeters < 1000 ? `${n.distanceMeters} m` : `${(n.distanceMeters / 1000).toFixed(1)} km`} away
                      </li>
                    ))}
                  </ul>
                  <div className="mt-1.5 text-sky-300/80">You can still submit. Extra reports help dispatchers confirm what is happening.</div>
                </div>
              )}

              {/* Location Picker Section */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                      5. Gujarat Location Verification
                    </label>
                    <span className="text-xs text-slate-400">
                      Coordinates must fall within Gujarat State (20.1°N - 24.7°N, 68.1°E - 74.5°E)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleUseGPS}
                    className="min-h-[40px] flex items-center gap-1.5 bg-sky-950/80 hover:bg-sky-900 border border-sky-700/60 text-sky-200 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    <span aria-hidden="true">📍</span> Use Device GPS
                  </button>
                </div>

                {/* Address Search Bar */}
                <div className="relative">
                  <input
                    id="address-search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (!e.target.value.trim() || e.target.value.trim().length < 3) {
                        setSearchResults([]);
                      }
                    }}
                    placeholder="Search Gujarat city, locality, village or landmark (e.g. Navrangpura, Ahmedabad)..."
                    aria-label="Search Gujarat locality, city or landmark"
                    className="w-full min-h-[40px] bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-400"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-2.5 text-xs text-slate-400 animate-spin" aria-label="Searching">⌛</div>
                  )}

                  {/* Search Dropdown */}
                  {searchResults.length > 0 && (
                    <div role="listbox" aria-label="Search results" className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-30 overflow-hidden">
                      {searchResults.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          role="option"
                          aria-selected={false}
                          onClick={() => handleSelectSearchResult(item)}
                          className="w-full min-h-[40px] px-3.5 py-2 text-left text-xs text-slate-200 hover:bg-slate-800 hover:text-white border-b border-slate-800/60 last:border-b-0 transition flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:bg-slate-800 focus-visible:ring-1 focus-visible:ring-sky-400"
                        >
                          <span aria-hidden="true">📌</span>
                          <span className="truncate">{item.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Coordinate Fields & Verification Badge */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="incident-lat" className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Latitude (°N)
                    </label>
                    <input
                      id="incident-lat"
                      type="number"
                      step="0.0001"
                      value={latitude}
                      onChange={(e) => {
                        setLatitude(parseFloat(e.target.value) || 0);
                        setLocationSource("MAP_PIN");
                      }}
                      className="w-full min-h-[38px] bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-400"
                    />
                  </div>
                  <div>
                    <label htmlFor="incident-lon" className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Longitude (°E)
                    </label>
                    <input
                      id="incident-lon"
                      type="number"
                      step="0.0001"
                      value={longitude}
                      onChange={(e) => {
                        setLongitude(parseFloat(e.target.value) || 0);
                        setLocationSource("MAP_PIN");
                      }}
                      className="w-full min-h-[38px] bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-400"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between text-xs pt-1 gap-2">
                  <div className="flex items-center gap-2">
                    {validLocation ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        ✓ Inside Gujarat Boundary
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1 font-medium">
                        ✕ Coordinates Outside Gujarat
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">
                    Source: {locationSource}
                  </span>
                </div>

                {/* Address Text & Landmark */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <input
                      id="incident-address"
                      type="text"
                      value={addressText}
                      onChange={(e) => setAddressText(e.target.value)}
                      placeholder="Address / Locality (e.g. Near Usmanpura Underpass)"
                      aria-label="Address or Locality text"
                      className="w-full min-h-[38px] bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-400"
                    />
                  </div>
                  <div>
                    <input
                      id="incident-landmark"
                      type="text"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder="Landmark (e.g. Opposite Jain Temple)"
                      aria-label="Landmark text"
                      className="w-full min-h-[38px] bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-400"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !validLocation}
                  className="w-full min-h-[50px] bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl text-sm transition shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin text-base" aria-hidden="true">⏳</span>
                      <span>Transmitting Report to SEOC...</span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">🚨</span>
                      <span>Dispatch Incident Report</span>
                      <span aria-hidden="true">→</span>
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
