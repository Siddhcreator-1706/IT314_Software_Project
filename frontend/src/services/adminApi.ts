/**
 * Application Management API Client
 * Provides typed, authenticated communication with the FastAPI DRCH Backend.
 * Supports AM-FR-01, AM-FR-02, AM-FR-05, AM-FR-06, AM-FR-07, and AM-FR-11.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface UserAccount {
  user_id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  status: "ACTIVE" | "LOCKED" | "DISABLED" | "PENDING_VERIFICATION";
  role: "NORMAL_USER" | "DISASTER_MGMT" | "APP_MGMT";
  agency_name?: string | null;
  designation?: string | null;
  failed_login_count?: number;
  locked_until?: string | null;
  last_login_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AuditLogEntry {
  audit_id: number;
  occurred_at: string;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  result: "SUCCESS" | "FAILURE" | "DENIED";
  rationale?: string | null;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  ip_address?: string | null;
  prev_hash?: string | null;
  row_hash?: string | null;
}

export interface SecurityOverview {
  active_administrators: number;
  locked_accounts_count: number;
  disabled_accounts_count: number;
  locked_accounts: Array<{
    user_id: string;
    email: string;
    full_name: string;
    failed_login_count: number;
    locked_until: string | null;
  }>;
  policies: {
    min_password_length: number;
    max_failed_attempts: number;
    lockout_duration_minutes: number;
    session_expiry_minutes: number;
    mfa_enforced: boolean;
  };
}

export interface AbuseControlsData {
  rules: Record<string, number>;
  blocklist: Array<{
    ip: string;
    reason: string;
    blocked_at: number;
    expires_at: number | null;
  }>;
  allowlist: string[];
  recent_abuse_events: Array<{
    id: number;
    ip: string;
    action: string;
    details: string;
    status_code: number;
    timestamp: string;
  }>;
}

class AdminApiService {
  private getHeaders(token?: string | null): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const storedToken = token || (typeof window !== "undefined" ? localStorage.getItem("drch_admin_token") : null);
    if (storedToken) {
      headers["Authorization"] = `Bearer ${storedToken}`;
    }
    return headers;
  }

  // --------------------------------------------------------------------------
  // AM-FR-01: Authentication
  // --------------------------------------------------------------------------
  async login(email: string, password: string): Promise<{ access_token: string; user: UserAccount }> {
    const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login failed" }));
      throw new Error(err.detail || "Authentication failed");
    }
    const data = await res.json();
    if (typeof window !== "undefined" && data.access_token) {
      localStorage.setItem("drch_admin_token", data.access_token);
    }
    return data;
  }

  async fetchMe(token?: string): Promise<UserAccount> {
    const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error("Failed to authenticate profile");
    return res.json();
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: "POST",
        headers: this.getHeaders(),
      });
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("drch_admin_token");
      }
    }
  }

  // --------------------------------------------------------------------------
  // AM-FR-02: User & Role Management
  // --------------------------------------------------------------------------
  async fetchUsers(params?: { search?: string; role?: string; status?: string; limit?: number; offset?: number }): Promise<{ total: number; users: UserAccount[] }> {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.role && params.role !== "ALL") query.set("role", params.role);
    if (params?.status && params.status !== "ALL") query.set("status", params.status);
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.offset) query.set("offset", params.offset.toString());

    const res = await fetch(`${API_BASE}/api/v1/admin/users?${query.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to fetch users" }));
      throw new Error(err.detail);
    }
    return res.json();
  }

  async createUser(data: { email: string; full_name: string; role: string; password: string; designation?: string; phone?: string }): Promise<UserAccount> {
    const res = await fetch(`${API_BASE}/api/v1/admin/users`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to create user" }));
      throw new Error(err.detail);
    }
    return res.json();
  }

  async updateUser(userId: string, updates: { role?: string; status?: string; full_name?: string; designation?: string; phone?: string; rationale?: string }): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/admin/users/${userId}`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to update user" }));
      throw new Error(err.detail);
    }
  }

  async deleteUser(userId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to deactivate user" }));
      throw new Error(err.detail);
    }
  }

  // --------------------------------------------------------------------------
  // AM-FR-05: Audit Logs
  // --------------------------------------------------------------------------
  async fetchAuditLogs(params?: { search?: string; action?: string; entity_type?: string; result?: string; limit?: number; offset?: number }): Promise<{ total: number; logs: AuditLogEntry[] }> {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.action && params.action !== "ALL") query.set("action", params.action);
    if (params?.entity_type && params.entity_type !== "ALL") query.set("entity_type", params.entity_type);
    if (params?.result && params.result !== "ALL") query.set("result", params.result);
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.offset) query.set("offset", params.offset.toString());

    const res = await fetch(`${API_BASE}/api/v1/admin/audit-logs?${query.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to fetch audit logs" }));
      throw new Error(err.detail);
    }
    return res.json();
  }

  // --------------------------------------------------------------------------
  // AM-FR-06: Data Management
  // --------------------------------------------------------------------------
  async fetchDataEntities(): Promise<{ entities: Array<{ type: string; label: string; table: string }> }> {
    const res = await fetch(`${API_BASE}/api/v1/admin/data/entities`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch data entities");
    return res.json();
  }

  async fetchEntityRecords(entityType: string): Promise<{ entity_type: string; records: Record<string, unknown>[] }> {
    const res = await fetch(`${API_BASE}/api/v1/admin/data/${entityType}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch records for ${entityType}`);
    return res.json();
  }

  async correctEntityRecord(entityType: string, recordId: string, fieldUpdates: Record<string, unknown>, rationale: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/admin/data/${entityType}/${recordId}`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify({ field_updates: fieldUpdates, rationale }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Data correction failed" }));
      throw new Error(err.detail);
    }
  }

  // --------------------------------------------------------------------------
  // AM-FR-07: Security Management
  // --------------------------------------------------------------------------
  async fetchSecurityOverview(): Promise<SecurityOverview> {
    const res = await fetch(`${API_BASE}/api/v1/admin/security/overview`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load security overview");
    return res.json();
  }

  async unlockAccount(userId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/admin/security/unlock/${userId}`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Unlock failed" }));
      throw new Error(err.detail);
    }
  }

  async revokeUserSessions(userId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/admin/security/revoke-sessions/${userId}`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Session revocation failed" }));
      throw new Error(err.detail);
    }
  }

  async revokeAllSessions(): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/admin/security/revoke-all-sessions`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Global revocation failed" }));
      throw new Error(err.detail);
    }
  }

  // --------------------------------------------------------------------------
  // AM-FR-11: Abuse & Rate-Limit Controls
  // --------------------------------------------------------------------------
  async fetchAbuseControls(): Promise<AbuseControlsData> {
    const res = await fetch(`${API_BASE}/api/v1/admin/abuse-controls`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch abuse controls");
    return res.json();
  }

  async updateRateLimits(rules: Record<string, number>): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/admin/abuse-controls/rules`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify({ rules }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to update rate limits" }));
      throw new Error(err.detail);
    }
  }

  async addToBlocklist(ip: string, reason: string, durationMinutes = 60): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/admin/abuse-controls/blocklist`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ ip, reason, duration_minutes: durationMinutes }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to block IP" }));
      throw new Error(err.detail);
    }
  }

  async removeFromBlocklist(ip: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/admin/abuse-controls/blocklist/${encodeURIComponent(ip)}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to unblock IP" }));
      throw new Error(err.detail);
    }
  }
}

export const adminApi = new AdminApiService();
