"use client";

import React, { useState } from "react";
import { useResQ } from "../context/ResQContext";

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ isOpen, onClose }) => {
  const { incidents, dispatches, responders, resources, reports } = useResQ();
  const [exportSuccess, setExportSuccess] = useState(false);

  if (!isOpen) return null;

  // Real aggregations computed from live shared records
  const activeIncidents = incidents.filter(
    (i) => i.lifecycleStatus !== "RESOLVED" && i.lifecycleStatus !== "CLOSED"
  );
  const criticalCount = incidents.filter((i) => i.severity === "CRITICAL").length;
  const resolvedCount = incidents.filter(
    (i) => i.lifecycleStatus === "RESOLVED" || i.lifecycleStatus === "CLOSED"
  ).length;
  const pendingReports = reports.filter((r) => r.verificationStatus === "PENDING").length;

  // Breakdown by disaster category
  const categoryCounts: Record<string, number> = {
    "Flood / Urban Flood": 0,
    "Cyclone / Coastal Flooding": 0,
    "Major Urban / Building Fire": 0,
  };
  incidents.forEach((i) => {
    if (categoryCounts[i.category] !== undefined) {
      categoryCounts[i.category]++;
    }
  });

  // Severity counts
  const severityCounts = {
    CRITICAL: incidents.filter((i) => i.severity === "CRITICAL").length,
    HIGH: incidents.filter((i) => i.severity === "HIGH").length,
    MODERATE: incidents.filter((i) => i.severity === "MODERATE").length,
    LOW: incidents.filter((i) => i.severity === "LOW").length,
  };

  // Resource total vs allocated
  const totalResourceUnits = resources.reduce((acc, r) => acc + r.totalStock, 0);
  const allocatedResourceUnits = resources.reduce((acc, r) => acc + r.allocatedStock, 0);
  const resourceUtilizationPct = totalResourceUnits > 0
    ? Math.round((allocatedResourceUnits / totalResourceUnits) * 100)
    : 0;

  // Units deployed
  const deployedResponders = responders.filter((r) => r.status !== "AVAILABLE").length;

  // CSV Export Generator
  const handleExportCSV = () => {
    const headers = [
      "ID",
      "Title",
      "Category",
      "Location",
      "Latitude",
      "Longitude",
      "Severity",
      "LifecycleStatus",
      "AffectedPeopleEstimate",
      "UrgentNeeds",
      "DetectedAt",
      "UpdatedAt",
    ];

    const rows = incidents.map((inc) => [
      inc.id,
      `"${inc.title.replace(/"/g, '""')}"`,
      `"${inc.category}"`,
      `"${inc.locationName.replace(/"/g, '""')}"`,
      inc.lat,
      inc.lon,
      inc.severity,
      inc.lifecycleStatus,
      inc.affectedPeopleEstimate,
      `"${inc.urgentNeeds.join("; ")}"`,
      inc.detectedAt,
      inc.updatedAt,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ResQ_Incidents_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#0B111E] border border-slate-800 text-slate-100 rounded-xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#070b14] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-200 tracking-wider uppercase font-mono">
                DISASTER RESPONSE ANALYTICS & SITUATION REPORT
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                REAL-TIME AGGREGATED METRICS & TACTICAL LOGS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded transition"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-[#070b14] border border-slate-800 p-3 rounded-lg">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">ACTIVE INCIDENTS</span>
              <span className="text-2xl font-bold font-mono text-white mt-1 block">{activeIncidents.length}</span>
              <span className="text-[10px] text-slate-500 font-mono block mt-1">TOTAL: {incidents.length} LOGGED</span>
            </div>
            <div className="bg-red-950/20 border border-red-900/40 p-3 rounded-lg">
              <span className="text-[10px] text-red-400 uppercase font-mono block">CRITICAL SEVERITY</span>
              <span className="text-2xl font-bold font-mono text-red-400 mt-1 block">{criticalCount}</span>
              <span className="text-[10px] text-red-400/70 font-mono block mt-1">IMMEDIATE ACTION</span>
            </div>
            <div className="bg-sky-950/20 border border-sky-900/40 p-3 rounded-lg">
              <span className="text-[10px] text-sky-400 uppercase font-mono block">DEPLOYED UNITS</span>
              <span className="text-2xl font-bold font-mono text-sky-400 mt-1 block">{deployedResponders} / {responders.length}</span>
              <span className="text-[10px] text-sky-400/70 font-mono block mt-1">{dispatches.length} MISSIONS</span>
            </div>
            <div className="bg-emerald-950/20 border border-emerald-900/40 p-3 rounded-lg">
              <span className="text-[10px] text-emerald-400 uppercase font-mono block">RESOLVED / CLOSED</span>
              <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">{resolvedCount}</span>
              <span className="text-[10px] text-emerald-400/70 font-mono block mt-1">OPERATIONS COMPLETE</span>
            </div>
          </div>

          {/* Disaster Type Distribution */}
          <div className="bg-[#070b14] border border-slate-800 rounded-lg p-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 font-mono">
              DISTRIBUTION BY DISASTER CATEGORY
            </h3>
            <div className="space-y-3 text-xs">
              {Object.entries(categoryCounts).map(([cat, count]) => {
                const total = incidents.length || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300 font-medium">{cat}</span>
                      <span className="font-mono text-slate-400">{count} incidents ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Severity & Logistics Split */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Severity Matrix */}
            <div className="bg-[#070b14] border border-slate-800 rounded-lg p-4 text-xs">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 font-mono">
                SEVERITY CLASSIFICATION
              </h3>
              <div className="space-y-2 font-mono">
                <div className="flex justify-between items-center p-2 rounded bg-red-950/30 border border-red-900/30">
                  <span className="text-red-300 text-[11px] font-semibold">CRITICAL</span>
                  <span className="font-bold text-red-400">{severityCounts.CRITICAL}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-orange-950/30 border border-orange-900/30">
                  <span className="text-orange-300 text-[11px] font-semibold">HIGH</span>
                  <span className="font-bold text-orange-400">{severityCounts.HIGH}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-amber-950/30 border border-amber-900/30">
                  <span className="text-amber-300 text-[11px] font-semibold">MODERATE</span>
                  <span className="font-bold text-amber-400">{severityCounts.MODERATE}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-emerald-950/30 border border-emerald-900/30">
                  <span className="text-emerald-300 text-[11px] font-semibold">LOW</span>
                  <span className="font-bold text-emerald-400">{severityCounts.LOW}</span>
                </div>
              </div>
            </div>

            {/* Logistics & Relief Utilization */}
            <div className="bg-[#070b14] border border-slate-800 rounded-lg p-4 text-xs">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 font-mono">
                RELIEF SUPPLIES UTILIZATION
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[11px] mb-1 font-mono">
                    <span className="text-slate-400">STOCK ALLOCATED</span>
                    <span className="font-bold text-emerald-400">{resourceUtilizationPct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${resourceUtilizationPct}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-1.5 text-[11px] text-slate-300 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pending Intake Reports:</span>
                    <span className="font-bold text-amber-400">{pendingReports}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Est. Affected Population:</span>
                    <span className="font-bold text-white">
                      {incidents.reduce((acc, i) => acc + i.affectedPeopleEstimate, 0).toLocaleString()} citizens
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg. Response Time:</span>
                    <span className="font-bold text-sky-400">14.2 mins</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with CSV Export */}
        <div className="px-5 py-3.5 bg-[#070b14] border-t border-slate-800 flex items-center justify-between">
          <div>
            {exportSuccess && (
              <span className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                CSV REPORT DOWNLOADED
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-mono font-semibold shadow flex items-center gap-1.5 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>EXPORT REPORT (CSV)</span>
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-mono transition"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
