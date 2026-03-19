"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Step Configuration ────────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { num: 1, label: "Case Info", shortLabel: "Info", path: "" },
  { num: 2, label: "Past Work", shortLabel: "PRW", path: "/prw" },
  { num: 3, label: "Skills", shortLabel: "Skills", path: "/skills" },
  { num: 4, label: "Profiles", shortLabel: "Profiles", path: "/profiles" },
  { num: 5, label: "Analysis", shortLabel: "Analysis", path: "/analysis" },
  { num: 6, label: "Results", shortLabel: "Results", path: "/results" },
  { num: 7, label: "Comparison", shortLabel: "Compare", path: "/comparison" },
  { num: 8, label: "Report", shortLabel: "Report", path: "/report" },
] as const;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface WizardNavProps {
  caseId: string;
  currentStep: number; // 1-8
  completedSteps?: number[]; // which steps have data
}

interface WizardStatus {
  completedSteps: number[];
  currentStep: number;
  clientName: string;
}

// ─── Step Circle Component ─────────────────────────────────────────────────────

function StepCircle({
  step,
  isCurrentStep,
  isCompleted,
  isClickable,
  onClick,
}: {
  step: (typeof WIZARD_STEPS)[number];
  isCurrentStep: boolean;
  isCompleted: boolean;
  isClickable: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={cn(
        "flex flex-col items-center gap-1 group relative",
        isClickable ? "cursor-pointer" : "cursor-default"
      )}
      title={
        isClickable
          ? `Go to ${step.label}`
          : `${step.label} — complete earlier steps first`
      }
    >
      {/* Circle */}
      <div
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold border-2 transition-all",
          isCurrentStep &&
            "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25",
          isCompleted &&
            !isCurrentStep &&
            "bg-green-600 text-white border-green-600",
          !isCurrentStep &&
            !isCompleted &&
            "bg-muted text-muted-foreground border-muted-foreground/20",
          isClickable &&
            !isCurrentStep &&
            "group-hover:border-primary/50 group-hover:shadow-sm"
        )}
      >
        {isCompleted && !isCurrentStep ? (
          <Check className="h-4 w-4" />
        ) : (
          step.num
        )}
      </div>
      {/* Label — hidden on small screens */}
      <span
        className={cn(
          "text-[11px] leading-tight text-center hidden sm:block max-w-[60px] truncate",
          isCurrentStep && "font-bold text-foreground",
          isCompleted && !isCurrentStep && "text-foreground",
          !isCurrentStep && !isCompleted && "text-muted-foreground"
        )}
      >
        <span className="hidden md:inline">{step.label}</span>
        <span className="md:hidden">{step.shortLabel}</span>
      </span>
    </button>
  );
}

// ─── Connector Line ────────────────────────────────────────────────────────────

function ConnectorLine({ isCompleted }: { isCompleted: boolean }) {
  return (
    <div
      className={cn(
        "flex-1 h-0.5 mt-4 sm:mt-4 min-w-[8px] max-w-[40px]",
        isCompleted ? "bg-green-600" : "bg-muted-foreground/20"
      )}
    />
  );
}

// ─── Main WizardNav Component ──────────────────────────────────────────────────

export function WizardNav({
  caseId,
  currentStep,
  completedSteps: propCompletedSteps,
}: WizardNavProps) {
  const router = useRouter();
  const [wizardStatus, setWizardStatus] = useState<WizardStatus | null>(null);

  const completedSteps =
    propCompletedSteps ?? wizardStatus?.completedSteps ?? [1];
  const clientName = wizardStatus?.clientName ?? null;

  // Fetch wizard status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/wizard-status`);
      if (!res.ok) return;
      const data: WizardStatus = await res.json();
      setWizardStatus(data);
    } catch {
      // Silently fail — we'll fall back to propCompletedSteps or default
    }
  }, [caseId]);

  useEffect(() => {
    if (!propCompletedSteps) {
      fetchStatus();
    }
  }, [fetchStatus, propCompletedSteps]);

  // Navigation helpers
  const navigateToStep = useCallback(
    (stepNum: number) => {
      const step = WIZARD_STEPS.find((s) => s.num === stepNum);
      if (!step) return;
      if (step.num === 8) {
        // Report step — navigate to results page which has the report generation
        router.push(`/cases/${caseId}/results`);
        return;
      }
      router.push(`/cases/${caseId}${step.path}`);
    },
    [caseId, router]
  );

  const isStepClickable = (stepNum: number): boolean => {
    // Current step is always visible but no need to re-navigate
    if (stepNum === currentStep) return false;
    // Completed steps are always clickable
    if (completedSteps.includes(stepNum)) return true;
    // Future step: clickable if the step right before it is completed
    if (stepNum > 1 && completedSteps.includes(stepNum - 1)) return true;
    // Step 1 is always clickable
    if (stepNum === 1) return true;
    return false;
  };

  const currentStepConfig = WIZARD_STEPS.find((s) => s.num === currentStep);

  // Keyboard navigation: Alt+Arrow
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === "ArrowLeft" && currentStep > 1) {
        e.preventDefault();
        navigateToStep(currentStep - 1);
      } else if (e.key === "ArrowRight" && currentStep < 8) {
        e.preventDefault();
        navigateToStep(currentStep + 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStep, navigateToStep]);

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Client name + step indicator */}
      <div className="px-4 md:px-6 pt-3 pb-1">
        <p className="text-sm text-muted-foreground">
          {clientName ? (
            <>
              <span className="font-medium text-foreground">{clientName}</span>
              {" \u2014 "}
            </>
          ) : null}
          Step {currentStep}: {currentStepConfig?.label}
        </p>
      </div>

      {/* Step circles */}
      <div className="px-4 md:px-6 pb-3 flex items-start justify-between gap-0">
        {WIZARD_STEPS.map((step, idx) => (
          <div key={step.num} className="contents">
            <StepCircle
              step={step}
              isCurrentStep={step.num === currentStep}
              isCompleted={completedSteps.includes(step.num)}
              isClickable={isStepClickable(step.num)}
              onClick={() => navigateToStep(step.num)}
            />
            {idx < WIZARD_STEPS.length - 1 && (
              <ConnectorLine
                isCompleted={
                  completedSteps.includes(step.num) &&
                  completedSteps.includes(WIZARD_STEPS[idx + 1].num)
                }
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bottom Navigation Buttons ─────────────────────────────────────────────────

interface WizardNavButtonsProps {
  caseId: string;
  currentStep: number;
}

export function WizardNavButtons({
  caseId,
  currentStep,
}: WizardNavButtonsProps) {
  const router = useRouter();

  const prevStep =
    currentStep > 1 ? WIZARD_STEPS.find((s) => s.num === currentStep - 1) : null;
  const nextStep =
    currentStep < 8 ? WIZARD_STEPS.find((s) => s.num === currentStep + 1) : null;

  const navigateToStep = (stepNum: number) => {
    const step = WIZARD_STEPS.find((s) => s.num === stepNum);
    if (!step) return;
    if (step.num === 8) {
      router.push(`/cases/${caseId}/results`);
      return;
    }
    router.push(`/cases/${caseId}${step.path}`);
  };

  // On the comparison page (step 7) and report step (step 8), the "next" button
  // triggers PDF download rather than navigation. We still render the nav for
  // the comparison page, but the results page handles report generation itself.

  return (
    <div className="flex items-center justify-between pt-6 pb-2 border-t mt-6">
      <div>
        {prevStep && (
          <Button
            variant="outline"
            onClick={() => navigateToStep(prevStep.num)}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to {prevStep.label}</span>
            <span className="sm:hidden">Back</span>
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground hidden md:inline">
          Alt+\u2190 / Alt+\u2192
        </span>
        {nextStep && (
          <Button onClick={() => navigateToStep(nextStep.num)} className="gap-1.5">
            <span className="hidden sm:inline">
              {nextStep.num === 8
                ? "Generate Report"
                : `Continue to ${nextStep.label}`}
            </span>
            <span className="sm:hidden">
              {nextStep.num === 8 ? "Report" : "Next"}
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
