"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * Disaster Management overlay for the existing ResQ map.
 *
 * Draws real incidents and located resources from the operations database
 * (GET /api/v1/dm/map via the same-origin proxy) onto the portal's Leaflet map,
 * in a separate layer group. It renders nothing unless the visitor has a valid
 * Disaster Management session: the backend refuses everyone else.
 */

type MapIncident = {
  incident_id: string;
  incident_ref: string;
  scenario: string;
  status: string;
  verified_priority: string | null;
  latitude: string;
  longitude: string;
  address_text: string | null;
  people_affected: number | null;
};
type MapResource = {
  resource_id: string;
  name: string;
  type: string;
  status: string;
  quantity_available: string;
  quantity_total: string;
  agency_name: string | null;
  latitude: number;
  longitude: number;
  /** When the team last reported its position; null when a dispatcher set it by hand. */
  position_updated_at?: string | null;
};
type MapData = {
  generated_at: string;
  incidents: MapIncident[];
  incidents_without_coordinates: { incident_id: string }[];
  resources: MapResource[];
};

// Same palette and icons as the portal's own incident markers.
const PRIORITY_COLOR: Record<string, string> = { CRITICAL: "#dc2626", HIGH: "#ea580c", MEDIUM: "#d97706", LOW: "#16a34a" };
const SCENARIO_ICON: Record<string, string> = { industrial_fire: "🔥", cyclone: "🌀", urban_flooding: "🌊" };
const RESOURCE_ICON: Record<string, string> = { TEAM: "👷", VEHICLE: "🚒", SUPPLY: "📦", SUPPORT: "🛠️" };
const REFRESH_MS = 60_000;

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function words(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

/** How long ago a team reported its position, in words. */
function reportedAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

// The portal loads Leaflet from its CDN as window.L, so there are no static types.
type LeafletMap = any;

export function LiveOperationsLayer({ mapRef }: { mapRef: RefObject<LeafletMap> }) {
  const [data, setData] = useState<MapData | null>(null);
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState(false);
  const layerRef = useRef<LeafletMap>(null);
  const focusedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const session = await fetch("/api/session", { cache: "no-store" });
      if (!session.ok || !(await session.json()).dm) {
        setData(null); // guests, citizens and other roles see the portal unchanged
        return;
      }
      const res = await fetch("/api/dm/map", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        setData(null); // not Disaster Management staff: show nothing
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load and periodic refresh
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Draw markers once both the data and the portal's map (loaded asynchronously) are ready.
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    let attempts = 0;

    const draw = () => {
      const L = (window as any).L;
      const map = mapRef.current;
      if (!L || !map) {
        if (!cancelled && attempts++ < 60) setTimeout(draw, 250);
        return;
      }
      if (!layerRef.current) layerRef.current = L.layerGroup();
      const layer = layerRef.current;
      layer.clearLayers();
      if (visible) layer.addTo(map);
      else map.removeLayer(layer);

      const focusId = new URLSearchParams(window.location.search).get("incident");
      let focusMarker: LeafletMap = null;

      for (const inc of data.incidents) {
        const color = inc.verified_priority ? PRIORITY_COLOR[inc.verified_priority] : "#475569";
        const html = `
          <div style="background:${color};color:#fff;font:700 11px system-ui,sans-serif;padding:3px 8px;border-radius:9999px;
            border:2px solid #38bdf8;box-shadow:0 0 0 2px rgba(56,189,248,.35),0 4px 10px rgba(0,0,0,.5);display:flex;
            align-items:center;gap:4px;white-space:nowrap;cursor:pointer;transform:translate(-50%,-50%)">
            <span>${SCENARIO_ICON[inc.scenario] ?? "⚠️"}</span><span>${esc(inc.incident_ref)}</span>
            <span style="font-size:9px;background:rgba(0,0,0,.25);padding:1px 4px;border-radius:4px">${esc(words(inc.status).toUpperCase())}</span>
          </div>`;
        const marker = L.marker([Number(inc.latitude), Number(inc.longitude)], {
          icon: L.divIcon({ html, className: "dm-live-incident-marker", iconSize: [0, 0] }),
          zIndexOffset: 500,
        }).bindPopup(`
          <div style="font:12px system-ui,sans-serif;padding:3px;min-width:180px">
            <div style="font-size:9px;font-weight:700;color:#0284c7;letter-spacing:.05em">LIVE · OPERATIONS DATABASE</div>
            <b style="color:#0f172a">${esc(inc.incident_ref)}</b><br/>
            <span style="color:#475569">${esc(words(inc.scenario))} · ${esc(words(inc.status))}</span><br/>
            <span style="color:#475569">Priority: ${esc(inc.verified_priority ? words(inc.verified_priority) : "unassigned")}</span><br/>
            ${inc.address_text ? `<span style="font-size:11px;color:#64748b">${esc(inc.address_text)}</span><br/>` : ""}
            <a href="/dm/incidents/${encodeURIComponent(inc.incident_id)}" style="color:#0284c7;font-weight:600">Open in DM workspace →</a>
          </div>`);
        marker.addTo(layer);
        if (focusId === inc.incident_id) focusMarker = marker;
      }

      for (const r of data.resources) {
        const html = `
          <div style="background:#0f172a;color:#f8fafc;font:700 10px monospace;padding:2px 6px;border-radius:6px;
            border:1.5px solid ${r.status === "AVAILABLE" ? "#10b981" : "#f59e0b"};box-shadow:0 2px 8px rgba(0,0,0,.6);
            display:flex;align-items:center;gap:3px;white-space:nowrap;transform:translate(-50%,-50%)">
            <span>${RESOURCE_ICON[r.type] ?? "📍"}</span><span style="color:#38bdf8">${esc(r.name)}</span>
          </div>`;
        L.marker([r.latitude, r.longitude], { icon: L.divIcon({ html, className: "dm-live-resource-marker", iconSize: [0, 0] }) })
          .bindPopup(`
            <div style="font:12px system-ui,sans-serif;padding:3px">
              <b style="color:#0f172a">${esc(r.name)}</b><br/>
              <span style="color:#475569">${esc(words(r.type))} · ${esc(words(r.status))}</span><br/>
              <span style="font-size:11px;color:#0284c7">${Number(r.quantity_available)} of ${Number(r.quantity_total)} available</span>
              ${r.agency_name ? `<br/><span style="font-size:10px;color:#64748b">${esc(r.agency_name)}</span>` : ""}
              <br/><span style="font-size:10px;color:#64748b">${
                r.position_updated_at ? `Position reported ${esc(reportedAgo(r.position_updated_at))}` : "Position set by a dispatcher, not reported by the team"
              }</span>
            </div>`)
          .addTo(layer);
      }

      if (focusMarker && visible && !focusedRef.current) {
        focusedRef.current = true;
        // Wait for the portal's own intro flight over India (about 3.6 s) before focusing.
        setTimeout(() => {
          map.flyTo(focusMarker.getLatLng(), 15, { duration: 2.5 });
          setTimeout(() => focusMarker.openPopup(), 2700);
        }, 3800);
      }
    };

    draw();
    return () => {
      cancelled = true;
    };
  }, [data, visible, mapRef]);

  // Remove the layer when the portal unmounts.
  useEffect(() => () => layerRef.current?.remove(), []);

  if (!data) return null;
  const missing = data.incidents_without_coordinates.length;

  return (
    <div className="fixed top-14 right-3 z-[900] w-64 rounded-xl border border-sky-500/40 bg-[#0b1222]/95 p-3 text-white shadow-2xl backdrop-blur-md font-sans">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-sky-300">
          <span className="size-2 animate-pulse rounded-full bg-emerald-400" aria-hidden /> LIVE OPERATIONS
        </span>
        <label className="flex cursor-pointer items-center gap-1 text-[10px] text-slate-300">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="accent-sky-500" />
          Show
        </label>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-300">
        {data.incidents.length} open incident{data.incidents.length === 1 ? "" : "s"} · {data.resources.length} located resource
        {data.resources.length === 1 ? "" : "s"}
        {missing > 0 && <span className="text-amber-300"> · {missing} without coordinates</span>}
      </p>
      <p className="text-[10px] text-slate-500">
        From the operations database · {new Date(data.generated_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        {error && <span className="text-red-300"> · refresh failed</span>}
      </p>
      <p className="mt-1 text-[10px] text-slate-500">Outlined in blue on the map; other pins are the portal&apos;s demo data.</p>
      <Link
        href="/dm"
        className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 py-1.5 text-xs font-bold transition hover:bg-sky-500"
      >
        Open DM Workspace →
      </Link>
    </div>
  );
}
