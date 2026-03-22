"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, RotateCcw, Zap, Info } from "lucide-react";
import { toast } from "sonner";
import { CaseBreadcrumb } from "@/components/case-breadcrumb";
import { WizardNav, WizardNavButtons } from "@/components/wizard-nav";
import {
  TRAIT_KEYS,
  TRAIT_LABELS,
  TRAIT_GROUPS,
  STRENGTH_LABELS,
  FREQUENCY_LABELS,
  type TraitKey,
} from "@/lib/engine/traits";

const PROFILE_TYPES = [
  { key: "WORK_HISTORY", label: "Work History" },
  { key: "EVALUATIVE", label: "Evaluative" },
  { key: "PRE", label: "Pre-Profile" },
  { key: "POST", label: "Post-Profile" },
] as const;

type ProfileType = (typeof PROFILE_TYPES)[number]["key"];

interface TraitSourceEntry {
  source: string;
  date?: string;
  notes?: string;
}

interface ProfileData {
  id?: string;
  profileType: string;
  notes?: string | null;
  sources?: string | null;
  traitSources?: Record<string, TraitSourceEntry> | null;
  [key: string]: unknown;
}

const TRAIT_SOURCE_OPTIONS = [
  "FCE Report",
  "Medical Records",
  "Treating Physician",
  "Vocational Testing",
  "Worker Self-Report",
  "Evaluator Observation",
  "Other",
];

function getTraitLabel(trait: TraitKey, value: number | null): string {
  if (value === null) return "—";
  if (trait === "strength") return STRENGTH_LABELS[value] ?? String(value);
  return FREQUENCY_LABELS[value] ?? String(value);
}

function getCellColor(value: number | null, isPost = false): string {
  if (value === null) return "";
  if (isPost) {
    // Post-profile uses inverse coloring (lower = more restrictive)
    if (value <= 1) return "bg-red-100 dark:bg-red-950";
    if (value === 2) return "bg-yellow-100 dark:bg-yellow-950";
    return "bg-green-100 dark:bg-green-950";
  }
  // Demand coloring (higher = more demanding)
  if (value >= 3) return "bg-red-100 dark:bg-red-950";
  if (value === 2) return "bg-yellow-100 dark:bg-yellow-950";
  return "bg-green-100 dark:bg-green-950";
}

export default function ProfilesPage() {
  const params = useParams();
  const caseId = params.id as string;
  const [profiles, setProfiles] = useState<Record<ProfileType, ProfileData>>(
    {} as Record<ProfileType, ProfileData>
  );
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [traitSources, setTraitSources] = useState<Record<string, TraitSourceEntry>>({});
  const [autoAnalyzed, setAutoAnalyzed] = useState(false);

  function setTraitSource(trait: string, field: keyof TraitSourceEntry, value: string | null) {
    setTraitSources((prev) => ({
      ...prev,
      [trait]: {
        ...prev[trait],
        source: prev[trait]?.source ?? "",
        [field]: value,
      },
    }));
    setDirty(true);
  }

  const loadProfiles = useCallback(async () => {
    let data: ProfileData[];
    try {
      const res = await fetch(`/api/cases/${caseId}/profiles`);
      const raw = await res.json();
      data = Array.isArray(raw) ? raw : [];
    } catch {
      toast.error("Failed to load data");
      return;
    }
    const map: Record<string, ProfileData> = {};
    for (const p of data) {
      map[p.profileType] = p;
    }
    // Ensure all four profile types exist
    for (const pt of PROFILE_TYPES) {
      if (!map[pt.key]) {
        map[pt.key] = { profileType: pt.key };
      }
    }
    setProfiles(map as Record<ProfileType, ProfileData>);
    // Load trait sources from POST profile
    if (map["POST"]?.traitSources && typeof map["POST"].traitSources === "object") {
      setTraitSources(map["POST"].traitSources as Record<string, TraitSourceEntry>);
    }
  }, [caseId]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  // Auto-analyze PRW when profiles are empty (first visit)
  useEffect(() => {
    if (autoAnalyzed || analyzing || dirty) return;
    // Check if WORK_HISTORY row is completely empty (no traits filled)
    const wh = profiles.WORK_HISTORY;
    if (!wh) return;
    const hasAnyTrait = TRAIT_KEYS.some(
      (k) => wh[k] !== undefined && wh[k] !== null
    );
    if (!hasAnyTrait) {
      setAutoAnalyzed(true);
      analyzePRW();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, autoAnalyzed, analyzing, dirty]);

  function setTraitValue(
    profileType: ProfileType,
    trait: TraitKey,
    value: number | null
  ) {
    // Validate: only allow null or integers 0-4
    if (value !== null && (value < 0 || value > 4 || !Number.isInteger(value))) {
      toast.error(`Invalid value: ${value}. Trait values must be 0-4.`);
      return;
    }
    setProfiles((prev) => {
      const updated = {
        ...prev,
        [profileType]: {
          ...prev[profileType],
          [trait]: value,
        },
      };
      // Evaluative edits cascade to Post-Profile
      if (profileType === "EVALUATIVE") {
        updated.POST = {
          ...updated.POST,
          [trait]: value,
        };
      }
      return updated;
    });
    setDirty(true);
  }

  async function saveAll() {
    setSaving(true);
    try {
      for (const pt of PROFILE_TYPES) {
        const profile = profiles[pt.key];
        if (!profile) continue;
        const payload = pt.key === "POST"
          ? { ...profile, traitSources }
          : profile;
        await fetch(`/api/cases/${caseId}/profiles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setDirty(false);
      toast.success("Profiles saved");
    } catch {
      toast.error("Failed to save profiles");
    }
    setSaving(false);
  }

  async function analyzePRW() {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/profiles/analyze`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Analysis failed");
        setAnalyzing(false);
        return;
      }
      const data = await res.json();
      const meta = data._meta;

      // Populate all 4 rows identically — no assumed reduction
      setProfiles((prev) => {
        const traitValues: Record<string, number> = {};
        let filled = 0;
        for (const key of TRAIT_KEYS) {
          if (data[key] !== undefined && data[key] !== null) {
            traitValues[key] = data[key];
            filled++;
          }
        }

        const updated = { ...prev };
        for (const pt of PROFILE_TYPES) {
          updated[pt.key] = {
            ...updated[pt.key],
            ...traitValues,
          };
        }

        toast.success(
          `Auto-filled ${filled}/${meta?.totalTraits ?? 24} traits across all profiles from ${meta?.jobsAnalyzed ?? "?"} PRW jobs`
        );
        return updated;
      });
      setDirty(true);
    } catch {
      toast.error("Failed to analyze PRW data");
    }
    setAnalyzing(false);
  }

  const groupLabels = {
    aptitudes: "Aptitudes",
    physical: "Physical",
    environmental: "Environmental",
  };

  return (
    <div>
      <WizardNav caseId={caseId} currentStep={4} />
      <div className="p-4 md:p-6 space-y-4">
      <CaseBreadcrumb caseId={caseId} currentPage="Worker Profiles" />

      {/* Auto-analysis banner */}
      {analyzing && (
        <Card className="border-blue-300 bg-blue-50 dark:bg-blue-950">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
              <div>
                <p className="font-semibold text-blue-800 dark:text-blue-200">
                  Analyzing Past Relevant Work...
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-300">
                  Building all 24 traits from DOT, O*NET, and ORS data for your PRW entries. All 4 profile rows will be populated automatically.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Post-analysis instruction banner */}
      {!analyzing && dirty && !saving && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950">
          <CardContent className="py-4">
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-200">
                ✏️ Review & Adjust the Evaluative Profile
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-300">
                All 4 profiles were auto-filled from PRW data. Now adjust the <strong>Evaluative</strong> row to reflect medical restrictions (FCE results, physician opinions, vocational testing). Changes to the Evaluative row automatically update the Post-Injury row. Then click <strong>Save All</strong>.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Worker Profiles</h1>
          <p className="text-muted-foreground">
            24-trait vector across 4 profile rows
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={analyzePRW}
            disabled={saving || analyzing}
          >
            <Zap className="mr-2 h-4 w-4" />
            {analyzing ? "Analyzing..." : "Analyze PRW"}
          </Button>
          <Button
            variant="outline"
            onClick={loadProfiles}
            disabled={saving}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button onClick={saveAll} disabled={saving || !dirty}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save All"}
          </Button>
        </div>
      </div>

      {dirty && (
        <Badge variant="outline" className="text-amber-600">
          Unsaved changes
        </Badge>
      )}

      {/* Mobile Card Layout */}
      <div className="md:hidden space-y-4">
        {PROFILE_TYPES.map((pt) => (
          <Card key={pt.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{pt.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(TRAIT_GROUPS).map(([group, traits]) => (
                <div key={group}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    {groupLabels[group as keyof typeof groupLabels]}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(traits as readonly TraitKey[]).map((trait) => {
                      const value =
                        profiles[pt.key]?.[trait] as number | null | undefined;
                      const numValue =
                        value !== undefined && value !== null ? value : null;
                      const hasSource = pt.key === "POST" && traitSources[trait]?.source;
                      return (
                        <div
                          key={trait}
                          className={`flex items-center justify-between rounded-md px-2 py-1 ${getCellColor(numValue, pt.key === "POST")}`}
                        >
                          <span className="text-xs truncate mr-1 flex items-center gap-1">
                            {TRAIT_LABELS[trait]}
                            {hasSource && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" />}
                          </span>
                          <div className="flex items-center gap-1">
                            <Select
                              value={numValue !== null ? String(numValue) : "null"}
                              onValueChange={(v) =>
                                setTraitValue(
                                  pt.key,
                                  trait,
                                  !v || v === "null" ? null : parseInt(v)
                                )
                              }
                            >
                              <SelectTrigger className="h-8 w-16 text-xs px-1 shrink-0">
                                <SelectValue>
                                  {numValue !== null ? numValue : "—"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="null">—</SelectItem>
                                {[0, 1, 2, 3, 4].map((v) => (
                                  <SelectItem key={v} value={String(v)}>
                                    {v} - {getTraitLabel(trait, v)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {pt.key === "POST" && (
                              <Popover>
                                <PopoverTrigger
                                  render={
                                    <button type="button" className="shrink-0 p-0.5 rounded hover:bg-muted relative">
                                      <Info className="h-3 w-3 text-muted-foreground" />
                                    </button>
                                  }
                                />
                                <PopoverContent side="bottom" align="end" className="w-64 p-3">
                                  <div className="space-y-2">
                                    <p className="text-xs font-medium">Source for {TRAIT_LABELS[trait]}</p>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Source</Label>
                                      <Select
                                        value={traitSources[trait]?.source ?? ""}
                                        onValueChange={(v) => setTraitSource(trait, "source", v)}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue placeholder="Select source" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {TRAIT_SOURCE_OPTIONS.map((s) => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Date (optional)</Label>
                                      <Input
                                        type="date"
                                        className="h-8 text-xs"
                                        value={traitSources[trait]?.date ?? ""}
                                        onChange={(e) => setTraitSource(trait, "date", e.target.value)}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Notes (optional)</Label>
                                      <Input
                                        className="h-8 text-xs"
                                        placeholder="e.g., No overhead reach per Dr. Smith"
                                        value={traitSources[trait]?.notes ?? ""}
                                        onChange={(e) => setTraitSource(trait, "notes", e.target.value)}
                                      />
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop Table Layout */}
      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto pt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="sticky left-0 z-20 bg-background px-2 py-1 text-left font-medium min-w-[140px]">
                  Profile
                </th>
                {Object.entries(TRAIT_GROUPS).map(([group, traits]) => (
                  <th
                    key={group}
                    colSpan={traits.length}
                    className="px-1 py-1 text-center font-semibold border-l"
                  >
                    {groupLabels[group as keyof typeof groupLabels]}
                  </th>
                ))}
              </tr>
              <tr className="border-b">
                <th className="sticky left-0 z-20 bg-background px-2 py-1" />
                {TRAIT_KEYS.map((trait) => (
                  <th
                    key={trait}
                    className="px-1 py-1 text-center text-xs font-normal text-muted-foreground"
                    style={{ minWidth: "60px", writingMode: "vertical-rl" }}
                  >
                    <Tooltip>
                      <TooltipTrigger className="cursor-help">
                          {TRAIT_LABELS[trait]}
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{TRAIT_LABELS[trait]}</p>
                        <p className="text-xs text-muted-foreground">
                          Scale: 0-4
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROFILE_TYPES.map((pt) => (
                <tr key={pt.key} className="border-b hover:bg-muted/30">
                  <td className="sticky left-0 z-20 bg-background px-2 py-2 font-medium">
                    {pt.label}
                  </td>
                  {TRAIT_KEYS.map((trait) => {
                    const value =
                      profiles[pt.key]?.[trait] as number | null | undefined;
                    const numValue =
                      value !== undefined && value !== null ? value : null;
                    const hasSource = pt.key === "POST" && traitSources[trait]?.source;
                    return (
                      <td
                        key={trait}
                        className={`px-1 py-1 text-center ${getCellColor(numValue, pt.key === "POST")}`}
                      >
                        <div className="flex items-center gap-0.5">
                          <Select
                            value={numValue !== null ? String(numValue) : "null"}
                            onValueChange={(v) =>
                              setTraitValue(
                                pt.key,
                                trait,
                                !v || v === "null" ? null : parseInt(v)
                              )
                            }
                          >
                            <SelectTrigger className="h-8 w-14 text-xs px-1">
                              <SelectValue>
                                {numValue !== null ? numValue : "—"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="null">—</SelectItem>
                              {[0, 1, 2, 3, 4].map((v) => (
                                <SelectItem key={v} value={String(v)}>
                                  {v} - {getTraitLabel(trait, v)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {pt.key === "POST" && (
                            <Popover>
                              <PopoverTrigger
                                render={
                                  <button type="button" className="shrink-0 p-0.5 rounded hover:bg-muted relative">
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                    {hasSource && (
                                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-500" />
                                    )}
                                  </button>
                                }
                              />
                              <PopoverContent side="bottom" align="start" className="w-64 p-3">
                                <div className="space-y-2">
                                  <p className="text-xs font-medium">Source for {TRAIT_LABELS[trait]}</p>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Source</Label>
                                    <Select
                                      value={traitSources[trait]?.source ?? ""}
                                      onValueChange={(v) => setTraitSource(trait, "source", v)}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Select source" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {TRAIT_SOURCE_OPTIONS.map((s) => (
                                          <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Date (optional)</Label>
                                    <Input
                                      type="date"
                                      className="h-8 text-xs"
                                      value={traitSources[trait]?.date ?? ""}
                                      onChange={(e) => setTraitSource(trait, "date", e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Notes (optional)</Label>
                                    <Input
                                      className="h-8 text-xs"
                                      placeholder="e.g., No overhead reach per Dr. Smith"
                                      value={traitSources[trait]?.notes ?? ""}
                                      onChange={(e) => setTraitSource(trait, "notes", e.target.value)}
                                    />
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Scale Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium mb-1">Strength</p>
              {Object.entries(STRENGTH_LABELS).map(([k, v]) => (
                <p key={k} className="text-muted-foreground">
                  {k} = {v}
                </p>
              ))}
            </div>
            <div>
              <p className="font-medium mb-1">Frequency / Aptitude Level</p>
              {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                <p key={k} className="text-muted-foreground">
                  {k} = {v}
                </p>
              ))}
            </div>
            <div>
              <p className="font-medium mb-1">Color Coding</p>
              <p className="text-muted-foreground">
                <span className="inline-block w-3 h-3 bg-green-100 border mr-1" />
                Low demand / high capacity
              </p>
              <p className="text-muted-foreground">
                <span className="inline-block w-3 h-3 bg-yellow-100 border mr-1" />
                Moderate
              </p>
              <p className="text-muted-foreground">
                <span className="inline-block w-3 h-3 bg-red-100 border mr-1" />
                High demand / low capacity
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <WizardNavButtons caseId={caseId} currentStep={4} />
      </div>
    </div>
  );
}
