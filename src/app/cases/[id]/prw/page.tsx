"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Plus, Search, Briefcase, Trash2, Pencil, ExternalLink, Loader2 } from "lucide-react";
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

interface DOTEntry {
  dotCode: string;
  title: string;
  svp: number;
  strength: string;
  skillLevel: string;
  gedR: number;
  gedM: number;
  gedL: number;
  workFields: string[];
  mpsms: string[];
  traits: Record<string, number | null>;
}

// Typical acquired skills based on O*NET SOC major group
const SKILL_TEMPLATES: Record<string, Array<{ verb: string; object: string; context: string; tools?: string }>> = {
  "11": [ // Management
    { verb: "Supervise", object: "staff and daily operations", context: "in organizational setting" },
    { verb: "Develop", object: "strategic plans and budgets", context: "for department operations" },
    { verb: "Coordinate", object: "team schedules and projects", context: "using project management tools", tools: "Microsoft Office, project management software" },
  ],
  "13": [ // Business & Financial
    { verb: "Analyze", object: "financial data and reports", context: "for business operations", tools: "Excel, accounting software" },
    { verb: "Prepare", object: "financial statements and budgets", context: "in compliance with regulations" },
    { verb: "Review", object: "contracts and invoices", context: "for accuracy and compliance" },
  ],
  "15": [ // Computer & Math
    { verb: "Develop", object: "software applications and code", context: "in development environment", tools: "Programming languages, IDEs" },
    { verb: "Troubleshoot", object: "technical issues and system errors", context: "for IT infrastructure" },
    { verb: "Configure", object: "networks and systems", context: "for organizational use", tools: "Servers, network equipment" },
  ],
  "17": [ // Architecture & Engineering
    { verb: "Design", object: "technical plans and specifications", context: "for construction or manufacturing", tools: "CAD software, drafting tools" },
    { verb: "Inspect", object: "structures and systems", context: "for compliance with codes and standards" },
    { verb: "Calculate", object: "load requirements and material specifications", context: "for engineering projects" },
  ],
  "25": [ // Education
    { verb: "Instruct", object: "students in subject matter", context: "in educational setting" },
    { verb: "Develop", object: "lesson plans and curricula", context: "for classroom instruction" },
    { verb: "Evaluate", object: "student performance and progress", context: "using assessment tools" },
  ],
  "29": [ // Healthcare Practitioners
    { verb: "Assess", object: "patient conditions and symptoms", context: "in clinical setting", tools: "Medical instruments, diagnostic equipment" },
    { verb: "Administer", object: "treatments and medications", context: "per physician orders" },
    { verb: "Document", object: "patient care and medical records", context: "in healthcare system", tools: "Electronic health records" },
  ],
  "31": [ // Healthcare Support
    { verb: "Assist", object: "patients with daily living activities", context: "in healthcare facility" },
    { verb: "Monitor", object: "vital signs and patient conditions", context: "under clinical supervision", tools: "Blood pressure cuffs, thermometers" },
    { verb: "Transport", object: "patients and equipment", context: "within healthcare facility" },
  ],
  "35": [ // Food Preparation
    { verb: "Prepare", object: "food items and beverages", context: "in food service environment", tools: "Kitchen equipment, utensils" },
    { verb: "Maintain", object: "sanitation and food safety standards", context: "per health regulations" },
    { verb: "Operate", object: "food preparation equipment", context: "in commercial kitchen", tools: "Ovens, grills, fryers" },
  ],
  "37": [ // Building & Grounds
    { verb: "Clean", object: "facilities and work areas", context: "in commercial or institutional setting", tools: "Cleaning equipment, chemicals" },
    { verb: "Maintain", object: "building systems and grounds", context: "per maintenance schedule", tools: "Hand tools, power equipment" },
    { verb: "Inspect", object: "facilities for maintenance needs", context: "during routine rounds" },
  ],
  "41": [ // Sales
    { verb: "Sell", object: "products and services to customers", context: "in retail or commercial environment" },
    { verb: "Process", object: "customer transactions and orders", context: "using point-of-sale systems", tools: "POS terminals, cash registers" },
    { verb: "Resolve", object: "customer complaints and inquiries", context: "in sales environment" },
  ],
  "43": [ // Office & Administrative
    { verb: "Process", object: "correspondence and documents", context: "in office setting", tools: "Computers, office software" },
    { verb: "Maintain", object: "filing systems and records", context: "for organizational use" },
    { verb: "Schedule", object: "appointments and meetings", context: "using scheduling software", tools: "Calendar software, telephone" },
    { verb: "Enter", object: "data into computer systems", context: "for record keeping", tools: "Keyboard, data entry software" },
  ],
  "47": [ // Construction
    { verb: "Operate", object: "power and hand tools", context: "on construction sites", tools: "Saws, drills, hammers, levels" },
    { verb: "Read", object: "blueprints and specifications", context: "for construction projects" },
    { verb: "Install", object: "building materials and fixtures", context: "per construction plans", tools: "Hand tools, power tools" },
    { verb: "Measure", object: "dimensions and layouts", context: "for accurate construction", tools: "Tape measures, levels, squares" },
  ],
  "49": [ // Installation, Maintenance, Repair
    { verb: "Diagnose", object: "equipment malfunctions", context: "using diagnostic tools", tools: "Multimeters, diagnostic software" },
    { verb: "Repair", object: "mechanical and electrical systems", context: "per manufacturer specifications", tools: "Hand tools, power tools" },
    { verb: "Maintain", object: "equipment per service schedules", context: "in maintenance setting" },
  ],
  "51": [ // Production
    { verb: "Operate", object: "production machinery and equipment", context: "in manufacturing environment", tools: "Production equipment, controls" },
    { verb: "Inspect", object: "products for quality and defects", context: "on production line" },
    { verb: "Assemble", object: "components and finished products", context: "per assembly instructions", tools: "Hand tools, fixtures" },
  ],
  "53": [ // Transportation
    { verb: "Operate", object: "vehicles and transport equipment", context: "for cargo or passenger transport", tools: "Trucks, forklifts, vehicles" },
    { verb: "Load", object: "cargo and materials", context: "for transport or storage", tools: "Forklifts, hand trucks, dollies" },
    { verb: "Inspect", object: "vehicles and equipment", context: "for safe operation" },
  ],
};

const GENERIC_SKILLS = [
  { verb: "Communicate", object: "information to coworkers and supervisors", context: "in work setting" },
  { verb: "Follow", object: "safety procedures and guidelines", context: "in work environment" },
  { verb: "Complete", object: "assigned tasks and responsibilities", context: "per job requirements" },
];

export default function PRWPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;
  const [entries, setEntries] = useState<PRWEntry[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OccSearchResult[]>([]);
  const [selectedOcc, setSelectedOcc] = useState<OccSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [dotEntries, setDotEntries] = useState<DOTEntry[]>([]);
  const [selectedDot, setSelectedDot] = useState<DOTEntry | null>(null);
  const [loadingDot, setLoadingDot] = useState(false);
  const [saving, setSaving] = useState(false);

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
      toast.error("Search failed");
    }
    setSearching(false);
  }

  async function lookupDOT(onetCode: string) {
    setLoadingDot(true);
    setDotEntries([]);
    setSelectedDot(null);
    try {
      const res = await fetch(`/api/occupations/dot-lookup?onet=${encodeURIComponent(onetCode)}`);
      const data = await res.json();
      if (data.dotEntries?.length > 0) {
        setDotEntries(data.dotEntries);
        setSelectedDot(data.dotEntries[0]);
      }
    } catch {
      // DOT lookup failed silently
    }
    setLoadingDot(false);
  }

  function handleSelectOcc(occ: OccSearchResult) {
    setSelectedOcc(occ);
    setSearchResults([]);
    lookupDOT(occ.code);
  }

  function openEdit(entry: PRWEntry) {
    setEditingId(entry.id);
    setSelectedOcc(
      entry.onetSocCode
        ? { code: entry.onetSocCode, title: entry.jobTitle }
        : null
    );
    setDotEntries([]);
    setSelectedDot(null);
    setDialogOpen(true);
  }

  function openNew() {
    setEditingId(null);
    setSelectedOcc(null);
    setSelectedDot(null);
    setDotEntries([]);
    setSearchQuery("");
    setSearchResults([]);
    setDialogOpen(true);
  }

  async function autoPopulateProfiles(dotData: DOTEntry) {
    const profileTypes = ["WORK_HISTORY", "EVALUATIVE", "PRE", "POST"];
    for (const profileType of profileTypes) {
      try {
        await fetch(`/api/cases/${caseId}/profiles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileType,
            ...dotData.traits,
          }),
        });
      } catch {
        // Silent fail
      }
    }
  }

  async function autoPopulateSkills(prwId: string, onetCode: string, dotData: DOTEntry | null) {
    const prefix = onetCode.substring(0, 2);
    const templates = SKILL_TEMPLATES[prefix] ?? GENERIC_SKILLS;
    const allSkills = [...templates];

    if (dotData?.mpsms?.length) {
      const toolsList = dotData.mpsms.slice(0, 3).join(", ");
      if (toolsList) {
        allSkills.push({
          verb: "Operate",
          object: `specialized tools and equipment (${toolsList})`,
          context: "in occupational setting",
          tools: toolsList,
        });
      }
    }

    for (const skill of allSkills) {
      try {
        await fetch(`/api/cases/${caseId}/skills`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prwId,
            actionVerb: skill.verb,
            object: skill.object,
            context: skill.context || null,
            toolsSoftware: skill.tools || null,
            svpLevel: dotData?.svp ?? null,
            evidenceSource: "DOT/O*NET auto-populated",
            isTransferable: true,
          }),
        });
      } catch {
        // Silent fail
      }
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
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

    try {
      const res = await fetch(`/api/cases/${caseId}/prw`, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const savedPrw = await res.json();
        toast.success(editingId ? "PRW updated" : "PRW added");

        if (!editingId && selectedOcc) {
          if (selectedDot) {
            toast.info("Auto-populating worker profiles from DOT data...");
            await autoPopulateProfiles(selectedDot);
          }

          toast.info("Auto-populating acquired skills...");
          await autoPopulateSkills(savedPrw.id, selectedOcc.code, selectedDot);
          toast.success("Profiles and skills auto-populated!");
        }

        setDialogOpen(false);
        setEditingId(null);
        setSelectedOcc(null);
        setSelectedDot(null);
        setDotEntries([]);
        setSearchResults([]);
        setSearchQuery("");

        // Navigate back to case dashboard
        router.push(`/cases/${caseId}`);
      } else {
        toast.error("Failed to save PRW");
      }
    } catch {
      toast.error("Failed to save PRW");
    }
    setSaving(false);
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
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setDotEntries([]); setSelectedDot(null); } }}>
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
              {/* O*NET Search */}
              <div className="space-y-2">
                <Label>O*NET Occupation Search</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search occupations (e.g., carpenter, nurse, cashier)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), searchOccs())
                    }
                  />
                  <Button type="button" variant="outline" onClick={searchOccs} disabled={searching}>
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                {searchResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border rounded-md">
                    {searchResults.map((r) => (
                      <button
                        key={r.code}
                        type="button"
                        onClick={() => handleSelectOcc(r)}
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
                  <Badge variant="outline" className="text-sm">
                    Selected: {selectedOcc.code} — {selectedOcc.title}
                  </Badge>
                )}
              </div>

              {/* DOT Crosswalk Results */}
              {loadingDot && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Looking up DOT crosswalk...
                </div>
              )}
              {dotEntries.length > 0 && (
                <div className="space-y-2">
                  <Label>Corresponding DOT Occupation(s)</Label>
                  <div className="max-h-32 overflow-y-auto border rounded-md">
                    {dotEntries.map((dot) => (
                      <button
                        key={dot.dotCode}
                        type="button"
                        onClick={() => setSelectedDot(dot)}
                        className={`w-full text-left px-3 py-2 text-sm border-b last:border-0 transition-colors ${
                          selectedDot?.dotCode === dot.dotCode
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{dot.dotCode}</span>
                          <span className="font-medium">{dot.title}</span>
                        </div>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">SVP {dot.svp}</Badge>
                          <Badge variant="secondary" className="text-xs">Strength: {dot.strength}</Badge>
                          <Badge variant="secondary" className="text-xs">{dot.skillLevel}</Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                  {selectedDot && (
                    <p className="text-xs text-green-600">
                      DOT data will auto-fill SVP, strength, skill level, and worker profiles.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job Title *</Label>
                  <Input
                    id="jobTitle"
                    name="jobTitle"
                    required
                    defaultValue={editingEntry?.jobTitle ?? selectedOcc?.title ?? ""}
                    key={`title-${selectedOcc?.title ?? editingEntry?.jobTitle ?? ""}`}
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
                  <Input
                    id="dotCode"
                    name="dotCode"
                    placeholder="000.000-000"
                    defaultValue={editingEntry?.dotCode ?? selectedDot?.dotCode ?? ""}
                    key={`dot-${selectedDot?.dotCode ?? editingEntry?.dotCode ?? ""}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onetSocCode">O*NET Code</Label>
                  <Input
                    id="onetSocCode"
                    name="onetSocCode"
                    defaultValue={editingEntry?.onetSocCode ?? selectedOcc?.code ?? ""}
                    key={`onet-${selectedOcc?.code ?? editingEntry?.onetSocCode ?? ""}`}
                    placeholder="00-0000.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="svp">SVP</Label>
                  <Select
                    name="svp"
                    defaultValue={selectedDot?.svp?.toString() ?? editingEntry?.svp?.toString() ?? ""}
                    key={`svp-${selectedDot?.svp ?? editingEntry?.svp ?? ""}`}
                  >
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
                  <Select
                    name="skillLevel"
                    defaultValue={selectedDot?.skillLevel ?? editingEntry?.skillLevel ?? ""}
                    key={`skill-${selectedDot?.skillLevel ?? editingEntry?.skillLevel ?? ""}`}
                  >
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
                  <Select
                    name="strengthLevel"
                    defaultValue={selectedDot?.strength ?? editingEntry?.strengthLevel ?? ""}
                    key={`str-${selectedDot?.strength ?? editingEntry?.strengthLevel ?? ""}`}
                  >
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

              {/* Auto-populate info */}
              {!editingId && selectedOcc && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <p className="font-medium text-green-700 mb-1">Auto-Populate on Save:</p>
                  <ul className="text-muted-foreground space-y-1 text-xs">
                    {selectedDot && <li>Worker Profiles (all 4 rows) from DOT trait data</li>}
                    <li>Acquired Skills Inventory (typical skills for this occupation)</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-1">
                    You can adjust the Evaluative and Post profiles afterward.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingId(null); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : editingId ? "Save Changes" : "Add PRW & Auto-Populate"}
                </Button>
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
              onset. Select an O*NET occupation and the DOT code, SVP, strength,
              skill level, worker profiles, and acquired skills will auto-populate.
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
