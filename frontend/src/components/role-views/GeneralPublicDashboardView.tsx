"use client";

import React, { useState } from "react";
import { useResQ } from "../../context/ResQContext";

interface GeneralPublicDashboardViewProps {
  onOpenAuth: () => void;
  onOpenCitizenReport: () => void;
  onClose?: () => void;
}

export const GeneralPublicDashboardView: React.FC<GeneralPublicDashboardViewProps> = ({
  onOpenAuth,
  onOpenCitizenReport,
  onClose,
}) => {
  const { incidents, responders, infrastructure, setMapFocusTarget } = useResQ();
  const [isMinimized, setIsMinimized] = useState(false);

  const activeIncidentsCount = incidents.filter((i) => i.lifecycleStatus !== "RESOLVED" && i.lifecycleStatus !== "CLOSED").length;
  const activeRespondersCount = responders.filter((r) => r.status !== "OFFLINE").length;
  const activeSheltersCount = infrastructure.filter((infra) => infra.type === "SHELTER" || infra.type === "HOSPITAL").length;

  return (
    <div className="fixed bottom-4 left-4 z-[900] max-w-md w-full animate-in fade-in duration-200">
      <div className="bg-[#0B111E]/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl overflow-hidden text-white transition-all duration-300">
        {/* Banner Top Bar */}
        <div className="px-4 py-2.5 bg-[#070b14] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
            <span className="text-xs font-bold tracking-wider text-slate-200 uppercase font-mono flex items-center gap-2">
              PUBLIC DISASTER OVERVIEW
              <span className="text-[9px] font-normal text-sky-400 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800/80 font-mono">
                NATIONAL NET
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-slate-400 hover:text-white text-xs p-1 rounded hover:bg-slate-800 transition cursor-pointer"
              title={isMinimized ? "Expand Overview" : "Minimize"}
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
                className="text-slate-400 hover:text-white text-xs p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                title="Close Overview Panel"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {!isMinimized && (
          <div className="p-4 space-y-3 font-mono">
            {/* Live Disaster Overview Counters */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#070b14] border border-red-900/40 p-2.5 rounded-lg">
                <div className="text-xl font-bold text-red-400 font-mono">{activeIncidentsCount}</div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">ACTIVE CRISIS</div>
              </div>

              <div className="bg-[#070b14] border border-sky-900/40 p-2.5 rounded-lg">
                <div className="text-xl font-bold text-sky-400 font-mono">{activeRespondersCount}</div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">UNITS DEPLOYED</div>
              </div>

              <div className="bg-[#070b14] border border-emerald-900/40 p-2.5 rounded-lg">
                <div className="text-xl font-bold text-emerald-400 font-mono">{activeSheltersCount}</div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">SAFE SHELTERS</div>
              </div>
            </div>

            {/* Public Advisory Ticker */}
            <div className="p-2.5 bg-[#070b14] rounded-lg border border-amber-900/40 text-xs flex items-center gap-2.5">
              <div className="w-5 h-5 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <span className="text-slate-300 text-[10.5px] leading-relaxed font-sans">
                <b className="font-mono text-amber-300">IMD WEATHER ADVISORY:</b> Torrential rain & flash flood warning active in Western Ghats. Dial <b className="font-mono text-white">112</b> for emergency evacuation.
              </span>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={onOpenCitizenReport}
                className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-red-600/30 cursor-pointer transition uppercase tracking-wider text-[11px]"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>REPORT SOS DISTRESS</span>
              </button>

              <button
                onClick={onOpenAuth}
                className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-sky-600/30 cursor-pointer transition uppercase tracking-wider text-[11px]"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>SIGN IN / ROLE HUD</span>
              </button>
            </div>

            {/* Safe Shelters Fast-Focus */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5 uppercase">
                <span>NEARBY EMERGENCY SHELTERS:</span>
                <span className="text-sky-400">LOCATE ON MAP &rarr;</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {infrastructure
                  .filter((inf) => inf.type === "SHELTER" || inf.type === "HOSPITAL")
                  .slice(0, 3)
                  .map((inf) => (
                    <button
                      key={inf.id}
                      onClick={() => setMapFocusTarget({ lat: inf.lat, lon: inf.lon, zoom: 15, title: inf.name })}
                      className="text-[10px] bg-[#070b14] hover:bg-slate-900 text-slate-200 border border-slate-800 hover:border-slate-700 px-2 py-1 rounded transition cursor-pointer flex items-center gap-1.5 font-mono"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${inf.type === "HOSPITAL" ? "bg-red-400" : "bg-emerald-400"}`} />
                      <span className="truncate max-w-[130px]">{inf.name.split(" ")[0]} {inf.name.split(" ")[1]}</span>
                    </button>
                  ))}
              </div>
            </div>

            {/* Emergency Hotline Numbers */}
            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
              <span className="uppercase">EMERGENCY HELPLINES:</span>
              <span className="text-sky-400 font-bold">112 (ERSS) • 1070 (NDMA) • 108 (EMS)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
