"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewCasePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const data = {
      clientName: form.get("clientName"),
      clientDOB: form.get("clientDOB") || null,
      evaluatorName: form.get("evaluatorName") || null,
      referralSource: form.get("referralSource") || null,
      dateOfInjury: form.get("dateOfInjury") || null,
      dateOfEval: form.get("dateOfEval") || null,
      notes: form.get("notes") || null,
    };

    const res = await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const newCase = await res.json();
      router.push(`/cases/${newCase.id}`);
    }
    setSaving(false);
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">New Case</h1>
      <Card>
        <CardHeader>
          <CardTitle>Case Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name *</Label>
                <Input id="clientName" name="clientName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientDOB">Date of Birth</Label>
                <Input id="clientDOB" name="clientDOB" type="date" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="evaluatorName">Evaluator Name</Label>
                <Input id="evaluatorName" name="evaluatorName" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="referralSource">Referral Source</Label>
                <Input id="referralSource" name="referralSource" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateOfInjury">Date of Injury</Label>
                <Input id="dateOfInjury" name="dateOfInjury" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfEval">Date of Evaluation</Label>
                <Input id="dateOfEval" name="dateOfEval" type="date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={4} />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create Case"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
