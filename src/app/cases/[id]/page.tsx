"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Briefcase,
  Grid3x3,
  Wrench,
  BarChart3,
  FileText,
  ArrowRight,
  CheckCircle2,
  Circle,
  AlertCircle,
  Pencil,
  X,
  Check,
  Loader2,
  MapPin,
  Stethoscope,
} from "lucide-react";
import { CaseBreadcrumb } from "@/components/case-breadcrumb";

interface CaseData {
  id: string;
  clientName: string;
  clientDOB: string | null;
  evaluatorName: string | null;
  referralSource: string | null;
  dateOfInjury: string | null;
  dateOfEval: string | null;
  zipCode: string | null;
  metroAreaCode: string | null;
  metroAreaName: string | null;
  notes: string | null;
  status: string;
  // Injury & Medical fields
  injuryDescription: string | null;
  bodyPartsAffected: string[];
  treatingPhysician: string | null;
  physicianSpecialty: string | null;
  mmiDate: string | null;
  fceDate: string | null;
  fceProvider: string | null;
  surgeryDates: string | null;
  medicalNotes: string | null;
  profiles: { id: string; profileType: string }[];
  pastRelevantWork: { id: string; jobTitle: string; svp: number | null }[];
  acquiredSkills: { id: string; isTransferable: boolean }[];
  analyses: { id: string; name: string | null; status: string }[];
}

type StepStatus = "complete" | "ready" | "blocked";

function getStepStatus(caseData: CaseData) {
  const prw = caseData.pastRelevantWork ?? [];
  const profiles = caseData.profiles ?? [];
  const skills = caseData.acquiredSkills ?? [];
  const analyses = caseData.analyses ?? [];

  const hasPRW = prw.length > 0;
  const hasProfiles = profiles.length >= 1;
  const hasSkills = skills.length > 0;
  const hasCompletedAnalysis = analyses.some(
    (a) => a.status === "completed"
  );
  const hasAnalysis = analyses.length > 0;

  return {
    prw: hasPRW ? "complete" as StepStatus : "ready" as StepStatus,
    profiles: hasProfiles ? "complete" as StepStatus : hasPRW ? "ready" as StepStatus : "blocked" as StepStatus,
    skills: hasSkills ? "complete" as StepStatus : hasPRW ? "ready" as StepStatus : "blocked" as StepStatus,
    analysis: hasCompletedAnalysis
      ? "complete" as StepStatus
      : hasAnalysis || (hasPRW && hasProfiles)
        ? "ready" as StepStatus
        : "blocked" as StepStatus,
    results: hasCompletedAnalysis ? "complete" as StepStatus : "blocked" as StepStatus,
  };
}

function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "complete":
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case "ready":
      return <Circle className="h-5 w-5 text-blue-500" />;
    case "blocked":
      return <AlertCircle className="h-5 w-5 text-muted-foreground/40" />;
  }
}

function StatusLabel({ status }: { status: StepStatus }) {
  switch (status) {
    case "complete":
      return <Badge variant="default" className="bg-green-600 text-xs">Done</Badge>;
    case "ready":
      return <Badge variant="outline" className="border-blue-500 text-blue-600 text-xs">Next Step</Badge>;
    case "blocked":
      return <Badge variant="secondary" className="text-xs">Waiting</Badge>;
  }
}

// ─── Inline Editable Field ────────────────────────────────────────────────────

function InlineField({
  label,
  value,
  fieldKey,
  type = "text",
  onSave,
  multiline = false,
}: {
  label: string;
  value: string;
  fieldKey: string;
  type?: "text" | "date";
  onSave: (key: string, value: string) => Promise<void>;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const save = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(fieldKey, draft);
      setEditing(false);
    } catch {
      toast.error(`Failed to update ${label}`);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      save();
    }
    if (e.key === "Escape") {
      cancel();
    }
  };

  if (editing) {
    return (
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <div className="flex items-start gap-1">
          {multiline ? (
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              className="text-sm"
            />
          ) : (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={type}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-7 text-sm"
            />
          )}
          <button
            onClick={save}
            disabled={saving}
            className="p-1 text-green-600 hover:bg-green-50 rounded shrink-0"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={cancel}
            className="p-1 text-muted-foreground hover:bg-muted rounded shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const displayValue = type === "date" && value
    ? new Date(value).toLocaleDateString()
    : value || "\u2014";

  return (
    <div className="space-y-1 group">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-sm">{displayValue}</span>
        <button
          onClick={() => setEditing(true)}
          className="p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
          title={`Edit ${label}`}
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Inline Editable ZIP (with metro area lookup) ─────────────────────────────

function InlineZipField({
  zipCode,
  metroAreaName,
  onSave,
}: {
  zipCode: string;
  metroAreaName: string;
  onSave: (updates: Record<string, string | null>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(zipCode);
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [previewMetro, setPreviewMetro] = useState(metroAreaName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(zipCode);
    setPreviewMetro(metroAreaName);
  }, [zipCode, metroAreaName]);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const lookupZip = async (zip: string) => {
    setDraft(zip);
    if (zip.length === 5) {
      setLookingUp(true);
      try {
        const res = await fetch(`/api/geo/zip-to-metro?zip=${zip}`);
        if (res.ok) {
          const data = await res.json();
          setPreviewMetro(data.areaName ?? "");
        }
      } catch { /* silent */ }
      setLookingUp(false);
    } else {
      setPreviewMetro("");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      // Lookup metro for the final zip
      let areaCode = "";
      let areaName = "";
      if (draft.length === 5) {
        try {
          const res = await fetch(`/api/geo/zip-to-metro?zip=${draft}`);
          if (res.ok) {
            const data = await res.json();
            areaCode = data.areaCode ?? "";
            areaName = data.areaName ?? "";
          }
        } catch { /* silent */ }
      }
      await onSave({
        zipCode: draft || null,
        metroAreaCode: areaCode || null,
        metroAreaName: areaName || null,
      });
      setEditing(false);
    } catch {
      toast.error("Failed to update ZIP code");
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(zipCode);
    setPreviewMetro(metroAreaName);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground font-medium">
          <MapPin className="h-3 w-3 inline mr-0.5" />ZIP Code
        </span>
        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            maxLength={5}
            value={draft}
            onChange={(e) => lookupZip(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); save(); }
              if (e.key === "Escape") cancel();
            }}
            className="h-7 text-sm w-24"
          />
          {lookingUp && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          {previewMetro && <span className="text-xs text-muted-foreground">{previewMetro}</span>}
          <button onClick={save} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded shrink-0">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button onClick={cancel} className="p-1 text-muted-foreground hover:bg-muted rounded shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 group">
      <span className="text-xs text-muted-foreground font-medium">
        <MapPin className="h-3 w-3 inline mr-0.5" />ZIP Code
      </span>
      <div className="flex items-center gap-1">
        <span className="text-sm">{zipCode || "\u2014"}</span>
        {metroAreaName && <span className="text-xs text-muted-foreground">({metroAreaName})</span>}
        <button
          onClick={() => setEditing(true)}
          className="p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
          title="Edit ZIP Code"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Body Parts Tag Input ─────────────────────────────────────────────────────

const COMMON_BODY_PARTS = [
  "back", "neck", "shoulder", "knee", "wrist", "hip", "ankle",
  "elbow", "hand", "foot", "spine", "head",
];

function InlineBodyPartsField({
  value,
  onSave,
}: {
  value: string[];
  onSave: (key: string, value: string[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [parts, setParts] = useState<string[]>(value);
  const [inputVal, setInputVal] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setParts(value); }, [value]);

  const addPart = (part: string) => {
    const p = part.trim().toLowerCase();
    if (p && !parts.includes(p)) setParts([...parts, p]);
    setInputVal("");
  };

  const removePart = (part: string) => {
    setParts(parts.filter((p) => p !== part));
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave("bodyPartsAffected", parts);
      setEditing(false);
    } catch {
      toast.error("Failed to update body parts");
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setParts(value);
    setInputVal("");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-2">
        <span className="text-xs text-muted-foreground font-medium">Body Parts Affected</span>
        <div className="flex flex-wrap gap-1">
          {parts.map((p) => (
            <Badge key={p} variant="secondary" className="text-xs gap-1">
              {p}
              <button onClick={() => removePart(p)} className="hover:text-red-500">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addPart(inputVal); }
              if (e.key === "Escape") cancel();
            }}
            placeholder="Type or click below"
            className="h-7 text-sm"
          />
          <button onClick={save} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded shrink-0">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button onClick={cancel} className="p-1 text-muted-foreground hover:bg-muted rounded shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {COMMON_BODY_PARTS.filter((bp) => !parts.includes(bp)).map((bp) => (
            <button
              key={bp}
              onClick={() => addPart(bp)}
              className="text-xs border rounded px-1.5 py-0.5 hover:bg-muted"
            >
              + {bp}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 group">
      <span className="text-xs text-muted-foreground font-medium">Body Parts Affected</span>
      <div className="flex items-center gap-1 flex-wrap">
        {value.length > 0
          ? value.map((p) => <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>)
          : <span className="text-sm">{"\u2014"}</span>
        }
        <button
          onClick={() => setEditing(true)}
          className="p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
          title="Edit body parts"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Status Badge with Dropdown ───────────────────────────────────────────────

const STATUS_OPTIONS = ["active", "completed", "archived"] as const;
const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-300",
  completed: "bg-blue-100 text-blue-800 border-blue-300",
  archived: "bg-gray-100 text-gray-600 border-gray-300",
};

function StatusDropdown({
  status,
  onSave,
}: {
  status: string;
  onSave: (key: string, value: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const changeStatus = async (newStatus: string) => {
    if (newStatus === status) { setOpen(false); return; }
    setSaving(true);
    try {
      await onSave("status", newStatus);
      setOpen(false);
    } catch {
      toast.error("Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border cursor-pointer ${STATUS_COLORS[status] ?? STATUS_COLORS.active}`}
        disabled={saving}
      >
        {saving && <Loader2 className="h-3 w-3 animate-spin" />}
        {status}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-background border rounded-md shadow-md py-1 min-w-[120px]">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => changeStatus(s)}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted ${s === status ? "font-medium" : ""}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CaseDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const id = params.id as string;
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/cases/${id}`);
      if (!r.ok) {
        const msg = await r.text().catch(() => "Unknown error");
        throw new Error(`HTTP ${r.status}: ${msg}`);
      }
      const data = await r.json();
      setCaseData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      toast.error("Failed to load case data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load, pathname]);

  // Save a single field (or multiple for ZIP)
  const saveField = useCallback(async (key: string, value: string | string[]) => {
    const body = { [key]: value };
    const r = await fetch(`/api/cases/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("Save failed");
    const updated = await r.json();
    setCaseData((prev) => (prev ? { ...prev, ...updated } : prev));
    toast.success("Saved");
  }, [id]);

  const saveMultipleFields = useCallback(async (updates: Record<string, string | null>) => {
    const r = await fetch(`/api/cases/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!r.ok) throw new Error("Save failed");
    const updated = await r.json();
    setCaseData((prev) => (prev ? { ...prev, ...updated } : prev));
    toast.success("Saved");
  }, [id]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!caseData) return <div className="p-6">Case not found</div>;

  const steps = getStepStatus(caseData);
  const prw = caseData.pastRelevantWork ?? [];
  const profiles = caseData.profiles ?? [];
  const skills = caseData.acquiredSkills ?? [];
  const analyses = caseData.analyses ?? [];
  const transferableCount = skills.filter(
    (s) => s.isTransferable
  ).length;
  const completedAnalyses = analyses.filter(
    (a) => a.status === "completed"
  ).length;

  const sections = [
    {
      href: `/cases/${id}/prw`,
      icon: Briefcase,
      label: "Past Relevant Work",
      desc: "Employment history with DOT/O*NET codes, SVP, strength, and duties",
      countLabel: `${prw.length} entries`,
      status: steps.prw,
      hint: steps.prw === "ready" ? "Start here \u2014 add jobs from the 15 years before disability onset" : undefined,
    },
    {
      href: `/cases/${id}/profiles`,
      icon: Grid3x3,
      label: "Worker Profiles",
      desc: "4-row \u00d7 24-trait profile grid (Work History, Evaluative, Pre-injury, Post-injury)",
      countLabel: `${profiles.length}/4 profiles`,
      status: steps.profiles,
      hint: steps.profiles === "ready" ? "Build profiles including the Post-injury functional capacity" : steps.profiles === "blocked" ? "Add Past Relevant Work first" : undefined,
    },
    {
      href: `/cases/${id}/skills`,
      icon: Wrench,
      label: "Acquired Skills",
      desc: "Transferable skills inventory using SSA format (Action + Object + Context)",
      countLabel: skills.length > 0
        ? `${transferableCount} transferable / ${skills.length} total`
        : "0 skills",
      status: steps.skills,
      hint: steps.skills === "ready" ? "Extract skills from each PRW entry" : steps.skills === "blocked" ? "Add Past Relevant Work first" : undefined,
    },
    {
      href: `/cases/${id}/analysis`,
      icon: BarChart3,
      label: "Analysis",
      desc: "Run the 5-step PVQ-TM analysis: candidates, trait filter, adjustment, labor market, PVQ",
      countLabel: analyses.length > 0
        ? `${analyses.length} analyses (${completedAnalyses} completed)`
        : "No analyses",
      status: steps.analysis,
      hint: steps.analysis === "ready" && analyses.length === 0 ? "Create and run an analysis" : steps.analysis === "blocked" ? "Complete PRW and Profiles first" : undefined,
    },
    {
      href: `/cases/${id}/results`,
      icon: FileText,
      label: "Results & Report",
      desc: "Ranked occupations with PVQ scores, wage comparison, and PDF report",
      countLabel: `${completedAnalyses} completed`,
      status: steps.results,
      hint: steps.results === "blocked" ? "Complete an analysis first" : undefined,
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <CaseBreadcrumb caseId={id} currentPage="" />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{caseData.clientName}</h1>
        </div>
        <StatusDropdown status={caseData.status} onSave={saveField} />
      </div>

      {/* Case Details Card - Inline Editable */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Case Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <InlineField
              label="Client Name"
              value={caseData.clientName ?? ""}
              fieldKey="clientName"
              onSave={saveField}
            />
            <InlineField
              label="Date of Birth"
              value={caseData.clientDOB ? caseData.clientDOB.split("T")[0] : ""}
              fieldKey="clientDOB"
              type="date"
              onSave={saveField}
            />
            <InlineField
              label="Evaluator Name"
              value={caseData.evaluatorName ?? ""}
              fieldKey="evaluatorName"
              onSave={saveField}
            />
            <InlineField
              label="Referral Source"
              value={caseData.referralSource ?? ""}
              fieldKey="referralSource"
              onSave={saveField}
            />
            <InlineField
              label="Date of Injury"
              value={caseData.dateOfInjury ? caseData.dateOfInjury.split("T")[0] : ""}
              fieldKey="dateOfInjury"
              type="date"
              onSave={saveField}
            />
            <InlineField
              label="Date of Evaluation"
              value={caseData.dateOfEval ? caseData.dateOfEval.split("T")[0] : ""}
              fieldKey="dateOfEval"
              type="date"
              onSave={saveField}
            />
            <InlineZipField
              zipCode={caseData.zipCode ?? ""}
              metroAreaName={caseData.metroAreaName ?? ""}
              onSave={saveMultipleFields}
            />
          </div>
          <div className="mt-4">
            <InlineField
              label="Notes"
              value={caseData.notes ?? ""}
              fieldKey="notes"
              onSave={saveField}
              multiline
            />
          </div>
        </CardContent>
      </Card>

      {/* Injury & Medical Card - Inline Editable */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Stethoscope className="h-4 w-4" />
            Injury & Medical Context
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <InlineField
                label="Injury Description"
                value={caseData.injuryDescription ?? ""}
                fieldKey="injuryDescription"
                onSave={saveField}
                multiline
              />
            </div>
            <div className="sm:col-span-2">
              <InlineBodyPartsField
                value={caseData.bodyPartsAffected ?? []}
                onSave={saveField}
              />
            </div>
            <InlineField
              label="Treating Physician"
              value={caseData.treatingPhysician ?? ""}
              fieldKey="treatingPhysician"
              onSave={saveField}
            />
            <InlineField
              label="Physician Specialty"
              value={caseData.physicianSpecialty ?? ""}
              fieldKey="physicianSpecialty"
              onSave={saveField}
            />
            <InlineField
              label="MMI Date"
              value={caseData.mmiDate ? caseData.mmiDate.split("T")[0] : ""}
              fieldKey="mmiDate"
              type="date"
              onSave={saveField}
            />
            <InlineField
              label="FCE Date"
              value={caseData.fceDate ? caseData.fceDate.split("T")[0] : ""}
              fieldKey="fceDate"
              type="date"
              onSave={saveField}
            />
            <InlineField
              label="FCE Provider"
              value={caseData.fceProvider ?? ""}
              fieldKey="fceProvider"
              onSave={saveField}
            />
            <InlineField
              label="Surgery Dates"
              value={caseData.surgeryDates ?? ""}
              fieldKey="surgeryDates"
              onSave={saveField}
            />
            <div className="sm:col-span-2">
              <InlineField
                label="Medical Notes"
                value={caseData.medicalNotes ?? ""}
                fieldKey="medicalNotes"
                onSave={saveField}
                multiline
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">TSA Workflow Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1">
            {sections.map((s, i) => (
              <div key={s.href} className="flex items-center flex-1">
                <div className={`flex flex-col items-center text-center flex-1 ${s.status === "blocked" ? "opacity-40" : ""}`}>
                  <StatusIcon status={s.status} />
                  <span className="text-xs mt-1 font-medium">{s.label === "Past Relevant Work" ? "PRW" : s.label.split(" ")[0]}</span>
                </div>
                {i < sections.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className={`hover:bg-muted/50 transition-colors cursor-pointer h-full ${s.status === "ready" ? "border-blue-500/30 bg-blue-50/30 dark:bg-blue-950/10" : ""}`}>
              <CardHeader className="flex flex-row items-start gap-3 pb-2">
                <s.icon className={`h-5 w-5 mt-0.5 ${s.status === "complete" ? "text-green-600" : s.status === "ready" ? "text-blue-500" : "text-muted-foreground"}`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{s.label}</CardTitle>
                    <StatusLabel status={s.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm font-medium">{s.countLabel}</p>
                {s.hint && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{s.hint}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
