"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Wrench, CheckCircle, XCircle, Trash2, Pencil, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CaseBreadcrumb } from "@/components/case-breadcrumb";

interface PRWEntry {
  id: string;
  jobTitle: string;
  svp: number | null;
  onetSocCode: string | null;
  strengthLevel: string | null;
  dutiesDescription: string | null;
}

interface SkillEntry {
  id: string;
  actionVerb: string;
  object: string;
  context: string | null;
  toolsSoftware: string | null;
  materialsServices: string | null;
  svpLevel: number | null;
  evidenceSource: string | null;
  frequency: string | null;
  recency: string | null;
  performanceMode: string | null;
  isTransferable: boolean;
  prw: PRWEntry;
  prwId: string;
}

export default function SkillsPage() {
  const params = useParams();
  const caseId = params.id as string;
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [prwList, setPrwList] = useState<PRWEntry[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [generatingAI, setGeneratingAI] = useState(false);

  const load = useCallback(async () => {
    try {
      const [skillsRes, prwRes] = await Promise.all([
        fetch(`/api/cases/${caseId}/skills`),
        fetch(`/api/cases/${caseId}/prw`),
      ]);
      setSkills(await skillsRes.json());
      setPrwList(await prwRes.json());
    } catch {
      toast.error("Failed to load data");
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(skill: SkillEntry) {
    setEditingId(skill.id);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const svpVal = form.get("svpLevel");
    const data = {
      ...(editingId ? { id: editingId } : {}),
      prwId: form.get("prwId"),
      actionVerb: form.get("actionVerb"),
      object: form.get("object"),
      context: form.get("context") || null,
      toolsSoftware: form.get("toolsSoftware") || null,
      materialsServices: form.get("materialsServices") || null,
      svpLevel: svpVal ? parseInt(svpVal as string) : null,
      evidenceSource: form.get("evidenceSource") || null,
      frequency: form.get("frequency") || null,
      recency: form.get("recency") || null,
      performanceMode: form.get("performanceMode") || null,
      isTransferable: form.get("isTransferable") === "true",
    };

    const res = await fetch(`/api/cases/${caseId}/skills`, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      toast.success(editingId ? "Skill updated" : "Skill added");
      setDialogOpen(false);
      setEditingId(null);
      load();
    } else {
      toast.error("Failed to save skill");
    }
  }

  async function handleDelete(id: string, verb: string, obj: string) {
    if (!confirm(`Delete skill "${verb} ${obj}"?`)) return;
    const res = await fetch(`/api/cases/${caseId}/skills?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Skill deleted");
      load();
    } else {
      toast.error("Failed to delete");
    }
  }

  async function generateAISkills(prw: PRWEntry) {
    setGeneratingAI(true);
    try {
      const res = await fetch("/api/ai/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: prw.jobTitle,
          onetCode: prw.onetSocCode ?? undefined,
          svp: prw.svp ?? undefined,
          strength: prw.strengthLevel ?? undefined,
          dutiesDescription: prw.dutiesDescription ?? undefined,
        }),
      });

      if (res.status === 503) {
        toast.error("AI not available — OpenAI key not configured");
        return;
      }

      const data = await res.json();
      if (data.skills?.length > 0) {
        let count = 0;
        for (const skill of data.skills) {
          const saveRes = await fetch(`/api/cases/${caseId}/skills`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prwId: prw.id,
              actionVerb: skill.actionVerb,
              object: skill.object,
              context: skill.context || null,
              toolsSoftware: skill.toolsSoftware || null,
              svpLevel: prw.svp ?? null,
              evidenceSource: "AI-generated (OpenAI)",
              isTransferable: true,
            }),
          });
          if (saveRes.ok) count++;
        }
        toast.success(`${count} AI-generated skills added for "${prw.jobTitle}"`);
        load();
      } else {
        toast.error("AI could not generate skills");
      }
    } catch {
      toast.error("Failed to generate skills");
    }
    setGeneratingAI(false);
  }

  const editingSkill = editingId ? skills.find((s) => s.id === editingId) : null;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <CaseBreadcrumb caseId={caseId} currentPage="Acquired Skills" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Acquired Skill Inventory</h1>
          <p className="text-muted-foreground">
            Document transferable skills from each PRW entry using SSA format:
            Action Verb + Object + Context
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingId(null); }}>
          <DialogTrigger render={<Button disabled={prwList.length === 0} onClick={openNew} />}>
            <Plus className="mr-2 h-4 w-4" />
            Add Skill
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Acquired Skill" : "Add Acquired Skill"}</DialogTitle>
            </DialogHeader>
            <form key={editingId ?? "new"} onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Source PRW *</Label>
                <Select name="prwId" required defaultValue={editingSkill?.prwId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select PRW" />
                  </SelectTrigger>
                  <SelectContent>
                    {prwList.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.jobTitle} (SVP {p.svp ?? "?"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="actionVerb">Action Verb *</Label>
                  <Input
                    id="actionVerb"
                    name="actionVerb"
                    required
                    placeholder="e.g. operated, supervised, calibrated"
                    defaultValue={editingSkill?.actionVerb ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="object">Object *</Label>
                  <Input
                    id="object"
                    name="object"
                    required
                    placeholder="What was acted upon"
                    defaultValue={editingSkill?.object ?? ""}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="context">Context</Label>
                <Input
                  id="context"
                  name="context"
                  placeholder="Industry/setting context"
                  defaultValue={editingSkill?.context ?? ""}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="toolsSoftware">Tools / Software</Label>
                  <Input
                    id="toolsSoftware"
                    name="toolsSoftware"
                    placeholder="Specific tools or software"
                    defaultValue={editingSkill?.toolsSoftware ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="materialsServices">Materials / Services</Label>
                  <Input
                    id="materialsServices"
                    name="materialsServices"
                    placeholder="Materials, products, processes"
                    defaultValue={editingSkill?.materialsServices ?? ""}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label>SVP Level</Label>
                  <Select name="svpLevel" defaultValue={editingSkill?.svpLevel?.toString() ?? ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => (
                        <SelectItem key={v} value={String(v)}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select name="frequency" defaultValue={editingSkill?.frequency ?? ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Recency</Label>
                  <Select name="recency" defaultValue={editingSkill?.recency ?? ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Current</SelectItem>
                      <SelectItem value="<5yr">&lt;5 years</SelectItem>
                      <SelectItem value="5-10yr">5-10 years</SelectItem>
                      <SelectItem value=">10yr">&gt;10 years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label>Performance Mode</Label>
                  <Select name="performanceMode" defaultValue={editingSkill?.performanceMode ?? ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="independent">Independent</SelectItem>
                      <SelectItem value="supervisory">Supervisory</SelectItem>
                      <SelectItem value="assistive">Assistive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Meets SSA Transferable Skill Definition?</Label>
                  <Select name="isTransferable" defaultValue={editingSkill?.isTransferable?.toString() ?? "true"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    SSA criteria: SVP {"\u2265"}4, &gt;30 days to learn, requires judgment beyond simple instructions
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="evidenceSource">Evidence Source</Label>
                <Input
                  id="evidenceSource"
                  name="evidenceSource"
                  placeholder="Where this was documented"
                  defaultValue={editingSkill?.evidenceSource ?? ""}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingId(null); }}>
                  Cancel
                </Button>
                <Button type="submit">{editingId ? "Save Changes" : "Add Skill"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* AI Generate Skills for PRW */}
      {prwList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              AI Skill Generation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Generate occupation-specific acquired skills using AI for each PRW entry.
            </p>
            <div className="flex flex-wrap gap-2">
              {prwList.map((prw) => (
                <Button
                  key={prw.id}
                  variant="outline"
                  size="sm"
                  disabled={generatingAI}
                  onClick={() => generateAISkills(prw)}
                >
                  {generatingAI ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1 h-3 w-3" />
                  )}
                  Generate for &quot;{prw.jobTitle}&quot;
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {prwList.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-muted-foreground">
              Add Past Relevant Work entries before adding skills.
            </p>
          </CardContent>
        </Card>
      )}

      {skills.length === 0 && prwList.length > 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">
              No acquired skills documented yet
            </p>
            <p className="text-xs text-muted-foreground">
              Use the AI buttons above, or manually add skills using the format: Action Verb (e.g. &quot;operated&quot;) +
              Object (e.g. &quot;CNC lathe&quot;) + Context (e.g. &quot;in manufacturing setting&quot;)
            </p>
          </CardContent>
        </Card>
      ) : skills.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Object</TableHead>
                  <TableHead>Context</TableHead>
                  <TableHead>Source PRW</TableHead>
                  <TableHead>Tools</TableHead>
                  <TableHead>SVP</TableHead>
                  <TableHead>Freq.</TableHead>
                  <TableHead className="text-center">Transferable</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skills.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.actionVerb}</TableCell>
                    <TableCell>{s.object}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.context ?? "\u2014"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.prw.jobTitle}</TableCell>
                    <TableCell className="text-sm">{s.toolsSoftware ?? "\u2014"}</TableCell>
                    <TableCell>{s.svpLevel ?? "\u2014"}</TableCell>
                    <TableCell className="text-sm">{s.frequency ?? "\u2014"}</TableCell>
                    <TableCell className="text-center">
                      {s.isTransferable ? (
                        <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(s.id, s.actionVerb, s.object)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {skills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Badge variant="outline">{skills.length} total skills</Badge>
            <Badge variant="default">{skills.filter((s) => s.isTransferable).length} transferable</Badge>
            <Badge variant="secondary">{skills.filter((s) => !s.isTransferable).length} non-transferable</Badge>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
