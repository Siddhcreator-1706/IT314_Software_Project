import {
  IncidentRecord,
  CitizenReportRecord,
  ResponderUnitRecord,
  DispatchAssignmentRecord,
  ResourceItemRecord,
  InfrastructureRecord,
  IncidentMessageRecord,
  SystemAlertRecord,
  AuditLogRecord,
  UserProfile,
  UserRole,
} from "../types/resq";

const STORAGE_KEYS = {
  CURRENT_USER: "resq_current_user",
  IS_AUTHENTICATED: "resq_is_authenticated",
  REGISTERED_USERS: "resq_registered_users",
  INCIDENTS: "resq_incidents",
  REPORTS: "resq_reports",
  RESPONDERS: "resq_responders",
  DISPATCHES: "resq_dispatches",
  RESOURCES: "resq_resources",
  INFRASTRUCTURE: "resq_infrastructure",
  MESSAGES: "resq_messages",
  ALERTS: "resq_alerts",
  AUDIT_LOGS: "resq_audit_logs",
};

export function getRoleCategory(role: UserRole): "user" | "admin" | "service_provider" {
  if (role === "Public / Citizen") return "user";
  if (
    role === "Command Officer / Incident Commander" ||
    role === "Dispatcher" ||
    role === "System Administrator"
  ) {
    return "admin";
  }
  return "service_provider";
}

export const GUEST_USER: UserProfile = {
  id: "GUEST-000",
  name: "Public Citizen / Guest",
  email: "guest@resq.gov.in",
  role: "Public / Citizen",
  agency: "General Public Visitor",
  phone: "112",
};

// Demo Users for the 8 Roles with default test passwords
export const DEMO_USERS: UserProfile[] = [
  {
    id: "USR-001",
    name: "Dr. Rajesh Sharma",
    email: "commander@resq.gov.in",
    role: "Command Officer / Incident Commander",
    agency: "National Disaster Management Authority (NDMA)",
    badgeNumber: "NDMA-HQ-01",
    phone: "+91 98765 43210",
    password: "admin123password",
  },
  {
    id: "USR-002",
    name: "Priya Nair",
    email: "dispatcher@resq.gov.in",
    role: "Dispatcher",
    agency: "ERSS 112 Emergency Operations Center",
    badgeNumber: "ERSS-OP-44",
    phone: "+91 98765 43211",
    password: "admin123password",
  },
  {
    id: "USR-003",
    name: "Riya Shah",
    email: "medic@resq.gov.in",
    role: "Medic / Ambulance Team",
    agency: "Emergency Medical Services (EMS 108)",
    badgeNumber: "EMS-MED-07",
    phone: "+91 98765 43212",
    assignedUnitCallsign: "AMB-07",
    password: "provider123password",
  },
  {
    id: "USR-004",
    name: "Arjun Patel",
    email: "firefighter@resq.gov.in",
    role: "Firefighter / Fire Service Officer",
    agency: "State Disaster Fire & Rescue Service",
    badgeNumber: "SFS-CMD-17",
    phone: "+91 98765 43213",
    assignedUnitCallsign: "FIRE-17",
    password: "provider123password",
  },
  {
    id: "USR-005",
    name: "Mehul Joshi",
    email: "ndrf@resq.gov.in",
    role: "NDRF / SDRF Team Leader or Responder",
    agency: "8th Battalion NDRF (Rapid Response)",
    badgeNumber: "NDRF-BN8-04",
    phone: "+91 98765 43214",
    assignedUnitCallsign: "RESCUE-04",
    password: "provider123password",
  },
  {
    id: "USR-006",
    name: "Neha Desai",
    email: "logistics@resq.gov.in",
    role: "Logistics Officer",
    agency: "Disaster Relief Supply & Inventory Command",
    badgeNumber: "LOG-SUP-12",
    phone: "+91 98765 43215",
    password: "provider123password",
  },
  {
    id: "USR-000",
    name: "DRCH System Administrator",
    email: "admin@drch.gov.in",
    role: "System Administrator",
    agency: "National Disaster Response Hub (DRCH HQ)",
    badgeNumber: "DRCH-ADM-01",
    phone: "+91 99999 00001",
    password: "Admin@123",
  },
  {
    id: "USR-007",
    name: "Devendra Rao",
    email: "admin@resq.gov.in",
    role: "System Administrator",
    agency: "ISRO / DRCH Technical Operations",
    badgeNumber: "SYS-ADMIN-01",
    phone: "+91 98765 43216",
    password: "admin123password",
  },
  {
    id: "USR-008",
    name: "Ananya Verma",
    email: "citizen@example.com",
    role: "Public / Citizen",
    agency: "Resident / Public Citizen",
    phone: "+91 98765 43217",
    password: "user123password",
  },
];

// Seed Incidents (Strictly matching the 3 supported disaster categories)
export const INITIAL_INCIDENTS: IncidentRecord[] = [
  {
    id: "INC-2026-081",
    category: "Flood / Urban Flood",
    title: "Severe Inundation & Flash Flooding — Wayanad Hill Basin",
    description: "Rapid water rise after 180mm torrential rain in 4 hours. Chaliyar tributary overflow breached containment barriers. 24 families stranded on rooftops near Meppadi road.",
    lat: 11.5542,
    lon: 76.1264,
    locationName: "Meppadi Ward 4, Wayanad, Kerala",
    severity: "CRITICAL",
    lifecycleStatus: "RESPONSE IN PROGRESS",
    detectedAt: "2026-10-12T16:20:00Z",
    updatedAt: "2026-10-12T17:45:00Z",
    reporterSource: "CITIZEN_APP",
    reporterName: "Sunil Kumar",
    reporterPhone: "+91 94471 22334",
    affectedPeopleEstimate: 65,
    urgentNeeds: ["Rescue Boats", "Medical Evacuation", "Drinking Water"],
    evidenceUrls: [],
    assignedUnitIds: ["UNIT-RESCUE-04", "UNIT-MEDIC-07"],
    relatedReportIds: ["REP-2026-101", "REP-2026-102"],
    aiRecommendation: {
      suggestedCategory: "Flood / Urban Flood",
      proposedSeverity: "CRITICAL",
      confidenceScore: 94,
      evidenceSummary: "Multi-modal correlation: 18 citizen distress signals, radar reflectivity >50dBZ, rainfall sensor 182mm, UAV video confirms deep flood currents.",
      risksIdentified: ["Submerged electrical poles", "Fast-moving mud slurry", "Risk of bridge collapse on NH-766 link"],
      affectedPopulationEstimate: 70,
      recommendedPriority: 1,
      suggestedCapabilities: ["High-clearance rescue boat", "Paramedic trauma kit", "Winch-equipped drone"],
      explanation: "Meets NDMA Level-3 flash flood triage criteria. Life-safety hazard imminent due to rapid rising current.",
      missingInformationWarnings: ["Exact count of elderly residents in ground floor houses unconfirmed."],
      status: "ACCEPTED",
      reviewedBy: "Dr. Rajesh Sharma (Commander)",
      reviewedAt: "2026-10-12T16:35:00Z",
    },
    timeline: [
      {
        id: "EVT-01",
        timestamp: "2026-10-12T16:20:00Z",
        actorName: "System",
        actorRole: "System Administrator",
        action: "Citizen report REP-2026-101 promoted to Incident INC-2026-081.",
      },
      {
        id: "EVT-02",
        timestamp: "2026-10-12T16:22:00Z",
        actorName: "ResQ AI Triage",
        actorRole: "System Administrator",
        action: "Generated AI recommendation: CRITICAL priority Level 1.",
      },
      {
        id: "EVT-03",
        timestamp: "2026-10-12T16:35:00Z",
        actorName: "Dr. Rajesh Sharma",
        actorRole: "Command Officer / Incident Commander",
        action: "Approved AI triage recommendation & upgraded priority.",
      },
      {
        id: "EVT-04",
        timestamp: "2026-10-12T16:40:00Z",
        actorName: "Priya Nair",
        actorRole: "Dispatcher",
        action: "Dispatched RESCUE-04 (NDRF boat team) and AMB-07 (EMS Medic).",
      },
    ],
  },
  {
    id: "INC-2026-082",
    category: "Major Urban / Building Fire",
    title: "Commercial Godown & Multistory Fire — Chandni Chowk",
    description: "Multi-alarm structural fire detected in 4-story textile market. Intense smoke plume spreading towards residential apartments. 12 workers reported trapped on 3rd floor terrace.",
    lat: 28.6506,
    lon: 77.2303,
    locationName: "Katra Neel, Chandni Chowk, Delhi",
    severity: "CRITICAL",
    lifecycleStatus: "DISPATCHED",
    detectedAt: "2026-10-12T17:05:00Z",
    updatedAt: "2026-10-12T17:30:00Z",
    reporterSource: "ERSS_112_CALL",
    reporterName: "Rajeev Bansal",
    reporterPhone: "+91 98110 55442",
    affectedPeopleEstimate: 28,
    urgentNeeds: ["Water Tenders", "Hydraulic Platform", "Burn Trauma Kits"],
    evidenceUrls: [],
    assignedUnitIds: ["UNIT-FIRE-17"],
    relatedReportIds: ["REP-2026-103"],
    aiRecommendation: {
      suggestedCategory: "Major Urban / Building Fire",
      proposedSeverity: "CRITICAL",
      confidenceScore: 91,
      evidenceSummary: "112 telecom call volume spike (14 calls in 3 mins from Katra Neel tower sector), thermal sensor confirms combustion heat signature.",
      risksIdentified: ["Narrow alleys impede large fire tenders", "Secondary chemical explosion hazard from synthetic fabric dyes"],
      affectedPopulationEstimate: 30,
      recommendedPriority: 1,
      suggestedCapabilities: ["High-pressure mist tender", "Compressed air breathing apparatus", "Aerial ladder platform"],
      explanation: "Dense urban heritage commercial zone with high combustible fuel load.",
      missingInformationWarnings: ["Water hydrant pressure on Main Chandni Chowk road fluctuating."],
      status: "ACCEPTED",
      reviewedBy: "Dr. Rajesh Sharma",
      reviewedAt: "2026-10-12T17:10:00Z",
    },
    timeline: [
      {
        id: "EVT-10",
        timestamp: "2026-10-12T17:05:00Z",
        actorName: "ERSS 112 Gateway",
        actorRole: "Dispatcher",
        action: "Incoming 112 emergency call spike triaged.",
      },
      {
        id: "EVT-11",
        timestamp: "2026-10-12T17:15:00Z",
        actorName: "Priya Nair",
        actorRole: "Dispatcher",
        action: "Assigned FIRE-17 (Delhi Fire Service Tender) with ETA 8 mins.",
      },
    ],
  },
  {
    id: "INC-2026-083",
    category: "Cyclone / Coastal Flooding",
    title: "Cyclone Impact & Coastal Sea Surge — Paradip Port Coastal Sector",
    description: "Deep depression intensified into severe cyclonic storm. Wind gusts exceeding 105 km/h. Sea waves overtopping coastal embankment by 1.5 meters, inundating 3 fishing hamlets.",
    lat: 20.2644,
    lon: 86.6712,
    locationName: "Nehru Bangla Coastal Belt, Paradip, Odisha",
    severity: "HIGH",
    lifecycleStatus: "VERIFIED",
    detectedAt: "2026-10-12T15:10:00Z",
    updatedAt: "2026-10-12T17:10:00Z",
    reporterSource: "DRONE_UAV",
    reporterName: "Coast Guard Air Recon",
    affectedPeopleEstimate: 210,
    urgentNeeds: ["Cyclone Shelter Evacuation", "High-Mast Emergency Lighting", "Temporary Food Packets"],
    evidenceUrls: [],
    assignedUnitIds: ["UNIT-DRONE-03"],
    relatedReportIds: ["REP-2026-104"],
    aiRecommendation: {
      suggestedCategory: "Cyclone / Coastal Flooding",
      proposedSeverity: "HIGH",
      confidenceScore: 89,
      evidenceSummary: "IMD Doppler radar echo velocity match + UAV footage reveals seawater intrusion in Sandhakud settlement.",
      risksIdentified: ["Power grid severed", "Saltwater contamination of borewells"],
      affectedPopulationEstimate: 220,
      recommendedPriority: 2,
      suggestedCapabilities: ["Amphibious troop carrier", "Satellite communication SATPHONE", "Packaged dry ration kits"],
      explanation: "Evacuation priority to cyclone shelter #4 required before high tide peak.",
      missingInformationWarnings: ["Fishermen country boat mooring integrity not verified."],
      status: "ACCEPTED",
      reviewedBy: "Dr. Rajesh Sharma",
      reviewedAt: "2026-10-12T15:30:00Z",
    },
    timeline: [
      {
        id: "EVT-20",
        timestamp: "2026-10-12T15:10:00Z",
        actorName: "UAV Recon Team",
        actorRole: "NDRF / SDRF Team Leader or Responder",
        action: "Aerial video verified 1.5m sea surge overtopping coastal wall.",
      },
      {
        id: "EVT-21",
        timestamp: "2026-10-12T15:40:00Z",
        actorName: "Neha Desai",
        actorRole: "Logistics Officer",
        action: "Allocated 500 food packets and 4 water purifier units to Paradip Shelter #4.",
      },
    ],
  },
];

// Seed Citizen Reports (Queue for simulated sources)
export const INITIAL_REPORTS: CitizenReportRecord[] = [
  {
    id: "REP-2026-101",
    source: "CITIZEN_APP",
    submittedAt: "2026-10-12T16:15:00Z",
    lat: 11.5539,
    lon: 76.1261,
    locationName: "Meppadi Junction, Wayanad",
    category: "Flood / Urban Flood",
    description: "Water has reached 1st floor window level. 8 of us are stuck on roof. Need immediate boat assistance.",
    affectedPeopleCount: 8,
    urgentNeeds: ["Rescue Boats", "Medical Evacuation"],
    photoUrls: [],
    reporterName: "Sunil Kumar",
    reporterPhone: "+91 94471 22334",
    verificationStatus: "VERIFIED",
    linkedIncidentId: "INC-2026-081",
    confidenceScore: 95,
  },
  {
    id: "REP-2026-102",
    source: "SOCIAL_MEDIA",
    submittedAt: "2026-10-12T16:18:00Z",
    lat: 11.5545,
    lon: 76.1270,
    locationName: "Meppadi School Road, Wayanad",
    category: "Flood / Urban Flood",
    description: "SOS! Elderly diabetic patient stranded without insulin near St. Joseph School in Meppadi.",
    affectedPeopleCount: 4,
    urgentNeeds: ["Medical Evacuation", "Drinking Water"],
    photoUrls: [],
    reporterName: "Twitter/X @wayanad_updates",
    reporterPhone: "N/A",
    verificationStatus: "VERIFIED",
    linkedIncidentId: "INC-2026-081",
    confidenceScore: 88,
  },
  {
    id: "REP-2026-103",
    source: "ERSS_112_CALL",
    submittedAt: "2026-10-12T17:02:00Z",
    lat: 28.6504,
    lon: 77.2301,
    locationName: "Katra Neel, Chandni Chowk, Delhi",
    category: "Major Urban / Building Fire",
    description: "Huge black smoke coming out from textile warehouse basement. Loud crackling sounds. Need fire engines.",
    affectedPeopleCount: 15,
    urgentNeeds: ["Water Tenders", "Hydraulic Platform"],
    photoUrls: [],
    reporterName: "Rajeev Bansal",
    reporterPhone: "+91 98110 55442",
    verificationStatus: "VERIFIED",
    linkedIncidentId: "INC-2026-082",
    confidenceScore: 92,
  },
  {
    id: "REP-2026-104",
    source: "DRONE_UAV",
    submittedAt: "2026-10-12T15:05:00Z",
    lat: 20.2640,
    lon: 86.6705,
    locationName: "Sandhakud Fishing Colony, Paradip",
    category: "Cyclone / Coastal Flooding",
    description: "Aerial optical camera observes seawater flooding thatched houses. Approx 50 thatched units partially submerged.",
    affectedPeopleCount: 120,
    urgentNeeds: ["Cyclone Shelter Evacuation"],
    photoUrls: [],
    reporterName: "UAV Drone 03 Sensor",
    reporterPhone: "INTERNAL-TELEMETRY",
    verificationStatus: "VERIFIED",
    linkedIncidentId: "INC-2026-083",
    confidenceScore: 96,
  },
  {
    id: "REP-2026-105",
    source: "CITIZEN_APP",
    submittedAt: "2026-10-12T17:40:00Z",
    lat: 19.0760,
    lon: 72.8777,
    locationName: "Kurla West LBS Road, Mumbai",
    category: "Flood / Urban Flood",
    description: "Mithi river water level rising near railway bridge. Water logged up to 2.5 feet on roadway, buses stalled.",
    affectedPeopleCount: 40,
    urgentNeeds: ["Rescue Boats", "Traffic Diversion"],
    photoUrls: [],
    reporterName: "Kunal Shinde",
    reporterPhone: "+91 98200 44119",
    verificationStatus: "PENDING",
    confidenceScore: 78,
  },
  {
    id: "REP-2026-106",
    source: "SOCIAL_MEDIA",
    submittedAt: "2026-10-12T17:42:00Z",
    lat: 28.6510,
    lon: 77.2310,
    locationName: "Chandni Chowk Market, Delhi",
    category: "Major Urban / Building Fire",
    description: "Fire visible from metro station gate 3! Huge crowds panicking, fire trucks struggling to enter narrow road.",
    affectedPeopleCount: 20,
    urgentNeeds: ["Water Tenders", "Police Crowd Control"],
    photoUrls: [],
    reporterName: "Insta @delhi_live",
    reporterPhone: "N/A",
    verificationStatus: "PENDING",
    confidenceScore: 84,
  },
];

// Seed Responders and Units
export const INITIAL_RESPONDERS: ResponderUnitRecord[] = [
  {
    id: "UNIT-MEDIC-07",
    callsign: "AMB-07",
    personnelName: "Riya Shah",
    role: "Medic / Ambulance Team",
    agency: "Emergency Medical Services (EMS 108)",
    status: "EN ROUTE",
    currentLat: 11.5600,
    currentLon: 76.1350,
    assignedIncidentId: "INC-2026-081",
    capabilities: ["Advanced Life Support (ALS)", "Defibrillator", "Oxygen", "Pediatric Trauma"],
    vehicleType: "4x4 High-Clearance Ambulance",
    phone: "+91 98765 43212",
    speedKmH: 45,
  },
  {
    id: "UNIT-FIRE-17",
    callsign: "FIRE-17",
    personnelName: "Arjun Patel",
    role: "Firefighter / Fire Service Officer",
    agency: "Delhi Fire Service (HQ Connaught Place)",
    status: "EN ROUTE",
    currentLat: 28.6410,
    currentLon: 77.2250,
    assignedIncidentId: "INC-2026-082",
    capabilities: ["High-Pressure Water Cannon", "Hydraulic Platform (32m)", "Thermal Camera", "Foam Compound"],
    vehicleType: "Heavy Water Tender (8000L)",
    phone: "+91 98765 43213",
    speedKmH: 35,
  },
  {
    id: "UNIT-RESCUE-04",
    callsign: "RESCUE-04",
    personnelName: "Mehul Joshi",
    role: "NDRF / SDRF Team Leader or Responder",
    agency: "8th Battalion NDRF (Rapid Response)",
    status: "ON SCENE",
    currentLat: 11.5542,
    currentLon: 76.1264,
    assignedIncidentId: "INC-2026-081",
    capabilities: ["Inflatable Motor Boats (OPE)", "Swift Water Rescue Divers", "Life Jackets", "Chainsaws"],
    vehicleType: "All-Terrain Rescue Carrier + 3 Boats",
    phone: "+91 98765 43214",
    speedKmH: 0,
  },
  {
    id: "UNIT-DRONE-03",
    callsign: "DRONE-03",
    personnelName: "Vikram Solanki",
    role: "NDRF / SDRF Team Leader or Responder",
    agency: "Coast Guard Drone Recon Unit",
    status: "ON SCENE",
    currentLat: 20.2644,
    currentLon: 86.6712,
    assignedIncidentId: "INC-2026-083",
    capabilities: ["Thermal FLIR Camera", "4K Optical Zoom (30x)", "Megaphone Loudspeaker", "Drop Payload"],
    vehicleType: "Heavy-Lift Hexacopter Drone",
    phone: "+91 98765 43299",
    speedKmH: 55,
  },
  {
    id: "UNIT-LOG-12",
    callsign: "LOG-12",
    personnelName: "Neha Desai",
    role: "Logistics Officer",
    agency: "Disaster Relief Supply & Inventory Command",
    status: "AVAILABLE",
    currentLat: 11.6000,
    currentLon: 76.1500,
    capabilities: ["Mobile Water Filtration (1000L/hr)", "50 KVA Diesel Generator", "Emergency Blankets"],
    vehicleType: "Heavy Logistics Supply Truck",
    phone: "+91 98765 43215",
  },
];

// Seed Dispatches
export const INITIAL_DISPATCHES: DispatchAssignmentRecord[] = [
  {
    id: "DISP-2026-501",
    incidentId: "INC-2026-081",
    unitId: "UNIT-MEDIC-07",
    assignedAt: "2026-10-12T16:40:00Z",
    assignedBy: "Priya Nair (Dispatcher)",
    status: "EN ROUTE",
    etaMinutes: 12,
    routeCoordinates: [
      [11.5850, 76.1480],
      [11.5740, 76.1410],
      [11.5650, 76.1360],
      [11.5600, 76.1350],
      [11.5542, 76.1264],
    ],
    notes: "Approach via Vythiri bypass, main bridge submerged. Coordinated with NDRF RESCUE-04 on channel 4.",
  },
  {
    id: "DISP-2026-502",
    incidentId: "INC-2026-082",
    unitId: "UNIT-FIRE-17",
    assignedAt: "2026-10-12T17:15:00Z",
    assignedBy: "Priya Nair (Dispatcher)",
    status: "EN ROUTE",
    etaMinutes: 7,
    routeCoordinates: [
      [28.6328, 77.2197],
      [28.6410, 77.2250],
      [28.6465, 77.2280],
      [28.6506, 77.2303],
    ],
    notes: "Traffic police clearing Netaji Subhash Marg green corridor. Enter from Nai Sarak side.",
  },
];

// Seed Resources
export const INITIAL_RESOURCES: ResourceItemRecord[] = [
  {
    id: "RES-01",
    name: "Advanced Life Support (ALS) Ambulances",
    category: "Ambulance",
    totalStock: 18,
    allocatedStock: 6,
    availableStock: 12,
    unit: "vehicles",
    criticalThreshold: 4,
    warehouseLocation: "Central Emergency Motor Pool, Kozhikode",
  },
  {
    id: "RES-02",
    name: "Heavy Foam & Water Crash Tenders",
    category: "Fire Engine",
    totalStock: 24,
    allocatedStock: 9,
    availableStock: 15,
    unit: "vehicles",
    criticalThreshold: 5,
    warehouseLocation: "Delhi Fire Service Central Depot",
  },
  {
    id: "RES-03",
    name: "Rigid Inflatable Rescue Boats (RIB)",
    category: "Rescue Equipment",
    totalStock: 30,
    allocatedStock: 14,
    availableStock: 16,
    unit: "boats",
    criticalThreshold: 6,
    warehouseLocation: "NDRF Regional Water Depot, Arakkonam",
  },
  {
    id: "RES-04",
    name: "Emergency Trauma & Burn First-Aid Kits",
    category: "Medical Supplies",
    totalStock: 450,
    allocatedStock: 180,
    availableStock: 270,
    unit: "kits",
    criticalThreshold: 50,
    warehouseLocation: "Red Cross Disaster Depot, New Delhi",
  },
  {
    id: "RES-05",
    name: "Ready-To-Eat Emergency Ration Meals (MRE)",
    category: "Food and Water",
    totalStock: 12000,
    allocatedStock: 4500,
    availableStock: 7500,
    unit: "packets",
    criticalThreshold: 1000,
    warehouseLocation: "Odisha State Civil Supplies Depot, Cuttack",
  },
  {
    id: "RES-06",
    name: "Thermal Surveillance Hexacopter Drones",
    category: "Drones",
    totalStock: 12,
    allocatedStock: 5,
    availableStock: 7,
    unit: "units",
    criticalThreshold: 2,
    warehouseLocation: "ISRO Disaster Support Depot, Hyderabad",
  },
  {
    id: "RES-07",
    name: "Emergency Diesel (High Octane for Gensets/Boats)",
    category: "Fuel",
    totalStock: 25000,
    allocatedStock: 8000,
    availableStock: 17000,
    unit: "litres",
    criticalThreshold: 3000,
    warehouseLocation: "IOCL Reserve Fuel Terminal, Kochi",
  },
];

// Seed Infrastructure
export const INITIAL_INFRASTRUCTURE: InfrastructureRecord[] = [
  {
    id: "INFRA-01",
    type: "HOSPITAL",
    name: "Wayanad Government District Hospital",
    lat: 11.6050,
    lon: 76.0820,
    address: "Mananthavady, Wayanad, Kerala",
    totalCapacity: 350,
    currentOccupancy: 280,
    availableBeds: 70,
    icuAvailable: 14,
    contactNumber: "+91 4935 240223",
    status: "OPERATIONAL",
    notes: "Emergency burn/trauma triage ward active. Blood bank stocked.",
  },
  {
    id: "INFRA-02",
    type: "HOSPITAL",
    name: "Lok Nayak Jai Prakash (LNJP) Hospital",
    lat: 28.6385,
    lon: 77.2422,
    address: "Jawaharlal Nehru Marg, Delhi Gate, Delhi",
    totalCapacity: 2000,
    currentOccupancy: 1750,
    availableBeds: 250,
    icuAvailable: 38,
    contactNumber: "+91 11 2323 3000",
    status: "OPERATIONAL",
    notes: "Designated burn trauma referral center for Chandni Chowk incident.",
  },
  {
    id: "INFRA-03",
    type: "SHELTER",
    name: "Meppadi Higher Secondary School Relief Camp",
    lat: 11.5580,
    lon: 76.1310,
    address: "School Road, Meppadi, Wayanad",
    totalCapacity: 400,
    currentOccupancy: 310,
    contactNumber: "+91 94470 11223",
    status: "OPERATIONAL",
    notes: "Has potable water, emergency kitchen, and female privacy enclosure.",
  },
  {
    id: "INFRA-04",
    type: "SHELTER",
    name: "Paradip Multi-Purpose Cyclone Shelter #4",
    lat: 20.2710,
    lon: 86.6620,
    address: "Near Port Township, Paradip, Odisha",
    totalCapacity: 1200,
    currentOccupancy: 680,
    contactNumber: "+91 6722 222105",
    status: "OPERATIONAL",
    notes: "Concrete reinforced, solar backup, high ground 12m above sea level.",
  },
  {
    id: "INFRA-05",
    type: "FIRE_STATION",
    name: "Connaught Circus Fire Station",
    lat: 28.6328,
    lon: 77.2197,
    address: "Connaught Place, New Delhi",
    contactNumber: "+91 11 2341 2222",
    status: "OPERATIONAL",
    notes: "Base for FIRE-17 unit.",
  },
  {
    id: "INFRA-06",
    type: "BLOCKED_ROAD",
    name: "Meppadi-Chooralmala Link Bridge (Submerged)",
    lat: 11.5500,
    lon: 76.1220,
    address: "State Highway 59, Meppadi, Wayanad",
    contactNumber: "+91 4936 1077",
    status: "HAZARD_BLOCKED",
    notes: "Water flowing 0.8m over bridge deck. All vehicular movement prohibited.",
  },
  {
    id: "INFRA-07",
    type: "BLOCKED_ROAD",
    name: "Nai Sarak Congestion & Fire Hose Line Block",
    lat: 28.6480,
    lon: 77.2290,
    address: "Nai Sarak, Chandni Chowk, Delhi",
    contactNumber: "+91 11 1095",
    status: "HAZARD_BLOCKED",
    notes: "Dual 150mm water feeder lines laid across road. Emergency vehicles only.",
  },
];

// Seed Messages
export const INITIAL_MESSAGES: IncidentMessageRecord[] = [
  {
    id: "MSG-01",
    incidentId: "INC-2026-081",
    senderId: "USR-001",
    senderName: "Dr. Rajesh Sharma",
    senderRole: "Command Officer / Incident Commander",
    agency: "NDMA HQ",
    messageText: "Priority 1 established for Wayanad rooftop evacuations. All units maintain radio check on Channel 4.",
    timestamp: "2026-10-12T16:38:00Z",
    isPriority: true,
  },
  {
    id: "MSG-02",
    incidentId: "INC-2026-081",
    senderId: "USR-005",
    senderName: "Mehul Joshi",
    senderRole: "NDRF / SDRF Team Leader or Responder",
    agency: "8th Bn NDRF",
    messageText: "RESCUE-04 deployed 2 Inflatable boats into Ward 4. Rescued first family of 5 from terrace. Evacuating to Meppadi camp.",
    timestamp: "2026-10-12T16:55:00Z",
    isPriority: false,
    locationRef: { lat: 11.5542, lon: 76.1264, label: "Ward 4 Rooftop" },
  },
  {
    id: "MSG-03",
    incidentId: "INC-2026-081",
    senderId: "USR-003",
    senderName: "Riya Shah",
    senderRole: "Medic / Ambulance Team",
    agency: "EMS 108",
    messageText: "AMB-07 standing by at school relief camp staging ground. Prepared for hypothermia and trauma triage.",
    timestamp: "2026-10-12T17:05:00Z",
    isPriority: false,
  },
  {
    id: "MSG-04",
    incidentId: "INC-2026-082",
    senderId: "USR-004",
    senderName: "Arjun Patel",
    senderRole: "Firefighter / Fire Service Officer",
    agency: "Delhi Fire Service",
    messageText: "FIRE-17 on scene. Water tender connected to street booster. Setting up high-pressure foam on east flank.",
    timestamp: "2026-10-12T17:28:00Z",
    isPriority: true,
  },
];

// Seed Alerts
export const INITIAL_ALERTS: SystemAlertRecord[] = [
  {
    id: "ALT-01",
    type: "CRITICAL_SEVERITY",
    severity: "CRITICAL",
    title: "Flash Flood Alert — Wayanad Level 3",
    description: "Rapid water level spike in Chaliyar basin. 24 rooftop rescues underway. NDRF & EMS dispatched.",
    timestamp: "2026-10-12T16:20:00Z",
    isRead: false,
    relatedIncidentId: "INC-2026-081",
    isPublic: true,
    targetRoles: [
      "Public / Citizen",
      "Command Officer / Incident Commander",
      "Dispatcher",
      "NDRF / SDRF Team Leader or Responder",
      "Medic / Ambulance Team",
    ],
  },
  {
    id: "ALT-02",
    type: "CRITICAL_SEVERITY",
    severity: "CRITICAL",
    title: "Structural Commercial Fire — Chandni Chowk",
    description: "Multi-alarm fire at Katra Neel. Smoke plume hazard. Avoid Nai Sarak and Main Road.",
    timestamp: "2026-10-12T17:05:00Z",
    isRead: false,
    relatedIncidentId: "INC-2026-082",
    isPublic: true,
    targetRoles: [
      "Public / Citizen",
      "Command Officer / Incident Commander",
      "Dispatcher",
      "Firefighter / Fire Service Officer",
      "Medic / Ambulance Team",
    ],
  },
  {
    id: "ALT-03",
    type: "BLOCKED_ROAD",
    severity: "WARNING",
    title: "Road Inundation — Meppadi-Chooralmala Bridge",
    description: "Bridge deck submerged by flood torrents. Emergency vehicles diverting via Vythiri bypass.",
    timestamp: "2026-10-12T16:45:00Z",
    isRead: false,
    relatedIncidentId: "INC-2026-081",
    isPublic: true,
    targetRoles: [
      "Public / Citizen",
      "Dispatcher",
      "Medic / Ambulance Team",
      "Logistics Officer",
    ],
  },
  {
    id: "ALT-04",
    type: "RESOURCE_SHORTAGE",
    severity: "WARNING",
    title: "Rescue Boat Stock Warning (NDRF Depot)",
    description: "Inflatable RIB boat availability reached 16 units remaining across southern sector.",
    timestamp: "2026-10-12T17:15:00Z",
    isRead: false,
    isPublic: false,
    targetRoles: ["Command Officer / Incident Commander", "Logistics Officer"],
  },
];

// Seed Audit Logs
export const INITIAL_AUDIT_LOGS: AuditLogRecord[] = [
  {
    id: "AUD-01",
    timestamp: "2026-10-12T16:20:00Z",
    userId: "SYSTEM",
    userName: "ResQ Automated Gateway",
    userRole: "System Administrator",
    action: "INCIDENT_CREATED",
    recordType: "INCIDENT",
    recordId: "INC-2026-081",
    newValue: "Category: Flood / Urban Flood, Severity: CRITICAL",
    reason: "Promoted from verified Citizen Report REP-2026-101",
  },
  {
    id: "AUD-02",
    timestamp: "2026-10-12T16:35:00Z",
    userId: "USR-001",
    userName: "Dr. Rajesh Sharma",
    userRole: "Command Officer / Incident Commander",
    action: "AI_TRIAGE_APPROVED",
    recordType: "AI_TRIAGE",
    recordId: "INC-2026-081",
    previousValue: "PENDING_REVIEW",
    newValue: "ACCEPTED",
    reason: "Confirmed rooftop life hazard aligns with UAV footage.",
  },
  {
    id: "AUD-03",
    timestamp: "2026-10-12T16:40:00Z",
    userId: "USR-002",
    userName: "Priya Nair",
    userRole: "Dispatcher",
    action: "UNIT_DISPATCHED",
    recordType: "DISPATCH",
    recordId: "DISP-2026-501",
    newValue: "Unit: AMB-07, ETA: 12 min",
    reason: "Dispatched to Meppadi School staging ground for casualty intake.",
  },
];

// Safe LocalStorage Service with in-memory fallback
class ResQStorageService {
  private getItem<T>(key: string, defaultValue: T): T {
    if (typeof window === "undefined") return defaultValue;
    try {
      const item = localStorage.getItem(key);
      if (!item) {
        localStorage.setItem(key, JSON.stringify(defaultValue));
        return defaultValue;
      }
      return JSON.parse(item);
    } catch (e) {
      console.warn(`LocalStorage read failed for ${key}:`, e);
      return defaultValue;
    }
  }

  private setItem<T>(key: string, value: T): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`LocalStorage write failed for ${key}:`, e);
    }
  }

  // Current Authenticated User & Role
  getCurrentUser(): UserProfile {
    return this.getItem<UserProfile>(STORAGE_KEYS.CURRENT_USER, GUEST_USER);
  }

  setCurrentUser(user: UserProfile): void {
    this.setItem(STORAGE_KEYS.CURRENT_USER, user);
  }

  isAuthenticated(): boolean {
    return this.getItem<boolean>(STORAGE_KEYS.IS_AUTHENTICATED, false);
  }

  setAuthenticated(val: boolean): void {
    this.setItem(STORAGE_KEYS.IS_AUTHENTICATED, val);
  }

  getRegisteredUsers(): UserProfile[] {
    return this.getItem<UserProfile[]>(STORAGE_KEYS.REGISTERED_USERS, DEMO_USERS);
  }

  saveRegisteredUser(user: UserProfile): void {
    const list = this.getRegisteredUsers();
    const idx = list.findIndex(
      (u) => u.email.toLowerCase() === user.email.toLowerCase() || u.id === user.id
    );
    if (idx >= 0) {
      list[idx] = user;
    } else {
      list.push(user);
    }
    this.setItem(STORAGE_KEYS.REGISTERED_USERS, list);
  }

  // Incidents CRUD
  getIncidents(): IncidentRecord[] {
    return this.getItem<IncidentRecord[]>(STORAGE_KEYS.INCIDENTS, INITIAL_INCIDENTS);
  }

  getIncidentById(id: string): IncidentRecord | undefined {
    return this.getIncidents().find((inc) => inc.id === id);
  }

  saveIncident(incident: IncidentRecord, actor: UserProfile, reason?: string): void {
    const list = this.getIncidents();
    const index = list.findIndex((i) => i.id === incident.id);
    let previousState: string | undefined = undefined;

    if (index >= 0) {
      previousState = `Status: ${list[index].lifecycleStatus}, Severity: ${list[index].severity}`;
      list[index] = { ...incident, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(incident);
    }

    this.setItem(STORAGE_KEYS.INCIDENTS, list);

    // Record in Audit Log
    this.addAuditLog({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: index >= 0 ? "INCIDENT_UPDATED" : "INCIDENT_CREATED",
      recordType: "INCIDENT",
      recordId: incident.id,
      previousValue: previousState,
      newValue: `Status: ${incident.lifecycleStatus}, Severity: ${incident.severity}`,
      reason: reason || "Operational update",
    });
  }

  // Citizen Reports CRUD
  getReports(): CitizenReportRecord[] {
    return this.getItem<CitizenReportRecord[]>(STORAGE_KEYS.REPORTS, INITIAL_REPORTS);
  }

  addReport(report: CitizenReportRecord): void {
    const reports = this.getReports();
    reports.unshift(report);
    this.setItem(STORAGE_KEYS.REPORTS, reports);

    // Emit System Alert for Dispatchers & Commanders
    this.addAlert({
      id: `ALT-${Date.now()}`,
      type: "NEW_INCIDENT",
      severity: "WARNING",
      title: `New Emergency Report: ${report.category}`,
      description: `Report ${report.id} received from ${report.locationName}. Population: ~${report.affectedPeopleCount}.`,
      timestamp: new Date().toISOString(),
      isRead: false,
      isPublic: false,
      targetRoles: [
        "Command Officer / Incident Commander",
        "Dispatcher",
      ],
    });
  }

  updateReportStatus(reportId: string, status: CitizenReportRecord["verificationStatus"], linkedIncidentId?: string): void {
    const reports = this.getReports();
    const idx = reports.findIndex((r) => r.id === reportId);
    if (idx >= 0) {
      reports[idx].verificationStatus = status;
      if (linkedIncidentId) reports[idx].linkedIncidentId = linkedIncidentId;
      this.setItem(STORAGE_KEYS.REPORTS, reports);
    }
  }

  // Responders CRUD
  getResponders(): ResponderUnitRecord[] {
    return this.getItem<ResponderUnitRecord[]>(STORAGE_KEYS.RESPONDERS, INITIAL_RESPONDERS);
  }

  updateResponderStatus(unitId: string, status: ResponderUnitRecord["status"], actor: UserProfile, incidentId?: string): void {
    const list = this.getResponders();
    const idx = list.findIndex((u) => u.id === unitId);
    if (idx >= 0) {
      const prev = list[idx].status;
      list[idx].status = status;
      if (incidentId !== undefined) list[idx].assignedIncidentId = incidentId;
      this.setItem(STORAGE_KEYS.RESPONDERS, list);

      this.addAuditLog({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        action: "UNIT_STATUS_CHANGED",
        recordType: "DISPATCH",
        recordId: unitId,
        previousValue: `Status: ${prev}`,
        newValue: `Status: ${status}`,
        reason: "Field mission transition",
      });
    }
  }

  // Dispatches
  getDispatches(): DispatchAssignmentRecord[] {
    return this.getItem<DispatchAssignmentRecord[]>(STORAGE_KEYS.DISPATCHES, INITIAL_DISPATCHES);
  }

  addDispatch(dispatch: DispatchAssignmentRecord, actor: UserProfile): void {
    const list = this.getDispatches();
    list.unshift(dispatch);
    this.setItem(STORAGE_KEYS.DISPATCHES, list);

    // Update Unit status to ASSIGNED / EN ROUTE
    this.updateResponderStatus(dispatch.unitId, "EN ROUTE", actor, dispatch.incidentId);

    // Update Incident assigned units
    const incident = this.getIncidentById(dispatch.incidentId);
    if (incident) {
      if (!incident.assignedUnitIds.includes(dispatch.unitId)) {
        incident.assignedUnitIds.push(dispatch.unitId);
      }
      if (incident.lifecycleStatus === "VERIFIED" || incident.lifecycleStatus === "NEW REPORT") {
        incident.lifecycleStatus = "DISPATCHED";
      }
      incident.timeline.push({
        id: `EVT-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorName: actor.name,
        actorRole: actor.role,
        action: `Assigned unit ${dispatch.unitId} (ETA ${dispatch.etaMinutes} min).`,
      });
      this.saveIncident(incident, actor, "Unit assigned");
    }

    this.addAuditLog({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "DISPATCH_CREATED",
      recordType: "DISPATCH",
      recordId: dispatch.id,
      newValue: `Unit: ${dispatch.unitId} -> Incident: ${dispatch.incidentId}`,
    });
  }

  // Resources
  getResources(): ResourceItemRecord[] {
    return this.getItem<ResourceItemRecord[]>(STORAGE_KEYS.RESOURCES, INITIAL_RESOURCES);
  }

  allocateResource(resourceId: string, quantity: number, incidentId: string, actor: UserProfile): boolean {
    const list = this.getResources();
    const idx = list.findIndex((r) => r.id === resourceId);
    if (idx < 0) return false;

    if (list[idx].availableStock < quantity) return false;

    list[idx].allocatedStock += quantity;
    list[idx].availableStock -= quantity;
    this.setItem(STORAGE_KEYS.RESOURCES, list);

    this.addAuditLog({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "RESOURCE_ALLOCATED",
      recordType: "RESOURCE",
      recordId: resourceId,
      newValue: `Allocated ${quantity} ${list[idx].unit} to ${incidentId}. Remaining: ${list[idx].availableStock}`,
    });

    if (list[idx].availableStock <= list[idx].criticalThreshold) {
      this.addAlert({
        id: `ALT-${Date.now()}`,
        type: "RESOURCE_SHORTAGE",
        severity: "CRITICAL",
        title: `Low Stock Alert: ${list[idx].name}`,
        description: `Available inventory is critically low (${list[idx].availableStock} ${list[idx].unit} remaining at ${list[idx].warehouseLocation}).`,
        timestamp: new Date().toISOString(),
        isRead: false,
        isPublic: false,
        targetRoles: ["Command Officer / Incident Commander", "Logistics Officer"],
      });
    }

    return true;
  }

  // Infrastructure
  getInfrastructure(): InfrastructureRecord[] {
    return this.getItem<InfrastructureRecord[]>(STORAGE_KEYS.INFRASTRUCTURE, INITIAL_INFRASTRUCTURE);
  }

  // Messages
  getMessages(incidentId?: string): IncidentMessageRecord[] {
    const all = this.getItem<IncidentMessageRecord[]>(STORAGE_KEYS.MESSAGES, INITIAL_MESSAGES);
    if (incidentId) {
      return all.filter((m) => m.incidentId === incidentId);
    }
    return all;
  }

  sendMessage(msg: IncidentMessageRecord): void {
    const list = this.getMessages();
    list.push(msg);
    this.setItem(STORAGE_KEYS.MESSAGES, list);
  }

  // Alerts
  getAlerts(forRole?: UserRole): SystemAlertRecord[] {
    const all = this.getItem<SystemAlertRecord[]>(STORAGE_KEYS.ALERTS, INITIAL_ALERTS);
    if (forRole) {
      return all.filter((a) => a.isPublic || a.targetRoles.includes(forRole));
    }
    return all;
  }

  addAlert(alert: SystemAlertRecord): void {
    const list = this.getItem<SystemAlertRecord[]>(STORAGE_KEYS.ALERTS, INITIAL_ALERTS);
    list.unshift(alert);
    this.setItem(STORAGE_KEYS.ALERTS, list);
  }

  markAlertRead(id: string): void {
    const list = this.getItem<SystemAlertRecord[]>(STORAGE_KEYS.ALERTS, INITIAL_ALERTS);
    const idx = list.findIndex((a) => a.id === id);
    if (idx >= 0) {
      list[idx].isRead = true;
      this.setItem(STORAGE_KEYS.ALERTS, list);
    }
  }

  // Audit Logs
  getAuditLogs(): AuditLogRecord[] {
    return this.getItem<AuditLogRecord[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
  }

  addAuditLog(entry: AuditLogRecord): void {
    const list = this.getAuditLogs();
    list.unshift(entry);
    this.setItem(STORAGE_KEYS.AUDIT_LOGS, list.slice(0, 200)); // cap at 200
  }

  // Reset demo state
  resetAll(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEYS.INCIDENTS);
    localStorage.removeItem(STORAGE_KEYS.REPORTS);
    localStorage.removeItem(STORAGE_KEYS.RESPONDERS);
    localStorage.removeItem(STORAGE_KEYS.DISPATCHES);
    localStorage.removeItem(STORAGE_KEYS.RESOURCES);
    localStorage.removeItem(STORAGE_KEYS.INFRASTRUCTURE);
    localStorage.removeItem(STORAGE_KEYS.MESSAGES);
    localStorage.removeItem(STORAGE_KEYS.ALERTS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
}

export const ResQStorage = new ResQStorageService();
