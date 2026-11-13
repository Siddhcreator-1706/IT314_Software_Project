"use client";

import React, { useState, useEffect, useCallback } from "react";
import { SiteHeader, NavLink } from "@/components/Brand";
import Link from "next/link";
import { InformationRequestReply } from "@/components/citizen/InformationRequestReply";
import { fetchMyReports, ReportData } from "@/services/citizenApi";

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; step: number; color: string }
> = {
  SUBMITTED: {
    label: "Awaiting Verification",
    badgeClass: "bg-amber-950/60 text-amber-300 border-amber-700/60",
    step: 1,
    color: "#f59e0b",
  },
  VERIFIED: {
    label: "Verified by SEOC",
    badgeClass: "bg-sky-950/60 text-sky-300 border-sky-700/60",
    step: 2,
    color: "#0284c7",
  },
  DISPATCHED: {
    label: "Response Team En Route",
    badgeClass: "bg-purple-950/60 text-purple-300 border-purple-700/60",
    step: 3,
    color: "#a855f7",
  },
  RESOLVED: {
    label: "Incident Resolved",
    badgeClass: "bg-emerald-950/60 text-emerald-300 border-emerald-700/60",
    step: 4,
    color: "#10b981",
  },
  CLOSED: {
    label: "Closed",
    badgeClass: "bg-slate-800 text-slate-300 border-slate-700",
    step: 4,
    color: "#64748b",
  },
  REJECTED: {
    label: "Dismissed / Duplicate",
    badgeClass: "bg-rose-950/60 text-rose-300 border-rose-700/60",
    step: 1,
    color: "#f43f5e",
  },
  NEEDS_INFORMATION: {
    label: "Additional Info Requested",
    badgeClass: "bg-orange-950/60 text-orange-300 border-orange-700/60",
    step: 1,
    color: "#f97316",
  },
};

const STAGES = [
  { id: 1, name: "Submitted", desc: "Logged in queue" },
  { id: 2, name: "Verified", desc: "Assessed by Command" },
  { id: 3, name: "Dispatched", desc: "Field Team assigned" },
  { id: 4, name: "Resolved", desc: "Emergency cleared" },
];

export default function MyReportsPage() {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Null until the first load finishes: a time rendered on the server never matches the browser locale (hydration error).
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);

  const loadReports = useCallback(async () => {
    try {
      const res = await fetchMyReports();
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        setReports(res.data);
        setError(null);
      }
      setLastRefreshed(new Date());
    } catch {
      setError("Unable to connect to reports service.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load & Polling every 15 seconds (SRS Requirement S1-06)
  useEffect(() => {
    let mounted = true;
    const fetchReports = async () => {
      try {
        const res = await fetchMyReports();
        if (!mounted) return;
        if (res.error) {
          setError(res.error);
        } else if (res.data) {
          setReports(res.data);
          setError(null);
        }
        setLastRefreshed(new Date());
      } catch {
        if (mounted) setError("Unable to connect to reports service.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchReports();
    const interval = setInterval(fetchReports, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const getStatusInfo = (statusStr?: string) => {
    const key = (statusStr || "SUBMITTED").toUpperCase();
    return STATUS_CONFIG[key] || STATUS_CONFIG.SUBMITTED;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <SiteHeader subtitle="My Incident Reports" maxWidth="max-w-5xl">
        <span aria-live="polite" className="hidden items-center gap-1.5 font-mono text-[11px] text-sky-200/80 xl:flex">
          <span aria-hidden="true" className="size-1.5 animate-ping rounded-full bg-emerald-400" />
          Auto-refresh 15s · {lastRefreshed ? lastRefreshed.toLocaleTimeString() : "…"}
        </span>
        <NavLink href="/report" variant="primary">+ Report<span className="hidden sm:inline"> Incident</span></NavLink>
        <NavLink href="/citizen/dashboard" hideBelow="sm">Dashboard</NavLink>
      </SiteHeader>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
              <span aria-hidden="true">📋</span> Active Emergency Reports
            </h1>
            <p className="text-slate-300 text-xs md:text-sm mt-0.5">
              Live status progression and verification timeline from Gujarat Disaster Management operations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadReports()}
            className="min-h-[44px] text-xs font-semibold text-slate-200 hover:text-white bg-slate-900 border border-slate-700 hover:border-slate-600 px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <span aria-hidden="true">🔄</span> Refresh Now
          </button>
        </div>

        {error && (
          <div role="alert" aria-live="assertive" className="mb-6 p-4 bg-red-950/60 border border-red-700/60 rounded-xl text-red-200 text-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span aria-hidden="true">⚠️</span>
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => loadReports()}
              className="text-xs font-semibold bg-red-900/80 hover:bg-red-800 text-white px-3 py-1.5 rounded-lg border border-red-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div role="status" aria-label="Loading incident reports" className="space-y-4">
            <span className="sr-only">Loading your incident reports...</span>
            {[1, 2, 3].map((skeletonId) => (
              <div key={skeletonId} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 md:p-6 animate-pulse space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="h-5 w-36 bg-slate-800 rounded" />
                    <div className="h-3 w-48 bg-slate-800/60 rounded" />
                  </div>
                  <div className="h-6 w-28 bg-slate-800 rounded-full" />
                </div>
                <div className="h-14 w-full bg-slate-950/60 rounded-xl border border-slate-800/40" />
                <div className="grid grid-cols-4 gap-2 pt-2">
                  {[1, 2, 3, 4].map((stepId) => (
                    <div key={stepId} className="text-center space-y-1.5">
                      <div className="w-7 h-7 rounded-full bg-slate-800 mx-auto" />
                      <div className="h-3 w-12 bg-slate-800/60 rounded mx-auto" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center shadow-lg">
            <div className="text-4xl mb-3" aria-hidden="true">📍</div>
            <h2 className="text-lg font-bold text-white mb-1">No Incidents Reported</h2>
            <p className="text-slate-300 text-sm max-w-md mx-auto mb-6">
              You haven&apos;t filed any emergency incident reports yet. If you are experiencing a disaster in Gujarat, file a report directly with emergency operations.
            </p>
            <Link
              href="/report"
              className="inline-flex items-center gap-2 min-h-[44px] bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-sky-600/30 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span aria-hidden="true">🚨</span>
              <span>Report An Emergency</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => {
              const currentStatus = report.status || report.verification_status || "SUBMITTED";
              const statusInfo = getStatusInfo(currentStatus);
              const isSelected = selectedReport?.id === report.id;

              return (
                <div
                  key={report.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 md:p-6 shadow-md transition"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-sky-400 text-sm">
                          {report.incident_ref || report.id}
                        </span>
                        <span className="text-xs uppercase tracking-wider font-semibold bg-slate-800 text-slate-200 px-2 py-0.5 rounded border border-slate-700">
                          {report.category || "Incident"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 flex flex-wrap items-center gap-2">
                        <span>📍 {report.location_name || `${report.lat.toFixed(4)}, ${report.lon.toFixed(4)}`}</span>
                        <span aria-hidden="true">•</span>
                        <span>
                          {report.submitted_at
                            ? new Date(report.submitted_at).toLocaleString()
                            : "Recently logged"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full border ${statusInfo.badgeClass}`}
                      >
                        {statusInfo.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedReport(isSelected ? null : report)}
                        className="min-h-[44px] text-xs font-medium text-slate-300 hover:text-white bg-slate-800/90 px-3 py-1 rounded-lg border border-slate-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 flex items-center justify-center"
                      >
                        {isSelected ? "Hide Details" : "Timeline View"}
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-slate-200 mb-5 leading-relaxed bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/60">
                    {report.description}
                  </p>

                  {/* Citizen reply to a NEEDS_INFORMATION request (issue #99, SRS S2-13) */}
                  <InformationRequestReply report={report} onReplied={loadReports} className="mb-5" />

                  {/* Visual 4-Stage Progression Timeline */}
                  <div className="pt-2">
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2 relative">
                      {STAGES.map((stage) => {
                        const isPast = statusInfo.step > stage.id;
                        const isCurrent = statusInfo.step === stage.id;

                        return (
                          <div
                            key={stage.id}
                            className="text-center relative"
                            aria-current={isCurrent ? "step" : undefined}
                          >
                            {/* Connector Bar */}
                            {stage.id < 4 && (
                              <div
                                className={`hidden sm:block absolute top-3.5 left-1/2 w-full h-0.5 z-0 ${
                                  isPast ? "bg-sky-500" : "bg-slate-800"
                                }`}
                                aria-hidden="true"
                              />
                            )}

                            {/* Node Icon */}
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center mx-auto mb-1.5 text-xs font-bold relative z-10 transition ${
                                isPast
                                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/30"
                                  : isCurrent
                                  ? "bg-amber-500 text-slate-950 ring-4 ring-amber-500/20 shadow-md shadow-amber-500/30 font-extrabold"
                                  : "bg-slate-800 text-slate-400 border border-slate-700"
                              }`}
                            >
                              {isPast ? "✓" : stage.id}
                            </div>

                            <div
                              className={`text-[11px] sm:text-xs font-semibold truncate ${
                                isCurrent ? "text-amber-300 font-bold" : isPast ? "text-slate-200" : "text-slate-400"
                              }`}
                            >
                              {stage.name}
                            </div>
                            <div className="text-[10px] text-slate-400 hidden md:block">
                              {stage.desc}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Detailed Timeline Drawer */}
                  {isSelected && (
                    <div className="mt-5 pt-4 border-t border-slate-800 text-xs space-y-2">
                      <div className="font-semibold text-slate-200 mb-2">Detailed Event Audit:</div>
                      <div className="space-y-1.5 font-mono text-[11px] text-slate-300">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400" aria-hidden="true">●</span>
                          <span>Report received by Gujarat Gateway:</span>
                          <span className="text-white font-medium">
                            {report.submitted_at || "Initial Timestamp recorded"}
                          </span>
                        </div>
                        {report.timeline &&
                          report.timeline.map((item, tIdx) => (
                            <div key={tIdx} className="flex items-center gap-2">
                              <span className="text-sky-400" aria-hidden="true">●</span>
                              <span>Status updated to {item.status}:</span>
                              <span className="text-white font-medium">
                                {new Date(item.timestamp).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        <div className="flex items-center gap-2 text-slate-400">
                          <span aria-hidden="true">ℹ️</span>
                          <span>Coordinates: {(report.lat ?? (report as unknown as { latitude?: number }).latitude ?? 22.2587).toFixed(4)}°N, {(report.lon ?? (report as unknown as { longitude?: number }).longitude ?? 71.1924).toFixed(4)}°E (Gujarat)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
