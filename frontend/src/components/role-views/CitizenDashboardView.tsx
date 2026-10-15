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
    setMapFocusTarget,
  } = useResQ();

  const [activeTab, setActiveTab] = useState<"reports" | "shelters" | "guide">("reports");
  const [isMinimized, setIsMinimized] = useState(false);

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
    <div className="fixed bottom-4 left-4 z-[900] max-w-md w-full animate-fadeIn font-sans">
      <div className="bg-[#0b1324]/98 backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden text-foreground">
        {/* Top Header */}
        <div className="px-4 py-3 bg-[#093452] border-b border-[#062338] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">👤</span>
            <div>
              <div className="text-xs font-bold tracking-wide text-white flex items-center gap-1.5">
                <span>Citizen Emergency Console</span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-600/50 px-1.5 py-0.2 rounded font-medium">
                  Active
                </span>
              </div>
              <div className="text-[10px] text-sky-200/80">
                Logged in as: <span className="font-semibold text-white">{currentUser.name}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenCitizenReport}
              className="bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-xs cursor-pointer transition flex items-center gap-1"
              title="Report Emergency SOS"
            >
              <span>🚨</span> SOS
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
            {/* View Navigation Tabs */}
            <div className="flex bg-surface-muted/60 p-1 rounded-xl border border-border text-xs">
              <button
                onClick={() => setActiveTab("reports")}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === "reports"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <span>📋</span> My SOS ({myReports.length})
              </button>
              <button
                onClick={() => setActiveTab("shelters")}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === "shelters"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <span>🏥</span> Relief Shelters
              </button>
              <button
                onClick={() => setActiveTab("guide")}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === "guide"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <span>🛡️</span> Safety Guide
              </button>
            </div>

            {/* Tab Contents */}
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {activeTab === "reports" && (
                <>
                  {myReports.length === 0 ? (
                    <div className="text-center py-6 text-muted text-xs bg-surface-muted/30 border border-dashed border-border rounded-xl">
                      No reports filed yet. Use the red SOS button to request immediate help.
                    </div>
                  ) : (
                    myReports.map((rep) => (
                      <div
                        key={rep.id}
                        className="bg-surface-muted/60 border border-border rounded-xl p-2.5 space-y-1 hover:border-slate-700 transition"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold text-sky-400">{rep.id}</span>
                          <span className="text-[9.5px] bg-sky-950 text-sky-300 border border-sky-800 px-1.5 py-0.2 rounded font-semibold">
                            {rep.verificationStatus}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-white">{rep.category}</p>
                        <p className="text-[10px] text-muted line-clamp-1">📍 {rep.locationName}</p>
                        <div className="flex justify-between items-center text-[10px] text-muted pt-1 border-t border-border/60">
                          <span>People in danger: {rep.affectedPeopleCount}</span>
                          <button
                            onClick={() => setMapFocusTarget({ lat: rep.lat, lon: rep.lon, zoom: 16, title: rep.locationName })}
                            className="text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
                          >
                            Focus Map →
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeTab === "shelters" && (
                <div className="space-y-1.5">
                  {activeShelters.map((inf) => (
                    <div
                      key={inf.id}
                      className="bg-surface-muted/60 border border-border rounded-xl p-2.5 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-semibold text-white truncate flex items-center gap-1.5">
                          <span>{inf.type === "HOSPITAL" ? "🏥" : "⛺"}</span>
                          <span className="truncate">{inf.name}</span>
                        </div>
                        <p className="text-[10.5px] text-muted truncate mt-0.5">{inf.address || "Designated Emergency Facility"}</p>
                      </div>
                      <button
                        onClick={() => setMapFocusTarget({ lat: inf.lat, lon: inf.lon, zoom: 16, title: inf.name })}
                        className="bg-surface hover:bg-surface-elevated text-sky-400 hover:text-sky-300 border border-border px-2 py-1 rounded text-[10.5px] font-semibold cursor-pointer shrink-0"
                      >
                        Navigate
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "guide" && (
                <div className="space-y-2 text-xs text-muted leading-relaxed">
                  <div className="bg-surface-muted/60 border border-border rounded-xl p-3">
                    <p className="font-bold text-white mb-1">🌊 Flooding Precautions</p>
                    <p>Avoid walking or driving through moving water. Disconnect electrical breakers before evacuating.</p>
                  </div>
                  <div className="bg-surface-muted/60 border border-border rounded-xl p-3">
                    <p className="font-bold text-white mb-1">📞 Emergency Numbers</p>
                    <p>Police/Fire/Ambulance: <strong className="text-white">112</strong> · Disaster Cell: <strong className="text-white">1070</strong></p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
