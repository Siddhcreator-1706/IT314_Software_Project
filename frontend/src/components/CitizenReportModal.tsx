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

  return (
    <div className="fixed inset-0 z-[2500] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0B111E] rounded-xl max-w-xl w-full shadow-2xl border border-slate-800 text-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#070b14] px-5 py-3.5 border-b border-red-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200 font-mono">
                PUBLIC EMERGENCY DISPATCH & REPORT
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">NDMA / ERSS 112 RAPID TRIAGE CHANNEL</p>
            </div>
          </div>
          <button
            onClick={() => {
              setSubmittedReportId(null);
              onClose();
            }}
            className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-[#080d19] text-xs font-mono uppercase tracking-wider">
          <button
            onClick={() => {
              setActiveTab("new");
              setSubmittedReportId(null);
            }}
            className={`flex-1 py-2.5 text-center transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "new"
                ? "border-b-2 border-sky-500 text-sky-400 bg-sky-950/20 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>SUBMIT EMERGENCY REPORT</span>
          </button>
          <button
            onClick={() => setActiveTab("track")}
            className={`flex-1 py-2.5 text-center transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "track"
                ? "border-b-2 border-sky-500 text-sky-400 bg-sky-950/20 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>TRACK SUBMISSION STATUS</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
          {activeTab === "new" ? (
            submittedReportId ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
                  Emergency Report Dispatched
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Your distress report has been queued in the ResQ Operations Center. Response units and AI triage have been notified.
                </p>
                <div className="bg-[#070b14] border border-sky-500/30 rounded-lg p-3 max-w-xs mx-auto text-sky-400 font-mono text-xs font-bold tracking-wider">
                  REFERENCE ID: {submittedReportId}
                </div>
                <p className="text-[10px] text-slate-400 font-mono">Save this Reference ID to track real-time verification and ambulance/rescue progress.</p>
                <div className="pt-2 flex justify-center gap-2">
                  <button
                    onClick={() => {
                      setTrackSearchId(submittedReportId);
                      setActiveTab("track");
                    }}
                    className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded font-mono text-xs font-semibold cursor-pointer transition"
                  >
                    TRACK STATUS NOW
                  </button>
                  <button
                    onClick={() => {
                      setSubmittedReportId(null);
                      onClose();
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded font-mono text-xs font-medium cursor-pointer transition"
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* Disaster Category */}
                <div>
                  <label className="block font-mono text-xs text-slate-300 mb-1.5 uppercase font-semibold">
                    DISASTER TYPE <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        type: "Flood / Urban Flood",
                        label: "FLOOD",
                        icon: (
                          <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M3 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" />
                          </svg>
                        ),
                      },
                      {
                        type: "Cyclone / Coastal Flooding",
                        label: "CYCLONE",
                        icon: (
                          <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21a9 9 0 100-18 9 9 0 000 18z" />
                          </svg>
                        ),
                      },
                      {
                        type: "Major Urban / Building Fire",
                        label: "FIRE",
                        icon: (
                          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                          </svg>
                        ),
                      },
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.type}
                        onClick={() => setCategory(item.type as DisasterCategory)}
                        className={`p-3 rounded-lg border text-center flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                          category === item.type
                            ? "bg-sky-950/40 border-sky-500 text-sky-300 ring-1 ring-sky-500 font-bold"
                            : "bg-[#070b14] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        {item.icon}
                        <span className="text-[10px] font-mono leading-tight uppercase">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block font-mono text-xs text-slate-300 mb-1.5 uppercase font-semibold">
                    SITUATION DESCRIPTION <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe trapped people, water height, fire intensity, floor level, landmarks..."
                    required
                    className="w-full border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 bg-[#070b14]"
                  />
                </div>

                {/* Location and Coords */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-mono text-[10px] text-slate-400 mb-1 uppercase">LOCATION / LANDMARK</label>
                    <input
                      type="text"
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      placeholder="e.g. Ward 4, Meppadi"
                      className="w-full border border-slate-700 rounded-lg p-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 bg-[#070b14]"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] text-slate-400 mb-1 uppercase">APPROX. AFFECTED</label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={affectedCount}
                      onChange={(e) => setAffectedCount(Number(e.target.value))}
                      className="w-full border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 bg-[#070b14] font-mono"
                    />
                  </div>
                </div>

                {/* Urgent Needs Pills */}
                <div>
                  <label className="block font-mono text-[10px] text-slate-400 mb-1.5 uppercase">IMMEDIATE URGENT NEEDS</label>
                  <div className="flex flex-wrap gap-1.5">
                    {urgentNeedsOptions.map((need) => (
                      <button
                        type="button"
                        key={need}
                        onClick={() => handleNeedToggle(need)}
                        className={`px-2.5 py-1 rounded text-[10px] font-mono font-medium border transition cursor-pointer flex items-center gap-1 ${
                          selectedNeeds.includes(need)
                            ? "bg-red-950/60 text-red-300 border-red-700/80 shadow-xs"
                            : "bg-[#070b14] text-slate-400 border-slate-800 hover:text-slate-200"
                        }`}
                      >
                        {selectedNeeds.includes(need) ? (
                          <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span>+ </span>
                        )}
                        <span>{need}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contact Information */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                  <div>
                    <label className="block font-mono text-[10px] text-slate-400 mb-0.5 uppercase">YOUR NAME (OPTIONAL)</label>
                    <input
                      type="text"
                      value={reporterName}
                      onChange={(e) => setReporterName(e.target.value)}
                      placeholder="Ananya Verma"
                      className="w-full border border-slate-700 rounded p-1.5 text-xs text-slate-100 placeholder-slate-500 bg-[#070b14] focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] text-slate-400 mb-0.5 uppercase">CONTACT PHONE</label>
                    <input
                      type="tel"
                      value={reporterPhone}
                      onChange={(e) => setReporterPhone(e.target.value)}
                      placeholder="+91 98765 00000"
                      className="w-full border border-slate-700 rounded p-1.5 text-xs text-slate-100 placeholder-slate-500 bg-[#070b14] font-mono focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded text-xs font-mono text-slate-300 bg-slate-800 hover:bg-slate-700 cursor-pointer transition"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded text-xs font-mono font-bold bg-red-600 hover:bg-red-500 text-white shadow-md cursor-pointer flex items-center gap-1.5 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>SUBMIT EMERGENCY REPORT</span>
                  </button>
                </div>
              </form>
            )
          ) : (
            /* Track Submission Tab */
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={trackSearchId}
                  onChange={(e) => setTrackSearchId(e.target.value)}
                  placeholder="Enter Reference ID (e.g. REP-2026-101)"
                  className="flex-1 border border-slate-700 rounded-lg p-2 text-xs font-mono uppercase bg-[#070b14] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => {}}
                  className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded font-mono text-xs font-semibold cursor-pointer transition"
                >
                  SEARCH
                </button>
              </div>

              {trackedReport ? (
                <div className="border border-slate-800 rounded-xl p-4 bg-[#070b14] space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <span className="font-mono font-bold text-sky-400 text-sm">{trackedReport.id}</span>
                      <span className="text-[11px] text-slate-400 ml-2 font-mono">{trackedReport.category}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        trackedReport.verificationStatus === "VERIFIED"
                          ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                          : trackedReport.verificationStatus === "PENDING"
                          ? "bg-amber-950/80 text-amber-400 border border-amber-800"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {trackedReport.verificationStatus}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{trackedReport.description}</p>
                  <div className="text-[11px] text-slate-400 font-mono">
                    <span className="text-slate-300 font-semibold">LOCATION:</span> {trackedReport.locationName} • <span className="text-slate-300 font-semibold">AFFECTED:</span> ~{trackedReport.affectedPeopleCount} people
                  </div>

                  {trackedReport.linkedIncidentId && (
                    <div className="bg-sky-950/30 border border-sky-800/60 rounded p-2 text-[11px] text-sky-300 font-mono">
                      <b>ACTIVE MISSION:</b> Linked to unified operational incident <b>{trackedReport.linkedIncidentId}</b>. First responders assigned.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 font-mono">
                  <p>Enter Reference ID above or select from recent reports:</p>
                  <div className="mt-3 space-y-1.5 text-left max-w-sm mx-auto">
                    {reports.slice(0, 3).map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setTrackSearchId(r.id)}
                        className="w-full text-left p-2.5 rounded bg-[#070b14] hover:bg-slate-900 border border-slate-800 text-xs flex justify-between cursor-pointer transition font-mono"
                      >
                        <span className="font-bold text-sky-400">{r.id}</span>
                        <span className="text-slate-400 truncate max-w-[150px]">{r.locationName}</span>
                        <span className="text-slate-500">({r.verificationStatus})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
