"use client";

import React, { useState } from "react";
import { useResQ } from "../../context/ResQContext";

interface CitizenDashboardViewProps {
  onOpenCitizenReport: () => void;
  onClose?: () => void;
}

export const CitizenDashboardView: React.FC<CitizenDashboardViewProps> = ({
  onOpenCitizenReport,
  onClose,
}) => {
  const {
    currentUser,
    reports,
    infrastructure,
    dispatches,
    responders,
    setMapFocusTarget,
  } = useResQ();

  const [activeTab, setActiveTab] = useState<"reports" | "shelters" | "guide">("reports");
  const [isMinimized, setIsMinimized] = useState(false);

  // Filter reports submitted by this user (or show all user reports if demo)
  const myReports = reports.filter(
    (r) =>
      r.reporterName.toLowerCase() === currentUser.name.toLowerCase() ||
      r.reporterPhone === currentUser.phone ||
      r.source === "CITIZEN_APP"
  );

  const activeShelters = infrastructure.filter(
    (inf) => inf.type === "SHELTER" || inf.type === "HOSPITAL"
  );

  return (
    <div className="fixed bottom-4 left-4 z-[900] max-w-md w-full animate-in fade-in duration-200">
      <div className="bg-[#0B111E]/95 backdrop-blur-md border border-sky-500/30 rounded-xl shadow-2xl overflow-hidden text-white transition-all duration-300 ring-1 ring-sky-500/20">
        {/* Banner Top Bar */}
        <div className="px-4 py-2.5 bg-[#070b14] border-b border-sky-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold tracking-wider text-slate-200 flex items-center gap-1.5 uppercase font-mono">
                <span>CITIZEN SAFETY CONSOLE</span>
                <span className="text-[9px] bg-emerald-950/80 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded font-mono">
                  ONLINE
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                CITIZEN: <span className="font-semibold text-white">{currentUser.name}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenCitizenReport}
              className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded shadow animate-pulse cursor-pointer transition uppercase"
              title="Report Emergency SOS"
            >
              SOS REPORT
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
                title="Hide Console"
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
            {/* View Navigation Tabs */}
            <div className="flex bg-[#070b14] p-1 rounded-lg border border-slate-800 text-[10px] uppercase">
              <button
                onClick={() => setActiveTab("reports")}
                className={`flex-1 py-1.5 rounded transition cursor-pointer flex items-center justify-center gap-1.5 font-bold ${
                  activeTab === "reports"
                    ? "bg-sky-600/30 text-sky-300 border border-sky-500/50 shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <svg className="w-3 h-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>MY SOS ({myReports.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("shelters")}
                className={`flex-1 py-1.5 rounded transition cursor-pointer flex items-center justify-center gap-1.5 font-bold ${
                  activeTab === "shelters"
                    ? "bg-sky-600/30 text-sky-300 border border-sky-500/50 shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <svg className="w-3 h-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>SHELTERS & ER</span>
              </button>
              <button
                onClick={() => setActiveTab("guide")}
                className={`flex-1 py-1.5 rounded transition cursor-pointer flex items-center justify-center gap-1.5 font-bold ${
                  activeTab === "guide"
                    ? "bg-sky-600/30 text-sky-300 border border-sky-500/50 shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <svg className="w-3 h-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>GUIDELINES</span>
              </button>
            </div>

            {/* TAB 1: My SOS Reports */}
            {activeTab === "reports" && (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {myReports.length === 0 ? (
                  <div className="text-center py-4 bg-[#070b14] rounded-lg border border-slate-800 p-3">
                    <p className="text-xs text-slate-400 font-mono">No distress reports filed yet.</p>
                    <button
                      onClick={onOpenCitizenReport}
                      className="mt-2 text-xs bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-1.5 rounded font-mono shadow cursor-pointer transition uppercase"
                    >
                      FILE EMERGENCY REPORT NOW
                    </button>
                  </div>
                ) : (
                  myReports.map((rep) => {
                    const activeDispatch = rep.linkedIncidentId
                      ? dispatches.find((d) => d.incidentId === rep.linkedIncidentId)
                      : undefined;
                    const assignedUnit = activeDispatch
                      ? responders.find((r) => r.id === activeDispatch.unitId)
                      : undefined;

                    return (
                      <div
                        key={rep.id}
                        className="bg-[#070b14] border border-slate-800 hover:border-sky-500/50 p-2.5 rounded-lg space-y-1.5 transition"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-sky-400">
                            {rep.id}
                          </span>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider ${
                              rep.verificationStatus === "VERIFIED" || rep.verificationStatus === "LINKED_TO_INCIDENT"
                                ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                                : rep.verificationStatus === "PENDING"
                                ? "bg-amber-950/80 text-amber-400 border border-amber-800"
                                : "bg-red-950/80 text-red-400 border border-red-800"
                            }`}
                          >
                            {rep.verificationStatus === "LINKED_TO_INCIDENT"
                              ? "DISPATCHED / ACTIVE"
                              : rep.verificationStatus}
                          </span>
                        </div>

                        <div className="text-xs font-semibold text-slate-200">
                          {rep.category} — {rep.locationName}
                        </div>

                        <div className="text-[10.5px] text-slate-400 line-clamp-2 font-sans">
                          {rep.description}
                        </div>

                        {/* Status tracker bar */}
                        <div className="bg-[#0b1424] p-2 rounded border border-slate-800 text-[10px] space-y-1 font-mono">
                          <div className="flex items-center justify-between text-slate-400">
                            <span>RESPONSE PROGRESS:</span>
                            <span className="text-emerald-400 font-semibold">
                              {rep.verificationStatus === "PENDING"
                                ? "UNDER EOC REVIEW"
                                : assignedUnit
                                ? `${assignedUnit.callsign} DISPATCHED`
                                : "TEAM ASSIGNED"}
                            </span>
                          </div>

                          {assignedUnit && (
                            <div className="text-sky-300 flex items-center justify-between pt-0.5">
                              <span>ESTIMATED ARRIVAL:</span>
                              <span className="font-bold text-white">~{activeDispatch?.etaMinutes || 10} MINS</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1 font-mono">
                          <button
                            onClick={() =>
                              setMapFocusTarget({
                                lat: rep.lat,
                                lon: rep.lon,
                                zoom: 16,
                                title: `My Report: ${rep.category}`,
                              })
                            }
                            className="text-[10px] text-sky-400 hover:text-sky-300 cursor-pointer flex items-center gap-1"
                          >
                            <svg className="w-3 h-3 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>LOCATE ON MAP</span>
                          </button>
                          <span className="text-[9px] text-slate-500">
                            {new Date(rep.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 2: Shelters & ER */}
            {activeTab === "shelters" && (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {activeShelters.map((shelter) => (
                  <div
                    key={shelter.id}
                    className="bg-[#070b14] border border-slate-800 hover:border-emerald-500/50 p-2.5 rounded-lg space-y-1 transition font-mono"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${shelter.type === "HOSPITAL" ? "bg-red-400" : "bg-emerald-400"}`} />
                        <span>{shelter.name}</span>
                      </span>
                      <span className="text-[9px] font-bold bg-emerald-950/80 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-800">
                        {shelter.status}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 font-sans">
                      {shelter.address} • Tel: <b className="text-sky-300 font-mono">{shelter.contactNumber}</b>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-300 pt-1">
                      <span>
                        AVAILABLE BEDS: <b className="text-white">{shelter.availableBeds ?? 120}</b>
                      </span>
                      <button
                        onClick={() =>
                          setMapFocusTarget({
                            lat: shelter.lat,
                            lon: shelter.lon,
                            zoom: 16,
                            title: shelter.name,
                          })
                        }
                        className="text-sky-400 hover:text-sky-300 cursor-pointer"
                      >
                        SHOW ON MAP &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 3: Safety Guidelines */}
            {activeTab === "guide" && (
              <div className="space-y-2 max-h-56 overflow-y-auto text-xs text-slate-300 pr-1 font-mono">
                <div className="bg-[#070b14] p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="font-bold text-sky-400 text-[11px] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    <span>FLASH FLOOD SAFETY PROTOCOL:</span>
                  </div>
                  <ul className="text-[10.5px] text-slate-400 list-disc list-inside space-y-0.5 font-sans">
                    <li>Move immediately to upper floors or designated relief camps.</li>
                    <li>Avoid walking or driving through moving water.</li>
                    <li>Turn off main electrical breaker if water enters premises.</li>
                  </ul>
                </div>

                <div className="bg-[#070b14] p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="font-bold text-amber-400 text-[11px] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>BUILDING FIRE PROTOCOL:</span>
                  </div>
                  <ul className="text-[10.5px] text-slate-400 list-disc list-inside space-y-0.5 font-sans">
                    <li>Crawl low under smoke towards emergency exits.</li>
                    <li>Never use elevators during structural alarms.</li>
                    <li>Signal rescuers from balconies using bright cloth or torch.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Action Bar Footer */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <button
                onClick={onOpenCitizenReport}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg text-xs font-mono uppercase tracking-wider shadow-md shadow-red-600/30 cursor-pointer transition flex items-center justify-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>SUBMIT EMERGENCY DISTRESS SOS</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
