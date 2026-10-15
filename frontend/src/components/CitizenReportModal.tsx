"use client";

import React, { useState } from "react";
import { useResQ } from "../context/ResQContext";
import { DisasterCategory } from "../types/resq";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pickedCoords?: { lat: number; lon: number; name?: string };
}

export default function CitizenReportModal({ isOpen, onClose, pickedCoords }: Props) {
  const { submitCitizenReport, reports } = useResQ();

  const [activeTab, setActiveTab] = useState<"new" | "track">("new");
  const [category, setCategory] = useState<DisasterCategory>("Flood / Urban Flood");
  const [description, setDescription] = useState("");
  const [locationName, setLocationName] = useState(pickedCoords?.name || "Wayanad, Kerala");
  const [lat] = useState(pickedCoords?.lat || 11.5542);
  const [lon] = useState(pickedCoords?.lon || 76.1264);
  const [affectedCount, setAffectedCount] = useState(5);
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>(["Rescue Boats"]);
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null);
  const [trackSearchId, setTrackSearchId] = useState("");

  if (!isOpen) return null;

  const urgentNeedsOptions = [
    "Rescue Boats",
    "Medical Evacuation",
    "Drinking Water",
    "Temporary Shelter",
    "Water Tenders (Fire)",
    "Power Grid Cutoff",
  ];

  const handleNeedToggle = (need: string) => {
    if (selectedNeeds.includes(need)) {
      setSelectedNeeds(selectedNeeds.filter((n) => n !== need));
    } else {
      setSelectedNeeds([...selectedNeeds, need]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      alert("Please provide a description of the emergency situation.");
      return;
    }

    const report = submitCitizenReport({
      source: "CITIZEN_APP",
      lat: Number(lat),
      lon: Number(lon),
      locationName: locationName || "Reported Location",
      category,
      description,
      affectedPeopleCount: Number(affectedCount) || 1,
      urgentNeeds: selectedNeeds,
      photoUrls: [],
      reporterName: reporterName || "Anonymous Resident",
      reporterPhone: reporterPhone || "+91 90000 00000",
    });

    setSubmittedReportId(report.id);
  };

  const trackedReport = reports.find((r) => r.id.toLowerCase() === trackSearchId.trim().toLowerCase());

  const inputClass =
    "w-full bg-[#0b1324] border border-border rounded-lg px-3 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted/60 transition focus:outline-none focus:border-info focus:ring-1 focus:ring-info";

  return (
    <div className="fixed inset-0 z-[2500] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn font-sans">
      <div className="bg-[#0b1324] text-foreground rounded-2xl max-w-xl w-full shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#093452] px-5 py-4 border-b border-[#062338] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🚨</span>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">Emergency Incident &amp; SOS Reporting</h3>
              <p className="text-[11px] text-sky-200/80">NDMA / ERSS 112 Rapid Dispatch Intake</p>
            </div>
          </div>
          <button
            onClick={() => {
              setSubmittedReportId(null);
              onClose();
            }}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border bg-[#0b1324] text-xs font-semibold">
          <button
            onClick={() => setActiveTab("new")}
            className={`flex-1 py-3 text-center transition cursor-pointer border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === "new"
                ? "border-sky-400 text-sky-300 bg-surface-muted/30"
                : "border-transparent text-muted hover:text-foreground hover:bg-surface-muted/10"
            }`}
          >
            <span>📝</span> Submit Situation Report
          </button>
          <button
            onClick={() => setActiveTab("track")}
            className={`flex-1 py-3 text-center transition cursor-pointer border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === "track"
                ? "border-sky-400 text-sky-300 bg-surface-muted/30"
                : "border-transparent text-muted hover:text-foreground hover:bg-surface-muted/10"
            }`}
          >
            <span>🔍</span> Track Active Report Status
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {submittedReportId ? (
            <div className="text-center py-6 space-y-3">
              <div className="size-14 mx-auto rounded-full bg-emerald-950/80 border border-emerald-600/50 flex items-center justify-center text-2xl text-emerald-300 shadow-lg">
                ✓
              </div>
              <h4 className="text-lg font-bold text-white">Emergency Report Registered</h4>
              <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
                Your report has been forwarded to the NDMA Integrated Command Hub and active responder units in your sector.
              </p>
              <div className="bg-surface-muted border border-border p-3 rounded-xl max-w-xs mx-auto">
                <span className="text-[10px] text-muted uppercase tracking-wider block">Your Tracking Reference ID</span>
                <span className="font-mono text-base font-bold text-sky-400 select-all">{submittedReportId}</span>
              </div>
              <div className="pt-2 flex justify-center gap-2">
                <button
                  onClick={() => setSubmittedReportId(null)}
                  className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-muted hover:text-white"
                >
                  Submit Another Report
                </button>
                <button
                  onClick={() => {
                    setSubmittedReportId(null);
                    onClose();
                  }}
                  className="rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-sm"
                >
                  Return to Map
                </button>
              </div>
            </div>
          ) : activeTab === "new" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Disaster / Emergency Type <span className="text-sky-400">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as DisasterCategory)}
                  className={inputClass}
                >
                  <option value="Flood / Urban Flood">🌊 Flood / Urban Inundation</option>
                  <option value="Cyclone / Coastal Flooding">🌀 Cyclone / Coastal Storm</option>
                  <option value="Major Urban / Building Fire">🔥 Major Urban / Structural Fire</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Location Description &amp; Landmark <span className="text-sky-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="e.g. Near Old Bridge, Sector 4, Wayanad"
                  className={inputClass}
                />
                <p className="text-[10px] text-muted mt-1 font-mono">
                  Coordinates: {lat.toFixed(4)}° N, {lon.toFixed(4)}° E (Auto-tagged)
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Emergency Situation Details <span className="text-sky-400">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe trapped people, water level, structural damage, fire spread..."
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Estimated People in Danger
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={affectedCount}
                    onChange={(e) => setAffectedCount(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Contact Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={reporterPhone}
                    onChange={(e) => setReporterPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                  Immediate Rescue Needs (Select All Applicable)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {urgentNeedsOptions.map((need) => (
                    <button
                      key={need}
                      type="button"
                      onClick={() => handleNeedToggle(need)}
                      className={`p-2 rounded-lg border text-left text-xs font-medium transition cursor-pointer flex items-center justify-between ${
                        selectedNeeds.includes(need)
                          ? "bg-sky-950/80 border-sky-500 text-sky-200 ring-1 ring-sky-500/50"
                          : "bg-surface-muted/50 border-border text-muted hover:border-slate-700 hover:text-white"
                      }`}
                    >
                      <span className="truncate">{need}</span>
                      <span>{selectedNeeds.includes(need) ? "✓" : "+"}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-border flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-semibold text-muted hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-red-950/50 transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>🚨</span> Transmit Emergency SOS
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Enter Incident Reference or SOS ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={trackSearchId}
                    onChange={(e) => setTrackSearchId(e.target.value)}
                    placeholder="e.g. REP-8041 or INC-..."
                    className={inputClass}
                  />
                </div>
              </div>

              {trackedReport ? (
                <div className="bg-surface-muted border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-sky-400">{trackedReport.id}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-800">
                      {trackedReport.verificationStatus}
                    </span>
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-sm">{trackedReport.category}</h5>
                    <p className="text-xs text-muted mt-0.5">{trackedReport.locationName}</p>
                  </div>
                  <p className="text-xs text-foreground bg-surface p-2.5 rounded-lg border border-border">
                    {trackedReport.description}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-muted pt-2 border-t border-border">
                    <span>Submitted: {trackedReport.submittedAt}</span>
                    <span>People in danger: {trackedReport.affectedPeopleCount}</span>
                  </div>
                </div>
              ) : trackSearchId.trim() ? (
                <div className="text-center py-8 text-muted text-xs bg-surface-muted/30 border border-dashed border-border rounded-xl">
                  No matching emergency report found for &ldquo;{trackSearchId}&rdquo;.
                </div>
              ) : (
                <div className="text-center py-8 text-muted text-xs bg-surface-muted/30 border border-dashed border-border rounded-xl">
                  Enter an SOS Reference ID above to check dispatch progress.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
