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

  const severityBadges = {
    CRITICAL: "bg-red-950/80 text-red-400 border border-red-800/80",
    HIGH: "bg-orange-950/80 text-orange-400 border border-orange-800/80",
    MODERATE: "bg-amber-950/80 text-amber-400 border border-amber-800/80",
    LOW: "bg-emerald-950/80 text-emerald-400 border border-emerald-800/80",
  };

  const lifecycleColors: { [key: string]: string } = {
    "NEW REPORT": "bg-slate-800 text-slate-300 border border-slate-700",
    "UNDER REVIEW": "bg-purple-950/60 text-purple-300 border border-purple-800/60",
    "VERIFIED": "bg-sky-950/60 text-sky-300 border border-sky-800/60",
    "DISPATCHED": "bg-amber-950/60 text-amber-300 border border-amber-800/60",
    "RESPONSE IN PROGRESS": "bg-red-950/60 text-red-300 border border-red-800/60",
    "RESOLVED": "bg-emerald-950/60 text-emerald-300 border border-emerald-800/60",
    "CLOSED": "bg-slate-900 text-slate-400 border border-slate-800",
    "REJECTED": "bg-rose-950 text-rose-400 border border-rose-800",
  };

  return (
    <div className="fixed top-14 right-3 z-[1100] w-96 max-w-[calc(100vw-24px)] bg-[#0B111E]/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-800 flex flex-col max-h-[calc(100vh-70px)] overflow-hidden animate-in fade-in duration-200 text-slate-100">
      {/* Header */}
      <div className="bg-[#070b14] text-white p-3.5 border-b border-slate-800 flex items-start justify-between">
        <div className="flex-1 pr-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] font-bold bg-sky-950/80 text-sky-400 px-1.5 py-0.5 rounded border border-sky-800/80">
              {incident.id}
            </span>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono ${severityBadges[incident.severity]}`}>
              {incident.severity}
            </span>
          </div>
          <h3 className="font-bold text-xs leading-tight text-slate-100 font-mono line-clamp-1">{incident.title}</h3>
          <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-1 font-mono">
            <svg className="w-3 h-3 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">{incident.locationName}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition cursor-pointer"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-[#080d19] text-[10px] font-mono uppercase tracking-wider">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex-1 py-2 text-center transition cursor-pointer ${
            activeTab === "overview" ? "border-b-2 border-sky-500 text-sky-400 bg-sky-950/20 font-bold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          OVERVIEW
        </button>
        <button
          onClick={() => setActiveTab("triage")}
          className={`flex-1 py-2 text-center transition cursor-pointer relative ${
            activeTab === "triage" ? "border-b-2 border-sky-500 text-sky-400 bg-sky-950/20 font-bold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          AI TRIAGE
          {incident.aiRecommendation?.status === "PENDING_REVIEW" && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block ml-1 animate-ping" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("timeline")}
          className={`flex-1 py-2 text-center transition cursor-pointer ${
            activeTab === "timeline" ? "border-b-2 border-sky-500 text-sky-400 bg-sky-950/20 font-bold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          TIMELINE
        </button>
        <button
          onClick={() => setActiveTab("comms")}
          className={`flex-1 py-2 text-center transition cursor-pointer relative ${
            activeTab === "comms" ? "border-b-2 border-sky-500 text-sky-400 bg-sky-950/20 font-bold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          CHAT ({incidentMessages.length})
        </button>
      </div>

      {/* Content */}
      <div className="p-3.5 overflow-y-auto space-y-3.5 text-xs text-slate-300 flex-1">
        {activeTab === "overview" && (
          <div className="space-y-3">
            {/* Status & Focus Button */}
            <div className="flex items-center justify-between bg-[#070b14] p-2.5 rounded-lg border border-slate-800">
              <div>
                <span className="text-[9px] text-slate-400 block font-mono font-bold uppercase">LIFECYCLE STATE</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold inline-block mt-0.5 ${lifecycleColors[incident.lifecycleStatus] || "bg-slate-800"}`}>
                  {incident.lifecycleStatus}
                </span>
              </div>
              <button
                onClick={() => setMapFocusTarget({ lat: incident.lat, lon: incident.lon, zoom: 15, title: incident.title })}
                className="bg-sky-600/30 border border-sky-500/50 hover:bg-sky-600/50 text-sky-300 px-2.5 py-1 rounded text-[10px] font-mono font-semibold flex items-center gap-1.5 cursor-pointer transition"
              >
                <svg className="w-3 h-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                </svg>
                <span>ZOOM ON MAP</span>
              </button>
            </div>

            {/* Description */}
            <div>
              <span className="font-mono text-[10px] text-slate-400 uppercase font-semibold block mb-1">DESCRIPTION</span>
              <p className="text-slate-300 text-xs leading-relaxed bg-[#070b14] p-2.5 rounded-lg border border-slate-800">
                {incident.description}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="bg-[#070b14] p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[10px] block uppercase">EST. AFFECTED</span>
                <b className="text-xs text-white">~{incident.affectedPeopleEstimate} CITIZENS</b>
              </div>
              <div className="bg-[#070b14] p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[10px] block uppercase">INTAKE SOURCE</span>
                <b className="text-xs text-sky-400 truncate block">{incident.reporterSource.replace(/_/g, " ")}</b>
              </div>
            </div>

            {/* Urgent Needs */}
            {incident.urgentNeeds.length > 0 && (
              <div>
                <span className="font-mono text-[10px] text-slate-400 uppercase font-semibold block mb-1">REQUIRED CAPABILITIES</span>
                <div className="flex flex-wrap gap-1">
                  {incident.urgentNeeds.map((need) => (
                    <span key={need} className="bg-red-950/60 text-red-300 border border-red-800/80 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                      {need}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Assigned Units */}
            <div className="border-t border-slate-800 pt-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[10px] text-slate-400 uppercase font-semibold">
                  ASSIGNED UNITS ({assignedUnits.length})
                </span>
                <button
                  onClick={() => onOpenDispatch(incident.id)}
                  className="text-sky-400 hover:text-sky-300 font-mono font-bold text-[10px] cursor-pointer"
                >
                  + DISPATCH UNIT
                </button>
              </div>

              {assignedUnits.length === 0 ? (
                <div className="p-3 bg-[#070b14] border border-amber-900/50 rounded-lg text-amber-300 text-[11px] font-mono text-center">
                  NO UNITS CURRENTLY DISPATCHED
                </div>
              ) : (
                <div className="space-y-1.5">
                  {assignedUnits.map((unit) => (
                    <div key={unit.id} className="p-2 rounded-lg bg-[#070b14] border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-200 font-mono text-xs flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                          {unit.callsign} — {unit.personnelName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{unit.vehicleType} • {unit.agency}</div>
                      </div>
                      <span className="bg-sky-950/80 text-sky-400 border border-sky-800/80 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold">
                        {unit.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lifecycle Status Change Actions */}
            <div className="border-t border-slate-800 pt-2.5 font-mono">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">UPDATE MISSION LIFECYCLE</span>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                {incident.lifecycleStatus !== "DISPATCHED" && (
                  <button
                    onClick={() => updateIncidentStatus(incident.id, "DISPATCHED")}
                    className="p-1.5 rounded bg-amber-950/50 hover:bg-amber-900/60 border border-amber-700/60 text-amber-300 font-semibold cursor-pointer text-center transition"
                  >
                    MARK DISPATCHED
                  </button>
                )}
                {incident.lifecycleStatus !== "RESPONSE IN PROGRESS" && (
                  <button
                    onClick={() => updateIncidentStatus(incident.id, "RESPONSE IN PROGRESS")}
                    className="p-1.5 rounded bg-sky-950/50 hover:bg-sky-900/60 border border-sky-700/60 text-sky-300 font-semibold cursor-pointer text-center transition"
                  >
                    IN PROGRESS
                  </button>
                )}
                {incident.lifecycleStatus !== "RESOLVED" && (
                  <button
                    onClick={() => updateIncidentStatus(incident.id, "RESOLVED", "All victims secured")}
                    className="p-1.5 rounded bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-700/60 text-emerald-300 font-semibold cursor-pointer text-center transition"
                  >
                    RESOLVE MISSION
                  </button>
                )}
                {incident.lifecycleStatus !== "CLOSED" && (
                  <button
                    onClick={() => updateIncidentStatus(incident.id, "CLOSED", "Mission closed")}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold cursor-pointer text-center transition"
                  >
                    CLOSE RECORD
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AI Triage Tab */}
        {activeTab === "triage" && incident.aiRecommendation && (
          <div className="space-y-3 font-mono">
            <div className="bg-[#070b14] border border-sky-800/60 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-300 flex items-center gap-1.5 text-xs">
                  <svg className="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>AI TRIAGE SYNTHESIS</span>
                </span>
                <span className="font-bold text-[10px] bg-sky-950 text-sky-300 border border-sky-700 px-2 py-0.5 rounded">
                  {incident.aiRecommendation.confidenceScore}% CONFIDENCE
                </span>
              </div>

              <div className="text-[11px] text-slate-300 space-y-1">
                <div>PROPOSED SEVERITY: <span className="font-bold text-red-400">{incident.aiRecommendation.proposedSeverity}</span></div>
                <div>RECOMMENDED PRIORITY: <span className="text-white">LEVEL {incident.aiRecommendation.recommendedPriority}</span></div>
                <div className="text-[10px] text-slate-400 leading-relaxed font-sans">{incident.aiRecommendation.evidenceSummary}</div>
              </div>
            </div>

            {/* Identified Risks */}
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">IDENTIFIED GROUND RISKS</span>
              <ul className="space-y-1 text-slate-300 text-xs font-sans">
                {incident.aiRecommendation.risksIdentified.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-amber-400 mt-1">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Missing Information Warnings */}
            {incident.aiRecommendation.missingInformationWarnings.length > 0 && (
              <div className="bg-amber-950/30 border border-amber-900/50 rounded-lg p-2.5 text-amber-300">
                <span className="font-bold block mb-1 text-[11px]">INFORMATION GAPS:</span>
                <ul className="space-y-0.5 text-[10.5px] font-sans">
                  {incident.aiRecommendation.missingInformationWarnings.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI Review State */}
            <div className="p-2.5 rounded bg-[#070b14] border border-slate-800 flex items-center justify-between text-[10px]">
              <div>
                <span className="text-slate-400 block uppercase">TRIAGE STATUS:</span>
                <b className="text-sky-300">{incident.aiRecommendation.status}</b>
              </div>
              {incident.aiRecommendation.reviewedBy && (
                <div className="text-right text-slate-400">
                  REVIEWED BY: <b className="text-slate-200">{incident.aiRecommendation.reviewedBy}</b>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col gap-1.5">
              {incident.aiRecommendation.status === "PENDING_REVIEW" && (
                <button
                  onClick={() => acceptAITriage(incident.id)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-sm cursor-pointer transition flex items-center justify-center gap-1.5 text-xs"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>ACCEPT AI RECOMMENDATION ({incident.aiRecommendation.proposedSeverity})</span>
                </button>
              )}
              <button
                onClick={() => setShowOverrideModal(true)}
                className="w-full py-1.5 bg-[#070b14] hover:bg-slate-900 text-slate-300 rounded-lg font-semibold border border-slate-700 cursor-pointer transition text-xs flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>OVERRIDE SEVERITY / PRIORITY</span>
              </button>
            </div>
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === "timeline" && (
          <div className="space-y-3 font-mono">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">AUDIT & ACTION TIMELINE</span>
            <div className="relative border-l border-sky-600/40 ml-2 space-y-3 pl-3">
              {incident.timeline.map((evt) => (
                <div key={evt.id} className="relative">
                  <div className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_6px_#38bdf8]" />
                  <div className="text-[9px] text-slate-500">
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • {evt.actorName} ({evt.actorRole})
                  </div>
                  <div className="font-semibold text-slate-200 text-[11px]">{evt.action}</div>
                  {evt.details && <div className="text-slate-400 text-[10px] font-sans">{evt.details}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tactical Chat Tab */}
        {activeTab === "comms" && (
          <div className="flex flex-col h-full space-y-2 font-mono">
            <div className="bg-[#070b14] p-2 rounded text-[10px] text-sky-400 border border-slate-800 flex justify-between items-center">
              <span><b>CHANNEL:</b> {incident.id} SECURE NET</span>
              <span className="text-[9px] bg-sky-950 text-sky-300 border border-sky-800 px-1.5 py-0.5 rounded font-bold">ENCRYPTED</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {incidentMessages.length === 0 ? (
                <div className="text-center py-6 text-slate-500 italic text-xs">No field transmissions recorded on this channel yet.</div>
              ) : (
                incidentMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-2 rounded-lg text-[11px] border ${
                      msg.isPriority
                        ? "bg-red-950/40 border-red-800/60 text-red-300"
                        : "bg-[#070b14] border-slate-800 text-slate-300"
                    }`}
                  >
                    <div className="flex justify-between text-[9px] mb-1">
                      <b className="text-slate-200">{msg.senderName} ({msg.senderRole})</b>
                      <span className="text-slate-500">{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="font-sans text-xs">{msg.messageText}</div>
                    {msg.locationRef && (
                      <button
                        onClick={() => setMapFocusTarget({ lat: msg.locationRef!.lat, lon: msg.locationRef!.lon, zoom: 15, title: msg.locationRef!.label })}
                        className="text-sky-400 underline text-[10px] mt-1 block cursor-pointer font-mono"
                      >
                        PINNED LOCATION: {msg.locationRef.label}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendChat} className="pt-2 border-t border-slate-800 space-y-1.5">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type operational tactical update..."
                  className="flex-1 border border-slate-700 rounded p-1.5 text-xs text-slate-100 bg-[#070b14] placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded font-mono font-bold text-xs cursor-pointer transition"
                >
                  SEND
                </button>
              </div>
              <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer font-mono">
                <input
                  type="checkbox"
                  checked={isPriorityMsg}
                  onChange={(e) => setIsPriorityMsg(e.target.checked)}
                  className="rounded text-red-500 bg-slate-900 border-slate-700"
                />
                <span>BROADCAST AS FLASH MESSAGE</span>
              </label>
            </form>
          </div>
        )}
      </div>

      {/* Override Severity Dialog */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-[2500] bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#0B111E] rounded-xl max-w-sm w-full p-4 shadow-2xl border border-slate-800 text-slate-100 space-y-3 font-mono">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200">OVERRIDE AI TRIAGE SEVERITY</h4>
            <div>
              <label className="block text-[10px] uppercase text-slate-400 mb-1">SELECT NEW SEVERITY:</label>
              <select
                value={overrideSeverity}
                onChange={(e) => setOverrideSeverity(e.target.value as IncidentSeverity)}
                className="w-full border border-slate-700 bg-[#070b14] rounded p-1.5 text-xs font-semibold text-slate-100"
              >
                <option value="CRITICAL">CRITICAL (Immediate Life Threat)</option>
                <option value="HIGH">HIGH (Severe Hazard)</option>
                <option value="MODERATE">MODERATE (Controlled Localized)</option>
                <option value="LOW">LOW (Advisory / Minor)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-slate-400 mb-1">OPERATIONAL JUSTIFICATION:</label>
              <textarea
                rows={2}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Ground reconnaissance confirms flood barrier intact..."
                required
                className="w-full border border-slate-700 bg-[#070b14] rounded p-1.5 text-xs text-slate-100 placeholder-slate-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleOverrideSubmit}
                className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
              >
                CONFIRM OVERRIDE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
