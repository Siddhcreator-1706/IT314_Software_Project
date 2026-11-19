"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Badge, Button, Card, Dialog, EmptyState, ErrorState, Field, Input, LoadingRows, PageHeader, Textarea, type Tone } from "@/components/ui";

type Assignment = {
  dispatch_id: string;
  dispatch_ref: string;
  status: "REQUESTED" | "ACKNOWLEDGED" | "DISPATCHED";
  incident_ref: string;
  scenario: string;
  priority: string;
  address_text: string;
  landmark: string | null;
  latitude: number;
  longitude: number;
  instructions: string | null;
  dispatched_at: string;
};

type BackupRequest = {
  request_id: string;
  dispatch_id: string;
  dispatch_ref: string;
  required_capability: string;
  note: string | null;
  status: "OPEN" | "APPROVED" | "DECLINED";
  decision_rationale: string | null;
  decided_at: string | null;
  created_at: string;
};

const requestTone: Record<BackupRequest["status"], Tone> = { OPEN: "medium", APPROVED: "low", DECLINED: "high" };
const requestLabel: Record<BackupRequest["status"], string> = {
  OPEN: "Waiting for the dispatcher",
  APPROVED: "Approved",
  DECLINED: "Declined",
};

type DialogType = "reject" | "delay" | "backup" | "complete";

type ActiveDialog = {
  type: DialogType;
  dispatch: Assignment;
} | null;

const priorityTone: Record<string, Tone> = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

export default function FieldPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [requests, setRequests] = useState<BackupRequest[]>([]);
  // Sharing the team's position is an explicit opt-in each time the page is opened, never a default.
  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const lastFix = useRef<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ dispatchRef: string; message: string } | null>(null);
  const [dialogInput, setDialogInput] = useState({ text: "", secondary: "" });

  const loadAssignments = useCallback(async () => {
    try {
      const res = await fetch("/api/field/assignments", { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? `Server responded with ${res.status}`);
      }
      const data = await res.json();
      setAssignments(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load field assignments");
    } finally {
      setLoading(false);
    }
  }, []);

  // The team's backup requests and the dispatcher's decisions. A failure here must not hide the assignments.
  const loadRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/field/team-requests", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      // Keep showing the last list; the assignments screen reports connection problems.
    }
  }, []);

  // Initial load and auto-refresh every 15 seconds (SRS Requirement S2-04)
  useEffect(() => {
    let ignore = false;
    const fetchAssignments = async () => {
      try {
        const res = await fetch("/api/field/assignments", { cache: "no-store" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error?.message ?? `Server responded with ${res.status}`);
        }
        const data = await res.json();
        if (!ignore) {
          setAssignments(Array.isArray(data) ? data : []);
          setError(null);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load field assignments");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    const refresh = () => {
      fetchAssignments();
      loadRequests();
    };
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [loadRequests]);

  // While sharing is on, send the device position every minute. The server accepts it only while the team has
  // an active dispatch, and says so when it does not; sharing then simply carries on and resumes by itself.
  useEffect(() => {
    if (!sharing) return;
    let stopped = false;
    const send = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const fix = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          lastFix.current = fix;
          try {
            const res = await fetch("/api/field/location", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(fix),
            });
            if (stopped) return;
            if (res.ok) {
              setShareNote(`Shared with dispatchers at ${new Date().toLocaleTimeString()}`);
            } else {
              const data = await res.json().catch(() => ({}));
              setShareNote(data?.error?.message ?? `Could not share your location (${res.status}).`);
            }
          } catch {
            if (!stopped) setShareNote("Could not reach the server. Trying again in a minute.");
          }
        },
        (err) => {
          if (stopped) return;
          if (err.code === err.PERMISSION_DENIED) {
            setShareNote("This device refused location access. Allow it in the browser settings to share.");
            setSharing(false);
          } else {
            setShareNote("Could not get your position. Trying again in a minute.");
          }
        },
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
      );
    };
    send();
    const timer = setInterval(send, 60_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [sharing]);

  const toggleSharing = () => {
    if (sharing) {
      setSharing(false);
      lastFix.current = null;
      setShareNote(null);
    } else if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      setShareNote("Getting your position…");
      setSharing(true);
    } else {
      setShareNote("This device cannot share its location.");
    }
  };

  /** POST a field action. Returns null on success, or the error message to show the responder. */
  const postAction = async (dispatchId: string, url: string, body?: unknown): Promise<string | null> => {
    setBusyId(dispatchId);
    try {
      // While sharing is on, a progress report carries the latest known position too.
      const payload =
        url.endsWith("/progress") && body && lastFix.current ? { ...(body as object), ...lastFix.current } : body;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload ? JSON.stringify(payload) : "{}",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return data?.error?.message ?? `Action failed (${res.status}).`;
      }
      await Promise.all([loadAssignments(), loadRequests()]);
      return null;
    } catch {
      return "Could not reach the server. Check your connection and try again.";
    } finally {
      setBusyId(null);
    }
  };

  // Card buttons: a failure stays on screen (not a blocking alert) until dismissed or retried.
  const handleSimpleAction = async (dispatch: Assignment, url: string, body?: unknown) => {
    setActionError(null);
    const failure = await postAction(dispatch.dispatch_id, url, body);
    if (failure) setActionError({ dispatchRef: dispatch.dispatch_ref, message: failure });
  };

  const handleDialogSubmit = async () => {
    if (!activeDialog) return;
    setDialogError(null);
    const { type, dispatch } = activeDialog;
    const base = `/api/field/dispatches/${dispatch.dispatch_id}`;
    const text = dialogInput.text.trim();

    let request: { url: string; body: unknown };
    if (type === "reject") {
      if (text.length < 3) return setDialogError("Rejection reason must be at least 3 characters.");
      request = { url: `${base}/rejection`, body: { reason: text } };
    } else if (type === "delay") {
      request = { url: `${base}/progress`, body: { status: "DELAYED", note: text || undefined } };
    } else if (type === "backup") {
      if (text.length < 2) return setDialogError("Required capability must be at least 2 characters.");
      request = {
        url: `${base}/team-requests`,
        body: { required_capability: text, note: dialogInput.secondary.trim() || undefined },
      };
    } else {
      if (text.length < 3) return setDialogError("Completion summary must be at least 3 characters.");
      request = { url: `${base}/completion`, body: { summary: text } };
    }

    // Keep the dialog (and what the responder typed) open when the server refuses the action.
    const failure = await postAction(dispatch.dispatch_id, request.url, request.body);
    if (failure) return setDialogError(failure);
    setActiveDialog(null);
    setDialogInput({ text: "", secondary: "" });
  };

  const openDialog = (type: DialogType, dispatch: Assignment) => {
    setDialogError(null);
    setDialogInput({ text: "", secondary: "" });
    setActiveDialog({ type, dispatch });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Active Assignments"
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>Your team&apos;s active dispatches in the field. Glove-friendly controls.</span>
            <span aria-live="polite" className="text-xs font-mono text-muted">
              • Auto-refreshes every 15s
            </span>
          </span>
        }
        actions={
          <Button
            size="md"
            variant="secondary"
            onClick={loadAssignments}
            busy={loading}
            className="min-h-12 px-5 text-sm font-semibold"
          >
            Refresh
          </Button>
        }
      />

      <Card bodyClassName="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={sharing ? "primary" : "secondary"}
            className="min-h-12 px-5 text-sm font-semibold"
            onClick={toggleSharing}
            aria-pressed={sharing}
          >
            {sharing ? "Sharing location: ON (tap to stop)" : "Share my location with dispatchers"}
          </Button>
          <p className="min-w-0 flex-1 text-xs text-muted" aria-live="polite">
            {shareNote ??
              "Off by default. When on, dispatchers see your team's position on their map while your team has an active dispatch. It is never shared otherwise, and you can stop at any time."}
          </p>
        </div>
      </Card>

      {loading && <LoadingRows rows={3} />}

      {error && <ErrorState message={error} onRetry={loadAssignments} />}

      {actionError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-critical/30 bg-critical-soft px-4 py-3 text-sm text-critical">
          <span>
            <strong>{actionError.dispatchRef}:</strong> {actionError.message}
          </span>
          <Button size="sm" onClick={() => setActionError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {!loading && !error && assignments.length === 0 && (
        <EmptyState title="No active field dispatches">
          You are not currently assigned to any active dispatches. When the DM dispatcher assigns an order to your team, it will appear here.
        </EmptyState>
      )}

      {!loading && assignments.length > 0 && (
        <div className="space-y-6">
          {assignments.map((item) => {
            const isBusy = busyId === item.dispatch_id;
            return (
              <Card
                key={item.dispatch_id}
                title={
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-foreground sm:text-lg">{item.dispatch_ref}</span>
                    <Badge tone={priorityTone[item.priority] || "neutral"}>{item.priority}</Badge>
                    <Badge tone="info">{item.scenario.toUpperCase()}</Badge>
                    <span className="rounded bg-surface-muted px-2 py-0.5 text-xs font-mono font-medium text-muted">
                      {item.status}
                    </span>
                  </div>
                }
                subtitle={`Incident: ${item.incident_ref} · Dispatched ${new Date(item.dispatched_at).toLocaleTimeString()}`}
                className="overflow-hidden border-2 border-border shadow-md"
              >
                <div className="space-y-4">
                  {/* Incident details */}
                  <div className="rounded-lg bg-surface-muted/50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted">Target Location</div>
                    <p className="mt-1 text-base font-medium text-foreground">{item.address_text}</p>
                    {item.landmark && <p className="text-xs text-muted">Landmark: {item.landmark}</p>}
                    <p className="mt-1 font-mono text-xs text-muted">GPS: {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</p>
                  </div>

                  {item.instructions && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-amber-500">Dispatcher Instructions</div>
                      <p className="mt-1 text-sm text-foreground">{item.instructions}</p>
                    </div>
                  )}

                  {/* Glove-friendly action controls */}
                  <div className="border-t border-border pt-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Available Actions</div>
                    <div className="flex flex-wrap gap-3">
                      {item.status === "REQUESTED" && (
                        <>
                          <Button
                            variant="primary"
                            className="min-h-12 flex-1 min-w-[140px] text-base font-semibold"
                            busy={isBusy}
                            onClick={() =>
                              handleSimpleAction(
                                item,
                                `/api/field/dispatches/${item.dispatch_id}/acknowledgement`
                              )
                            }
                          >
                            Acknowledge
                          </Button>
                          <Button
                            variant="danger"
                            className="min-h-12 flex-1 min-w-[140px] text-base font-semibold"
                            disabled={isBusy}
                            onClick={() => openDialog("reject", item)}
                          >
                            Reject
                          </Button>
                        </>
                      )}

                      {item.status === "ACKNOWLEDGED" && (
                        <Button
                          variant="primary"
                          className="min-h-12 w-full text-base font-semibold bg-emerald-600 hover:bg-emerald-500"
                          busy={isBusy}
                          onClick={() =>
                            handleSimpleAction(
                              item,
                              `/api/field/dispatches/${item.dispatch_id}/progress`,
                              { status: "EN_ROUTE" }
                            )
                          }
                        >
                          En Route
                        </Button>
                      )}

                      {item.status === "DISPATCHED" && (
                        <>
                          <Button
                            variant="primary"
                            className="min-h-12 flex-1 min-w-[130px] text-sm sm:text-base font-semibold bg-blue-600 hover:bg-blue-500"
                            busy={isBusy}
                            onClick={() =>
                              handleSimpleAction(
                                item,
                                `/api/field/dispatches/${item.dispatch_id}/progress`,
                                { status: "ON_SCENE" }
                              )
                            }
                          >
                            On Scene
                          </Button>
                          <Button
                            variant="secondary"
                            className="min-h-12 flex-1 min-w-[130px] text-sm sm:text-base font-semibold"
                            disabled={isBusy}
                            onClick={() => openDialog("delay", item)}
                          >
                            Delayed
                          </Button>
                          <Button
                            variant="secondary"
                            className="min-h-12 flex-1 min-w-[140px] text-sm sm:text-base font-semibold"
                            disabled={isBusy}
                            onClick={() => openDialog("backup", item)}
                          >
                            Request Backup
                          </Button>
                          <Button
                            variant="primary"
                            className="min-h-12 flex-1 min-w-[140px] text-sm sm:text-base font-semibold bg-emerald-600 hover:bg-emerald-500"
                            disabled={isBusy}
                            onClick={() => openDialog("complete", item)}
                          >
                            Complete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {requests.length > 0 && (
        <Card
          title="Backup requests"
          subtitle="What your team asked for, and the dispatcher's answer. Anyone on your team can see these."
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border">
            {requests.map((r) => (
              <li key={r.request_id} className="space-y-1.5 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{r.required_capability}</span>
                  <Badge tone={requestTone[r.status]}>{requestLabel[r.status]}</Badge>
                  <span className="font-mono text-xs text-muted">{r.dispatch_ref}</span>
                  <span className="ml-auto text-xs text-muted">
                    {r.decided_at ? `Decided ${new Date(r.decided_at).toLocaleTimeString()}` : `Asked ${new Date(r.created_at).toLocaleTimeString()}`}
                  </span>
                </div>
                {r.note && <p className="text-xs text-muted">You said: {r.note}</p>}
                {r.decision_rationale && (
                  <p className="rounded-lg bg-surface-muted/60 px-3 py-2 text-sm">
                    <span className="font-medium">Dispatcher:</span> {r.decision_rationale}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Action Dialogs */}
      {activeDialog && (
        <Dialog
          open={Boolean(activeDialog)}
          onClose={() => setActiveDialog(null)}
          title={
            activeDialog.type === "reject"
              ? `Reject Dispatch ${activeDialog.dispatch.dispatch_ref}`
              : activeDialog.type === "delay"
              ? `Report Delay for ${activeDialog.dispatch.dispatch_ref}`
              : activeDialog.type === "backup"
              ? `Request Backup for ${activeDialog.dispatch.dispatch_ref}`
              : `Complete Dispatch ${activeDialog.dispatch.dispatch_ref}`
          }
          footer={
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="min-h-11 px-4 text-sm font-medium"
                onClick={() => setActiveDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant={activeDialog.type === "reject" ? "danger" : "primary"}
                className="min-h-11 px-5 text-sm font-semibold"
                busy={busyId === activeDialog.dispatch.dispatch_id}
                onClick={handleDialogSubmit}
              >
                Submit
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {dialogError && <p role="alert" className="text-xs text-critical font-medium">{dialogError}</p>}

            {activeDialog.type === "reject" && (
              <Field label="Rejection Reason" hint="Minimum 3 characters explaining why the team cannot respond.">
                {(id) => (
                  <Textarea
                    id={id}
                    required
                    value={dialogInput.text}
                    onChange={(e) => setDialogInput((prev) => ({ ...prev, text: e.target.value }))}
                    placeholder="e.g. Unit currently immobilized due to mechanical failure..."
                    rows={4}
                    className="min-h-[100px] text-base"
                  />
                )}
              </Field>
            )}

            {activeDialog.type === "delay" && (
              <Field label="Delay Note" hint="Describe the situation causing the delay.">
                {(id) => (
                  <Textarea
                    id={id}
                    value={dialogInput.text}
                    onChange={(e) => setDialogInput((prev) => ({ ...prev, text: e.target.value }))}
                    placeholder="e.g. Road blocked by fallen trees on Highway 8..."
                    rows={4}
                    className="min-h-[100px] text-base"
                  />
                )}
              </Field>
            )}

            {activeDialog.type === "backup" && (
              <>
                <Field label="Required Capability" hint="e.g. AMBULANCE, RESCUE_BOAT, HAZMAT, PUMP">
                  {(id) => (
                    <Input
                      id={id}
                      required
                      value={dialogInput.text}
                      onChange={(e) => setDialogInput((prev) => ({ ...prev, text: e.target.value }))}
                      placeholder="e.g. RESCUE_BOAT"
                      className="h-12 text-base font-mono"
                    />
                  )}
                </Field>
                <Field label="Additional Note (Optional)" hint="Provide context for the DM dispatcher.">
                  {(id) => (
                    <Textarea
                      id={id}
                      value={dialogInput.secondary}
                      onChange={(e) => setDialogInput((prev) => ({ ...prev, secondary: e.target.value }))}
                      placeholder="e.g. Flood water level rising rapidly; need 2 boats for stranded families..."
                      rows={3}
                      className="min-h-[80px] text-base"
                    />
                  )}
                </Field>
              </>
            )}

            {activeDialog.type === "complete" && (
              <Field label="Mission Summary" hint="Minimum 3 characters detailing the outcome of the dispatch.">
                {(id) => (
                  <Textarea
                    id={id}
                    required
                    value={dialogInput.text}
                    onChange={(e) => setDialogInput((prev) => ({ ...prev, text: e.target.value }))}
                    placeholder="e.g. Extricated 4 casualties, transferred to primary health center. Area secured."
                    rows={4}
                    className="min-h-[100px] text-base"
                  />
                )}
              </Field>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
