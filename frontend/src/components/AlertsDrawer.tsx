"use client";

import React, { useState } from "react";
import { useResQ } from "../context/ResQContext";
import { SystemAlertRecord } from "../types/resq";

interface AlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AlertsDrawer: React.FC<AlertsDrawerProps> = ({ isOpen, onClose }) => {
  const { alerts, markAlertRead, incidents, selectIncident, setMapFocusTarget } = useResQ();
  const [filterType, setFilterType] = useState<"ALL" | "UNREAD" | "PUBLIC">("ALL");

  if (!isOpen) return null;

  const filteredAlerts = alerts.filter((a) => {
    if (filterType === "UNREAD") return !a.isRead;
    if (filterType === "PUBLIC") return a.isPublic;
    return true;
  });

  const handleAlertClick = (alert: SystemAlertRecord) => {
    markAlertRead(alert.id);
    if (alert.relatedIncidentId) {
      const match = incidents.find((i) => i.id === alert.relatedIncidentId);
      if (match) {
        selectIncident(match);
        setMapFocusTarget({ lat: match.lat, lon: match.lon, zoom: 15, title: match.title });
        onClose();
      }
    }
  };

  const getSeverityBadge = (severity: SystemAlertRecord["severity"]) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-950 text-red-400 border border-red-700/60";
      case "WARNING":
        return "bg-amber-950 text-amber-400 border border-amber-700/60";
      default:
        return "bg-blue-950 text-blue-400 border border-blue-700/60";
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0B111E] border-l border-slate-800 text-slate-100 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 bg-[#070b14] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-xs tracking-wider text-slate-200 uppercase font-mono">
                ALERT NOTIFICATIONS
              </h2>
              <div className="text-[10px] text-slate-400 font-mono">EMERGENCY BROADCAST FEED</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2.5 bg-[#080d19] border-b border-slate-800 flex gap-2 text-xs">
          {(["ALL", "UNREAD", "PUBLIC"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`px-3 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition ${
                filterType === tab
                  ? "bg-sky-600/30 text-sky-300 border border-sky-500/50 shadow-xs"
                  : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200"
              }`}
            >
              {tab === "ALL" && `ALL (${alerts.length})`}
              {tab === "UNREAD" && `UNREAD (${alerts.filter((a) => !a.isRead).length})`}
              {tab === "PUBLIC" && `PUBLIC (${alerts.filter((a) => a.isPublic).length})`}
            </button>
          ))}
        </div>

        {/* Alert List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs font-mono">
              NO NOTIFICATIONS MATCHING ACTIVE FILTER
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => handleAlertClick(alert)}
                className={`p-3.5 rounded-lg border cursor-pointer transition relative ${
                  !alert.isRead
                    ? "bg-[#0c1424] border-sky-500/40 shadow-md ring-1 ring-sky-500/10"
                    : "bg-[#090e1a]/60 border-slate-800/80 opacity-80 hover:bg-[#0c1424]"
                }`}
              >
                {!alert.isRead && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-sky-400 animate-pulse shadow-[0_0_6px_#38bdf8]" />
                )}

                <div className="flex items-center gap-2 mb-1.5 pr-4">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${getSeverityBadge(alert.severity)}`}>
                    {alert.severity}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {alert.timestamp}
                  </span>
                  {alert.isPublic && (
                    <span className="text-[9px] bg-emerald-950/80 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded font-mono">
                      PUBLIC
                    </span>
                  )}
                </div>

                <h4 className="text-xs font-bold text-slate-100 mb-1">
                  {alert.title}
                </h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {alert.description}
                </p>

                {alert.relatedIncidentId && (
                  <div className="mt-2 text-[10px] text-sky-400 hover:text-sky-300 font-mono flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>VIEW INCIDENT ({alert.relatedIncidentId}) &rarr;</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#070b14] border-t border-slate-800 text-right">
          <button
            onClick={() => {
              alerts.forEach((a) => markAlertRead(a.id));
            }}
            className="text-xs text-slate-400 hover:text-slate-200 font-mono transition"
          >
            MARK ALL AS READ
          </button>
        </div>
      </div>
    </div>
  );
};
