"use client";

import React, { useState } from "react";
import { useResQ } from "../context/ResQContext";
import { IncidentRecord, ResponderUnitRecord } from "../types/resq";

interface DispatchModalProps {
  incident: IncidentRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DispatchModal: React.FC<DispatchModalProps> = ({
  incident,
  isOpen,
  onClose,
}) => {
  const { responders, dispatchUnit } = useResQ();
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [customEta, setCustomEta] = useState<number>(12);
  const [notes, setNotes] = useState<string>("");
  const [overrideBusy, setOverrideBusy] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen || !incident) return null;

  // Capability matching logic
  const getSuitabilityScore = (unit: ResponderUnitRecord): { score: number; reason: string } => {
    let score = 0;
    const reasons: string[] = [];

    if (incident.category === "Major Urban / Building Fire") {
      if (unit.callsign.includes("FIRE") || unit.capabilities.some(c => c.toLowerCase().includes("fire") || c.toLowerCase().includes("smoke") || c.toLowerCase().includes("thermal"))) {
        score += 60;
        reasons.push("Fire suppression capability");
      }
    } else if (incident.category === "Flood / Urban Flood" || incident.category === "Cyclone / Coastal Flooding") {
      if (unit.callsign.includes("RESCUE") || unit.agency.includes("NDRF") || unit.capabilities.some(c => c.toLowerCase().includes("boat") || c.toLowerCase().includes("flood") || c.toLowerCase().includes("cyclone") || c.toLowerCase().includes("diver"))) {
        score += 60;
        reasons.push("Water rescue capability");
      }
    }

    if (incident.urgentNeeds.some(n => n.toLowerCase().includes("medic") || n.toLowerCase().includes("casualt") || n.toLowerCase().includes("injur"))) {
      if (unit.callsign.includes("AMB") || unit.role === "Medic / Ambulance Team") {
        score += 40;
        reasons.push("Medical evacuation match");
      }
    }

    if (unit.capabilities.some(c => c.toLowerCase().includes("drone") || c.toLowerCase().includes("recon"))) {
      score += 20;
      reasons.push("Aerial reconnaissance");
    }

    if (unit.status === "AVAILABLE") {
      score += 30;
      reasons.push("Currently AVAILABLE");
    } else {
      score -= 20;
      reasons.push(`Status: ${unit.status}`);
    }

    return { score, reason: reasons.join(" • ") };
  };

  const sortedResponders = [...responders].sort((a, b) => {
    return getSuitabilityScore(b).score - getSuitabilityScore(a).score;
  });

  const selectedUnit = responders.find((u) => u.id === selectedUnitId);

  const handleConfirmDispatch = () => {
    if (!selectedUnit) {
      setFeedbackMsg({ type: "error", text: "Please select an emergency response unit to dispatch." });
      return;
    }

    if (selectedUnit.status !== "AVAILABLE" && !overrideBusy) {
      setFeedbackMsg({
        type: "error",
        text: `Unit ${selectedUnit.callsign} is currently ${selectedUnit.status}. Enable authorized override to dispatch.`,
      });
      return;
    }

    try {
      dispatchUnit(incident.id, selectedUnit.id, customEta, notes || `Dispatched to ${incident.locationName}`);
      setFeedbackMsg({
        type: "success",
        text: `Successfully dispatched ${selectedUnit.callsign} (${selectedUnit.personnelName}) with simulated ETA ${customEta} mins.`,
      });
      setTimeout(() => {
        setFeedbackMsg(null);
        setSelectedUnitId("");
        setNotes("");
        onClose();
      }, 1200);
    } catch {
      setFeedbackMsg({ type: "error", text: "Failed to dispatch unit. Check authority permissions." });
    }
  };

  const inputClass =
    "w-full bg-[#0b1324] border border-border rounded-lg px-3 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted/60 transition focus:outline-none focus:border-info focus:ring-1 focus:ring-info";

  return (
    <div className="fixed inset-0 z-[2600] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn font-sans">
      <div className="bg-[#0b1324] text-foreground rounded-2xl max-w-2xl w-full shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#093452] px-5 py-4 border-b border-[#062338] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🚨</span>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">Tactical Unit Dispatch Authorization</h3>
              <p className="text-[11px] text-sky-200/80">Command Deck · Automated Suitability Scoring</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Target Incident Summary */}
          <div className="bg-surface-muted border border-border rounded-xl p-3.5 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950 px-1.5 py-0.5 rounded border border-sky-800">
                  {incident.id}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-critical-soft text-critical border border-critical/30">
                  {incident.severity}
                </span>
                <span className="text-[11px] font-medium text-muted truncate max-w-xs">{incident.category}</span>
              </div>
              <h4 className="font-bold text-sm text-white">{incident.title}</h4>
              <p className="text-xs text-muted mt-0.5">📍 {incident.locationName}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-muted font-semibold block">Casualty Est.</span>
              <span className="text-sm font-bold text-white">{incident.affectedPeopleEstimate}</span>
            </div>
          </div>

          {/* Feedback Box */}
          {feedbackMsg && (
            <div
              role="alert"
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 font-medium ${
                feedbackMsg.type === "success"
                  ? "bg-emerald-950/80 border-emerald-700/60 text-emerald-200"
                  : "bg-red-950/80 border-red-700/60 text-red-200"
              }`}
            >
              <span>{feedbackMsg.type === "success" ? "✓" : "⚠️"}</span>
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {/* Available Units Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                Select Responding Unit (Ranked by Compatibility)
              </label>
              <span className="text-[11px] text-muted">{responders.length} Tracked Units</span>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {sortedResponders.map((unit) => {
                const { score, reason } = getSuitabilityScore(unit);
                const isSelected = selectedUnitId === unit.id;
                const isAvailable = unit.status === "AVAILABLE";

                return (
                  <div
                    key={unit.id}
                    onClick={() => setSelectedUnitId(unit.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-sky-950/80 border-sky-500 shadow-md ring-1 ring-sky-500"
                        : "bg-surface-muted/50 border-border hover:border-slate-700 hover:bg-surface-muted"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{unit.callsign}</span>
                        <span className="text-xs text-muted">({unit.personnelName})</span>
                        <span
                          className={`text-[9.5px] px-1.5 py-0.2 rounded font-semibold ${
                            isAvailable
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : "bg-amber-950 text-amber-300 border border-amber-800"
                          }`}
                        >
                          {unit.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted truncate mt-0.5">{unit.agency} · {unit.vehicleType}</p>
                      <p className="text-[10px] text-sky-300 mt-0.5 truncate">{reason}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-sky-400 font-mono">{score}% Match</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ETA & Operational Dispatch Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Estimated En Route Time (Minutes)
              </label>
              <input
                type="number"
                min={2}
                max={120}
                value={customEta}
                onChange={(e) => setCustomEta(Number(e.target.value))}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Field Deployment Directive
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Approach from Sector 4 Northern Bridge..."
                className={inputClass}
              />
            </div>
          </div>

          {/* Busy Unit Override Checkbox */}
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={overrideBusy}
              onChange={(e) => setOverrideBusy(e.target.checked)}
              className="accent-sky-500 rounded"
            />
            <span>Authorized supervisor override (permits rerouting busy or committed units)</span>
          </label>
        </div>

        {/* Footer */}
        <div className="p-4 bg-surface-muted/40 border-t border-border flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold text-muted hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmDispatch}
            className="rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 px-5 py-2 text-xs font-bold text-white shadow-md shadow-sky-950/40 transition cursor-pointer flex items-center gap-1.5"
          >
            <span>🚀</span> Issue Formal Dispatch Order
          </button>
        </div>
      </div>
    </div>
  );
};
