"use client";

import React, { useState } from "react";
import { useResQ } from "../../context/ResQContext";
import { UnitStatus } from "../../types/resq";

interface ServiceProviderDashboardViewProps {
  onOpenWorkspace: () => void;
  onClose?: () => void;
}

export const ServiceProviderDashboardView: React.FC<ServiceProviderDashboardViewProps> = ({
  onOpenWorkspace,
  onClose,
}) => {
  const {
    currentUser,
    responders,
    updateUnitStatus,
    incidents,
    dispatches,
    sendMessage,
    setMapFocusTarget,
  } = useResQ();

  const [isMinimized, setIsMinimized] = useState(false);
  const [sitrepFeedback, setSitrepFeedback] = useState<string | null>(null);

  const myUnit =
    responders.find(
      (r) =>
        r.personnelName.toLowerCase() === currentUser.name.toLowerCase() ||
        r.callsign === currentUser.assignedUnitCallsign ||
        (r.role === currentUser.role && r.agency === currentUser.agency)
    ) || responders[0];

  const activeDispatch = dispatches.find(
    (d) => d.unitId === myUnit?.id && d.status !== "COMPLETED" && d.status !== "CANCELLED"
  );

  const assignedIncident = activeDispatch
    ? incidents.find((i) => i.id === activeDispatch.incidentId)
    : myUnit?.assignedIncidentId
    ? incidents.find((i) => i.id === myUnit.assignedIncidentId)
    : null;

  const handleStatusChange = (newStatus: UnitStatus) => {
    if (myUnit) {
      updateUnitStatus(myUnit.id, newStatus);
    }
  };

  const handleSendSITREP = (msg: string) => {
    if (assignedIncident) {
      sendMessage(assignedIncident.id, `[FIELD SITREP - ${myUnit?.callsign || "RESPONDER"}] ${msg}`, true);
      setSitrepFeedback(`Transmitted: "${msg}"`);
      setTimeout(() => setSitrepFeedback(null), 3000);
    } else {
      setSitrepFeedback("No active assigned mission to attach SITREP to.");
      setTimeout(() => setSitrepFeedback(null), 3000);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-[900] max-w-lg w-full animate-fadeIn font-sans">
      <div className="bg-[#0b1324]/98 backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden text-foreground">
        {/* Banner Top Bar */}
        <div className="px-4 py-3 bg-[#093452] border-b border-[#062338] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🚑</span>
            <div>
              <div className="text-xs font-bold tracking-wide text-white flex items-center gap-1.5">
                <span>Field Responder Unit Console</span>
                <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-600/50 px-1.5 py-0.2 rounded font-mono font-bold">
                  {myUnit ? myUnit.callsign : "UNIT"}
                </span>
              </div>
              <div className="text-[10px] text-sky-200/80">
                Personnel: <span className="font-semibold text-white">{currentUser.name}</span> • {currentUser.agency}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenWorkspace}
              className="bg-sky-600 hover:bg-sky-500 text-white text-[10.5px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer shadow-xs"
              title="Open Complete Operational Workspace"
            >
              Full Console
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
                title="Hide Console"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {!isMinimized && (
          <div className="p-3.5 space-y-3">
            {/* Unit Status Selector Buttons */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1.5">
                Current Operational Availability
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(["AVAILABLE", "EN ROUTE", "ON SCENE"] as UnitStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(st)}
                    className={`py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border flex items-center justify-center gap-1.5 ${
                      myUnit?.status === st
                        ? st === "AVAILABLE"
                          ? "bg-emerald-950 text-emerald-300 border-emerald-500 shadow-xs"
                          : st === "EN ROUTE"
                          ? "bg-amber-950 text-amber-300 border-amber-500 shadow-xs"
                          : "bg-red-950 text-red-300 border-red-500 shadow-xs"
                        : "bg-surface-muted/60 border-border text-muted hover:text-foreground hover:border-slate-700"
                    }`}
                  >
                    <span>●</span> {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Mission Details */}
            <div className="bg-surface-muted/60 border border-border rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                  Active Mission Directive
                </span>
                {assignedIncident && (
                  <span className="font-mono text-[10px] text-muted">{assignedIncident.id}</span>
                )}
              </div>

              {assignedIncident ? (
                <>
                  <h4 className="text-sm font-bold text-white">{assignedIncident.title}</h4>
                  <p className="text-xs text-muted">📍 {assignedIncident.locationName}</p>
                  <p className="text-xs text-foreground bg-surface p-2 rounded-lg border border-border">
                    {activeDispatch?.notes || assignedIncident.description}
                  </p>
                  <div className="flex justify-between items-center pt-1 text-[11px]">
                    <span className="text-muted">ETA: <strong className="text-white">{activeDispatch?.etaMinutes || 10} mins</strong></span>
                    <button
                      onClick={() => setMapFocusTarget({ lat: assignedIncident.lat, lon: assignedIncident.lon, zoom: 16, title: assignedIncident.title })}
                      className="text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
                    >
                      Focus Map →
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted text-center py-2">
                  No active emergency dispatch assigned. Standby in ready sector.
                </p>
              )}
            </div>

            {/* Quick Field SITREP Triggers */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1.5">
                Transmit 1-Click Tactical SITREP
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  "On scene, initial triage underway.",
                  "Requesting additional boat teams.",
                  "Evacuation corridor secured.",
                  "Casualties stabilized, moving to triage.",
                ].map((msg) => (
                  <button
                    key={msg}
                    onClick={() => handleSendSITREP(msg)}
                    className="p-2 text-left rounded-lg bg-surface hover:bg-surface-elevated border border-border hover:border-sky-500/50 text-[10.5px] text-foreground transition cursor-pointer truncate"
                    title={msg}
                  >
                    📡 {msg}
                  </button>
                ))}
              </div>
              {sitrepFeedback && (
                <p className="text-[10px] text-emerald-400 font-medium mt-1.5 animate-fadeIn">
                  ✓ {sitrepFeedback}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
