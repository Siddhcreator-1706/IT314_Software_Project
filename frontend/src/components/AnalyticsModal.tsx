"use client";

import React, { useState } from "react";
import { useResQ } from "../context/ResQContext";

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ isOpen, onClose }) => {
  const { incidents, responders, resources, reports } = useResQ();
  const [exportSuccess, setExportSuccess] = useState(false);

  if (!isOpen) return null;

  const activeIncidents = incidents.filter(
    (i) => i.lifecycleStatus !== "RESOLVED" && i.lifecycleStatus !== "CLOSED"
  );
  const criticalCount = incidents.filter((i) => i.severity === "CRITICAL").length;
  const resolvedCount = incidents.filter(
    (i) => i.lifecycleStatus === "RESOLVED" || i.lifecycleStatus === "CLOSED"
  ).length;
  const pendingReports = reports.filter((r) => r.verificationStatus === "PENDING").length;

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

  const severityCounts = {
    CRITICAL: incidents.filter((i) => i.severity === "CRITICAL").length,
    HIGH: incidents.filter((i) => i.severity === "HIGH").length,
    MODERATE: incidents.filter((i) => i.severity === "MODERATE").length,
    LOW: incidents.filter((i) => i.severity === "LOW").length,
  };

  const totalResourceUnits = resources.reduce((acc, r) => acc + r.totalStock, 0);
  const allocatedResourceUnits = resources.reduce((acc, r) => acc + r.allocatedStock, 0);
  const resourceUtilizationPct = totalResourceUnits > 0
    ? Math.round((allocatedResourceUnits / totalResourceUnits) * 100)
    : 0;

  const deployedResponders = responders.filter((r) => r.status !== "AVAILABLE").length;

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
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn font-sans">
      <div className="bg-[#0b1324] border border-border text-foreground rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#093452] border-b border-[#062338] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 font-bold text-base">
              📊
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Operational Analytics &amp; Situation Metrics
              </h2>
              <p className="text-[11px] text-sky-200/80">Real-time emergency incident aggregations and logistics utilization</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <span>📥</span> Export CSV Report
            </button>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer text-base font-bold"
              aria-label="Close dialog"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {exportSuccess && (
            <div role="status" className="p-3 bg-emerald-950/80 border border-emerald-700/60 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
              <span>✓</span> CSV export generated and downloaded successfully.
            </div>
          )}

          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-surface-muted/60 border border-border p-4 rounded-xl">
              <span className="text-[10px] uppercase tracking-wider text-muted font-semibold block">Active Emergencies</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-white mt-1 block tabular-nums">{activeIncidents.length}</span>
              <span className="text-[11px] text-critical font-medium mt-1 block">{criticalCount} Critical Priority</span>
            </div>

            <div className="bg-surface-muted/60 border border-border p-4 rounded-xl">
              <span className="text-[10px] uppercase tracking-wider text-muted font-semibold block">Resolved Incidents</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-low mt-1 block tabular-nums">{resolvedCount}</span>
              <span className="text-[11px] text-muted font-medium mt-1 block">Successfully Closed</span>
            </div>

            <div className="bg-surface-muted/60 border border-border p-4 rounded-xl">
              <span className="text-[10px] uppercase tracking-wider text-muted font-semibold block">Units Committed</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-info mt-1 block tabular-nums">{deployedResponders}</span>
              <span className="text-[11px] text-muted font-medium mt-1 block">of {responders.length} Tracked</span>
            </div>

            <div className="bg-surface-muted/60 border border-border p-4 rounded-xl">
              <span className="text-[10px] uppercase tracking-wider text-muted font-semibold block">Logistics Load</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 mt-1 block tabular-nums">{resourceUtilizationPct}%</span>
              <span className="text-[11px] text-muted font-medium mt-1 block">{allocatedResourceUnits} Units Allocated</span>
            </div>
          </div>

          {/* Chart Breakdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Category Breakdown */}
            <div className="bg-surface-muted/40 border border-border p-4 rounded-xl space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Emergencies by Disaster Category</h3>
              <div className="space-y-2.5 pt-1">
                {Object.entries(categoryCounts).map(([cat, count]) => {
                  const pct = incidents.length > 0 ? Math.round((count / incidents.length) * 100) : 0;
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-foreground">{cat}</span>
                        <span className="font-mono text-muted">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-surface rounded-full overflow-hidden border border-border/60">
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

            {/* Severity Breakdown */}
            <div className="bg-surface-muted/40 border border-border p-4 rounded-xl space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Severity Classification Breakdown</h3>
              <div className="space-y-2.5 pt-1">
                {(
                  [
                    ["CRITICAL", severityCounts.CRITICAL, "bg-critical"],
                    ["HIGH", severityCounts.HIGH, "bg-high"],
                    ["MODERATE", severityCounts.MODERATE, "bg-medium"],
                    ["LOW", severityCounts.LOW, "bg-low"],
                  ] as const
                ).map(([sev, count, color]) => {
                  const pct = incidents.length > 0 ? Math.round((count / incidents.length) * 100) : 0;
                  return (
                    <div key={sev} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-foreground">{sev}</span>
                        <span className="font-mono text-muted">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-surface rounded-full overflow-hidden border border-border/60">
                        <div
                          className={`h-full ${color} rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Pending Triage Notice */}
          {pendingReports > 0 && (
            <div className="bg-high-soft/60 border border-high/30 rounded-xl p-3.5 flex items-center justify-between text-xs text-high">
              <span>Notice: {pendingReports} citizen SOS emergency report(s) awaiting command verification.</span>
              <span className="font-semibold underline underline-offset-2">Queue Active →</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
