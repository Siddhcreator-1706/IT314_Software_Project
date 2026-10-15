"use client";

import React, { useState } from "react";
import { useResQ } from "../../context/ResQContext";
import { IncidentRecord } from "../../types/resq";

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
  onClose,
}) => {
  const {
    currentUser,
    incidents,
    selectIncident,
    resources,
    acceptAITriage,
    setMapFocusTarget,
  } = useResQ();

  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<"incidents" | "ai_triage" | "resources">("incidents");

  const pendingAIIncidents = incidents.filter(
    (inc) => inc.aiRecommendation && inc.aiRecommendation.status === "PENDING_REVIEW"
  );
  const activeCriticalIncidents = incidents.filter(
    (inc) => inc.severity === "CRITICAL" && inc.lifecycleStatus !== "RESOLVED"
  );

  return (
    <div className="fixed bottom-4 left-4 z-[900] max-w-lg w-full animate-fadeIn font-sans">
      <div className="bg-[#0b1324]/98 backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden text-foreground">
        {/* Top Header */}
        <div className="px-4 py-3 bg-[#093452] border-b border-[#062338] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🛡️</span>
            <div>
              <div className="text-xs font-bold tracking-wide text-white flex items-center gap-1.5">
                <span>NDMA Incident Command Deck</span>
                <span className="text-[9.5px] bg-sky-950 text-sky-300 border border-sky-600/50 px-1.5 py-0.2 rounded font-mono">
                  {currentUser.role.split("/")[0]}
                </span>
              </div>
              <div className="text-[10px] text-sky-200/80">
                Commander: <span className="font-semibold text-white">{currentUser.name}</span> ({currentUser.agency})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenWorkspace}
              className="bg-sky-600 hover:bg-sky-500 text-white text-[10.5px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer shadow-xs"
              title="Open Complete Operational Workspace"
            >
              Full Deck
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-white/70 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-white/10 cursor-pointer"
            >
              {isMinimized ? "▲" : "▼"}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-white/70 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-white/10 cursor-pointer font-bold"
                title="Close Dashboard Panel"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {!isMinimized && (
          <div className="p-3.5 space-y-3">
            {/* Quick Stat Tiles */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-surface-muted border border-critical/30 p-2 rounded-xl">
                <div className="text-base font-extrabold text-critical tabular-nums">{activeCriticalIncidents.length}</div>
                <div className="text-[9.5px] text-muted font-medium">Critical Threats</div>
              </div>
              <div className="bg-surface-muted border border-ai/30 p-2 rounded-xl">
                <div className="text-base font-extrabold text-ai tabular-nums">{pendingAIIncidents.length}</div>
                <div className="text-[9.5px] text-muted font-medium">AI Triage Queue</div>
              </div>
              <div className="bg-surface-muted border border-border p-2 rounded-xl">
                <div className="text-base font-extrabold text-white tabular-nums">{incidents.length}</div>
                <div className="text-[9.5px] text-muted font-medium">Logged Incidents</div>
              </div>
              <div className="bg-surface-muted border border-border p-2 rounded-xl">
                <div className="text-base font-extrabold text-low tabular-nums">
                  {resources.filter((r) => r.availableStock > 0).length}
                </div>
                <div className="text-[9.5px] text-muted font-medium">Available Units</div>
              </div>
            </div>

            {/* View Tabs */}
            <div className="flex bg-surface-muted/60 p-1 rounded-xl border border-border text-xs">
              <button
                onClick={() => setActiveTab("incidents")}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === "incidents"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <span>🔥</span> Threats ({activeCriticalIncidents.length})
              </button>
              <button
                onClick={() => setActiveTab("ai_triage")}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === "ai_triage"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <span>✦</span> AI Recommendations ({pendingAIIncidents.length})
              </button>
              <button
                onClick={() => setActiveTab("resources")}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === "resources"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <span>📦</span> Logistics Stock
              </button>
            </div>

            {/* Tab Contents */}
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {activeTab === "incidents" && (
                <>
                  {activeCriticalIncidents.length === 0 ? (
                    <div className="text-center py-6 text-muted text-xs bg-surface-muted/30 border border-dashed border-border rounded-xl">
                      No active critical emergencies in your operational sector.
                    </div>
                  ) : (
                    activeCriticalIncidents.map((inc) => (
                      <div
                        key={inc.id}
                        className="bg-surface-muted/60 border border-border rounded-xl p-2.5 flex items-center justify-between gap-2 hover:border-slate-700 transition"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold text-sky-400">{inc.id}</span>
                            <span className="text-[9px] bg-critical-soft text-critical border border-critical/30 px-1 rounded font-bold">
                              CRITICAL
                            </span>
                            <span className="text-xs font-semibold text-white truncate">{inc.title}</span>
                          </div>
                          <div className="text-[10px] text-muted truncate mt-0.5">📍 {inc.locationName}</div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => {
                              selectIncident(inc);
                              setMapFocusTarget({ lat: inc.lat, lon: inc.lon, zoom: 16, title: inc.title });
                            }}
                            className="bg-surface hover:bg-surface-elevated text-muted hover:text-white border border-border px-2 py-1 rounded text-[10px] font-semibold cursor-pointer"
                          >
                            Map
                          </button>
                          <button
                            onClick={() => onOpenDispatch(inc)}
                            className="bg-sky-600 hover:bg-sky-500 text-white px-2 py-1 rounded text-[10px] font-bold cursor-pointer shadow-xs"
                          >
                            Dispatch
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeTab === "ai_triage" && (
                <>
                  {pendingAIIncidents.length === 0 ? (
                    <div className="text-center py-6 text-muted text-xs bg-surface-muted/30 border border-dashed border-border rounded-xl">
                      AI triage queue is currently clear.
                    </div>
                  ) : (
                    pendingAIIncidents.map((inc) => (
                      <div
                        key={inc.id}
                        className="bg-ai-soft/40 border border-ai/30 rounded-xl p-2.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold text-sky-400">{inc.id}</span>
                          <span className="text-[9px] bg-ai-soft text-ai border border-ai/40 px-1.5 py-0.2 rounded font-mono font-semibold">
                            AI Confidence: {Math.round(inc.aiRecommendation?.confidenceScore || 88)}%
                          </span>
                        </div>
                        <p className="text-[11px] text-foreground font-medium">{inc.title}</p>
                        <p className="text-[10px] text-muted line-clamp-2">
                          {inc.aiRecommendation?.explanation || inc.aiRecommendation?.evidenceSummary || "Immediate tactical verification recommended."}
                        </p>
                        <div className="flex justify-end gap-1.5 pt-1">
                          <button
                            onClick={() => acceptAITriage(inc.id)}
                            className="bg-sky-600 hover:bg-sky-500 text-white px-2.5 py-1 rounded text-[10.5px] font-semibold cursor-pointer shadow-xs"
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeTab === "resources" && (
                <div className="space-y-1.5">
                  {resources.map((res) => (
                    <div
                      key={res.id}
                      className="bg-surface-muted/60 border border-border rounded-xl p-2 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-white">{res.name}</div>
                        <div className="text-[10px] text-muted">{res.warehouseLocation}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-sky-400">
                          {res.availableStock} / {res.totalStock}
                        </div>
                        <div className="text-[9.5px] text-muted">Stock Available</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
