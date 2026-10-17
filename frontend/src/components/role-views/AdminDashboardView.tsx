"use client";

import React, { useState } from "react";
import { useResQ } from "../../context/ResQContext";
import { IncidentRecord } from "../../types/resq";
import { AdminManagementWorkspace } from "./AdminManagementWorkspace";

interface AdminDashboardViewProps {
  onOpenWorkspace: () => void;
  onOpenDispatch: (incident: IncidentRecord) => void;
  onOpenSimulation: () => void;
  onOpenAnalytics: () => void;
  onClose?: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onOpenWorkspace,
  onOpenDispatch,
  onOpenSimulation,
  onOpenAnalytics,
  onClose,
}) => {
  const {
    currentUser,
    incidents,
    selectIncident,
    resources,
    auditLogs,
    acceptAITriage,
    updateIncidentStatus,
    setMapFocusTarget,
  } = useResQ();

  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<"incidents" | "ai_triage" | "resources">("incidents");
  const [showAdminConsole, setShowAdminConsole] = useState(false);

  const pendingAIIncidents = incidents.filter(
    (inc) => inc.aiRecommendation && inc.aiRecommendation.status === "PENDING_REVIEW"
  );
  const activeCriticalIncidents = incidents.filter(
    (inc) => inc.severity === "CRITICAL" && inc.lifecycleStatus !== "RESOLVED"
  );

  return (
    <div className="fixed bottom-4 left-4 z-[900] max-w-lg w-full animate-fadeIn font-sans">
      <div className="bg-[#0b1222]/95 backdrop-blur-md border border-blue-500/40 rounded-2xl shadow-2xl overflow-hidden text-white transition-all duration-300 ring-1 ring-blue-500/30">
        {/* Top Header */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-blue-950 via-[#0f2d59] to-slate-900 border-b border-blue-600/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-base">🛡️</span>
            <div>
              <div className="text-xs font-bold tracking-wide text-white flex items-center gap-1.5">
                <span>NDMA Incident Command & Triage Deck</span>
                <span className="text-[9.5px] bg-blue-500/20 text-blue-300 border border-blue-500/40 px-1.5 py-0.2 rounded font-mono">
                  {currentUser.role.split("/")[0]}
                </span>
              </div>
              <div className="text-[10px] text-blue-200">
                Commander: <span className="font-semibold text-white">{currentUser.name}</span> ({currentUser.agency})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowAdminConsole(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10.5px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer shadow flex items-center gap-1"
              title="Open Application Management Console (AM-FR-01 to 11)"
            >
              <span>⚙️</span>
              <span>App Admin</span>
            </button>
            <button
              onClick={onOpenWorkspace}
              className="bg-blue-600 hover:bg-blue-500 text-white text-[10.5px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer shadow"
              title="Open Complete Operational Workspace"
            >
              Full Command Deck
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-white/10 cursor-pointer"
            >
              {isMinimized ? "▲" : "▼"}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-white/10 cursor-pointer font-bold"
                title="Close Dashboard Panel"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {!isMinimized && (
          <div className="p-3.5 space-y-3">
            {/* Quick Command Stat Tiles */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-slate-900/90 border border-red-900/50 p-2 rounded-xl">
                <div className="text-base font-extrabold text-red-400">{activeCriticalIncidents.length}</div>
                <div className="text-[9.5px] text-slate-300">Critical Threats</div>
              </div>
              <div className="bg-slate-900/90 border border-amber-900/50 p-2 rounded-xl">
                <div className="text-base font-extrabold text-amber-400">{pendingAIIncidents.length}</div>
                <div className="text-[9.5px] text-slate-300">AI Triage Queue</div>
              </div>
              <div className="bg-slate-900/90 border border-sky-900/50 p-2 rounded-xl">
                <div className="text-base font-extrabold text-sky-400">{incidents.length}</div>
                <div className="text-[9.5px] text-slate-300">Total Declared</div>
              </div>
              <div className="bg-slate-900/90 border border-emerald-900/50 p-2 rounded-xl">
                <div className="text-base font-extrabold text-emerald-400">{auditLogs.length}</div>
                <div className="text-[9.5px] text-slate-300">Audit Logs</div>
              </div>
            </div>

            {/* Sub-Tabs */}
            <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab("incidents")}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                  activeTab === "incidents"
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>📋</span> Incidents ({incidents.length})
              </button>
              <button
                onClick={() => setActiveTab("ai_triage")}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                  activeTab === "ai_triage"
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>🤖</span> AI Triage ({pendingAIIncidents.length})
              </button>
              <button
                onClick={() => setActiveTab("resources")}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                  activeTab === "resources"
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>📦</span> Logistics ({resources.length})
              </button>
            </div>

            {/* TAB 1: INCIDENTS COMMAND LIST */}
            {activeTab === "incidents" && (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 p-2.5 rounded-xl space-y-1.5 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono font-bold text-sky-400">{inc.id}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            inc.severity === "CRITICAL"
                              ? "bg-red-500/20 text-red-300 border border-red-500/40"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          }`}
                        >
                          {inc.severity}
                        </span>
                      </div>
                      <span className="text-[9.5px] font-mono text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                        {inc.lifecycleStatus}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-white truncate">{inc.title}</div>
                    <div className="text-[10.5px] text-slate-400 line-clamp-1">{inc.locationName}</div>

                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            selectIncident(inc);
                            setMapFocusTarget({ lat: inc.lat, lon: inc.lon, zoom: 15, title: inc.title });
                          }}
                          className="text-[10.5px] text-sky-400 hover:text-sky-300 underline cursor-pointer"
                        >
                          Inspect & Triage
                        </button>
                        <button
                          onClick={() => onOpenDispatch(inc)}
                          className="text-[10.5px] text-amber-400 hover:text-amber-300 underline cursor-pointer"
                        >
                          Dispatch Units →
                        </button>
                      </div>

                      {inc.lifecycleStatus !== "RESOLVED" && (
                        <button
                          onClick={() =>
                            updateIncidentStatus(inc.id, "RESOLVED", "Operational Commander cleared incident.")
                          }
                          className="text-[9.5px] bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white px-2 py-0.5 rounded transition cursor-pointer"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 2: AI TRIAGE QUEUE */}
            {activeTab === "ai_triage" && (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {incidents
                  .filter((inc) => inc.aiRecommendation)
                  .map((inc) => {
                    const ai = inc.aiRecommendation!;
                    const isPending = ai.status === "PENDING_REVIEW";

                    return (
                      <div
                        key={inc.id}
                        className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white">{inc.id}: {inc.category}</span>
                          <span className="text-[10px] font-bold text-sky-400 bg-sky-950 px-1.5 py-0.5 rounded border border-sky-800">
                            Confidence: {ai.confidenceScore}%
                          </span>
                        </div>

                        <div className="text-[10.5px] text-slate-300 bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                          <b>Sensor Evidence:</b> {ai.evidenceSummary}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span
                            className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                              ai.status === "ACCEPTED"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            Status: {ai.status}
                          </span>

                          {isPending && (
                            <button
                              onClick={() => acceptAITriage(inc.id)}
                              className="text-[10.5px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1 rounded-lg transition cursor-pointer"
                            >
                              ✓ Approve AI Recommendation
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* TAB 3: LOGISTICS & INVENTORY */}
            {activeTab === "resources" && (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {resources.map((res) => (
                  <div
                    key={res.id}
                    className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{res.name}</span>
                      <span
                        className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                          res.availableStock <= res.criticalThreshold
                            ? "bg-red-500/20 text-red-300 border border-red-500/40"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        {res.availableStock <= res.criticalThreshold ? "LOW STOCK" : "ADEQUATE"}
                      </span>
                    </div>

                    <div className="text-[10.5px] text-slate-400">
                      Depot: {res.warehouseLocation}
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span>
                        Available: <b className="text-sky-300">{res.availableStock}</b> / {res.totalStock} {res.unit}
                      </span>
                      <button
                        onClick={onOpenWorkspace}
                        className="text-sky-400 hover:text-sky-300 underline cursor-pointer"
                      >
                        Reallocate Stock →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Launcher Deck */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
              <button
                onClick={onOpenSimulation}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-1.5 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
              >
                <span>🎯</span> Run Disaster Simulation
              </button>
              <button
                onClick={onOpenAnalytics}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold py-1.5 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-700"
              >
                <span>📊</span> Situation Analytics Report
              </button>
            </div>
          </div>
        )}
      </div>

      {showAdminConsole && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/85 backdrop-blur-xs p-3 animate-in fade-in">
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto p-5 shadow-2xl">
            <AdminManagementWorkspace onClose={() => setShowAdminConsole(false)} />
          </div>
        </div>
      )}
    </div>
  );
};
