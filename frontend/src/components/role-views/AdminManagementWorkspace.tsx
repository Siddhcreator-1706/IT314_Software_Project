"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  adminApi,
  UserAccount,
  AuditLogEntry,
  SecurityOverview,
  AbuseControlsData,
} from "../../services/adminApi";

interface AdminManagementWorkspaceProps {
  onClose?: () => void;
}

type TabType = "accounts" | "audit" | "data" | "security" | "abuse";

export const AdminManagementWorkspace: React.FC<AdminManagementWorkspaceProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>("accounts");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // Tab 1: Account & Role Management State
  // --------------------------------------------------------------------------
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [userTotal, setUserTotal] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Create form state
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"NORMAL_USER" | "DISASTER_MGMT" | "APP_MGMT">("DISASTER_MGMT");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserDesig, setNewUserDesig] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");

  // Edit form state
  const [editRole, setEditRole] = useState<"NORMAL_USER" | "DISASTER_MGMT" | "APP_MGMT">("DISASTER_MGMT");
  const [editStatus, setEditStatus] = useState<string>("ACTIVE");
  const [editRationale, setEditRationale] = useState("");

  // --------------------------------------------------------------------------
  // Tab 2: Audit Logs State
  // --------------------------------------------------------------------------
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState<number>(0);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("ALL");
  const [auditResultFilter, setAuditResultFilter] = useState("ALL");
  const [inspectAuditLog, setInspectAuditLog] = useState<AuditLogEntry | null>(null);

  // --------------------------------------------------------------------------
  // Tab 3: Data Management State
  // --------------------------------------------------------------------------
  const [dataEntities, setDataEntities] = useState<Array<{ type: string; label: string; table: string }>>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>("agencies");
  const [entityRecords, setEntityRecords] = useState<Record<string, unknown>[]>([]);
  const [correctingRecord, setCorrectingRecord] = useState<Record<string, unknown> | null>(null);
  const [correctionFields, setCorrectionFields] = useState<Record<string, string>>({});
  const [correctionRationale, setCorrectionRationale] = useState("");

  // --------------------------------------------------------------------------
  // Tab 4: Security Management State
  // --------------------------------------------------------------------------
  const [securityData, setSecurityData] = useState<SecurityOverview | null>(null);

  // --------------------------------------------------------------------------
  // Tab 5: Abuse & Rate Limits State
  // --------------------------------------------------------------------------
  const [abuseData, setAbuseData] = useState<AbuseControlsData | null>(null);
  const [newBlockIp, setNewBlockIp] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [newBlockDuration, setNewBlockDuration] = useState(60);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [editableRules, setEditableRules] = useState<Record<string, number>>({});

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

  // --------------------------------------------------------------------------
  // Data Loaders
  // --------------------------------------------------------------------------
  const loadUsers = useCallback(async () => {
    try {
      const data = await adminApi.fetchUsers({
        search: searchQuery,
        role: roleFilter,
        status: statusFilter,
      });
      setUsers(data.users);
      setUserTotal(data.total);
    } catch (err: unknown) {
      showToast((err as Error).message || "Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, roleFilter, statusFilter]);

  const loadAuditLogs = useCallback(async () => {
    try {
      const data = await adminApi.fetchAuditLogs({
        search: auditSearch,
        action: auditActionFilter,
        result: auditResultFilter,
      });
      setAuditLogs(data.logs);
      setAuditTotal(data.total);
    } catch (err: unknown) {
      showToast((err as Error).message || "Failed to load audit logs", "error");
    } finally {
      setLoading(false);
    }
  }, [auditSearch, auditActionFilter, auditResultFilter]);

  const loadDataEntities = useCallback(async () => {
    try {
      const data = await adminApi.fetchDataEntities();
      setDataEntities(data.entities);
      if (data.entities.length > 0) {
        const recordsData = await adminApi.fetchEntityRecords(selectedEntity);
        setEntityRecords(recordsData.records);
      }
    } catch (err: unknown) {
      showToast((err as Error).message || "Failed to load data entities", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedEntity]);

  const loadSecurity = useCallback(async () => {
    try {
      const data = await adminApi.fetchSecurityOverview();
      setSecurityData(data);
    } catch (err: unknown) {
      showToast((err as Error).message || "Failed to load security overview", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAbuseControls = useCallback(async () => {
    try {
      const data = await adminApi.fetchAbuseControls();
      setAbuseData(data);
      setEditableRules(data.rules);
    } catch (err: unknown) {
      showToast((err as Error).message || "Failed to load abuse controls", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const timer = setTimeout(() => {
      if (isCancelled) return;
      if (activeTab === "accounts") {
        void loadUsers();
      } else if (activeTab === "audit") {
        void loadAuditLogs();
      } else if (activeTab === "data") {
        void loadDataEntities();
      } else if (activeTab === "security") {
        void loadSecurity();
      } else if (activeTab === "abuse") {
        void loadAbuseControls();
      }
    }, 0);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [activeTab, loadUsers, loadAuditLogs, loadDataEntities, loadSecurity, loadAbuseControls]);

  // --------------------------------------------------------------------------
  // Handlers: Account & Roles
  // --------------------------------------------------------------------------
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserName || !newUserPassword) {
      showToast("Please fill in email, full name, and password.", "error");
      return;
    }
    try {
      await adminApi.createUser({
        email: newUserEmail,
        full_name: newUserName,
        role: newUserRole,
        password: newUserPassword,
        designation: newUserDesig || undefined,
        phone: newUserPhone || undefined,
      });
      showToast(`User ${newUserEmail} created successfully.`);
      setShowCreateModal(false);
      setNewUserEmail("");
      setNewUserName("");
      setNewUserPassword("");
      setNewUserDesig("");
      setNewUserPhone("");
      loadUsers();
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      await adminApi.updateUser(selectedUser.user_id, {
        role: editRole,
        status: editStatus,
        rationale: editRationale || undefined,
      });
      showToast(`Account ${selectedUser.email} updated.`);
      setShowEditModal(false);
      setSelectedUser(null);
      loadUsers();
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    }
  };

  const handleDeleteUser = async (user: UserAccount) => {
    if (!confirm(`Are you sure you want to deactivate account: ${user.email}? This will revoke all active tokens.`)) {
      return;
    }
    try {
      await adminApi.deleteUser(user.user_id);
      showToast(`Account ${user.email} deactivated.`);
      loadUsers();
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    }
  };

  // --------------------------------------------------------------------------
  // Handlers: Data Correction
  // --------------------------------------------------------------------------
  const handleCommitCorrection = async () => {
    if (!correctingRecord || !correctingRecord.id) return;
    if (!correctionRationale || correctionRationale.trim().length < 5) {
      showToast("Please provide an audited rationale (minimum 5 characters).", "error");
      return;
    }
    try {
      await adminApi.correctEntityRecord(
        selectedEntity,
        String(correctingRecord.id),
        correctionFields,
        correctionRationale
      );
      showToast(`Correction committed for ${selectedEntity} record.`);
      setCorrectingRecord(null);
      setCorrectionFields({});
      setCorrectionRationale("");
      loadDataEntities();
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    }
  };

  // --------------------------------------------------------------------------
  // Handlers: Security
  // --------------------------------------------------------------------------
  const handleUnlockUser = async (userId: string, email: string) => {
    try {
      await adminApi.unlockAccount(userId);
      showToast(`Account ${email} unlocked successfully.`);
      loadSecurity();
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    }
  };

  const handleRevokeSessions = async (userId: string, email: string) => {
    if (!confirm(`Revoke all active sessions for ${email}? The user will be required to re-authenticate.`)) {
      return;
    }
    try {
      await adminApi.revokeUserSessions(userId);
      showToast(`Active sessions for ${email} revoked.`);
      loadSecurity();
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    }
  };

  const handleRevokeAll = async () => {
    if (!confirm("WARNING: Emergency Global Session Invalidation will force ALL users across the platform to log in again. Proceed?")) {
      return;
    }
    try {
      await adminApi.revokeAllSessions();
      showToast("Global emergency session invalidation executed.");
      loadSecurity();
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    }
  };

  // --------------------------------------------------------------------------
  // Handlers: Abuse Controls
  // --------------------------------------------------------------------------
  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockIp || !newBlockReason) {
      showToast("Please enter an IP address and reason.", "error");
      return;
    }
    try {
      await adminApi.addToBlocklist(newBlockIp, newBlockReason, newBlockDuration);
      showToast(`IP ${newBlockIp} has been added to the blocklist.`);
      setShowBlockModal(false);
      setNewBlockIp("");
      setNewBlockReason("");
      loadAbuseControls();
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    }
  };

  const handleLiftBlock = async (ip: string) => {
    try {
      await adminApi.removeFromBlocklist(ip);
      showToast(`Block on IP ${ip} lifted.`);
      loadAbuseControls();
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    }
  };

  const handleSaveRateLimits = async () => {
    try {
      await adminApi.updateRateLimits(editableRules);
      showToast("Rate limit rules updated successfully.");
      loadAbuseControls();
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    }
  };

  return (
    <div className="space-y-4 font-sans text-slate-100">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-base">
            ⚙️
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              APPLICATION MANAGEMENT CONSOLE
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-mono">
                AM-FR-01 • 02 • 05 • 06 • 07 • 11
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Disaster Response Coordination Hub • Administrative Security & Governance
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg transition text-sm cursor-pointer"
            title="Close Application Management Console"
          >
            ✕
          </button>
        )}
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
            feedback.type === "success"
              ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-300"
              : "bg-red-950/80 border-red-500/40 text-red-300"
          }`}
        >
          <span>{feedback.type === "success" ? "✓" : "⚠️"} {feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="hover:opacity-75 cursor-pointer font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-900/90 rounded-xl border border-slate-800 text-xs">
        <button
          onClick={() => setActiveTab("accounts")}
          className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === "accounts"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <span>👥</span> Accounts & Roles (AM-FR-02)
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === "audit"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <span>📜</span> Audit Trail (AM-FR-05)
        </button>
        <button
          onClick={() => setActiveTab("data")}
          className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === "data"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <span>🗄️</span> Data Management (AM-FR-06)
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === "security"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <span>🛡️</span> Security Controls (AM-FR-07)
        </button>
        <button
          onClick={() => setActiveTab("abuse")}
          className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === "abuse"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <span>⚡</span> Abuse & Rate Limits (AM-FR-11)
        </button>
      </div>

      {/* ==================================================================== */}
      {/* 1. ACCOUNTS & ROLES (AM-FR-02) */}
      {/* ==================================================================== */}
      {activeTab === "accounts" && (
        <div className="space-y-3">
          {/* Quick Stats & Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadUsers()}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 flex-1 focus:border-blue-500 focus:outline-none"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs text-slate-300 rounded-lg px-2.5 py-1.5"
              >
                <option value="ALL">All Roles</option>
                <option value="APP_MGMT">APP_MGMT (Admin)</option>
                <option value="DISASTER_MGMT">DISASTER_MGMT (Staff)</option>
                <option value="NORMAL_USER">NORMAL_USER (Citizen)</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs text-slate-300 rounded-lg px-2.5 py-1.5"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="LOCKED">LOCKED</option>
                <option value="DISABLED">DISABLED</option>
              </select>
              <button
                onClick={loadUsers}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
              >
                Filter
              </button>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
            >
              <span>+</span> Create Account
            </button>
          </div>

          {/* Accounts Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Registered Accounts ({userTotal})</span>
              <span>Fixed 3-Role Scope: NORMAL_USER • DISASTER_MGMT • APP_MGMT</span>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="p-2.5">User</th>
                    <th className="p-2.5">Role</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Designation / Agency</th>
                    <th className="p-2.5">Last Active</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-[11px]">
                  {loading && users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        Loading accounts from database...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        No user accounts match the current search or filters.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.user_id} className="hover:bg-slate-900/50 transition">
                        <td className="p-2.5">
                          <div className="font-bold text-white">{u.full_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{u.email}</div>
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              u.role === "APP_MGMT"
                                ? "bg-purple-950 text-purple-300 border border-purple-800"
                                : u.role === "DISASTER_MGMT"
                                ? "bg-blue-950 text-blue-300 border border-blue-800"
                                : "bg-slate-800 text-slate-300 border border-slate-700"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.status === "ACTIVE"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                : u.status === "LOCKED"
                                ? "bg-amber-950 text-amber-400 border border-amber-800"
                                : "bg-red-950 text-red-400 border border-red-800"
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-300">
                          <div>{u.designation || "-"}</div>
                          <div className="text-[10px] text-slate-500">{u.agency_name || "General"}</div>
                        </td>
                        <td className="p-2.5 text-slate-400 text-[10px] font-mono">
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "Never"}
                        </td>
                        <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setEditRole(u.role);
                              setEditStatus(u.status);
                              setEditRationale("");
                              setShowEditModal(true);
                            }}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white rounded text-[10.5px] font-medium"
                          >
                            Manage
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="px-2 py-1 bg-red-950/60 hover:bg-red-800 text-red-400 hover:text-white rounded text-[10.5px] font-medium"
                            title="Deactivate account"
                          >
                            Deactivate
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal: Create User Account */}
          {showCreateModal && (
            <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
              <div className="bg-[#0b1120] border border-blue-500/40 text-slate-100 rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>👤</span> Create Official Account (AM-FR-02)
                  </h3>
                  <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Full Name</label>
                    <input
                      type="text"
                      required
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="e.g. Commander Vikram Singh"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Official Email</label>
                    <input
                      type="email"
                      required
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="e.g. vikram@drch.gov.in"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Application Role (Strict 3 Roles)</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as "NORMAL_USER" | "DISASTER_MGMT" | "APP_MGMT")}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white"
                    >
                      <option value="DISASTER_MGMT">DISASTER_MGMT (Incident Staff / Responder)</option>
                      <option value="APP_MGMT">APP_MGMT (Platform Administrator)</option>
                      <option value="NORMAL_USER">NORMAL_USER (Resident / Citizen)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Designation / Role Title</label>
                    <input
                      type="text"
                      value={newUserDesig}
                      onChange={(e) => setNewUserDesig(e.target.value)}
                      placeholder="e.g. Field Medic, Fire Officer, Dispatcher"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Phone</label>
                    <input
                      type="tel"
                      value={newUserPhone}
                      onChange={(e) => setNewUserPhone(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Initial Password (min 8 chars)</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold shadow"
                    >
                      Create Account
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Edit / Manage Account */}
          {showEditModal && selectedUser && (
            <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
              <div className="bg-[#0b1120] border border-blue-500/40 text-slate-100 rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>🛡️</span> Manage Account: {selectedUser.full_name}
                  </h3>
                  <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-[11px] space-y-1">
                    <div><span className="text-slate-400">Email:</span> <span className="font-mono text-white">{selectedUser.email}</span></div>
                    <div><span className="text-slate-400">Current Role:</span> <span className="font-mono text-cyan-300 font-bold">{selectedUser.role}</span></div>
                    <div><span className="text-slate-400">Current Status:</span> <span className="font-bold text-amber-300">{selectedUser.status}</span></div>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Assigned Role</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as "NORMAL_USER" | "DISASTER_MGMT" | "APP_MGMT")}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white"
                    >
                      <option value="NORMAL_USER">NORMAL_USER (Citizen)</option>
                      <option value="DISASTER_MGMT">DISASTER_MGMT (Incident Operational Staff)</option>
                      <option value="APP_MGMT">APP_MGMT (Platform Administrator)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Account Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white"
                    >
                      <option value="ACTIVE">ACTIVE (Authorized Access)</option>
                      <option value="LOCKED">LOCKED (Temporarily Restricted)</option>
                      <option value="DISABLED">DISABLED (Deactivated)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Audit Rationale (Mandatory for Compliance)</label>
                    <textarea
                      rows={2}
                      value={editRationale}
                      onChange={(e) => setEditRationale(e.target.value)}
                      placeholder="e.g. Role adjusted to Field Medic pursuant to State Relief Directive."
                      className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdateUser}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold shadow"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. AUDIT TRAIL & LOGS (AM-FR-05) */}
      {/* ==================================================================== */}
      {activeTab === "audit" && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                placeholder="Search audit records by action or rationale..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadAuditLogs()}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 flex-1 focus:border-blue-500 focus:outline-none"
              />
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs text-slate-300 rounded-lg px-2.5 py-1.5"
              >
                <option value="ALL">All Actions</option>
                <option value="LOGIN">LOGIN</option>
                <option value="LOGOUT">LOGOUT</option>
                <option value="USER_CREATE">USER_CREATE</option>
                <option value="USER_UPDATE">USER_UPDATE</option>
                <option value="DATA_CORRECTION">DATA_CORRECTION</option>
                <option value="IP_BLOCK">IP_BLOCK</option>
                <option value="IP_UNBLOCK">IP_UNBLOCK</option>
                <option value="RATE_LIMIT_UPDATE">RATE_LIMIT_UPDATE</option>
              </select>
              <select
                value={auditResultFilter}
                onChange={(e) => setAuditResultFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs text-slate-300 rounded-lg px-2.5 py-1.5"
              >
                <option value="ALL">All Outcomes</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="FAILURE">FAILURE</option>
                <option value="DENIED">DENIED</option>
              </select>
              <button
                onClick={loadAuditLogs}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
              >
                Filter
              </button>
            </div>

            <div className="text-[11px] text-emerald-400 font-mono flex items-center gap-1.5 shrink-0 bg-emerald-950/40 border border-emerald-800/60 px-3 py-1.5 rounded-lg">
              <span>🔒</span> Tamper-Proof Cryptographic Hash Chain Active
            </div>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Immutable Audit Trail ({auditTotal} records)</span>
              <span>Prevents Alteration via PostgreSQL Immutability Trigger</span>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] border-b border-slate-800 sticky top-0 font-sans">
                  <tr>
                    <th className="p-2.5">Time</th>
                    <th className="p-2.5">Actor</th>
                    <th className="p-2.5">Action</th>
                    <th className="p-2.5">Target Entity</th>
                    <th className="p-2.5">Outcome</th>
                    <th className="p-2.5">Rationale</th>
                    <th className="p-2.5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-[11px]">
                  {loading && auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500 font-sans">
                        Querying audit log records...
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500 font-sans">
                        No audit events match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.audit_id} className="hover:bg-slate-900/50 transition">
                        <td className="p-2.5 text-slate-400 whitespace-nowrap text-[10px]">
                          {new Date(log.occurred_at).toLocaleTimeString()}
                        </td>
                        <td className="p-2.5">
                          <span className="text-slate-200 font-semibold">{log.actor_name || log.actor_email || "System"}</span>
                          <span className="text-[10px] text-slate-500 block">({log.actor_role || "SYSTEM"})</span>
                        </td>
                        <td className="p-2.5 font-bold text-cyan-400">{log.action}</td>
                        <td className="p-2.5 text-slate-300">{log.entity_type}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              log.result === "SUCCESS"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                : log.result === "DENIED"
                                ? "bg-amber-950 text-amber-400 border border-amber-800"
                                : "bg-red-950 text-red-400 border border-red-800"
                            }`}
                          >
                            {log.result}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-400 text-[10.5px] max-w-xs truncate font-sans">
                          {log.rationale || "-"}
                        </td>
                        <td className="p-2.5 text-right font-sans">
                          <button
                            onClick={() => setInspectAuditLog(log)}
                            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white rounded text-[10px]"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Detail Drawer Modal */}
          {inspectAuditLog && (
            <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
              <div className="bg-[#0b1120] border border-blue-500/40 text-slate-100 rounded-xl shadow-2xl max-w-lg w-full p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                    <span>📜</span> Audit Entry #{inspectAuditLog.audit_id}: {inspectAuditLog.action}
                  </h3>
                  <button onClick={() => setInspectAuditLog(null)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="grid grid-cols-2 gap-2 bg-slate-900 p-2.5 rounded border border-slate-800 text-[11px]">
                    <div><span className="text-slate-400">Timestamp:</span> {inspectAuditLog.occurred_at}</div>
                    <div><span className="text-slate-400">Outcome:</span> <span className="font-bold text-emerald-400">{inspectAuditLog.result}</span></div>
                    <div><span className="text-slate-400">Actor:</span> {inspectAuditLog.actor_email || inspectAuditLog.actor_id || "SYSTEM"}</div>
                    <div><span className="text-slate-400">IP Address:</span> {inspectAuditLog.ip_address || "Internal"}</div>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-1">Administrative Rationale:</span>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800 text-slate-200">
                      {inspectAuditLog.rationale || "None provided"}
                    </div>
                  </div>

                  {inspectAuditLog.before_state && (
                    <div>
                      <span className="text-slate-400 block mb-1">Before State:</span>
                      <pre className="bg-slate-950 p-2 rounded border border-slate-800 text-slate-300 overflow-x-auto text-[10px]">
                        {JSON.stringify(inspectAuditLog.before_state, null, 2)}
                      </pre>
                    </div>
                  )}

                  {inspectAuditLog.after_state && (
                    <div>
                      <span className="text-slate-400 block mb-1">After State:</span>
                      <pre className="bg-slate-950 p-2 rounded border border-slate-800 text-emerald-300 overflow-x-auto text-[10px]">
                        {JSON.stringify(inspectAuditLog.after_state, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div>
                    <span className="text-slate-400 block mb-1">Cryptographic Row Hash (SHA-256):</span>
                    <div className="font-mono text-[10px] text-cyan-400 bg-slate-950 p-1.5 rounded border border-slate-800 break-all">
                      {inspectAuditLog.row_hash || "Calculated via DB trigger"}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setInspectAuditLog(null)}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. DATA MANAGEMENT (AM-FR-06) */}
      {/* ==================================================================== */}
      {activeTab === "data" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300">Manageable Entity:</span>
              <div className="flex gap-1.5">
                {dataEntities.map((ent) => (
                  <button
                    key={ent.type}
                    onClick={() => setSelectedEntity(ent.type)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      selectedEntity === ent.type
                        ? "bg-blue-600 text-white shadow"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {ent.label}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Transactional Mutations with Rollback Support
            </span>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-semibold text-slate-300">
              Active Entity Records ({entityRecords.length} entries)
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="p-2.5">ID / Key</th>
                    <th className="p-2.5">Primary Attributes</th>
                    <th className="p-2.5">Status / State</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-[11px]">
                  {entityRecords.map((r) => (
                    <tr key={String(r.id)} className="hover:bg-slate-900/50">
                      <td className="p-2.5 font-mono text-cyan-400">{String(r.config_key || r.name || r.title || r.id)}</td>
                      <td className="p-2.5 text-slate-300">
                        {selectedEntity === "agencies" && `${r.agency_type} • ${r.contact_phone || "No phone"}`}
                        {selectedEntity === "safety_content" && `${r.scenario} • ${r.language}`}
                        {selectedEntity === "system_configs" && (
                          <span className="font-mono text-[10px] text-slate-400 truncate max-w-sm block">
                            {JSON.stringify(r.value)}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                          {String(r.status || (r.is_active ? "ACTIVE" : "INACTIVE"))}
                        </span>
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          onClick={() => {
                            setCorrectingRecord(r);
                            const initialFields: Record<string, string> = {};
                            if (selectedEntity === "agencies") {
                              initialFields.name = String(r.name || "");
                              initialFields.contact_phone = String(r.contact_phone || "");
                              initialFields.contact_email = String(r.contact_email || "");
                            } else if (selectedEntity === "safety_content") {
                              initialFields.title = String(r.title || "");
                            }
                            setCorrectionFields(initialFields);
                            setCorrectionRationale("");
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white rounded text-[10px] font-bold"
                        >
                          Correct Data →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Data Correction Modal */}
          {correctingRecord && (
            <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
              <div className="bg-[#0b1120] border border-blue-500/40 text-slate-100 rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>✏️</span> Controlled Data Correction (AM-FR-06)
                  </h3>
                  <button onClick={() => setCorrectingRecord(null)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="text-[11px] text-slate-400">
                    Modifying {selectedEntity} record ID: <span className="font-mono text-cyan-300">{String(correctingRecord.id)}</span>
                  </div>

                  {Object.keys(correctionFields).map((field) => (
                    <div key={field}>
                      <label className="block text-slate-300 mb-1 font-medium capitalize">{field.replace("_", " ")}</label>
                      <input
                        type="text"
                        value={correctionFields[field]}
                        onChange={(e) => setCorrectionFields({ ...correctionFields, [field]: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white"
                      />
                    </div>
                  ))}

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Audit Rationale (Mandatory for Traceability)</label>
                    <textarea
                      rows={2}
                      required
                      value={correctionRationale}
                      onChange={(e) => setCorrectionRationale(e.target.value)}
                      placeholder="e.g. Corrected emergency helpline contact pursuant to verification drill."
                      className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setCorrectingRecord(null)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCommitCorrection}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold shadow"
                    >
                      Commit Correction
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. SECURITY CONTROLS (AM-FR-07) */}
      {/* ==================================================================== */}
      {activeTab === "security" && (
        <div className="space-y-4">
          {/* Posture Stats Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-900 border border-purple-900/50 p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Admins</span>
              <div className="text-xl font-extrabold text-purple-400 font-mono mt-1">
                {securityData?.active_administrators || 1}
              </div>
              <span className="text-[9.5px] text-purple-300/80">Protected from demotion</span>
            </div>

            <div className="bg-slate-900 border border-amber-900/50 p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Locked Accounts</span>
              <div className="text-xl font-extrabold text-amber-400 font-mono mt-1">
                {securityData?.locked_accounts_count || 0}
              </div>
              <span className="text-[9.5px] text-amber-300/80">Brute-force lockout active</span>
            </div>

            <div className="bg-slate-900 border border-red-900/50 p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Disabled Accounts</span>
              <div className="text-xl font-extrabold text-red-400 font-mono mt-1">
                {securityData?.disabled_accounts_count || 0}
              </div>
              <span className="text-[9.5px] text-red-300/80">Access revoked</span>
            </div>

            <div className="bg-slate-900 border border-emerald-900/50 p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">MFA Enforcement</span>
              <div className="text-xl font-extrabold text-emerald-400 font-mono mt-1">
                STANDBY
              </div>
              <span className="text-[9.5px] text-emerald-300/80">TOTP Supported</span>
            </div>
          </div>

          {/* Locked Accounts Queue */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 font-semibold">
              <span>Accounts Subject to Security Lockout</span>
              <span className="text-[10px] text-slate-400">Triggered after 5 failed login attempts</span>
            </div>

            <div className="p-3">
              {securityData?.locked_accounts.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  ✓ No user accounts are currently locked due to failed authentication attempts.
                </div>
              ) : (
                <div className="space-y-2">
                  {securityData?.locked_accounts.map((acc) => (
                    <div key={acc.user_id} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white">{acc.full_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {acc.email} • Failed: {acc.failed_login_count} attempts • Locked until: {acc.locked_until ? new Date(acc.locked_until).toLocaleTimeString() : "Manual"}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUnlockUser(acc.user_id, acc.email)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs shadow"
                        >
                          Unlock Account
                        </button>
                        <button
                          onClick={() => handleRevokeSessions(acc.user_id, acc.email)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs"
                        >
                          Revoke Sessions
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Global Emergency Invalidation */}
          <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-xl flex items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-red-300 flex items-center gap-1.5">
                <span>⚠️</span> Emergency Global Token & Session Revocation
              </h4>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xl">
                In the event of suspected administrative credential compromise, this action increments the global token version across all accounts, instantly terminating every active session on all field devices.
              </p>
            </div>
            <button
              onClick={handleRevokeAll}
              className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white font-bold text-xs rounded-lg shadow-lg shrink-0 cursor-pointer"
            >
              Emergency Invalidate All
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. ABUSE & RATE LIMITS (AM-FR-11) */}
      {/* ==================================================================== */}
      {activeTab === "abuse" && (
        <div className="space-y-4">
          {/* Rate Limits Form */}
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Endpoint Rate-Limiting Thresholds (Requests per 60 Seconds)
              </h4>
              <span className="text-[10px] text-emerald-400 font-mono">
                Fail-Safe Active: Emergency Reports Never Dropped
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Login Endpoint</label>
                <input
                  type="number"
                  min="1"
                  value={editableRules.auth_login || 10}
                  onChange={(e) => setEditableRules({ ...editableRules, auth_login: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Sign-Up Endpoint</label>
                <input
                  type="number"
                  min="1"
                  value={editableRules.auth_signup || 5}
                  onChange={(e) => setEditableRules({ ...editableRules, auth_signup: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Incident SOS Reporting</label>
                <input
                  type="number"
                  min="1"
                  value={editableRules.incident_report || 30}
                  onChange={(e) => setEditableRules({ ...editableRules, incident_report: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">General API Calls</label>
                <input
                  type="number"
                  min="1"
                  value={editableRules.general_api || 120}
                  onChange={(e) => setEditableRules({ ...editableRules, general_api: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveRateLimits}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow"
              >
                Save Thresholds
              </button>
            </div>
          </div>

          {/* Blocklist Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">
                IP Blocklist & Enforcements ({abuseData?.blocklist.length || 0})
              </span>
              <button
                onClick={() => setShowBlockModal(true)}
                className="px-2.5 py-1 bg-red-800 hover:bg-red-700 text-white rounded text-[11px] font-bold"
              >
                + Add Block
              </button>
            </div>

            <div className="p-3">
              {abuseData?.blocklist.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  No IP addresses are currently blocked.
                </div>
              ) : (
                <div className="space-y-2">
                  {abuseData?.blocklist.map((item) => (
                    <div key={item.ip} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono font-bold text-red-400">{item.ip}</span>
                        <span className="text-slate-400 ml-2">— {item.reason}</span>
                      </div>
                      <button
                        onClick={() => handleLiftBlock(item.ip)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded text-xs font-medium"
                      >
                        Lift Block ✓
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Abuse Events Stream */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-semibold text-slate-300">
              Live Abuse Events Log ({abuseData?.recent_abuse_events.length || 0} recent)
            </div>

            <div className="overflow-x-auto max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] border-b border-slate-800 sticky top-0 font-sans">
                  <tr>
                    <th className="p-2">Time</th>
                    <th className="p-2">IP</th>
                    <th className="p-2">Action</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-[10.5px]">
                  {abuseData?.recent_abuse_events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-900/50">
                      <td className="p-2 text-slate-500">{ev.timestamp}</td>
                      <td className="p-2 text-amber-300">{ev.ip}</td>
                      <td className="p-2 font-bold text-cyan-400">{ev.action}</td>
                      <td className="p-2">
                        <span className="text-red-400 font-bold">{ev.status_code}</span>
                      </td>
                      <td className="p-2 text-slate-400">{ev.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal: Add Block */}
          {showBlockModal && (
            <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
              <div className="bg-[#0b1120] border border-red-500/40 text-slate-100 rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>🛑</span> Add IP Block (AM-FR-11)
                  </h3>
                  <button onClick={() => setShowBlockModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleAddBlock} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Target IP Address</label>
                    <input
                      type="text"
                      required
                      value={newBlockIp}
                      onChange={(e) => setNewBlockIp(e.target.value)}
                      placeholder="e.g. 198.51.100.22"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Block Reason</label>
                    <input
                      type="text"
                      required
                      value={newBlockReason}
                      onChange={(e) => setNewBlockReason(e.target.value)}
                      placeholder="e.g. Repeated credential stuffing attempt"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Duration (Minutes)</label>
                    <input
                      type="number"
                      min="1"
                      value={newBlockDuration}
                      onChange={(e) => setNewBlockDuration(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowBlockModal(false)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded font-bold shadow"
                    >
                      Apply Block
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
