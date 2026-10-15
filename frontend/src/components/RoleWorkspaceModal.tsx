"use client";

import React, { useState } from "react";
import { useResQ } from "../context/ResQContext";
import { UserRole, IncidentRecord } from "../types/resq";
import { DEMO_USERS } from "../services/resqStorage";

interface RoleWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCitizenReport?: () => void;
  onOpenDispatch?: (incident: IncidentRecord) => void;
}

export const RoleWorkspaceModal: React.FC<RoleWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onOpenDispatch,
}) => {
  const {
    activeRole,
    currentUser,
    switchRole,
    incidents,
    selectIncident,
    reports,
    verifyReport,
    rejectReport,
    responders: _responders,
    resources,
    allocateResource,
    auditLogs,
    setMapFocusTarget,
  } = useResQ();

  const [reportFilter, setReportFilter] = useState<string>("ALL");
  const [allocationAmount, setAllocationAmount] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const showNotification = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleFocusLocation = (lat: number, lon: number, title: string) => {
    setMapFocusTarget({ lat, lon, zoom: 16, title });
    onClose();
  };

  const filteredReports = reports.filter((r) => {
    if (reportFilter === "PENDING") return r.verificationStatus === "PENDING";
    if (reportFilter === "VERIFIED") return r.verificationStatus === "VERIFIED";
    return true;
  });

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn font-sans">
      <div className="bg-[#0b1324] border border-border text-foreground rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden">
        {/* Workspace Top Bar */}
        <div className="px-5 py-3.5 bg-[#093452] border-b border-[#062338] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 font-bold text-base">
              🏢
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                Operational Multi-Role Workspace
                <span className="text-[10px] bg-sky-950 text-sky-300 border border-sky-600/50 px-2 py-0.5 rounded font-mono font-semibold">
                  {activeRole}
                </span>
              </h2>
              <p className="text-[11px] text-sky-200/80">
                User: <span className="text-white font-semibold">{currentUser.name}</span> ({currentUser.agency}) · ID: {currentUser.id}
              </p>
            </div>
          </div>

          {/* Quick Role Switcher */}
          <div className="flex items-center gap-2">
            <select
              value={activeRole}
              onChange={(e) => switchRole(e.target.value as UserRole)}
              className="bg-[#0b1324] border border-border text-xs text-amber-300 font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-info cursor-pointer"
            >
              {DEMO_USERS.map((u) => (
                <option key={u.id} value={u.role}>
                  Switch to: {u.role} ({u.name})
                </option>
              ))}
            </select>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer text-base font-bold ml-1"
              aria-label="Close workspace"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="bg-emerald-950/80 border-b border-emerald-700/60 text-emerald-200 px-5 py-2 text-xs flex items-center gap-2 font-medium">
            <span>✓</span> {feedback}
          </div>
        )}

        {/* Workspace Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Section 1: Emergency Citizen Intake Reports */}
          <div className="bg-surface-muted/40 border border-border rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
              <div>
                <h3 className="text-sm font-bold text-white">Citizen Emergency Reports Queue</h3>
                <p className="text-[11px] text-muted">Intake via Mobile App and ERSS 112 Gateway</p>
              </div>
              <div className="flex gap-1 text-xs">
                {(["ALL", "PENDING", "VERIFIED"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setReportFilter(f)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                      reportFilter === f
                        ? "bg-sky-600 text-white shadow-xs"
                        : "bg-surface border border-border text-muted hover:text-white"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {filteredReports.length === 0 ? (
                <div className="text-center py-6 text-muted text-xs">No reports in this view.</div>
              ) : (
                filteredReports.map((report) => (
                  <div
                    key={report.id}
                    className="bg-surface border border-border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] font-bold text-sky-400">{report.id}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            report.verificationStatus === "VERIFIED"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : report.verificationStatus === "REJECTED"
                              ? "bg-red-950 text-red-300 border border-red-800"
                              : "bg-amber-950 text-amber-300 border border-amber-800"
                          }`}
                        >
                          {report.verificationStatus}
                        </span>
                        <span className="font-semibold text-white truncate">{report.category}</span>
                      </div>
                      <p className="text-muted line-clamp-1">{report.description}</p>
                      <p className="text-[10.5px] text-muted mt-1">
                        📍 {report.locationName} · Reporter: {report.reporterName} ({report.affectedPeopleCount} people)
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleFocusLocation(report.lat, report.lon, report.locationName)}
                        className="bg-surface-muted hover:bg-surface-elevated text-muted hover:text-white border border-border px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        📍 Map
                      </button>
                      {report.verificationStatus === "PENDING" && (
                        <>
                          <button
                            onClick={() => {
                              verifyReport(report.id, true);
                              showNotification(`Report ${report.id} verified.`);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                          >
                            Verify
                          </button>
                          <button
                            onClick={() => {
                              rejectReport(report.id, "Invalid Report");
                              showNotification(`Report ${report.id} rejected.`);
                            }}
                            className="bg-surface-muted hover:bg-red-950 text-red-400 border border-border px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section 2: Active Incidents Overview */}
          <div className="bg-surface-muted/40 border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="text-sm font-bold text-white">Active Emergency Incidents ({incidents.length})</h3>
                <p className="text-[11px] text-muted">Tactical dispatch deployment and live situation status</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="bg-surface border border-border rounded-xl p-3 space-y-2 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-sky-400">{inc.id}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-critical-soft text-critical border border-critical/30">
                      {inc.severity}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-white line-clamp-1">{inc.title}</h4>
                  <p className="text-[11px] text-muted line-clamp-1">📍 {inc.locationName}</p>
                  <div className="flex items-center justify-between pt-1 border-t border-border/60 text-[10.5px]">
                    <span className="text-muted">Status: <strong className="text-sky-300">{inc.lifecycleStatus}</strong></span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          selectIncident(inc);
                          handleFocusLocation(inc.lat, inc.lon, inc.title);
                        }}
                        className="text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
                      >
                        Inspect
                      </button>
                      {onOpenDispatch && (
                        <button
                          onClick={() => {
                            onClose();
                            onOpenDispatch(inc);
                          }}
                          className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer ml-1"
                        >
                          Dispatch →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Logistics & Warehouse Stock */}
          <div className="bg-surface-muted/40 border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-white">Emergency Logistics &amp; Relief Stock</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {resources.map((res) => (
                <div key={res.id} className="bg-surface border border-border rounded-xl p-3 flex items-center justify-between text-xs">
                  <div>
                    <h5 className="font-bold text-white">{res.name}</h5>
                    <p className="text-[10.5px] text-muted">{res.warehouseLocation}</p>
                    <p className="text-[10.5px] font-mono text-sky-400 mt-1">
                      Available: {res.availableStock} / {res.totalStock}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={res.availableStock}
                      value={allocationAmount[res.id] || 1}
                      onChange={(e) =>
                        setAllocationAmount({
                          ...allocationAmount,
                          [res.id]: Number(e.target.value),
                        })
                      }
                      className="w-14 bg-surface-muted border border-border rounded px-2 py-1 text-xs text-white text-center font-mono"
                    />
                    <button
                      onClick={() => {
                        const amt = allocationAmount[res.id] || 1;
                        const targetIncId = incidents[0]?.id || "INC-2026-001";
                        allocateResource(res.id, amt, targetIncId);
                        showNotification(`Allocated ${amt} units of ${res.name}.`);
                      }}
                      disabled={res.availableStock <= 0}
                      className="bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-40 text-white px-2.5 py-1 rounded text-xs font-semibold cursor-pointer shadow-xs"
                    >
                      Allocate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Audit Log Feed */}
          <div className="bg-surface-muted/40 border border-border rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-bold text-white">Security &amp; Operational Audit Trail</h3>
            <div className="space-y-1.5 max-h-36 overflow-y-auto font-mono text-[11px] text-muted pr-1">
              {auditLogs.slice(-6).reverse().map((log) => (
                <div key={log.id} className="bg-surface p-2 rounded-lg border border-border/70 flex justify-between">
                  <span>[{log.timestamp.slice(11, 19)}] {log.action}: {log.reason || log.recordType}</span>
                  <span className="text-sky-400 font-semibold shrink-0 ml-2">{log.userId}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
