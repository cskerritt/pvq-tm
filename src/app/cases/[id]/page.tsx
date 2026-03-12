"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  notes: string | null;
  status: string;
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

  // Re-fetch when component mounts or when navigating back to this page
  useEffect(() => {
    load();
  }, [load, pathname]);

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
          <div className="flex flex-wrap gap-x-4 text-sm text-muted-foreground mt-1">
            {caseData.evaluatorName && <span>Evaluator: {caseData.evaluatorName}</span>}
            {caseData.dateOfInjury && <span>DOI: {new Date(caseData.dateOfInjury).toLocaleDateString()}</span>}
            {caseData.dateOfEval && <span>Eval: {new Date(caseData.dateOfEval).toLocaleDateString()}</span>}
            {caseData.clientDOB && <span>DOB: {new Date(caseData.clientDOB).toLocaleDateString()}</span>}
            {caseData.referralSource && <span>Referral: {caseData.referralSource}</span>}
          </div>
        </div>
        <Badge variant={caseData.status === "active" ? "default" : "secondary"}>
          {caseData.status}
        </Badge>
      </div>

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

      {/* Notes */}
      {caseData.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Case Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{caseData.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
