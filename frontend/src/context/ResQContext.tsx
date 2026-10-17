"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  UserProfile,
  UserRole,
  PortalRoleCategory,
  IncidentRecord,
  CitizenReportRecord,
  ResponderUnitRecord,
  DispatchAssignmentRecord,
  ResourceItemRecord,
  InfrastructureRecord,
  IncidentMessageRecord,
  SystemAlertRecord,
  AuditLogRecord,
  IncidentSeverity,
  IncidentLifecycleStatus,
} from "../types/resq";
import { ResQStorage, DEMO_USERS, GUEST_USER, getRoleCategory } from "../services/resqStorage";
import { generateAITriage } from "../services/aiTriage";
import { detectDuplicates } from "../services/duplicateDetection";

interface ResQContextType {
  currentUser: UserProfile;
  activeRole: UserRole;
  roleCategory: PortalRoleCategory;
  isAuthenticated: boolean;
  switchRole: (role: UserRole) => void;
  login: (user: UserProfile) => void;
  signup: (userData: Omit<UserProfile, "id">) => UserProfile;
  logout: () => void;
  allUsers: UserProfile[];

  incidents: IncidentRecord[];
  selectedIncident: IncidentRecord | null;
  selectIncident: (incident: IncidentRecord | null) => void;
  createIncident: (incident: Omit<IncidentRecord, "id" | "detectedAt" | "updatedAt" | "timeline">) => IncidentRecord;
  updateIncidentStatus: (id: string, status: IncidentLifecycleStatus, reason?: string) => void;
  updateIncidentSeverity: (id: string, severity: IncidentSeverity, reason: string) => void;
  acceptAITriage: (incidentId: string) => void;
  overrideAITriage: (incidentId: string, severity: IncidentSeverity, priority: number, reason: string) => void;

  reports: CitizenReportRecord[];
  submitCitizenReport: (report: Omit<CitizenReportRecord, "id" | "submittedAt" | "verificationStatus">) => CitizenReportRecord;
  verifyReport: (reportId: string, promoteToIncident: boolean) => void;
  rejectReport: (reportId: string, reason: string) => void;
  linkReportAsDuplicate: (reportId: string, targetIncidentId: string) => void;

  responders: ResponderUnitRecord[];
  dispatches: DispatchAssignmentRecord[];
  dispatchUnit: (incidentId: string, unitId: string, etaMinutes?: number, notes?: string) => void;
  updateUnitStatus: (unitId: string, status: ResponderUnitRecord["status"]) => void;

  resources: ResourceItemRecord[];
  allocateResource: (resourceId: string, quantity: number, incidentId: string) => boolean;

  infrastructure: InfrastructureRecord[];
  messages: IncidentMessageRecord[];
  sendMessage: (incidentId: string, text: string, isPriority?: boolean) => void;

  alerts: SystemAlertRecord[];
  unreadAlertCount: number;
  markAlertRead: (id: string) => void;

  auditLogs: AuditLogRecord[];

  // Simulation
  simulationRunning: boolean;
  simulationStep: number;
  startSimulation: () => void;
  pauseSimulation: () => void;
  stepSimulation: () => void;
  resetSimulation: () => void;

  // Map Navigation Focus Request
  mapFocusTarget: { lat: number; lon: number; zoom: number; title?: string } | null;
  setMapFocusTarget: (target: { lat: number; lon: number; zoom: number; title?: string } | null) => void;

  // Offline status
  isOnline: boolean;
}

const ResQContext = createContext<ResQContextType | undefined>(undefined);

export function ResQProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(GUEST_USER);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>(DEMO_USERS);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(null);
  const [reports, setReports] = useState<CitizenReportRecord[]>([]);
  const [responders, setResponders] = useState<ResponderUnitRecord[]>([]);
  const [dispatches, setDispatches] = useState<DispatchAssignmentRecord[]>([]);
  const [resources, setResources] = useState<ResourceItemRecord[]>([]);
  const [infrastructure, setInfrastructure] = useState<InfrastructureRecord[]>([]);
  const [messages, setMessages] = useState<IncidentMessageRecord[]>([]);
  const [alerts, setAlerts] = useState<SystemAlertRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);

  // Simulation states
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationStep, setSimulationStep] = useState(0);

  // Map request helper
  const [mapFocusTarget, setMapFocusTarget] = useState<{ lat: number; lon: number; zoom: number; title?: string } | null>(null);

  // Online / Offline tracking
  const [isOnline, setIsOnline] = useState(true);

  // Load state on mount
  const refreshState = useCallback(() => {
    const isAuth = ResQStorage.isAuthenticated();
    setIsAuthenticated(isAuth);
    const user = isAuth ? ResQStorage.getCurrentUser() : GUEST_USER;
    setCurrentUser(user);
    setAllUsers(ResQStorage.getRegisteredUsers());

    const incs = ResQStorage.getIncidents();
    setIncidents(incs);
    setReports(ResQStorage.getReports());
    setResponders(ResQStorage.getResponders());
    setDispatches(ResQStorage.getDispatches());
    setResources(ResQStorage.getResources());
    setInfrastructure(ResQStorage.getInfrastructure());
    setMessages(ResQStorage.getMessages());
    setAlerts(ResQStorage.getAlerts(user.role));
    setAuditLogs(ResQStorage.getAuditLogs());
  }, []);

  useEffect(() => {
    // Synchronize client storage after hydration
    const timer = setTimeout(() => {
      refreshState();
    }, 0);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshState]);

  // Authenticate user
  const login = (user: UserProfile) => {
    ResQStorage.setCurrentUser(user);
    ResQStorage.setAuthenticated(true);
    setCurrentUser(user);
    setIsAuthenticated(true);
    setAlerts(ResQStorage.getAlerts(user.role));

    ResQStorage.addAuditLog({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "USER_LOGIN",
      recordType: "AUTH",
      recordId: user.id,
      newValue: `Logged in as ${user.name} (${user.role} - ${getRoleCategory(user.role)})`,
      reason: "User authenticated into portal",
    });
    setAuditLogs(ResQStorage.getAuditLogs());
  };

  // Register and authenticate new user.
  // SECURITY: Role is always forced to "Public / Citizen" regardless of what is
  // supplied in userData. Privileged accounts (staff, admin) are provisioned
  // exclusively via the backend CLI and require MFA — never via self-registration.
  const signup = (userData: Omit<UserProfile, "id">): UserProfile => {
    const newUser: UserProfile = {
      ...userData,
      role: "Public / Citizen",   // ENFORCED — never trust caller's role
      agency: userData.agency || "Public Resident / Citizen",
      id: `USR-${Date.now().toString().slice(-4)}`,
    };
    ResQStorage.saveRegisteredUser(newUser);
    setAllUsers(ResQStorage.getRegisteredUsers());
    login(newUser);
    return newUser;
  };

  // Sign out back to general public dashboard
  const logout = () => {
    ResQStorage.setAuthenticated(false);
    ResQStorage.setCurrentUser(GUEST_USER);
    setCurrentUser(GUEST_USER);
    setIsAuthenticated(false);
    setAlerts(ResQStorage.getAlerts("Public / Citizen"));

    ResQStorage.addAuditLog({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: "USER_LOGOUT",
      recordType: "AUTH",
      recordId: currentUser.id,
      reason: "Signed out to General Public Dashboard",
    });
    setAuditLogs(ResQStorage.getAuditLogs());
  };

  // Switch role and update user profile
  const switchRole = (role: UserRole) => {
    const users = ResQStorage.getRegisteredUsers();
    const foundUser = users.find((u) => u.role === role) || DEMO_USERS.find((u) => u.role === role) || {
      id: `USR-${Date.now()}`,
      name: `Officer (${role})`,
      email: `${role.toLowerCase().replace(/[^a-z]/g, "")}@resq.gov.in`,
      role,
      agency: "ResQ Operational Division",
      phone: "+91 98765 00000",
    };
    ResQStorage.setCurrentUser(foundUser);
    ResQStorage.setAuthenticated(true);
    setCurrentUser(foundUser);
    setIsAuthenticated(true);
    setAlerts(ResQStorage.getAlerts(role));

    ResQStorage.addAuditLog({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: foundUser.id,
      userName: foundUser.name,
      userRole: role,
      action: "ROLE_SWITCHED",
      recordType: "AUTH",
      recordId: foundUser.id,
      newValue: `Active role: ${role}`,
    });
    setAuditLogs(ResQStorage.getAuditLogs());
  };

  // Submit a citizen report
  const submitCitizenReport = (reportData: Omit<CitizenReportRecord, "id" | "submittedAt" | "verificationStatus">): CitizenReportRecord => {
    const newReport: CitizenReportRecord = {
      ...reportData,
      id: `REP-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      submittedAt: new Date().toISOString(),
      verificationStatus: "PENDING",
      confidenceScore: reportData.source === "CITIZEN_APP" ? 85 : 90,
    };

    ResQStorage.addReport(newReport);
    refreshState();

    // Auto-focus map to the newly reported location
    setMapFocusTarget({
      lat: newReport.lat,
      lon: newReport.lon,
      zoom: 13,
      title: `${newReport.category} (Report ${newReport.id})`,
    });

    return newReport;
  };

  // Create Incident
  const createIncident = (incidentData: Omit<IncidentRecord, "id" | "detectedAt" | "updatedAt" | "timeline">): IncidentRecord => {
    const newInc: IncidentRecord = {
      ...incidentData,
      id: `INC-2026-${Math.floor(100 + Math.random() * 900)}`,
      detectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [
        {
          id: `EVT-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorName: currentUser.name,
          actorRole: currentUser.role,
          action: "Incident created directly in Command Hub.",
        },
      ],
    };

    // Auto-generate AI triage
    if (!newInc.aiRecommendation) {
      newInc.aiRecommendation = generateAITriage(
        newInc.category,
        newInc.description,
        newInc.affectedPeopleEstimate,
        newInc.urgentNeeds,
        newInc.reporterSource
      );
    }

    ResQStorage.saveIncident(newInc, currentUser, "Initial incident declaration");
    refreshState();
    setSelectedIncident(newInc);
    return newInc;
  };

  // Verify a report & optionally promote to incident
  const verifyReport = (reportId: string, promoteToIncident: boolean) => {
    const report = reports.find((r) => r.id === reportId);
    if (!report) return;

    if (promoteToIncident) {
      const triage = generateAITriage(
        report.category,
        report.description,
        report.affectedPeopleCount,
        report.urgentNeeds,
        report.source
      );

      const newInc: IncidentRecord = {
        id: `INC-2026-${Math.floor(100 + Math.random() * 900)}`,
        category: report.category,
        title: `${report.category} Incident — ${report.locationName}`,
        description: report.description,
        lat: report.lat,
        lon: report.lon,
        locationName: report.locationName,
        severity: triage.proposedSeverity,
        lifecycleStatus: "VERIFIED",
        detectedAt: report.submittedAt,
        updatedAt: new Date().toISOString(),
        reporterSource: report.source,
        reporterName: report.reporterName,
        reporterPhone: report.reporterPhone,
        affectedPeopleEstimate: report.affectedPeopleCount,
        urgentNeeds: report.urgentNeeds,
        evidenceUrls: report.photoUrls,
        assignedUnitIds: [],
        relatedReportIds: [report.id],
        aiRecommendation: triage,
        timeline: [
          {
            id: `EVT-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actorName: currentUser.name,
            actorRole: currentUser.role,
            action: `Verified and escalated from report ${report.id}.`,
          },
        ],
      };

      ResQStorage.saveIncident(newInc, currentUser, `Verified from report ${report.id}`);
      ResQStorage.updateReportStatus(reportId, "VERIFIED", newInc.id);
      setSelectedIncident(newInc);
    } else {
      ResQStorage.updateReportStatus(reportId, "VERIFIED");
    }

    refreshState();
  };

  // Reject Report
  const rejectReport = (reportId: string, reason: string) => {
    ResQStorage.updateReportStatus(reportId, "REJECTED");
    ResQStorage.addAuditLog({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: "REPORT_REJECTED",
      recordType: "REPORT",
      recordId: reportId,
      reason,
    });
    refreshState();
  };

  // Link as duplicate
  const linkReportAsDuplicate = (reportId: string, targetIncidentId: string) => {
    ResQStorage.updateReportStatus(reportId, "LINKED_TO_INCIDENT", targetIncidentId);

    const targetInc = ResQStorage.getIncidentById(targetIncidentId);
    if (targetInc) {
      if (!targetInc.relatedReportIds.includes(reportId)) {
        targetInc.relatedReportIds.push(reportId);
      }
      targetInc.timeline.push({
        id: `EVT-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: `Linked duplicate report ${reportId} to this incident.`,
      });
      ResQStorage.saveIncident(targetInc, currentUser, `Linked duplicate report ${reportId}`);
    }

    refreshState();
  };

  // Update incident status
  const updateIncidentStatus = (id: string, status: IncidentLifecycleStatus, reason?: string) => {
    const inc = ResQStorage.getIncidentById(id);
    if (!inc) return;

    inc.lifecycleStatus = status;
    inc.timeline.push({
      id: `EVT-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: `Status transitioned to: ${status}.`,
      details: reason,
    });

    ResQStorage.saveIncident(inc, currentUser, reason || `Lifecycle updated to ${status}`);
    refreshState();
    if (selectedIncident?.id === id) {
      setSelectedIncident({ ...inc });
    }
  };

  // Update incident severity
  const updateIncidentSeverity = (id: string, severity: IncidentSeverity, reason: string) => {
    const inc = ResQStorage.getIncidentById(id);
    if (!inc) return;

    const prev = inc.severity;
    inc.severity = severity;
    inc.timeline.push({
      id: `EVT-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: `Severity manually updated: ${prev} ➔ ${severity}.`,
      details: reason,
    });

    ResQStorage.saveIncident(inc, currentUser, `Severity changed from ${prev} to ${severity}: ${reason}`);
    refreshState();
    if (selectedIncident?.id === id) {
      setSelectedIncident({ ...inc });
    }
  };

  // Accept AI Triage
  const acceptAITriage = (incidentId: string) => {
    const inc = ResQStorage.getIncidentById(incidentId);
    if (!inc || !inc.aiRecommendation) return;

    inc.aiRecommendation.status = "ACCEPTED";
    inc.aiRecommendation.reviewedBy = `${currentUser.name} (${currentUser.role})`;
    inc.aiRecommendation.reviewedAt = new Date().toISOString();
    inc.severity = inc.aiRecommendation.proposedSeverity;

    inc.timeline.push({
      id: `EVT-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "Approved AI triage recommendation.",
      details: `Set severity to ${inc.severity}.`,
    });

    ResQStorage.saveIncident(inc, currentUser, "Approved AI triage recommendation");
    refreshState();
    if (selectedIncident?.id === incidentId) {
      setSelectedIncident({ ...inc });
    }
  };

  // Override AI Triage
  const overrideAITriage = (incidentId: string, severity: IncidentSeverity, priority: number, reason: string) => {
    const inc = ResQStorage.getIncidentById(incidentId);
    if (!inc || !inc.aiRecommendation) return;

    inc.aiRecommendation.status = "OVERRIDDEN";
    inc.aiRecommendation.reviewedBy = `${currentUser.name} (${currentUser.role})`;
    inc.aiRecommendation.reviewedAt = new Date().toISOString();
    inc.aiRecommendation.overrideReason = reason;
    inc.severity = severity;

    inc.timeline.push({
      id: `EVT-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: `Overrode AI triage recommendation: set to ${severity} (Priority ${priority}).`,
      details: `Reason: ${reason}`,
    });

    ResQStorage.saveIncident(inc, currentUser, `Overrode AI triage: ${reason}`);
    refreshState();
    if (selectedIncident?.id === incidentId) {
      setSelectedIncident({ ...inc });
    }
  };

  // Dispatch Unit
  const dispatchUnit = (incidentId: string, unitId: string, etaMinutes = 10, notes?: string) => {
    const inc = ResQStorage.getIncidentById(incidentId);
    const unit = responders.find((r) => r.id === unitId);
    if (!inc || !unit) return;

    // Simulated route coordinates between unit location and incident location
    const routeCoords: [number, number][] = [
      [unit.currentLat, unit.currentLon],
      [(unit.currentLat + inc.lat) / 2 + 0.005, (unit.currentLon + inc.lon) / 2 - 0.005],
      [inc.lat, inc.lon],
    ];

    const dispatchRecord: DispatchAssignmentRecord = {
      id: `DISP-2026-${Math.floor(500 + Math.random() * 400)}`,
      incidentId,
      unitId,
      assignedAt: new Date().toISOString(),
      assignedBy: `${currentUser.name} (${currentUser.role})`,
      status: "ASSIGNED",
      etaMinutes,
      routeCoordinates: routeCoords,
      notes: notes || `Direct emergency dispatch to ${inc.title}`,
    };

    ResQStorage.addDispatch(dispatchRecord, currentUser);
    refreshState();

    setMapFocusTarget({
      lat: inc.lat,
      lon: inc.lon,
      zoom: 14,
      title: `Dispatched ${unit.callsign} to ${inc.title}`,
    });
  };

  // Update Unit Status
  const updateUnitStatus = (unitId: string, status: ResponderUnitRecord["status"]) => {
    ResQStorage.updateResponderStatus(unitId, status, currentUser);
    refreshState();
  };

  // Allocate Resource
  const allocateResource = (resourceId: string, quantity: number, incidentId: string) => {
    const success = ResQStorage.allocateResource(resourceId, quantity, incidentId, currentUser);
    if (success) refreshState();
    return success;
  };

  // Send message
  const sendMessage = (incidentId: string, text: string, isPriority = false) => {
    const newMsg: IncidentMessageRecord = {
      id: `MSG-${Date.now()}`,
      incidentId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      agency: currentUser.agency,
      messageText: text,
      timestamp: new Date().toISOString(),
      isPriority,
    };
    ResQStorage.sendMessage(newMsg);
    setMessages(ResQStorage.getMessages());
  };

  // Mark Alert Read
  const markAlertRead = (id: string) => {
    ResQStorage.markAlertRead(id);
    setAlerts(ResQStorage.getAlerts(currentUser.role));
  };

  // Simulation Controller: 12-Step Full Lifecycle Demo
  const stepSimulation = () => {
    const step = simulationStep + 1;
    setSimulationStep(step);

    if (step === 1) {
      // Step 1: Citizen submits a disaster report
      submitCitizenReport({
        source: "CITIZEN_APP",
        lat: 19.0760,
        lon: 72.8777,
        locationName: "Kurla West LBS Road, Mumbai",
        category: "Flood / Urban Flood",
        description: "Mithi river surging. Water level reached 3 feet inside residential colonies. 15 seniors trapped.",
        affectedPeopleCount: 25,
        urgentNeeds: ["Rescue Boats", "Medical Evacuation"],
        photoUrls: [],
        reporterName: "Simulated Citizen (Sneha Rao)",
        reporterPhone: "+91 98201 11223",
      });
    } else if (step === 2) {
      // Step 2: Multi-source signal arrives (ERSS 112 call spike)
      submitCitizenReport({
        source: "ERSS_112_CALL",
        lat: 19.0772,
        lon: 72.8790,
        locationName: "Kurla Station Road, Mumbai",
        category: "Flood / Urban Flood",
        description: "112 Call Spike: 18 distress calls reported in 4 minutes. Submerged electrical transformers sparking.",
        affectedPeopleCount: 40,
        urgentNeeds: ["Power Grid Cutoff", "Rescue Boats"],
        photoUrls: [],
        reporterName: "ERSS 112 Gateway Feed",
        reporterPhone: "112-TELECOM",
      });
    } else if (step === 3) {
      // Step 3: Duplicate matching identifies overlap
      const latestReport = reports[0];
      if (latestReport) {
        const matches = detectDuplicates(latestReport, incidents);
        if (matches.length > 0) {
          linkReportAsDuplicate(latestReport.id, matches[0].existingIncidentId);
        }
      }
    } else if (step === 4) {
      // Step 4: AI triage generates recommendation & creates verified incident
      const simInc = createIncident({
        category: "Flood / Urban Flood",
        title: "Flash Flood & Urban Surge — Kurla Mithi Basin",
        description: "Simulated severe urban inundation. Rapid water rise in Kurla West. Ground floors submerged.",
        lat: 19.0760,
        lon: 72.8777,
        locationName: "Kurla West, Mumbai, Maharashtra",
        severity: "CRITICAL",
        lifecycleStatus: "VERIFIED",
        reporterSource: "CITIZEN_APP",
        affectedPeopleEstimate: 35,
        urgentNeeds: ["Rescue Boats", "Medical Evacuation"],
        evidenceUrls: [],
        assignedUnitIds: [],
        relatedReportIds: [],
      });
      setSelectedIncident(simInc);
      setMapFocusTarget({ lat: 19.0760, lon: 72.8777, zoom: 13, title: "Simulated Incident Created" });
    } else if (step === 5) {
      // Step 5: Dispatcher assigns rescue unit
      if (selectedIncident) {
        dispatchUnit(selectedIncident.id, "UNIT-RESCUE-04", 8, "Simulated immediate rescue mission");
      }
    } else if (step === 6) {
      // Step 6: Unit marks En Route
      updateUnitStatus("UNIT-RESCUE-04", "EN ROUTE");
    } else if (step === 7) {
      // Step 7: Unit marks On Scene & submits field observation
      updateUnitStatus("UNIT-RESCUE-04", "ON SCENE");
      if (selectedIncident) {
        sendMessage(selectedIncident.id, "RESCUE-04 ON SCENE: Inflatable rafts launched. 12 residents evacuated safely to dry ground.", true);
      }
    } else if (step === 8) {
      // Step 8: Resource allocation (Medical kits)
      const res = resources.find((r) => r.category === "Rescue Equipment");
      if (res && selectedIncident) {
        allocateResource(res.id, 2, selectedIncident.id);
      }
    } else if (step === 9) {
      // Step 9: Incident resolved
      if (selectedIncident) {
        updateIncidentStatus(selectedIncident.id, "RESOLVED", "All trapped individuals evacuated to relief shelter. Water receding.");
      }
    } else {
      // Reset simulation
      setSimulationRunning(false);
      setSimulationStep(0);
    }
  };

  const startSimulation = () => setSimulationRunning(true);
  const pauseSimulation = () => setSimulationRunning(false);
  const resetSimulation = () => {
    setSimulationRunning(false);
    setSimulationStep(0);
    ResQStorage.resetAll();
    refreshState();
  };

  const unreadAlertCount = alerts.filter((a) => !a.isRead).length;

  return (
    <ResQContext.Provider
      value={{
        currentUser,
        activeRole: currentUser.role,
        roleCategory: getRoleCategory(currentUser.role),
        isAuthenticated,
        switchRole,
        login,
        signup,
        logout,
        allUsers,
        incidents,
        selectedIncident,
        selectIncident: setSelectedIncident,
        createIncident,
        updateIncidentStatus,
        updateIncidentSeverity,
        acceptAITriage,
        overrideAITriage,
        reports,
        submitCitizenReport,
        verifyReport,
        rejectReport,
        linkReportAsDuplicate,
        responders,
        dispatches,
        dispatchUnit,
        updateUnitStatus,
        resources,
        allocateResource,
        infrastructure,
        messages,
        sendMessage,
        alerts,
        unreadAlertCount,
        markAlertRead,
        auditLogs,
        simulationRunning,
        simulationStep,
        startSimulation,
        pauseSimulation,
        stepSimulation,
        resetSimulation,
        mapFocusTarget,
        setMapFocusTarget,
        isOnline,
      }}
    >
      {children}
    </ResQContext.Provider>
  );
}

export function useResQ() {
  const context = useContext(ResQContext);
  if (!context) {
    throw new Error("useResQ must be used within a ResQProvider");
  }
  return context;
}
