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

  const pendingAIIncidents = incidents.filter(
    (inc) => inc.aiRecommendation && inc.aiRecommendation.status === "PENDING_REVIEW"
  );
  const activeCriticalIncidents = incidents.filter(
    (inc) => inc.severity === "CRITICAL" && inc.lifecycleStatus !== "RESOLVED"
  );

  return (
    <div className="fixed bottom-4 left-4 z-[900] max-w-lg w-full animate-in fade-in duration-200">
      <div className="bg-[#0B111E]/95 backdrop-blur-md border border-blue-500/30 rounded-xl shadow-2xl overflow-hidden text-white transition-all duration-300 ring-1 ring-blue-500/20">
        {/* Top Header */}
        <div className="px-4 py-2.5 bg-[#070b14] border-b border-blue-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold tracking-wider text-slate-200 flex items-center gap-1.5 uppercase font-mono">
                <span>NDMA COMMAND & TRIAGE DECK</span>
                <span className="text-[9px] bg-blue-950/80 text-blue-300 border border-blue-800 px-1.5 py-0.2 rounded font-mono">
                  {currentUser.role.split("/")[0]}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                COMMANDER: <span className="font-semibold text-white">{currentUser.name}</span> ({currentUser.agency})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenWorkspace}
              className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded transition cursor-pointer shadow uppercase"
              title="Open Complete Operational Workspace"
            >
              FULL DECK
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-slate-400 hover:text-white text-xs p-1 rounded hover:bg-slate-800 transition cursor-pointer"
            >
              {isMinimized ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white text-xs p-1 rounded hover:bg-slate-800 transition cursor-pointer font-bold"
                title="Close Dashboard Panel"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {!isMinimized && (
          <div className="p-3.5 space-y-3 font-mono">
            {/* Quick Command Stat Tiles */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-[#070b14] border border-red-900/50 p-2 rounded-lg">
                <div className="text-base font-bold text-red-400 font-mono">{activeCriticalIncidents.length}</div>
                <div className="text-[9px] text-slate-400 uppercase mt-0.5">CRITICAL</div>
              </div>
              <div className="bg-[#070b14] border border-amber-900/50 p-2 rounded-lg">
                <div className="text-base font-bold text-amber-400 font-mono">{pendingAIIncidents.length}</div>
                <div className="text-[9px] text-slate-400 uppercase mt-0.5">AI QUEUE</div>
              </div>
              <div className="bg-[#070b14] border border-sky-900/50 p-2 rounded-lg">
                <div className="text-base font-bold text-sky-400 font-mono">{incidents.length}</div>
                <div className="text-[9px] text-slate-400 uppercase mt-0.5">DECLARED</div>
              </div>
              <div className="bg-[#070b14] border border-emerald-900/50 p-2 rounded-lg">
                <div className="text-base font-bold text-emerald-400 font-mono">{auditLogs.length}</div>
                <div className="text-[9px] text-slate-400 uppercase mt-0.5">AUDIT LOGS</div>
              </div>
            </div>

            {/* Sub-Tabs */}
            <div className="flex bg-[#070b14] p-1 rounded-lg border border-slate-800 text-[10px] uppercase">
              <button
                onClick={() => setActiveTab("incidents")}
                className={`flex-1 py-1.5 rounded transition cursor-pointer flex items-center justify-center gap-1.5 font-bold ${
                  activeTab === "incidents"
                    ? "bg-blue-600/30 text-blue-300 border border-blue-500/50 shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>INCIDENTS ({incidents.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("ai_triage")}
                className={`flex-1 py-1.5 rounded transition cursor-pointer flex items-center justify-center gap-1.5 font-bold ${
                  activeTab === "ai_triage"
                    ? "bg-blue-600/30 text-blue-300 border border-blue-500/50 shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>AI TRIAGE ({pendingAIIncidents.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("resources")}
                className={`flex-1 py-1.5 rounded transition cursor-pointer flex items-center justify-center gap-1.5 font-bold ${
                  activeTab === "resources"
                    ? "bg-blue-600/30 text-blue-300 border border-blue-500/50 shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span>LOGISTICS ({resources.length})</span>
              </button>
            </div>

            {/* TAB 1: INCIDENTS COMMAND LIST */}
            {activeTab === "incidents" && (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="bg-[#070b14] border border-slate-800 hover:border-blue-500/50 p-2.5 rounded-lg space-y-1.5 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold text-sky-400">{inc.id}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono uppercase ${
                            inc.severity === "CRITICAL"
                              ? "bg-red-950/80 text-red-400 border border-red-800"
                              : "bg-amber-950/80 text-amber-400 border border-amber-800"
                          }`}
                        >
                          {inc.severity}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                        {inc.lifecycleStatus}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-white truncate">{inc.title}</div>
                    <div className="text-[10px] text-slate-400 line-clamp-1 font-sans">{inc.locationName}</div>

                    <div className="flex items-center justify-between pt-1 text-[10px] font-mono">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            selectIncident(inc);
                            setMapFocusTarget({ lat: inc.lat, lon: inc.lon, zoom: 15, title: inc.title });
                          }}
                          className="text-sky-400 hover:text-sky-300 underline cursor-pointer"
                        >
                          INSPECT
                        </button>
                        <button
                          onClick={() => onOpenDispatch(inc)}
                          className="text-amber-400 hover:text-amber-300 underline cursor-pointer"
                        >
                          DISPATCH &rarr;
                        </button>
                      </div>

                      {inc.lifecycleStatus !== "RESOLVED" && (
                        <button
                          onClick={() =>
                            updateIncidentStatus(inc.id, "RESOLVED", "Operational Commander cleared incident.")
                          }
                          className="text-[9px] bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white px-2 py-0.5 rounded transition cursor-pointer"
                        >
                          RESOLVE
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
                        className="bg-[#070b14] border border-slate-800 p-2.5 rounded-lg space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white font-mono">{inc.id}: {inc.category}</span>
                          <span className="text-[9px] font-mono font-bold text-sky-400 bg-sky-950 px-1.5 py-0.5 rounded border border-sky-800">
                            CONFIDENCE: {ai.confidenceScore}%
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-300 bg-[#0b1424] p-2 rounded border border-slate-800 font-sans leading-relaxed">
                          <b className="font-mono text-sky-300">SENSOR EVIDENCE:</b> {ai.evidenceSummary}
                        </div>

                        <div className="flex items-center justify-between pt-1 font-mono">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              ai.status === "ACCEPTED"
                                ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                                : "bg-amber-950/80 text-amber-300 border border-amber-800"
                            }`}
                          >
                            STATUS: {ai.status}
                          </span>

                          {isPending && (
                            <button
                              onClick={() => acceptAITriage(inc.id)}
                              className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1 rounded transition cursor-pointer flex items-center gap-1"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>APPROVE AI RECOMMENDATION</span>
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
                    className="bg-[#070b14] border border-slate-800 p-2.5 rounded-lg space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white font-mono">{res.name}</span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          res.availableStock <= res.criticalThreshold
                            ? "bg-red-950/80 text-red-400 border border-red-800"
                            : "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                        }`}
                      >
                        {res.availableStock <= res.criticalThreshold ? "LOW STOCK" : "ADEQUATE"}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 font-mono">
                      DEPOT: {res.warehouseLocation}
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-1 font-mono">
                      <span>
                        AVAILABLE: <b className="text-sky-300">{res.availableStock}</b> / {res.totalStock} {res.unit}
                      </span>
                      <button
                        onClick={onOpenWorkspace}
                        className="text-sky-400 hover:text-sky-300 underline cursor-pointer"
                      >
                        REALLOCATE STOCK &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Launcher Deck */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800 font-mono">
              <button
                onClick={onOpenSimulation}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-1.5 px-2.5 rounded-lg text-[10px] flex items-center justify-center gap-1.5 transition cursor-pointer shadow uppercase"
              >
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                  <circle cx="12" cy="12" r="6" strokeWidth="2"/>
                </svg>
                <span>RUN SIMULATION</span>
              </button>
              <button
                onClick={onOpenAnalytics}
                className="bg-[#070b14] hover:bg-slate-800 text-slate-200 hover:text-white font-bold py-1.5 px-2.5 rounded-lg text-[10px] flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-700 uppercase"
              >
                <svg className="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>ANALYTICS REPORT</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
