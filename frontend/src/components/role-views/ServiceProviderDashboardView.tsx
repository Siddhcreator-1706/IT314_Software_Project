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
    infrastructure,
    setMapFocusTarget,
  } = useResQ();

  const [isMinimized, setIsMinimized] = useState(false);
  const [sitrepFeedback, setSitrepFeedback] = useState<string | null>(null);

  // Find the responder unit corresponding to this user
  const myUnit =
    responders.find(
      (r) =>
        r.personnelName.toLowerCase() === currentUser.name.toLowerCase() ||
        r.callsign === currentUser.assignedUnitCallsign ||
        (r.role === currentUser.role && r.agency === currentUser.agency)
    ) || responders[0];

  // Find active dispatch assignment for this unit
  const activeDispatch = dispatches.find(
    (d) => d.unitId === myUnit?.id && d.status !== "COMPLETED" && d.status !== "CANCELLED"
  );

  const assignedIncident = activeDispatch
    ? incidents.find((i) => i.id === activeDispatch.incidentId)
    : myUnit?.assignedIncidentId
    ? incidents.find((i) => i.id === myUnit.assignedIncidentId)
    : null;

  // Status changer
  const handleStatusChange = (newStatus: UnitStatus) => {
    if (myUnit) {
      updateUnitStatus(myUnit.id, newStatus);
    }
  };

  // SITREP Transmitter
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

  // Relevant infrastructure (Hospitals for medics, Fire stations for firefighters, etc.)
  const relevantInfra = infrastructure.filter((inf) => {
    if (currentUser.role.includes("Medic") || currentUser.role.includes("Ambulance")) {
      return inf.type === "HOSPITAL";
    }
    if (currentUser.role.includes("Fire")) {
      return inf.type === "FIRE_STATION" || inf.type === "HOSPITAL";
    }
    return inf.type === "SHELTER" || inf.type === "HOSPITAL";
  });

  return (
    <div className="fixed bottom-4 left-4 z-[900] max-w-lg w-full animate-in fade-in duration-200">
      <div className="bg-[#0B111E]/95 backdrop-blur-md border border-amber-500/30 rounded-xl shadow-2xl overflow-hidden text-white transition-all duration-300 ring-1 ring-amber-500/20">
        {/* Banner Top Bar */}
        <div className="px-4 py-2.5 bg-[#070b14] border-b border-amber-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold tracking-wider text-slate-200 flex items-center gap-1.5 uppercase font-mono">
                <span>RESPONDER UNIT CONSOLE</span>
                <span className="text-[9px] bg-amber-950/80 text-amber-300 border border-amber-800 px-1.5 py-0.2 rounded font-mono font-bold">
                  {myUnit ? myUnit.callsign : "UNIT"}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                CALLSIGN: <span className="font-semibold text-white">{currentUser.name}</span> • {currentUser.agency}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenWorkspace}
              className="bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded transition cursor-pointer shadow uppercase"
              title="Open Responder Workspace"
            >
              FULL HUD
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
            {/* Live Operational Status Switcher */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 mb-1.5 uppercase">
                <span>UNIT OPERATIONAL STATUS:</span>
                <span className="text-amber-400 font-bold">{myUnit?.status || "AVAILABLE"}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(["AVAILABLE", "EN ROUTE", "ON SCENE", "BUSY"] as UnitStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(st)}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-bold transition cursor-pointer border flex items-center justify-center gap-1.5 ${
                      myUnit?.status === st
                        ? st === "AVAILABLE"
                          ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-xs"
                          : st === "EN ROUTE"
                          ? "bg-amber-950/80 border-amber-500 text-amber-300 shadow-xs"
                          : st === "ON SCENE"
                          ? "bg-sky-950/80 border-sky-500 text-sky-300 shadow-xs"
                          : "bg-red-950/80 border-red-500 text-red-300 shadow-xs"
                        : "bg-[#070b14] border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        st === "AVAILABLE"
                          ? "bg-emerald-400 shadow-[0_0_6px_#10b981]"
                          : st === "EN ROUTE"
                          ? "bg-amber-400 shadow-[0_0_6px_#f59e0b]"
                          : st === "ON SCENE"
                          ? "bg-sky-400 shadow-[0_0_6px_#38bdf8]"
                          : "bg-red-400 shadow-[0_0_6px_#ef4444]"
                      }`}
                    />
                    <span>{st}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Active Mission HUD */}
            <div className="bg-[#070b14] border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                    <circle cx="12" cy="12" r="4" fill="currentColor"/>
                  </svg>
                  <span>ACTIVE MISSION ASSIGNMENT</span>
                </span>
                {assignedIncident && (
                  <span className="text-[9px] bg-red-950/80 text-red-400 border border-red-800 px-2 py-0.5 rounded font-mono font-bold">
                    PRIORITY 1
                  </span>
                )}
              </div>

              {assignedIncident ? (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-white font-mono">
                    {assignedIncident.id}: {assignedIncident.title}
                  </div>
                  <div className="text-[10.5px] text-slate-300 flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      {assignedIncident.locationName}
                    </span>
                    <span className="text-sky-400 font-bold">
                      ~{activeDispatch?.etaMinutes || 12} MINS ETA
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 line-clamp-2 font-sans">
                    {assignedIncident.description}
                  </div>
                  <div className="text-[10px] text-amber-300 bg-amber-950/40 p-1.5 rounded border border-amber-900/40">
                    <b>URGENT NEEDS:</b> {assignedIncident.urgentNeeds.join(", ")}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() =>
                        setMapFocusTarget({
                          lat: assignedIncident.lat,
                          lon: assignedIncident.lon,
                          zoom: 16,
                          title: assignedIncident.title,
                        })
                      }
                      className="text-[10px] text-sky-400 hover:text-sky-300 underline font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <span>TRACE ROUTE ON MAP &rarr;</span>
                    </button>
                    <span className="text-[9px] text-slate-500">
                      DISPATCHED BY: ERSS 112
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-3 text-center text-xs text-slate-500 font-mono">
                  <span>No active incident assigned to your callsign. Unit is currently on stand-by.</span>
                </div>
              )}
            </div>

            {/* SITREP Fast Buttons */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 mb-1.5 flex items-center justify-between uppercase">
                <span>TRANSMIT FIELD SITREP TO COMMAND HQ:</span>
                {sitrepFeedback && (
                  <span className="text-[9px] text-emerald-400 font-semibold">{sitrepFeedback}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleSendSITREP("Arrived on scene, assessing perimeter safety")}
                  className="text-[10px] bg-[#070b14] hover:bg-slate-900 text-slate-300 border border-slate-800 p-1.5 rounded text-left transition cursor-pointer truncate"
                >
                  &rarr; Arrived on scene
                </button>
                <button
                  onClick={() => handleSendSITREP("Extricating casualties, medical triage in progress")}
                  className="text-[10px] bg-[#070b14] hover:bg-slate-900 text-slate-300 border border-slate-800 p-1.5 rounded text-left transition cursor-pointer truncate"
                >
                  &rarr; Casualties extricated
                </button>
                <button
                  onClick={() => handleSendSITREP("Road inundated, requesting backup boat unit")}
                  className="text-[10px] bg-[#070b14] hover:bg-slate-900 text-slate-300 border border-slate-800 p-1.5 rounded text-left transition cursor-pointer truncate"
                >
                  &rarr; Request backup boat
                </button>
                <button
                  onClick={() => handleSendSITREP("Casualties transported to hospital. Mission complete.")}
                  className="text-[10px] bg-[#070b14] hover:bg-slate-900 text-slate-300 border border-slate-800 p-1.5 rounded text-left transition cursor-pointer truncate"
                >
                  &rarr; Delivered to ER
                </button>
              </div>
            </div>

            {/* Nearest Critical Infrastructure */}
            <div className="pt-1 border-t border-slate-800">
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5 uppercase">
                <span>NEAREST ER TRAUMA CENTERS / HYDRANTS:</span>
                <span className="text-amber-400">LOCATE ON MAP &rarr;</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {relevantInfra.slice(0, 3).map((inf) => (
                  <button
                    key={inf.id}
                    onClick={() =>
                      setMapFocusTarget({
                        lat: inf.lat,
                        lon: inf.lon,
                        zoom: 16,
                        title: inf.name,
                      })
                    }
                    className="text-[10px] bg-[#070b14] hover:bg-slate-900 text-slate-200 border border-slate-800 px-2 py-1 rounded transition cursor-pointer flex items-center gap-1.5 font-mono"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${inf.type === "HOSPITAL" ? "bg-red-400" : "bg-orange-400"}`} />
                    <span className="truncate max-w-[130px]">{inf.name.split(" ")[0]} {inf.name.split(" ")[1]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
