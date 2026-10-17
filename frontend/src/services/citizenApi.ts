/**
 * ResQ AI — Citizen API Service
 * Handles communication with the FastAPI backend for citizen-specific operations.
 * Returns { data, error, isBackend } so callers know whether data came from
 * the backend or needs to fall back to localStorage (ResQContext).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiOptions {
  userId: string;
  userRole?: string;
}

interface ApiResult<T> {
  data: T | null;
  error: string | null;
  isBackend: boolean;
}

async function apiFetch<T>(
  path: string,
  options: ApiOptions,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": options.userId,
        "X-User-Role": options.userRole || "Public / Citizen",
        ...(init?.headers || {}),
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        data: null,
        error: (body as Record<string, string>).detail || `Server error (${res.status})`,
        isBackend: true,
      };
    }

    const data = (await res.json()) as T;
    return { data, error: null, isBackend: true };
  } catch {
    return {
      data: null,
      error: "Backend unavailable — using local demo data.",
      isBackend: false,
    };
  }
}

// ── Report Types ───────────────────────────────────────────────

export interface ReportPayload {
  category: string;
  description: string;
  location_name: string;
  lat: number;
  lon: number;
  affected_people_count: number;
  urgent_needs: string[];
  reporter_name: string;
  reporter_phone: string;
}

export interface ReportData {
  id: string;
  category: string;
  description: string;
  location_name: string;
  lat: number;
  lon: number;
  affected_people_count: number;
  urgent_needs: string[];
  verification_status: string;
  submitted_at: string;
  linked_incident_id: string | null;
  source: string;
}

export interface PublicIncident {
  id: string;
  category: string;
  title: string;
  lat: number;
  lon: number;
  location_name: string;
  severity: string;
  lifecycle_status: string;
  detected_at: string;
  affected_people_estimate: number;
}

export interface PublicAlert {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  timestamp: string;
  related_incident_id: string | null;
}

export interface ShelterData {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  address: string;
  total_capacity: number | null;
  current_occupancy: number | null;
  available_beds: number | null;
  contact_number: string;
  status: string;
  notes: string | null;
}

// ── Citizen Report Endpoints (authenticated) ───────────────────

export async function createReport(options: ApiOptions, report: ReportPayload) {
  return apiFetch<ReportData>("/api/citizen/reports", options, {
    method: "POST",
    body: JSON.stringify(report),
  });
}

export async function fetchMyReports(options: ApiOptions) {
  return apiFetch<ReportData[]>("/api/citizen/reports", options);
}

export async function fetchReportById(options: ApiOptions, reportId: string) {
  return apiFetch<ReportData>(`/api/citizen/reports/${reportId}`, options);
}

// ── Public Endpoints (no auth required) ────────────────────────

export async function fetchPublicIncidents() {
  return apiFetch<PublicIncident[]>("/api/public/incidents", { userId: "public" });
}

export async function fetchPublicAlerts() {
  return apiFetch<PublicAlert[]>("/api/public/alerts", { userId: "public" });
}

export async function fetchShelters() {
  return apiFetch<ShelterData[]>("/api/public/shelters", { userId: "public" });
}
