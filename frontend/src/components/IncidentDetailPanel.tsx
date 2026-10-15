"use client";

import React, { useState } from "react";
import { useResQ } from "../context/ResQContext";
import { IncidentRecord, IncidentSeverity } from "../types/resq";

interface Props {
  incident: IncidentRecord | null;
  onClose: () => void;
  onOpenDispatch: (incidentId: string) => void;
}

export default function IncidentDetailPanel({ incident, onClose, onOpenDispatch }: Props) {
  const {
    updateIncidentStatus,
    acceptAITriage,
    overrideAITriage,
    responders,
    messages,
    sendMessage,
    setMapFocusTarget,
  } = useResQ();

  const [activeTab, setActiveTab] = useState<"overview" | "triage" | "timeline" | "comms">("overview");
  const [chatInput, setChatInput] = useState("");
  const [isPriorityMsg, setIsPriorityMsg] = useState(false);

  // Override severity state
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideSeverity, setOverrideSeverity] = useState<IncidentSeverity>("CRITICAL");
  const [overrideReason, setOverrideReason] = useState("");

  if (!incident) return null;

  const incidentMessages = messages.filter((m) => m.incidentId === incident.id);
  const assignedUnits = responders.filter((r) => incident.assignedUnitIds.includes(r.id));

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendMessage(incident.id, chatInput.trim(), isPriorityMsg);
    setChatInput("");
    setIsPriorityMsg(false);
  };

  const handleOverrideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      alert("Please provide an operational reason for overriding AI triage severity.");
      return;
    }
    overrideAITriage(incident.id, overrideSeverity, 1, overrideReason);
    setShowOverrideModal(false);
    setOverrideReason("");
  };

  const severityBadges: Record<IncidentSeverity, string> = {
    CRITICAL: "bg-critical-soft text-critical border border-critical/30",
    HIGH: "bg-high-soft text-high border border-high/30",
    MODERATE: "bg-medium-soft text-medium border border-medium/30",
    LOW: "bg-low-soft text-low border border-low/30",
  };

  return (
    <div className="fixed top-16 right-4 z-[1100] w-96 max-w-[calc(100vw-2rem)] bg-[#0b1324]/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[calc(100vh-80px)] overflow-hidden animate-fadeIn text-foreground font-sans">
      {/* Header */}
      <div className="bg-[#093452] border-b border-[#062338] text-white p-4 flex items-start justify-between">
        <div className="flex-1 pr-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold bg-sky-950 px-2 py-0.5 rounded border border-sky-600/50 text-sky-300">
              {incident.id}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${severityBadges[incident.severity] || "bg-neutral-soft text-muted border border-border"}`}>
              {incident.severity}
            </span>
          </div>
          <h3 className="font-bold text-sm text-white line-clamp-1">{incident.title}</h3>
          <p className="text-[11px] text-sky-200/80 flex items-center gap-1 mt-0.5">
            <span>📍</span> {incident.locationName}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white text-base font-bold p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
          aria-label="Close detail panel"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-[#0b1324] text-xs font-medium">
        {[
          { key: "overview", label: "Overview", icon: "📋" },
          { key: "triage", label: "AI Triage", icon: "✦" },
          { key: "timeline", label: "Timeline", icon: "⏱️" },
          { key: "comms", label: `Comms (${incidentMessages.length})`, icon: "💬" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 py-2.5 text-center transition border-b-2 cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === tab.key
                ? "border-sky-400 text-sky-300 font-semibold bg-surface-muted/40"
                : "border-transparent text-muted hover:text-foreground hover:bg-surface-muted/20"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <>
            <div>
              <span className="font-semibold text-muted uppercase text-[10px] tracking-wider block mb-1">
                Incident Description
              </span>
              <p className="text-foreground leading-relaxed bg-surface-muted/50 p-3 rounded-xl border border-border">
                {incident.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-surface-muted/40 p-2.5 rounded-xl border border-border">
                <span className="text-[10px] text-muted block uppercase tracking-wider font-semibold">Status</span>
                <span className="font-semibold text-sky-300 text-xs mt-0.5 block">{incident.lifecycleStatus}</span>
              </div>
              <div className="bg-surface-muted/40 p-2.5 rounded-xl border border-border">
                <span className="text-[10px] text-muted block uppercase tracking-wider font-semibold">Casualties / Trapped</span>
                <span className="font-semibold text-white text-xs mt-0.5 block">{incident.affectedPeopleEstimate} people</span>
              </div>
            </div>

            {/* Assigned Units */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-muted uppercase text-[10px] tracking-wider">
                  Assigned Tactical Units ({assignedUnits.length})
                </span>
                <button
                  onClick={() => onOpenDispatch(incident.id)}
                  className="text-sky-400 hover:text-sky-300 font-semibold text-[11px] cursor-pointer"
                >
                  + Dispatch Unit
                </button>
              </div>

              {assignedUnits.length === 0 ? (
                <div className="bg-surface-muted/30 border border-dashed border-border rounded-xl p-3 text-center text-muted text-[11px]">
                  No response units dispatched yet.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {assignedUnits.map((unit) => (
                    <div
                      key={unit.id}
                      className="bg-surface-muted/50 border border-border rounded-xl p-2.5 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-white text-xs flex items-center gap-1.5">
                          <span>{unit.callsign}</span>
                          <span className="text-[10px] text-sky-300 font-normal">({unit.personnelName})</span>
                        </div>
                        <div className="text-[10px] text-muted">{unit.agency} · {unit.vehicleType}</div>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                        {unit.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Urgent Needs Tags */}
            <div>
              <span className="font-semibold text-muted uppercase text-[10px] tracking-wider block mb-1.5">
                Urgent Field Requirements
              </span>
              <div className="flex flex-wrap gap-1.5">
                {incident.urgentNeeds.map((need) => (
                  <span
                    key={need}
                    className="bg-surface-muted border border-border text-foreground px-2.5 py-1 rounded-lg text-[11px] font-medium"
                  >
                    • {need}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* AI TRIAGE TAB */}
        {activeTab === "triage" && (
          <div className="space-y-3.5">
            <div className="bg-ai-soft border border-ai/30 rounded-xl p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-ai font-bold flex items-center gap-1.5 text-xs">
                  <span>✦</span> Algorithmic Triage Assessment
                </span>
                <span className="text-[10px] bg-ai/20 text-ai px-2 py-0.5 rounded font-mono font-semibold">
                  CONFIDENCE: {Math.round(incident.aiRecommendation?.confidenceScore || 88)}%
                </span>
              </div>
              <p className="text-foreground text-xs leading-relaxed">
                {incident.aiRecommendation?.explanation ||
                  incident.aiRecommendation?.evidenceSummary ||
                  "Real-time sensor assessment and casualty clustering complete. Immediate resource staging advised."}
              </p>
            </div>

            <div className="bg-surface-muted/40 border border-border rounded-xl p-3 space-y-2">
              <span className="text-[10px] text-muted uppercase font-semibold tracking-wider block">
                Required Operational Capabilities
              </span>
              <ul className="space-y-1.5 text-[11px] text-foreground">
                {(incident.aiRecommendation?.suggestedCapabilities || [
                  "Water rescue boat team",
                  "Medical evacuation unit",
                  "Drone reconnaissance",
                ]).map((action: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-sky-400 font-bold">•</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => acceptAITriage(incident.id)}
                className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2 rounded-xl text-xs transition shadow-sm cursor-pointer"
              >
                Accept Triage
              </button>
              <button
                onClick={() => setShowOverrideModal(true)}
                className="bg-surface-muted hover:bg-surface-elevated text-muted hover:text-white border border-border px-3 py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Override
              </button>
            </div>
          </div>
        )}

        {/* TIMELINE TAB */}
        {activeTab === "timeline" && (
          <div className="space-y-3">
            <div className="relative pl-4 border-l border-border space-y-4">
              <div className="relative">
                <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-sky-400 ring-4 ring-[#0b1324]" />
                <span className="text-[10px] text-muted font-mono">{incident.detectedAt}</span>
                <p className="font-semibold text-white text-xs mt-0.5">Emergency Incident Detected & Logged</p>
                <p className="text-[11px] text-muted mt-0.5">Report logged via multi-channel ERSS triage engine.</p>
              </div>

              {incident.timeline && incident.timeline.length > 0 ? (
                incident.timeline.map((event) => (
                  <div key={event.id} className="relative">
                    <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-emerald-400 ring-4 ring-[#0b1324]" />
                    <span className="text-[10px] text-muted font-mono">{event.timestamp}</span>
                    <p className="font-semibold text-white text-xs mt-0.5">{event.action}</p>
                    <p className="text-[11px] text-muted mt-0.5">{event.actorName} ({event.actorRole}) {event.details ? `· ${event.details}` : ""}</p>
                  </div>
                ))
              ) : (
                <div className="relative">
                  <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-amber-400 ring-4 ring-[#0b1324]" />
                  <span className="text-[10px] text-muted font-mono">{incident.updatedAt}</span>
                  <p className="font-semibold text-white text-xs mt-0.5">Operational Status: {incident.lifecycleStatus}</p>
                  <p className="text-[11px] text-muted mt-0.5">Active resources and responders synchronizing telemetry.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* COMMS TAB */}
        {activeTab === "comms" && (
          <div className="flex flex-col h-64 space-y-2">
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {incidentMessages.length === 0 ? (
                <div className="h-full grid place-items-center text-center text-muted text-[11px]">
                  No tactical radio transmissions recorded.
                </div>
              ) : (
                incidentMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-2.5 rounded-xl border text-[11px] ${
                      msg.isPriority
                        ? "bg-red-950/60 border-red-700/60 text-red-100"
                        : "bg-surface-muted/50 border-border text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold mb-0.5">
                      <span className="text-sky-300 font-mono text-[10px]">{msg.senderName}</span>
                      <span className="text-[9px] text-muted font-mono">{msg.timestamp.slice(11, 16)}</span>
                    </div>
                    <p className="leading-relaxed">{msg.messageText}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendChat} className="space-y-1.5 pt-2 border-t border-border">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Transmit tactical SITREP message..."
                  className="flex-1 bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:border-info"
                />
                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition shadow-xs"
                >
                  Send
                </button>
              </div>
              <label className="flex items-center gap-1.5 text-[10.5px] text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPriorityMsg}
                  onChange={(e) => setIsPriorityMsg(e.target.checked)}
                  className="accent-red-500 rounded"
                />
                <span>Broadcast as Priority Alert</span>
              </label>
            </form>
          </div>
        )}
      </div>

      {/* Footer Dispatch Actions */}
      <div className="p-3 bg-[#0b1324] border-t border-border flex items-center justify-between gap-2">
        <button
          onClick={() => setMapFocusTarget({ lat: incident.lat, lon: incident.lon, zoom: 16, title: incident.title })}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:text-white hover:bg-surface-muted transition cursor-pointer"
        >
          📍 Focus Map
        </button>
        <button
          onClick={() => onOpenDispatch(incident.id)}
          className="flex-1 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition shadow-sm cursor-pointer text-center"
        >
          Deploy Dispatch Order
        </button>
      </div>

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="absolute inset-0 z-50 bg-[#070d18]/95 backdrop-blur-md p-5 flex flex-col justify-between animate-fadeIn">
          <div>
            <h4 className="font-bold text-white text-sm mb-1">Override AI Triage Severity</h4>
            <p className="text-[11px] text-muted mb-3">Provide command rationale for audit records.</p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
                  New Operational Severity
                </label>
                <select
                  value={overrideSeverity}
                  onChange={(e) => setOverrideSeverity(e.target.value as IncidentSeverity)}
                  className="w-full bg-[#0b1324] border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-info"
                >
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MODERATE">MODERATE</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Commander Rationale
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Field scouts report flash flood level receding in sector 4..."
                  rows={3}
                  className="w-full bg-[#0b1324] border border-border rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-info placeholder:text-muted/60"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t border-border">
            <button
              onClick={() => setShowOverrideModal(false)}
              className="flex-1 rounded-lg border border-border bg-surface py-2 text-xs font-semibold text-muted hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleOverrideSubmit}
              className="flex-1 rounded-lg bg-sky-600 hover:bg-sky-500 py-2 text-xs font-semibold text-white shadow-sm"
            >
              Confirm Override
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
