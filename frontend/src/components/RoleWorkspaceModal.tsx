"use client";

import React, { useState } from "react";
import { useResQ } from "../context/ResQContext";
import { UserRole, IncidentRecord } from "../types/resq";
import { DEMO_USERS } from "../services/resqStorage";
import { AdminManagementWorkspace } from "./role-views/AdminManagementWorkspace";

interface RoleWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCitizenReport?: () => void;
  onOpenDispatch?: (incident: IncidentRecord) => void;
}

export const RoleWorkspaceModal: React.FC<RoleWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onOpenCitizenReport,
  onOpenDispatch,
}) => {
  const {
    activeRole,
    currentUser,
    switchRole,
    incidents,
    selectIncident,
    reports,
    verifyReport,
    rejectReport,
    linkReportAsDuplicate,
    responders,
    dispatches,
    updateUnitStatus,
    resources,
    allocateResource,
    infrastructure,
    auditLogs,
    alerts,
    setMapFocusTarget,
  } = useResQ();

  const [reportFilter, setReportFilter] = useState<string>("ALL");
  const [allocationAmount, setAllocationAmount] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showAdminConsole, setShowAdminConsole] = useState(false);

  if (!isOpen) return null;

  const showNotification = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleFocusLocation = (lat: number, lon: number, title: string) => {
    setMapFocusTarget({ lat, lon, zoom: 16, title });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#0b1120] border border-[#1e293b] text-slate-100 rounded-xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden">
        {/* Workspace Top Bar */}
        <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-base">
              🏢
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                OPERATIONAL ROLE WORKSPACE
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded font-mono">
                  {activeRole}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                User: <span className="text-slate-200 font-semibold">{currentUser.name}</span> ({currentUser.agency}) • ID: {currentUser.id}
              </p>
            </div>
          </div>

          {/* Quick Role Switcher */}
          <div className="flex items-center gap-2">
            <select
              value={activeRole}
              onChange={(e) => switchRole(e.target.value as UserRole)}
              className="bg-slate-950 border border-slate-700 text-xs text-amber-400 font-medium rounded px-2.5 py-1 focus:outline-none focus:border-amber-500"
            >
              {DEMO_USERS.map((u) => (
                <option key={u.id} value={u.role}>
                  Switch to: {u.role} ({u.name})
                </option>
              ))}
            </select>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded transition text-sm ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="bg-emerald-950/60 border-b border-emerald-500/40 px-5 py-2 text-xs text-emerald-300 flex items-center justify-between">
            <span>✓ {feedback}</span>
            <button onClick={() => setFeedback(null)} className="hover:opacity-75">✕</button>
          </div>
        )}

        {/* Modal Body: Depends on activeRole */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* ========================================================= */}
          {/* 1. PUBLIC / CITIZEN WORKSPACE */}
          {/* ========================================================= */}
          {activeRole === "Public / Citizen" && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-blue-950/40 to-slate-900 border border-blue-900/40 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    🆘 Citizen Distress & Emergency Reporting
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-lg">
                    If you are affected by Flooding, Cyclones, or Building Fires, submit an SOS report with your coordinates. Your report will be instantly transmitted to the State Disaster Emergency Operations Center.
                  </p>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenCitizenReport?.();
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-md shadow-lg transition shrink-0 flex items-center gap-2"
                >
                  <span>📢</span> Report Emergency Now
                </button>
              </div>

              {/* Public Safety Warnings */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Active Public Warnings & Advisories
                </h4>
                <div className="space-y-2">
                  {alerts.filter((a) => a.isPublic).map((alert) => (
                    <div key={alert.id} className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-amber-300 flex items-center gap-1.5">
                          ⚠️ {alert.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{alert.timestamp}</span>
                      </div>
                      <p className="text-slate-300 text-[11px]">{alert.description}</p>
                    </div>
                  ))}
                  {alerts.filter((a) => a.isPublic).length === 0 && (
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded text-xs text-slate-400">
                      No active meteorological or flood warnings for this district.
                    </div>
                  )}
                </div>
              </div>

              {/* Verified Relief Shelters & Hospitals */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Emergency Shelters & Public Hospitals
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {infrastructure.map((item) => (
                    <div key={item.id} className="p-3 bg-slate-900/70 border border-slate-800 rounded-lg text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">
                          {item.type === "HOSPITAL" ? "🏥" : item.type === "SHELTER" ? "⛺" : "🏢"} {item.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 font-mono">
                          {item.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{item.address}</p>
                      <div className="text-[10px] text-slate-400 flex justify-between pt-1">
                        <span>Helpline: {item.contactNumber}</span>
                        {item.availableBeds !== undefined && (
                          <span className="text-emerald-400 font-medium">Beds: {item.availableBeds} avail</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleFocusLocation(item.lat, item.lon, item.name)}
                        className="text-[10px] text-blue-400 hover:text-blue-300 pt-1 block"
                      >
                        📍 View on GIS Map →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. COMMAND OFFICER / INCIDENT COMMANDER */}
          {/* ========================================================= */}
          {activeRole === "Command Officer / Incident Commander" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Incidents</span>
                  <div className="text-lg font-bold text-white font-mono">{incidents.length}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Critical Severity</span>
                  <div className="text-lg font-bold text-red-400 font-mono">
                    {incidents.filter((i) => i.severity === "CRITICAL").length}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Dispatches</span>
                  <div className="text-lg font-bold text-amber-400 font-mono">
                    {dispatches.filter((d) => d.status !== "COMPLETED" && d.status !== "CANCELLED").length}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Units Deployed</span>
                  <div className="text-lg font-bold text-emerald-400 font-mono">
                    {responders.filter((r) => r.status !== "AVAILABLE").length} / {responders.length}
                  </div>
                </div>
              </div>

              {/* Operational Incidents Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Command Incident Register & NDMA Triage
                </h4>
                <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/50">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">ID</th>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5">Location</th>
                        <th className="p-2.5">Severity</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">AI Triage</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-[11px]">
                      {incidents.map((inc) => (
                        <tr key={inc.id} className="hover:bg-slate-800/40">
                          <td className="p-2.5 font-mono font-bold text-slate-300">{inc.id}</td>
                          <td className="p-2.5 text-slate-200">{inc.category}</td>
                          <td className="p-2.5 text-slate-400">{inc.locationName}</td>
                          <td className="p-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              inc.severity === "CRITICAL" ? "bg-red-950 text-red-400 border border-red-800" :
                              inc.severity === "HIGH" ? "bg-orange-950 text-orange-400 border border-orange-800" :
                              "bg-amber-950 text-amber-400 border border-amber-800"
                            }`}>
                              {inc.severity}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <span className="font-mono text-[10px] text-cyan-400">{inc.lifecycleStatus}</span>
                          </td>
                          <td className="p-2.5">
                            <span className={`text-[10px] font-semibold ${
                              inc.aiRecommendation?.status === "ACCEPTED" ? "text-emerald-400" :
                              inc.aiRecommendation?.status === "OVERRIDDEN" ? "text-amber-400" : "text-blue-400"
                            }`}>
                              {inc.aiRecommendation?.status || "PENDING"} ({inc.aiRecommendation?.confidenceScore || 0}%)
                            </span>
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              onClick={() => {
                                selectIncident(inc);
                                onClose();
                              }}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-medium"
                            >
                              Inspect & Command →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. DISPATCHER WORKSPACE */}
          {/* ========================================================= */}
          {activeRole === "Dispatcher" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Multi-Source Report Intake Queue ({reports.length} incoming)
                </h4>
                <div className="flex gap-1 text-[11px]">
                  {["ALL", "PENDING", "VERIFIED", "REJECTED"].map((st) => (
                    <button
                      key={st}
                      onClick={() => setReportFilter(st)}
                      className={`px-2 py-0.5 rounded ${
                        reportFilter === st ? "bg-blue-600 text-white font-bold" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reports List */}
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {reports
                  .filter((r) => reportFilter === "ALL" || r.verificationStatus === reportFilter)
                  .map((rep) => (
                    <div key={rep.id} className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-400">{rep.id}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            Source: {rep.source}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            rep.verificationStatus === "VERIFIED" ? "bg-emerald-950 text-emerald-400" :
                            rep.verificationStatus === "REJECTED" ? "bg-red-950 text-red-400" :
                            "bg-amber-950 text-amber-400"
                          }`}>
                            {rep.verificationStatus}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{rep.submittedAt}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-400">Category: </span>
                          <span className="text-slate-200 font-semibold">{rep.category}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Location: </span>
                          <span className="text-slate-200">{rep.locationName}</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-300 bg-slate-950/60 p-2 rounded border border-slate-800/80">
                        &quot;{rep.description}&quot;
                      </p>

                      {/* Dispatcher Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
                        <span className="text-[10px] text-slate-400">
                          Reporter: {rep.reporterName} ({rep.reporterPhone})
                        </span>
                        <div className="flex items-center gap-1.5">
                          {rep.verificationStatus === "PENDING" && (
                            <>
                              <button
                                onClick={() => {
                                  verifyReport(rep.id, true);
                                  showNotification(`Report ${rep.id} verified and converted to active Incident.`);
                                }}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold"
                              >
                                ✓ Verify & Promote
                              </button>
                              <button
                                onClick={() => {
                                  rejectReport(rep.id, "Invalid report or unsubstantiated evidence");
                                  showNotification(`Report ${rep.id} rejected.`);
                                }}
                                className="px-2 py-1 bg-red-600/80 hover:bg-red-600 text-white rounded text-[10px] font-bold"
                              >
                                ✕ Reject
                              </button>
                            </>
                          )}
                          {incidents.length > 0 && rep.verificationStatus === "PENDING" && (
                            <button
                              onClick={() => {
                                linkReportAsDuplicate(rep.id, incidents[0].id);
                                showNotification(`Report ${rep.id} linked as duplicate to ${incidents[0].id}.`);
                              }}
                              className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold"
                            >
                              🔗 Link Duplicate
                            </button>
                          )}
                          <button
                            onClick={() => handleFocusLocation(rep.lat, rep.lon, rep.locationName)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px]"
                          >
                            📍 View on Map
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Ready to Dispatch Incidents */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Incidents Requiring Dispatch
                </h4>
                <div className="space-y-2">
                  {incidents.filter((i) => i.lifecycleStatus === "VERIFIED" || i.lifecycleStatus === "NEW REPORT").map((inc) => (
                    <div key={inc.id} className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white text-xs">{inc.title}</div>
                        <div className="text-[11px] text-slate-400">{inc.locationName} • {inc.category}</div>
                      </div>
                      <button
                        onClick={() => {
                          onClose();
                          onOpenDispatch?.(inc);
                        }}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded shadow"
                      >
                        🚀 Dispatch Unit →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. NDRF / SDRF / RESPONDER */}
          {/* ========================================================= */}
          {activeRole === "NDRF / SDRF Team Leader or Responder" && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-amber-400 font-mono">RESCUE-04</span>
                    <span className="text-xs text-slate-300">NDRF Battalion 4 (Team Leader Mehul Joshi)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-bold border border-emerald-800">
                    STATUS: AVAILABLE / STANDBY
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Specialization: Deep Flood Inflatable Boat Operations, Urban Debris Rescue, Drone Thermal Recon.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      updateUnitStatus("unit-3", "EN ROUTE");
                      showNotification("Unit RESCUE-04 marked EN ROUTE to scene.");
                    }}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded"
                  >
                    Set En Route 🚗
                  </button>
                  <button
                    onClick={() => {
                      updateUnitStatus("unit-3", "ON SCENE");
                      showNotification("Unit RESCUE-04 marked ON SCENE.");
                    }}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded"
                  >
                    Set On Scene 📍
                  </button>
                  <button
                    onClick={() => {
                      updateUnitStatus("unit-3", "AVAILABLE");
                      showNotification("Unit RESCUE-04 mission marked COMPLETED.");
                    }}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded"
                  >
                    Mark Mission Completed ✓
                  </button>
                </div>
              </div>

              {/* Field Hazard Warning List */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Operational Hazards & Blocked Routes
                </h4>
                <div className="space-y-2">
                  {infrastructure.filter((i) => i.type === "BLOCKED_ROAD").map((road) => (
                    <div key={road.id} className="p-3 bg-red-950/20 border border-red-900/40 rounded-lg text-xs">
                      <div className="font-bold text-red-400 flex items-center justify-between">
                        <span>🚧 {road.name}</span>
                        <span className="text-[10px] text-red-300 uppercase font-mono">{road.status}</span>
                      </div>
                      <p className="text-slate-300 text-[11px] mt-1">{road.notes || road.address}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. MEDIC / AMBULANCE TEAM */}
          {/* ========================================================= */}
          {activeRole === "Medic / Ambulance Team" && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-red-400 font-mono">AMB-07</span>
                    <span className="text-xs text-slate-300">EMS 108 Advanced Life Support (Paramedic Riya Shah)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-bold border border-emerald-800">
                    AVAILABLE
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      updateUnitStatus("unit-1", "EN ROUTE");
                      showNotification("AMB-07 En Route to triage point.");
                    }}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded"
                  >
                    En Route 🚑
                  </button>
                  <button
                    onClick={() => {
                      updateUnitStatus("unit-1", "ON SCENE");
                      showNotification("AMB-07 On Scene initiating casualty triage.");
                    }}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded"
                  >
                    On Scene (Triage) 🩺
                  </button>
                  <button
                    onClick={() => {
                      updateUnitStatus("unit-1", "AVAILABLE");
                      showNotification("Patient handover completed. AMB-07 Available.");
                    }}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded"
                  >
                    Handover Complete ✓
                  </button>
                </div>
              </div>

              {/* Hospital Capacities */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Regional Trauma Centers & Bed Availability
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {infrastructure.filter((i) => i.type === "HOSPITAL").map((hosp) => (
                    <div key={hosp.id} className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-1">
                      <div className="flex justify-between font-bold text-white">
                        <span>🏥 {hosp.name}</span>
                        <span className="text-emerald-400 font-mono">{hosp.availableBeds} Beds Avail</span>
                      </div>
                      <div className="text-[11px] text-slate-400">{hosp.address}</div>
                      <div className="text-[10px] text-cyan-400">
                        ICU Units: {hosp.icuAvailable} • Emergency Helpline: {hosp.contactNumber}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. FIREFIGHTER / FIRE SERVICE OFFICER */}
          {/* ========================================================= */}
          {activeRole === "Firefighter / Fire Service Officer" && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-orange-400 font-mono">FIRE-17</span>
                    <span className="text-xs text-slate-300">Delhi Fire Service Engine 17 (Officer Arjun Patel)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-bold border border-emerald-800">
                    AVAILABLE
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      updateUnitStatus("unit-2", "EN ROUTE");
                      showNotification("FIRE-17 En Route to fire incident.");
                    }}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded"
                  >
                    En Route 🚒
                  </button>
                  <button
                    onClick={() => {
                      updateUnitStatus("unit-2", "ON SCENE");
                      showNotification("FIRE-17 On Scene engaging suppression hoses.");
                    }}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded"
                  >
                    On Scene (Extinguishing) 🔥
                  </button>
                  <button
                    onClick={() => {
                      updateUnitStatus("unit-2", "AVAILABLE");
                      showNotification("Fire Extinguished. FIRE-17 Standby.");
                    }}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded"
                  >
                    Fire Extinguished ✓
                  </button>
                </div>
              </div>

              {/* Fire Stations & Hydrants */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Fire Stations & Water Sources
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {infrastructure.filter((i) => i.type === "FIRE_STATION").map((fs) => (
                    <div key={fs.id} className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-1">
                      <div className="font-bold text-white">🚒 {fs.name}</div>
                      <div className="text-[11px] text-slate-400">{fs.address}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Emergency Direct: {fs.contactNumber}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 7. LOGISTICS OFFICER */}
          {/* ========================================================= */}
          {activeRole === "Logistics Officer" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Disaster Relief Supply Inventory & Allocation
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">Real-time Warehouse Stock</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {resources.map((res) => {
                  const qty = allocationAmount[res.id] || 1;
                  return (
                    <div key={res.id} className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{res.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">
                          {res.category}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Warehouse: {res.warehouseLocation}</span>
                        <span className={`font-mono font-bold ${
                          res.availableStock <= res.criticalThreshold ? "text-red-400" : "text-emerald-400"
                        }`}>
                          {res.availableStock} / {res.totalStock} {res.unit}
                        </span>
                      </div>

                      {/* Allocation Control */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                        <input
                          type="number"
                          min="1"
                          max={res.availableStock}
                          value={qty}
                          onChange={(e) => setAllocationAmount({ ...allocationAmount, [res.id]: Number(e.target.value) })}
                          className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        />
                        <button
                          onClick={() => {
                            if (incidents.length === 0) {
                              showNotification("No active incidents to allocate to.");
                              return;
                            }
                            const targetInc = incidents[0];
                            const ok = allocateResource(res.id, qty, targetInc.id);
                            if (ok) {
                              showNotification(`Allocated ${qty} ${res.unit} of ${res.name} to ${targetInc.id}.`);
                            } else {
                              showNotification("Allocation failed: Insufficient stock.");
                            }
                          }}
                          disabled={res.availableStock <= 0}
                          className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-[11px] font-bold"
                        >
                          Allocate to Incident →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 8. SYSTEM ADMINISTRATOR */}
          {/* ========================================================= */}
          {activeRole === "System Administrator" && (
            <div className="space-y-4">
              {/* Application Management Launch Banner */}
              <div className="bg-gradient-to-r from-indigo-950/80 via-blue-950/60 to-slate-900 border border-indigo-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚙️</span>
                    <h3 className="text-sm font-bold text-white">Application Management Console</h3>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-mono">
                      AM-FR-01 • 02 • 05 • 06 • 07 • 11
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    Live operational control over DRCH User Accounts (AM-02), Immutable SHA-256 Chained Audit Logs (AM-05), Database Record Corrections (AM-06), Security Management &amp; JWT Session Revocation (AM-07), and Fail-Safe Sliding-Window Rate Limit Controls (AM-11).
                  </p>
                </div>
                <button
                  onClick={() => setShowAdminConsole(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-lg transition shrink-0 flex items-center gap-2 cursor-pointer"
                >
                  <span>🚀</span> Open Full Management Console
                </button>
              </div>

              {showAdminConsole && (
                <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/85 backdrop-blur-xs p-3 animate-in fade-in">
                  <div className="bg-[#0b1120] border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto p-5 shadow-2xl">
                    <AdminManagementWorkspace onClose={() => setShowAdminConsole(false)} />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Audit Logs & Security Trail ({auditLogs.length} entries)
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">Immutable Operation Log</span>
              </div>

              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950 max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead className="bg-slate-900 text-slate-400 text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-2">Timestamp</th>
                      <th className="p-2">User / Role</th>
                      <th className="p-2">Action</th>
                      <th className="p-2">Target</th>
                      <th className="p-2">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-[11px]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-900/60">
                        <td className="p-2 text-slate-500 whitespace-nowrap text-[10px]">{log.timestamp}</td>
                        <td className="p-2 text-slate-300">
                          {log.userName} <span className="text-[10px] text-slate-500">({log.userRole})</span>
                        </td>
                        <td className="p-2 font-bold text-cyan-400">{log.action}</td>
                        <td className="p-2 text-amber-300">{log.recordId || "SYS"}</td>
                        <td className="p-2 text-slate-400 text-[10px]">{log.reason || log.newValue || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Registered Agency Users */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Authorized Agency User Accounts
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {DEMO_USERS.map((usr) => (
                    <div key={usr.id} className="p-2.5 bg-slate-900 border border-slate-800 rounded flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white">{usr.name}</div>
                        <div className="text-[10px] text-slate-400">{usr.agency} • {usr.role}</div>
                      </div>
                      <button
                        onClick={() => {
                          switchRole(usr.role);
                          showNotification(`Switched role to ${usr.role}`);
                        }}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                      >
                        Login as User
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>ResQ AI NDMA Tactical Workspace • Version 2.4</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded transition"
          >
            Close Workspace
          </button>
        </div>
      </div>
    </div>
  );
};
