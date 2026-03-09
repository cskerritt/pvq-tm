"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Search, Briefcase, Trash2, Pencil, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface PRWEntry {
  id: string;
  jobTitle: string;
  employer: string | null;
  dotCode: string | null;
  onetSocCode: string | null;
  svp: number | null;
  skillLevel: string | null;
  strengthLevel: string | null;
  startDate: string | null;
  endDate: string | null;
  durationMonths: number | null;
  dutiesDescription: string | null;
  isSubstantialGainful: boolean;
  acquiredSkills: { id: string }[];
}

interface OccSearchResult {
  code: string;
  title: string;
  relevance_score?: number;
  cached?: boolean;
}

export default function PRWPage() {
  const params = useParams();
  const caseId = params.id as string;
  const [entries, setEntries] = useState<PRWEntry[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OccSearchResult[]>([]);
  const [selectedOcc, setSelectedOcc] = useState<OccSearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/prw`);
      setEntries(await res.json());
    } catch {
      toast.error("Failed to load data");
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function searchOccs() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/occupations/search?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      const merged = [...(data.onet ?? []), ...(data.local ?? [])];
      const seen = new Set<string>();
      setSearchResults(merged.filter((r: OccSearchResult) => {
        if (seen.has(r.code)) return false;
        seen.add(r.code);
        return true;
      }));
    } catch {
      toast.error("Failed to load data");
    }
    setSearching(false);
  }

  function openEdit(entry: PRWEntry) {
    setEditingId(entry.id);
    setSelectedOcc(
      entry.onetSocCode
        ? { code: entry.onetSocCode, title: entry.jobTitle }
        : null
    );
    setDialogOpen(true);
  }

  function openNew() {
    setEditingId(null);
    setSelectedOcc(null);
    setSearchQuery("");
    setSearchResults([]);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const svpVal = form.get("svp");
    const data = {
      ...(editingId ? { id: editingId } : {}),
      jobTitle: form.get("jobTitle"),
      employer: form.get("employer") || null,
      dotCode: form.get("dotCode") || null,
      onetSocCode: selectedOcc?.code || form.get("onetSocCode") || null,
      svp: svpVal ? parseInt(svpVal as string) : null,
      skillLevel: form.get("skillLevel") || null,
      strengthLevel: form.get("strengthLevel") || null,
      startDate: form.get("startDate") || null,
      endDate: form.get("endDate") || null,
      durationMonths: form.get("durationMonths")
        ? parseInt(form.get("durationMonths") as string)
        : null,
      dutiesDescription: form.get("dutiesDescription") || null,
    };

    const res = await fetch(`/api/cases/${caseId}/prw`, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      toast.success(editingId ? "PRW updated" : "PRW added");
      setDialogOpen(false);
      setEditingId(null);
      setSelectedOcc(null);
      setSearchResults([]);
      setSearchQuery("");
      load();
    } else {
      toast.error("Failed to save PRW");
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}" and all its acquired skills?`)) return;
    const res = await fetch(`/api/cases/${caseId}/prw?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("PRW deleted");
      load();
    } else {
      toast.error("Failed to delete");
    }
  }

  function getSvpLabel(svp: number | null): string {
    if (svp === null) return "\u2014";
    if (svp <= 3) return `${svp} (Unskilled)`;
    if (svp <= 6) return `${svp} (Semi-skilled)`;
    return `${svp} (Skilled)`;
  }

  const editingEntry = editingId
    ? entries.find((e) => e.id === editingId)
    : null;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Past Relevant Work</h1>
          <p className="text-muted-foreground">
            Employment history with DOT/O*NET codes. Document all jobs held in
            the 15 years before disability onset.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingId(null); }}>
          <DialogTrigger render={<Button onClick={openNew} />}>
            <Plus className="mr-2 h-4 w-4" />
            Add PRW
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Past Relevant Work" : "Add Past Relevant Work"}
              </DialogTitle>
            </DialogHeader>
            <form key={editingId ?? "new"} onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>O*NET Occupation Search</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search occupations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), searchOccs())
                    }
                  />
                  <Button type="button" variant="outline" onClick={searchOccs} disabled={searching}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                {searchResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border rounded-md">
                    {searchResults.map((r) => (
                      <button
                        key={r.code}
                        type="button"
                        onClick={() => { setSelectedOcc(r); setSearchResults([]); }}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0"
                      >
                        <span className="font-mono text-xs mr-2">{r.code}</span>
                        {r.title}
                        {r.cached && <Badge variant="secondary" className="ml-2 text-xs">cached</Badge>}
                      </button>
                    ))}
                  </div>
                )}
                {selectedOcc && (
                  <Badge variant="outline">
                    Selected: {selectedOcc.code} — {selectedOcc.title}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job Title *</Label>
                  <Input
                    id="jobTitle"
                    name="jobTitle"
                    required
                    defaultValue={editingEntry?.jobTitle ?? selectedOcc?.title ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employer">Employer</Label>
                  <Input id="employer" name="employer" defaultValue={editingEntry?.employer ?? ""} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dotCode">DOT Code</Label>
                  <Input id="dotCode" name="dotCode" placeholder="000.000-000" defaultValue={editingEntry?.dotCode ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onetSocCode">O*NET Code</Label>
                  <Input
                    id="onetSocCode"
                    name="onetSocCode"
                    defaultValue={editingEntry?.onetSocCode ?? selectedOcc?.code ?? ""}
                    placeholder="00-0000.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="svp">SVP</Label>
                  <Select name="svp" defaultValue={editingEntry?.svp?.toString() ?? ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => (
                        <SelectItem key={v} value={String(v)}>
                          {getSvpLabel(v)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="skillLevel">Skill Level</Label>
                  <Select name="skillLevel" defaultValue={editingEntry?.skillLevel ?? ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unskilled">Unskilled</SelectItem>
                      <SelectItem value="semiskilled">Semi-skilled</SelectItem>
                      <SelectItem value="skilled">Skilled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="strengthLevel">Strength</Label>
                  <Select name="strengthLevel" defaultValue={editingEntry?.strengthLevel ?? ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="S">Sedentary</SelectItem>
                      <SelectItem value="L">Light</SelectItem>
                      <SelectItem value="M">Medium</SelectItem>
                      <SelectItem value="H">Heavy</SelectItem>
                      <SelectItem value="V">Very Heavy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="durationMonths">Duration (months)</Label>
                  <Input id="durationMonths" name="durationMonths" type="number" defaultValue={editingEntry?.durationMonths ?? ""} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" name="startDate" type="date" defaultValue={editingEntry?.startDate?.split("T")[0] ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" name="endDate" type="date" defaultValue={editingEntry?.endDate?.split("T")[0] ?? ""} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dutiesDescription">Duties Description</Label>
                <Textarea id="dutiesDescription" name="dutiesDescription" rows={3} defaultValue={editingEntry?.dutiesDescription ?? ""} />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingId(null); }}>
                  Cancel
                </Button>
                <Button type="submit">{editingId ? "Save Changes" : "Add PRW"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">
              No past relevant work entries yet
            </p>
            <p className="text-xs text-muted-foreground">
              Add each job the evaluee held in the 15 years before disability
              onset. Include DOT/O*NET codes, SVP, and strength level.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <Card key={e.id}>
              <CardContent className="py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{e.jobTitle}</p>
                      {e.onetSocCode && (
                        <Link
                          href={`/occupations/${e.onetSocCode}`}
                          className="text-blue-600 hover:underline"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {e.employer && `${e.employer} | `}
                      {e.onetSocCode && <span className="font-mono">{e.onetSocCode}</span>}
                      {e.dotCode && <span className="font-mono ml-2">{e.dotCode}</span>}
                      {e.durationMonths && ` | ${e.durationMonths} months`}
                      {e.startDate && ` | ${new Date(e.startDate).toLocaleDateString()}`}
                      {e.endDate && ` \u2013 ${new Date(e.endDate).toLocaleDateString()}`}
                    </p>
                    {e.dutiesDescription && (
                      <p className="text-sm mt-1 text-muted-foreground line-clamp-2">
                        {e.dutiesDescription}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {e.svp !== null && <Badge variant="outline">SVP {e.svp}</Badge>}
                    {e.strengthLevel && <Badge variant="secondary">{e.strengthLevel}</Badge>}
                    {e.skillLevel && <Badge variant="secondary">{e.skillLevel}</Badge>}
                    <Badge variant="outline">{e.acquiredSkills.length} skills</Badge>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(e.id, e.jobTitle)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
