"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import {
  BarChart3,
  CheckCircle2,
  FileText,
  ListChecks,
  Plus,
  Search,
  Trash2,
  X,
} from "../../components/icons";
import { API, api, getAuthToken } from "../../lib/api";
import { useWorkspace, workspaceIds } from "../../lib/workspace";

type FieldType =
  | "TEXT"
  | "TEXTAREA"
  | "NUMBER"
  | "DATE"
  | "SELECT"
  | "RADIO"
  | "CHECKBOX"
  | "EMAIL"
  | "CALCULATED";
type FormField = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
  placeholder: string;
  conditionField?: string;
  conditionEquals?: string;
  formula?: string;
};
type NexusForm = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  approval_required: boolean;
  anonymous_enabled?: boolean;
  public_slug?: string | null;
  fields: FormField[];
  creator_name: string;
  submission_count: number;
  can_manage: boolean;
  updated_at: string;
  team_id?: string | null;
};
type Submission = {
  id: string;
  form_id: string;
  form_title: string;
  category: string;
  responses: Record<string, unknown>;
  status: string;
  submitted_by: string;
  submitter_name: string;
  submitter_email: string;
  submitted_at: string;
  reviewed_at?: string | null;
  reviewer_name?: string | null;
  review_note?: string | null;
  can_review: boolean;
};
type Tab = "forms" | "mine" | "review";
type FormAnalytics = {
  total: number;
  byStatus: Array<{ status: string; total: number }>;
  daily: Array<{ day: string; total: number }>;
};

const categories = [
  "LEAVE",
  "APPROVAL",
  "ONBOARDING",
  "SURVEY",
  "INCIDENT",
  "EQUIPMENT",
  "OTHER",
];
const fieldTypes: Array<[FieldType, string]> = [
  ["TEXT", "Short text"],
  ["TEXTAREA", "Long text"],
  ["EMAIL", "Email"],
  ["NUMBER", "Number"],
  ["DATE", "Date"],
  ["SELECT", "Dropdown"],
  ["RADIO", "Single choice"],
  ["CHECKBOX", "Checkbox"],
  ["CALCULATED", "Calculated"],
];
const presets: Record<
  string,
  { description: string; approval: boolean; fields: FormField[] }
> = {
  LEAVE: {
    description: "Request time away and route it for manager approval.",
    approval: true,
    fields: [
      field("Leave type", "SELECT", true, [
        "Annual leave",
        "Sick leave",
        "Personal leave",
      ]),
      field("Start date", "DATE", true),
      field("End date", "DATE", true),
      field("Reason", "TEXTAREA", true),
    ],
  },
  APPROVAL: {
    description: "Submit an internal request for review and approval.",
    approval: true,
    fields: [
      field("Request title", "TEXT", true),
      field("Business justification", "TEXTAREA", true),
      field("Required by", "DATE", false),
    ],
  },
  ONBOARDING: {
    description: "Collect the information needed to onboard a new employee.",
    approval: false,
    fields: [
      field("Employee name", "TEXT", true),
      field("Work email", "EMAIL", true),
      field("Start date", "DATE", true),
      field("Department", "TEXT", true),
      field("Manager", "TEXT", true),
    ],
  },
  SURVEY: {
    description: "Gather structured feedback from your organization.",
    approval: false,
    fields: [
      field("Overall rating", "RADIO", true, [
        "Excellent",
        "Good",
        "Fair",
        "Poor",
      ]),
      field("What worked well?", "TEXTAREA", false),
      field("What should improve?", "TEXTAREA", false),
    ],
  },
  INCIDENT: {
    description: "Report workplace, security, or operational incidents.",
    approval: true,
    fields: [
      field("Incident type", "SELECT", true, [
        "Security",
        "Safety",
        "Operations",
        "IT",
        "Other",
      ]),
      field("Date", "DATE", true),
      field("Description", "TEXTAREA", true),
      field("Immediate action taken", "TEXTAREA", false),
    ],
  },
  EQUIPMENT: {
    description: "Request workplace hardware, software, or accessories.",
    approval: true,
    fields: [
      field("Item requested", "TEXT", true),
      field("Quantity", "NUMBER", true),
      field("Business need", "TEXTAREA", true),
      field("Required by", "DATE", false),
    ],
  },
  OTHER: {
    description: "",
    approval: false,
    fields: [field("Response", "TEXTAREA", true)],
  },
};

function field(
  label = "New question",
  type: FieldType = "TEXT",
  required = false,
  options: string[] = [],
): FormField {
  return {
    id: `field_${Math.random().toString(36).slice(2, 10)}`,
    label,
    type,
    required,
    options,
    placeholder: "",
  };
}
function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(
      /(^|_)(\w)/g,
      (_, space, letter) => `${space ? " " : ""}${letter.toUpperCase()}`,
    );
}
function statusClass(value: string) {
  return `form-status ${value.toLowerCase()}`;
}
function calculatedValue(formula:string|undefined,responses:Record<string,unknown>){return (formula??'').split('+').reduce((sum,part)=>sum+(Number(responses[part.trim()]??part.trim())||0),0)}

export default function FormsPage() {
  const { workspace } = useWorkspace();
  const { orgId, teamId } = workspaceIds(workspace);
  const canManage = ["OWNER", "ADMIN"].includes(
    workspace?.organization.role ?? "",
  );
  const [forms, setForms] = useState<NexusForm[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [tab, setTab] = useState<Tab>("forms");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<NexusForm | null>(null);
  const [fillForm, setFillForm] = useState<NexusForm | null>(null);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("LEAVE");
  const [reviewing, setReviewing] = useState<Submission | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [analyticsForm, setAnalyticsForm] = useState<NexusForm | null>(null);
  const [analytics, setAnalytics] = useState<FormAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    setError("");
    try {
      const [formItems, submissionItems] = await Promise.all([
        api<NexusForm[]>(`/orgs/${orgId}/forms`),
        api<Submission[]>(`/orgs/${orgId}/form-submissions`),
      ]);
      setForms(formItems);
      setSubmissions(submissionItems);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Forms could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [orgId]);

  const visible = useMemo(
    () =>
      forms.filter(
        (form) =>
          (categoryFilter === "ALL" || form.category === categoryFilter) &&
          `${form.title} ${form.description}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [categoryFilter, forms, query],
  );
  const mine = submissions.filter(
    (item) => item.submitted_by === workspace?.user.id,
  );
  const queue = submissions.filter((item) =>
    ["PENDING", "SUBMITTED"].includes(item.status),
  );

  const create = async () => {
    if (!orgId || !newTitle.trim()) return;
    const preset = presets[newCategory];
    setBusy(true);
    setError("");
    try {
      const created = await api<NexusForm>(`/orgs/${orgId}/forms`, {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim(),
          description: preset.description,
          category: newCategory,
          approvalRequired: preset.approval,
          teamId,
          fields: preset.fields,
        }),
      });
      setForms((items) => [created, ...items]);
      setCreateOpen(false);
      setNewTitle("");
      setDraft(created);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Form could not be created.",
      );
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const saved = await api<NexusForm>(`/forms/${draft.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          category: draft.category,
          approvalRequired: draft.approval_required,
          teamId: draft.team_id ?? teamId,
          fields: draft.fields,
        }),
      });
      setForms((items) =>
        items.map((item) => (item.id === saved.id ? saved : item)),
      );
      setDraft(saved);
      setSuccess("Form saved.");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Form could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  const changeStatus = async (form: NexusForm, status: NexusForm["status"]) => {
    setBusy(true);
    setError("");
    try {
      const updated = await api<NexusForm>(`/forms/${form.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setForms((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setDraft((current) => (current?.id === updated.id ? updated : current));
      setSuccess(
        status === "PUBLISHED"
          ? "Form published to employees."
          : `Form moved to ${status.toLowerCase()}.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Form status could not be changed.",
      );
    } finally {
      setBusy(false);
    }
  };
  const remove = async (form: NexusForm) => {
    if (
      !window.confirm(
        `Delete “${form.title}” and hide it from employees? Existing submissions remain available for audit.`,
      )
    )
      return;
    setBusy(true);
    try {
      await api<void>(`/forms/${form.id}`, { method: "DELETE" });
      setForms((items) => items.filter((item) => item.id !== form.id));
      setDraft(null);
      setSuccess("Form deleted.");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Form could not be deleted.",
      );
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    if (!fillForm) return;
    setBusy(true);
    setError("");
    try {
      const item = await api<Submission>(`/forms/${fillForm.id}/submissions`, {
        method: "POST",
        body: JSON.stringify({ responses }),
      });
      setSubmissions((items) => [item, ...items]);
      setFillForm(null);
      setResponses({});
      setSuccess(
        item.status === "PENDING"
          ? "Response submitted for approval."
          : "Response submitted.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Response could not be submitted.",
      );
    } finally {
      setBusy(false);
    }
  };
  const decide = async (decision: "APPROVED" | "REJECTED") => {
    if (!reviewing) return;
    setBusy(true);
    try {
      const item = await api<Submission>(
        `/form-submissions/${reviewing.id}/decision`,
        {
          method: "PATCH",
          body: JSON.stringify({ decision, note: reviewNote }),
        },
      );
      setSubmissions((items) =>
        items.map((current) => (current.id === item.id ? item : current)),
      );
      setReviewing(null);
      setReviewNote("");
      setSuccess(`Response ${decision.toLowerCase()}.`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Decision could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  const openAnalytics = async (form: NexusForm) => {
    setAnalyticsForm(form);
    setAnalytics(null);
    setAnalyticsLoading(true);
    try {
      setAnalytics(await api<FormAnalytics>(`/forms/${form.id}/analytics`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Form analytics could not be loaded.");
      setAnalyticsForm(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="page forms-page">
        <div className="page-heading">
          <div>
            <div className="eyebrow">WORKFLOW / INTERNAL REQUESTS</div>
            <h1>Nexus Forms</h1>
            <p className="muted">
              Create secure internal forms for requests, approvals, onboarding,
              surveys, incidents, and equipment.
            </p>
          </div>
          {canManage && (
            <button
              className="button primary"
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={15} /> New form
            </button>
          )}
        </div>
        {error && (
          <div className="form-error">
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={15} />
            </button>
          </div>
        )}
        {success && (
          <div className="form-success">
            <span>{success}</span>
            <button
              className="icon-button"
              aria-label="Dismiss message"
              onClick={() => setSuccess("")}
            >
              <X size={15} />
            </button>
          </div>
        )}
        <div className="forms-tabs" role="tablist">
          <button
            className={tab === "forms" ? "active" : ""}
            onClick={() => setTab("forms")}
          >
            Available forms{" "}
            <span>
              {forms.filter((form) => form.status === "PUBLISHED").length}
            </span>
          </button>
          <button
            className={tab === "mine" ? "active" : ""}
            onClick={() => setTab("mine")}
          >
            My responses <span>{mine.length}</span>
          </button>
          {canManage && (
            <button
              className={tab === "review" ? "active" : ""}
              onClick={() => setTab("review")}
            >
              Approval queue <span>{queue.length}</span>
            </button>
          )}
        </div>
        {tab === "forms" && (
          <>
            <div className="card forms-toolbar">
              <div className="search">
                <Search size={15} />
                <input
                  aria-label="Search forms"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search forms"
                />
              </div>
              <select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="ALL">All categories</option>
                {categories.map((category) => (
                  <option value={category} key={category}>
                    {titleCase(category)}
                  </option>
                ))}
              </select>
            </div>
            {loading ? (
              <div className="card empty">Loading forms…</div>
            ) : visible.length === 0 ? (
              <div className="card empty">
                <ListChecks size={32} />
                <p>No forms match this view.</p>
                {canManage && (
                  <button
                    className="button primary"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus size={15} /> Create a form
                  </button>
                )}
              </div>
            ) : (
              <div className="forms-grid">
                {visible.map((form) => (
                  <article className="card form-card" key={form.id}>
                    <div className="form-card-top">
                      <span className="badge">{titleCase(form.category)}</span>
                      <span className={statusClass(form.status)}>
                        {form.status}
                      </span>
                    </div>
                    <div>
                      <h2>{form.title}</h2>
                      <p className="muted">
                        {form.description || "No description provided."}
                      </p>
                    </div>
                    <div className="form-card-meta">
                      <span>{form.fields.length} fields</span>
                      <span>{form.submission_count} responses</span>
                      {form.approval_required && <span>Approval required</span>}
                    </div>
                    <div className="actions">
                      {form.status === "PUBLISHED" && (
                        <button
                          className="button primary"
                          onClick={() => {
                            setFillForm(form);
                            setResponses({});
                          }}
                        >
                          Open form
                        </button>
                      )}
                      {form.can_manage && (
                        <>
                          <button className="button" onClick={() => setDraft(form)}>Manage</button>
                          <button className="button" onClick={() => void openAnalytics(form)}><BarChart3 size={14}/> Analytics</button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
        {tab === "mine" && (
          <SubmissionList
            items={mine}
            empty="You have not submitted any forms yet."
            onReview={undefined}
          />
        )}
        {tab === "review" && canManage && (
          <SubmissionList
            items={submissions}
            empty="No form responses are waiting for review."
            onReview={(item) => setReviewing(item)}
          />
        )}

        {createOpen && (
          <div className="modal-backdrop" onClick={() => setCreateOpen(false)}>
            <div
              className="card modal-card"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="card-header">
                <div>
                  <h2>Create internal form</h2>
                  <p className="muted">
                    Start from a tested employee workflow.
                  </p>
                </div>
                <button
                  className="icon-button"
                  aria-label="Close"
                  onClick={() => setCreateOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="field">
                <label htmlFor="form-title">Form title</label>
                <input
                  id="form-title"
                  autoFocus
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="Annual leave request"
                />
              </div>
              <div className="field">
                <label htmlFor="form-category">Workflow template</label>
                <select
                  id="form-category"
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                >
                  {categories.map((category) => (
                    <option value={category} key={category}>
                      {titleCase(category)}
                    </option>
                  ))}
                </select>
              </div>
              <p className="muted form-preset-description">
                {presets[newCategory].description ||
                  "Create a flexible internal data collection form."}
              </p>
              <button
                className="button primary"
                disabled={busy || !newTitle.trim()}
                onClick={() => void create()}
              >
                {busy ? "Creating…" : "Create draft"}
              </button>
            </div>
          </div>
        )}
        {draft && (
          <Designer
            form={draft}
            busy={busy}
            setForm={setDraft}
            onSave={() => void save()}
            onStatus={(status) => void changeStatus(draft, status)}
            onDelete={() => void remove(draft)}
            onClose={() => setDraft(null)}
          />
        )}
        {fillForm && (
          <ResponseModal
            form={fillForm}
            responses={responses}
            setResponses={setResponses}
            busy={busy}
            onSubmit={() => void submit()}
            onClose={() => setFillForm(null)}
          />
        )}
        {reviewing && (
          <ReviewModal
            item={reviewing}
            note={reviewNote}
            setNote={setReviewNote}
            busy={busy}
            onDecision={(decision) => void decide(decision)}
            onClose={() => setReviewing(null)}
          />
        )}
        {analyticsForm && (
          <FormAnalyticsModal
            form={analyticsForm}
            data={analytics}
            loading={analyticsLoading}
            onClose={() => setAnalyticsForm(null)}
          />
        )}
      </div>
    </AppShell>
  );
}

function Designer({
  form,
  setForm,
  busy,
  onSave,
  onStatus,
  onDelete,
  onClose,
}: {
  form: NexusForm;
  setForm: (form: NexusForm) => void;
  busy: boolean;
  onSave: () => void;
  onStatus: (status: NexusForm["status"]) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [designerError, setDesignerError] = useState("");
  const updateField = (index: number, change: Partial<FormField>) =>
    setForm({
      ...form,
      fields: form.fields.map((item, current) =>
        current === index ? { ...item, ...change } : item,
      ),
    });
  const toggleAnonymous = async () => {
    setDesignerError("");
    try {
      const updated = await api<{
        anonymous_enabled: boolean;
        public_slug?: string;
      }>(`/forms/${form.id}/advanced`, {
        method: "PUT",
        body: JSON.stringify({
          anonymousEnabled: !form.anonymous_enabled,
          approvalRoute: form.approval_required
            ? [{ step: 1, role: "ADMIN" }]
            : [],
        }),
      });
      setForm({ ...form, ...updated });
      if (updated.public_slug) await navigator.clipboard.writeText(`${window.location.origin}/public/forms/${updated.public_slug}`);
    } catch (reason) {
      setDesignerError(reason instanceof Error ? reason.message : "The anonymous form link could not be changed.");
    }
  };
  const exportCsv = async () => {
    setDesignerError("");
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API}/forms/${form.id}/export`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error("Responses could not be exported.");
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = `${form.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-responses.csv`; link.click(); URL.revokeObjectURL(url);
    } catch (reason) {
      setDesignerError(reason instanceof Error ? reason.message : "Responses could not be exported.");
    }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="card modal-card forms-designer"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="card-header">
          <div>
            <div className="eyebrow">FORM DESIGNER</div>
            <h2>{form.title}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close designer"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        {designerError && <div className="form-error">{designerError}</div>}
        <div className="forms-designer-grid">
          <section>
            <div className="field">
              <label>Title</label>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </div>
            <div className="forms-inline-fields">
              <div className="field">
                <label>Category</label>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value })
                  }
                >
                  {categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </div>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.approval_required}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      approval_required: event.target.checked,
                    })
                  }
                />{" "}
                Require approval
              </label>
            </div>
            <div className="actions">
              <button className="button" onClick={() => void toggleAnonymous()}>
                {form.anonymous_enabled
                  ? "Disable anonymous link"
                  : "Enable anonymous link"}
              </button>
              <button className="button" onClick={() => void exportCsv()}>
                Export CSV
              </button>
            </div>
            {form.public_slug && (
              <small className="muted">
                Anonymous link is active and copied when enabled.
              </small>
            )}
          </section>
          <section>
            <div className="card-header">
              <h3>Fields</h3>
              <button
                className="button"
                onClick={() =>
                  setForm({ ...form, fields: [...form.fields, field()] })
                }
              >
                <Plus size={14} /> Add field
              </button>
            </div>
            <div className="form-field-list">
              {form.fields.map((item, index) => (
                <div className="form-builder-field" key={item.id}>
                  <div className="form-builder-main">
                    <input
                      aria-label={`Label for field ${index + 1}`}
                      value={item.label}
                      onChange={(event) =>
                        updateField(index, { label: event.target.value })
                      }
                    />
                    <select
                      aria-label={`Type for ${item.label}`}
                      value={item.type}
                      onChange={(event) =>
                        updateField(index, {
                          type: event.target.value as FieldType,
                          options:
                            ["SELECT", "RADIO"].includes(event.target.value) &&
                            item.options.length === 0
                              ? ["Option 1"]
                              : item.options,
                        })
                      }
                    >
                      {fieldTypes.map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="icon-button"
                      aria-label={`Remove ${item.label}`}
                      onClick={() =>
                        setForm({
                          ...form,
                          fields: form.fields.filter(
                            (_, current) => current !== index,
                          ),
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {["SELECT", "RADIO"].includes(item.type) && (
                    <input
                      value={item.options.join(", ")}
                      onChange={(event) =>
                        updateField(index, {
                          options: event.target.value
                            .split(",")
                            .map((value) => value.trim()),
                        })
                      }
                      placeholder="Options separated by commas"
                    />
                  )}
                  {item.type === "CALCULATED" && (
                    <input value={item.formula ?? ""} onChange={(event) => updateField(index, { formula: event.target.value })} placeholder="Formula: field_id + field_id" />
                  )}
                  <div className="forms-inline-fields">
                    <input value={item.conditionField ?? ""} onChange={(event) => updateField(index, { conditionField: event.target.value })} placeholder="Show when field ID…" />
                    <input value={item.conditionEquals ?? ""} onChange={(event) => updateField(index, { conditionEquals: event.target.value })} placeholder="…equals value" />
                  </div>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={item.required}
                      onChange={(event) =>
                        updateField(index, { required: event.target.checked })
                      }
                    />{" "}
                    Required
                  </label>
                </div>
              ))}
            </div>
          </section>
        </div>
        <div className="forms-designer-footer">
          <button className="button danger" disabled={busy} onClick={onDelete}>
            <Trash2 size={14} /> Delete
          </button>
          <div className="actions">
            <button className="button" disabled={busy} onClick={onSave}>
              Save draft
            </button>
            {form.status !== "PUBLISHED" ? (
              <button
                className="button primary"
                disabled={busy || form.fields.length === 0}
                onClick={() => onStatus("PUBLISHED")}
              >
                Publish
              </button>
            ) : (
              <button
                className="button"
                disabled={busy}
                onClick={() => onStatus("CLOSED")}
              >
                Close responses
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResponseModal({
  form,
  responses,
  setResponses,
  busy,
  onSubmit,
  onClose,
}: {
  form: NexusForm;
  responses: Record<string, unknown>;
  setResponses: (responses: Record<string, unknown>) => void;
  busy: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="card modal-card form-response-modal"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="card-header">
          <div>
            <span className="badge">{titleCase(form.category)}</span>
            <h2>{form.title}</h2>
            <p className="muted">{form.description}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close form"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        {form.fields.filter((item)=>!item.conditionField||String(responses[item.conditionField]??'')===String(item.conditionEquals??'')).map((item) => (
          <ResponseField
            key={item.id}
            field={item}
            value={item.type==='CALCULATED'?calculatedValue(item.formula,responses):responses[item.id]}
            onChange={(value) =>
              setResponses({ ...responses, [item.id]: value })
            }
          />
        ))}
        <div className="form-submit-note">
          {form.approval_required
            ? "Your response will be sent to workspace administrators for approval."
            : "Your response will be recorded in this workspace."}
        </div>
        <button className="button primary" disabled={busy} type="submit">
          {busy ? "Submitting…" : "Submit response"}
        </button>
      </form>
    </div>
  );
}

function ResponseField({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const common = {
    id: field.id,
    required: field.required,
    "aria-label": field.label,
  };
  if(field.type==='CALCULATED') return <div className="field"><label>{field.label}</label><output className="calculated-output">{String(value??0)}</output></div>
  return (
    <div className="field">
      <label htmlFor={field.id}>
        {field.label}
        {field.required && " *"}
      </label>
      {field.type === "TEXTAREA" ? (
        <textarea
          {...common}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : field.type === "SELECT" ? (
        <select
          {...common}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select an option</option>
          {field.options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : field.type === "RADIO" ? (
        <div className="form-options">
          {field.options.map((option) => (
            <label key={option}>
              <input
                name={field.id}
                required={field.required}
                type="radio"
                checked={value === option}
                onChange={() => onChange(option)}
              />{" "}
              {option}
            </label>
          ))}
        </div>
      ) : field.type === "CHECKBOX" ? (
        <label className="checkbox-field">
          <input
            {...common}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
          />{" "}
          Confirm
        </label>
      ) : (
        <input
          {...common}
          type={field.type.toLowerCase()}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

function SubmissionList({
  items,
  empty,
  onReview,
}: {
  items: Submission[];
  empty: string;
  onReview?: (item: Submission) => void;
}) {
  if (items.length === 0)
    return (
      <div className="card empty">
        <FileText size={32} />
        <p>{empty}</p>
      </div>
    );
  return (
    <div className="card submission-table">
      <div className="submission-row submission-head">
        <span>Form</span>
        <span>Employee</span>
        <span>Submitted</span>
        <span>Status</span>
        <span />
      </div>
      {items.map((item) => (
        <div className="submission-row" key={item.id}>
          <div>
            <strong>{item.form_title}</strong>
            <small>{titleCase(item.category)}</small>
          </div>
          <div>
            <span>{item.submitter_name}</span>
            <small>{item.submitter_email}</small>
          </div>
          <span>{new Date(item.submitted_at).toLocaleString()}</span>
          <span className={statusClass(item.status)}>{item.status}</span>
          <div>
            {onReview && ["PENDING", "SUBMITTED"].includes(item.status) && (
              <button className="button" onClick={() => onReview(item)}>
                Review
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewModal({
  item,
  note,
  setNote,
  busy,
  onDecision,
  onClose,
}: {
  item: Submission;
  note: string;
  setNote: (value: string) => void;
  busy: boolean;
  onDecision: (decision: "APPROVED" | "REJECTED") => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="card modal-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="card-header">
          <div>
            <div className="eyebrow">APPROVAL REVIEW</div>
            <h2>{item.form_title}</h2>
            <p className="muted">Submitted by {item.submitter_name}</p>
          </div>
          <button
            className="icon-button"
            aria-label="Close review"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="review-responses">
          {Object.entries(item.responses).map(([key, value]) => (
            <div key={key}>
              <small>
                {titleCase(key.replace(/^field_[a-z0-9]+$/, "Response"))}
              </small>
              <p>
                {typeof value === "boolean"
                  ? value
                    ? "Yes"
                    : "No"
                  : String(value || "—")}
              </p>
            </div>
          ))}
        </div>
        <div className="field">
          <label htmlFor="review-note">Review note</label>
          <textarea
            id="review-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Explain the decision to the employee."
          />
        </div>
        <div className="actions">
          <button
            className="button"
            disabled={busy}
            onClick={() => onDecision("REJECTED")}
          >
            Reject
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => onDecision("APPROVED")}
          >
            <CheckCircle2 size={15} /> Approve
          </button>
        </div>
      </div>
    </div>
  );
}

function FormAnalyticsModal({
  form,
  data,
  loading,
  onClose,
}: {
  form: NexusForm;
  data: FormAnalytics | null;
  loading: boolean;
  onClose: () => void;
}) {
  const peak = Math.max(...(data?.daily.map((item) => item.total) ?? [1]), 1);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal-card form-analytics-modal" onClick={(event) => event.stopPropagation()}>
        <div className="card-header">
          <div><div className="eyebrow">FORM INSIGHTS</div><h2>{form.title}</h2><p className="muted">Submission activity and workflow outcomes.</p></div>
          <button className="icon-button" aria-label="Close analytics" onClick={onClose}><X size={16}/></button>
        </div>
        {loading ? <div className="empty">Loading analytics…</div> : data ? <>
          <div className="metric-grid form-analytics-metrics">
            <div className="card metric-card"><BarChart3 size={17} color="var(--brand)"/><span className="muted">Total responses</span><strong>{data.total}</strong></div>
            {data.byStatus.slice(0, 3).map((item) => <div className="card metric-card" key={item.status}><span className="muted">{titleCase(item.status)}</span><strong>{item.total}</strong></div>)}
          </div>
          <section className="form-analytics-chart"><div className="card-header"><h3>Responses by day</h3><small className="muted">Recent submission history</small></div>{data.daily.length === 0 ? <div className="empty">No responses yet.</div> : <div className="bar-chart">{data.daily.slice(-14).map((item) => <div className="bar-column" key={item.day} title={`${item.total} responses`}><i style={{height: `${Math.max(8, (item.total / peak) * 100)}%`}}/><small>{new Date(item.day).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</small></div>)}</div>}</section>
        </> : <div className="empty">Analytics are unavailable for this form.</div>}
      </div>
    </div>
  );
}
