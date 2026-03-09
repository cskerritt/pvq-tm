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
import { Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { CaseBreadcrumb } from "@/components/case-breadcrumb";
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

interface ProfileData {
  id?: string;
  profileType: string;
  notes?: string | null;
  sources?: string | null;
  [key: string]: unknown;
}

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
  const [dirty, setDirty] = useState(false);

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
  }, [caseId]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  function setTraitValue(
    profileType: ProfileType,
    trait: TraitKey,
    value: number | null
  ) {
    setProfiles((prev) => ({
      ...prev,
      [profileType]: {
        ...prev[profileType],
        [trait]: value,
      },
    }));
    setDirty(true);
  }

  async function saveAll() {
    setSaving(true);
    try {
      for (const pt of PROFILE_TYPES) {
        const profile = profiles[pt.key];
        if (!profile) continue;
        await fetch(`/api/cases/${caseId}/profiles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        });
      }
      setDirty(false);
      toast.success("Profiles saved");
    } catch {
      toast.error("Failed to save profiles");
    }
    setSaving(false);
  }

  const groupLabels = {
    aptitudes: "Aptitudes",
    physical: "Physical",
    environmental: "Environmental",
  };

  return (
    <div className="p-6 space-y-4">
      <CaseBreadcrumb caseId={caseId} currentPage="Worker Profiles" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Worker Profiles</h1>
          <p className="text-muted-foreground">
            24-trait vector across 4 profile rows
          </p>
        </div>
        <div className="flex gap-2">
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

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="sticky left-0 bg-background px-2 py-1 text-left font-medium min-w-[140px]">
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
                <th className="sticky left-0 bg-background px-2 py-1" />
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
                  <td className="sticky left-0 bg-background px-2 py-2 font-medium">
                    {pt.label}
                  </td>
                  {TRAIT_KEYS.map((trait) => {
                    const value =
                      profiles[pt.key]?.[trait] as number | null | undefined;
                    const numValue =
                      value !== undefined && value !== null ? value : null;
                    return (
                      <td
                        key={trait}
                        className={`px-1 py-1 text-center ${getCellColor(numValue, pt.key === "POST")}`}
                      >
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
          <div className="grid grid-cols-3 gap-4 text-sm">
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
    </div>
  );
}
