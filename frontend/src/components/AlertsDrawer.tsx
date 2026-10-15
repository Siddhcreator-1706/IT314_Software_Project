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
        return "bg-critical-soft text-critical border border-critical/30";
      case "WARNING":
        return "bg-high-soft text-high border border-high/30";
      default:
        return "bg-info-soft text-info border border-info/30";
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex justify-end bg-black/60 backdrop-blur-xs animate-fadeIn font-sans">
      <div className="w-full max-w-md bg-[#0b1324] border-l border-border text-foreground h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 bg-[#093452] border-b border-[#062338] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🔔</span>
            <div>
              <h2 className="font-bold text-sm text-white tracking-wide">
                Emergency Alerts &amp; Notifications
              </h2>
              <p className="text-[10.5px] text-sky-200/80">Real-time Public Warning Feed</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer text-base font-bold"
            aria-label="Close alerts"
          >
            ✕
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 py-2.5 bg-surface-muted/40 border-b border-border flex gap-2 text-xs">
          {(["ALL", "UNREAD", "PUBLIC"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterType === tab
                  ? "bg-sky-600 text-white shadow-xs"
                  : "bg-surface text-muted hover:text-foreground border border-border"
              }`}
            >
              {tab === "ALL" && `All (${alerts.length})`}
              {tab === "UNREAD" && `Unread (${alerts.filter((a) => !a.isRead).length})`}
              {tab === "PUBLIC" && `Public Broadcasts (${alerts.filter((a) => a.isPublic).length})`}
            </button>
          ))}
        </div>

        {/* Alert List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-16 text-muted text-xs bg-surface-muted/30 border border-dashed border-border rounded-xl">
              No notifications matching current filter.
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => handleAlertClick(alert)}
                className={`p-3.5 rounded-xl border cursor-pointer transition relative ${
                  !alert.isRead
                    ? "bg-surface border-sky-500/60 shadow-md ring-1 ring-sky-500/20"
                    : "bg-surface-muted/40 border-border opacity-85 hover:bg-surface-muted hover:opacity-100"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[9.5px] px-2 py-0.5 rounded-full font-bold ${getSeverityBadge(alert.severity)}`}>
                    {alert.severity}
                  </span>
                  <span className="text-[10px] text-muted font-mono">{alert.timestamp}</span>
                </div>
                <h4 className="text-xs font-bold text-white mb-1">{alert.title}</h4>
                <p className="text-xs text-muted leading-relaxed">{alert.description}</p>
                <div className="flex items-center justify-between text-[10px] text-muted pt-2 border-t border-border/60 mt-2">
                  <span>Scope: {alert.isPublic ? "Public Emergency Alert" : "Responder Tactical Network"}</span>
                  {alert.relatedIncidentId && (
                    <span className="text-sky-400 font-semibold hover:underline">View Incident →</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
