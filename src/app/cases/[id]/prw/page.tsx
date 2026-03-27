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
import { Plus, Search, Briefcase, Trash2, Pencil, ExternalLink, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { CaseBreadcrumb } from "@/components/case-breadcrumb";
import { WizardNav, WizardNavButtons } from "@/components/wizard-nav";

interface WageInfo {
  areaName: string;
  year: number;
  employment: number | null;
  meanWage: number | null;
  medianWage: number | null;
  pct10: number | null;
  pct25: number | null;
  pct75: number | null;
  pct90: number | null;
}

interface DOTOccData {
  id: string;
  title: string;
  svp: number;
  strength: string;
  gedR: number;
  gedM: number;
  gedL: number;
  aptitudes: Record<string, number>;
  temperaments: string[];
  interests: string[];
  physicalDemands: Record<string, unknown>;
  envConditions: Record<string, unknown>;
  workFields: string[];
  mpsms: string[];
}

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
  actualWageHourly: number | null;
  actualWageAnnual: number | null;
  wageYear: number | null;
  hoursPerWeek: number | null;
  acquiredSkills: { id: string }[];
  dotOcc: DOTOccData | null;
}

interface OccSearchResult {
  code: string;
  title: string;
  relevance_score?: number;
  cached?: boolean;
}

interface CombinedSearchResult {
  dotCode: string | null;
  onetCode: string | null;
  title: string;
  svp: number | null;
  strength: string | null;
  skillLevel: string | null;
  gedR: number | null;
  gedM: number | null;
  gedL: number | null;
  source: string; // "DOT", "O*NET", or "DOT+O*NET"
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
  const [combinedResults, setCombinedResults] = useState<CombinedSearchResult[]>([]);
  const [selectedOcc, setSelectedOcc] = useState<OccSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [dotEntries, setDotEntries] = useState<DOTEntry[]>([]);
  const [selectedDot, setSelectedDot] = useState<DOTEntry | null>(null);
  const [loadingDot, setLoadingDot] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedPRW, setExpandedPRW] = useState<string | null>(null);

  const [wageData, setWageData] = useState<Record<string, WageInfo>>({});

  // Controlled form state for reliable auto-fill
  const [formJobTitle, setFormJobTitle] = useState("");
  const [formEmployer, setFormEmployer] = useState("");
  const [formDotCode, setFormDotCode] = useState("");
  const [formOnetCode, setFormOnetCode] = useState("");
  const [formSvp, setFormSvp] = useState("");
  const [formSkillLevel, setFormSkillLevel] = useState("");
  const [formStrength, setFormStrength] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formDurationMonths, setFormDurationMonths] = useState("");
  const [formDuties, setFormDuties] = useState("");
  const [formActualWageHourly, setFormActualWageHourly] = useState("");
  const [formActualWageAnnual, setFormActualWageAnnual] = useState("");
  const [formHoursPerWeek, setFormHoursPerWeek] = useState("40");
  const [formWageYear, setFormWageYear] = useState("");
  const [autoFillSource, setAutoFillSource] = useState<string | null>(null);
  const [autoFillWages, setAutoFillWages] = useState<WageInfo | null>(null);

  // Auto-calculate annual wage from hourly
  function handleHourlyWageChange(val: string) {
    setFormActualWageHourly(val);
    if (val && !isNaN(parseFloat(val))) {
      const hours = parseFloat(formHoursPerWeek) || 40;
      const annual = parseFloat(val) * hours * 52;
      setFormActualWageAnnual(String(Math.round(annual)));
    }
  }

  function handleHoursPerWeekChange(val: string) {
    setFormHoursPerWeek(val);
    if (formActualWageHourly && !isNaN(parseFloat(formActualWageHourly)) && val && !isNaN(parseFloat(val))) {
      const annual = parseFloat(formActualWageHourly) * parseFloat(val) * 52;
      setFormActualWageAnnual(String(Math.round(annual)));
    }
  }

  function getWageConsistencyWarning(): string | null {
    const hourly = parseFloat(formActualWageHourly);
    const annual = parseFloat(formActualWageAnnual);
    const hours = parseFloat(formHoursPerWeek) || 40;
    if (!isNaN(hourly) && !isNaN(annual) && hourly > 0 && annual > 0) {
      const expected = hourly * hours * 52;
      const diff = Math.abs(expected - annual) / expected;
      if (diff > 0.05) {
        return `Hourly ($${hourly.toFixed(2)}) x ${hours}hrs x 52wks = $${Math.round(expected).toLocaleString()}, but annual entered is $${Math.round(annual).toLocaleString()}`;
      }
    }
    return null;
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/prw`);
      if (!res.ok) {
        toast.error("Failed to load PRW data");
        return;
      }
      const raw = await res.json();
      const data = Array.isArray(raw) ? raw : [];
      setEntries(data);

      // Fetch OEWS wage data for each unique O*NET code
      const onetCodes = [...new Set(data.map((e: PRWEntry) => e.onetSocCode).filter(Boolean))] as string[];
      const wages: Record<string, WageInfo> = {};
      await Promise.all(
        onetCodes.map(async (code) => {
          try {
            const wRes = await fetch(`/api/occupations/${encodeURIComponent(code)}`);
            if (wRes.ok) {
              const occData = await wRes.json();
              if (occData.wages?.length > 0) {
                wages[code] = occData.wages[0]; // Most recent year
              }
            }
          } catch {
            // Silent
          }
        })
      );
      setWageData(wages);
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
    setCombinedResults([]);
    setSearchResults([]);
    try {
      // Use combined search that searches both O*NET and DOT databases
      const res = await fetch(
        `/api/occupations/combined-search?q=${encodeURIComponent(searchQuery)}`
      );
      if (res.ok) {
        const data = await res.json();
        setCombinedResults(data.results ?? []);
      } else {
        // Fallback to old O*NET-only search
        const res2 = await fetch(
          `/api/occupations/search?q=${encodeURIComponent(searchQuery)}`
        );
        const data2 = await res2.json();
        const merged = [...(data2.onet ?? []), ...(data2.local ?? [])];
        const seen = new Set<string>();
        setSearchResults(merged.filter((r: OccSearchResult) => {
          if (seen.has(r.code)) return false;
          seen.add(r.code);
          return true;
        }));
      }
    } catch {
      toast.error("Search failed");
    }
    setSearching(false);
  }

  async function lookupOccupationData(onetCode: string) {
    setLoadingDot(true);
    setDotEntries([]);
    setSelectedDot(null);
    try {
      // Use the unified auto-fill API that works with or without DOT crosswalk
      const res = await fetch(`/api/occupations/auto-fill?code=${encodeURIComponent(onetCode)}`);
      if (res.ok) {
        const data = await res.json();

        // Auto-fill form from the best available source
        if (data.autoFill) {
          setFormSvp(String(data.autoFill.svp));
          setFormSkillLevel(data.autoFill.skillLevel);
          setFormStrength(data.autoFill.strength);
          if (data.autoFill.dotCode) {
            setFormDotCode(data.autoFill.dotCode);
          }
          toast.success(`Auto-filled from ${data.source}`);
        }

        // If DOT crosswalk entries exist, populate the list
        if (data.dotEntries?.length > 0) {
          setDotEntries(data.dotEntries);
          setSelectedDot(data.dotEntries[0]);
        }

        // Store source info for display
        setAutoFillSource(data.source ?? null);

        // Store wage info if available
        if (data.wages) {
          setAutoFillWages(data.wages);
        }
      }
    } catch {
      // Fallback: try the old DOT-only lookup
      try {
        const res = await fetch(`/api/occupations/dot-lookup?onet=${encodeURIComponent(onetCode)}`);
        const data = await res.json();
        if (data.dotEntries?.length > 0) {
          setDotEntries(data.dotEntries);
          const first = data.dotEntries[0];
          setSelectedDot(first);
          applyDotToForm(first);
        }
      } catch {
        // Silent fail
      }
    }
    setLoadingDot(false);
  }

  function applyDotToForm(dot: DOTEntry) {
    setFormDotCode(dot.dotCode);
    setFormSvp(String(dot.svp));
    setFormSkillLevel(dot.skillLevel);
    setFormStrength(dot.strength);
  }

  // Auto-calculate duration from dates
  function calcDurationMonths(start: string, end: string): string {
    if (!start || !end) return "";
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return "";
    const months =
      (e.getFullYear() - s.getFullYear()) * 12 +
      (e.getMonth() - s.getMonth());
    return String(Math.max(1, months));
  }

  function handleStartDateChange(val: string) {
    setFormStartDate(val);
    if (val && formEndDate) {
      setFormDurationMonths(calcDurationMonths(val, formEndDate));
    }
  }

  function handleEndDateChange(val: string) {
    setFormEndDate(val);
    if (formStartDate && val) {
      setFormDurationMonths(calcDurationMonths(formStartDate, val));
    }
  }

  function handleSelectOcc(occ: OccSearchResult) {
    setSelectedOcc(occ);
    setSearchResults([]);
    setCombinedResults([]);
    setAutoFillSource(null);
    setAutoFillWages(null);
    // Auto-fill job title and O*NET code
    setFormJobTitle(occ.title);
    setFormOnetCode(occ.code);
    lookupOccupationData(occ.code);
  }

  function handleSelectCombined(result: CombinedSearchResult) {
    setCombinedResults([]);
    setSearchResults([]);

    // Set job title
    setFormJobTitle(result.title);

    // Set codes
    if (result.onetCode) setFormOnetCode(result.onetCode);
    if (result.dotCode) setFormDotCode(result.dotCode);

    // Set DOT data directly if available (100% accurate from DOT)
    if (result.svp !== null) setFormSvp(String(result.svp));
    if (result.strength) setFormStrength(result.strength);
    if (result.skillLevel) setFormSkillLevel(result.skillLevel);

    // Set selected occupation for AI duties and skills generation
    if (result.onetCode) {
      setSelectedOcc({ code: result.onetCode, title: result.title });
    } else {
      setSelectedOcc({ code: result.dotCode ?? "", title: result.title });
    }

    setAutoFillSource(result.source);
    setAutoFillWages(null);

    // If we have an O*NET code, also look up wages
    if (result.onetCode) {
      lookupOccupationData(result.onetCode);
    }

    toast.success(
      result.source === "DOT+O*NET"
        ? "Auto-filled from DOT + O*NET (both codes populated)"
        : result.source === "DOT"
          ? "Auto-filled from DOT database (100% accurate)"
          : "Auto-filled from O*NET"
    );
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
    // Populate form state from existing entry
    setFormJobTitle(entry.jobTitle ?? "");
    setFormEmployer(entry.employer ?? "");
    setFormDotCode(entry.dotCode ?? "");
    setFormOnetCode(entry.onetSocCode ?? "");
    setFormSvp(entry.svp !== null ? String(entry.svp) : "");
    setFormSkillLevel(entry.skillLevel ?? "");
    setFormStrength(entry.strengthLevel ?? "");
    setFormStartDate(entry.startDate ? entry.startDate.split("T")[0] : "");
    setFormEndDate(entry.endDate ? entry.endDate.split("T")[0] : "");
    setFormDurationMonths(entry.durationMonths !== null ? String(entry.durationMonths) : "");
    setFormDuties(entry.dutiesDescription ?? "");
    setFormActualWageHourly(entry.actualWageHourly !== null ? String(entry.actualWageHourly) : "");
    setFormActualWageAnnual(entry.actualWageAnnual !== null ? String(entry.actualWageAnnual) : "");
    setFormHoursPerWeek(entry.hoursPerWeek !== null ? String(entry.hoursPerWeek) : "40");
    setFormWageYear(entry.wageYear !== null ? String(entry.wageYear) : "");
    setDialogOpen(true);
  }

  function openNew() {
    setEditingId(null);
    setSelectedOcc(null);
    setSelectedDot(null);
    setDotEntries([]);
    setSearchQuery("");
    setSearchResults([]);
    setCombinedResults([]);
    setAutoFillSource(null);
    setAutoFillWages(null);
    // Reset form state
    setFormJobTitle("");
    setFormEmployer("");
    setFormDotCode("");
    setFormOnetCode("");
    setFormSvp("");
    setFormSkillLevel("");
    setFormStrength("");
    setFormStartDate("");
    setFormEndDate("");
    setFormDurationMonths("");
    setFormDuties("");
    setFormActualWageHourly("");
    setFormActualWageAnnual("");
    setFormHoursPerWeek("40");
    setFormWageYear("");
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
    const data = {
      ...(editingId ? { id: editingId } : {}),
      jobTitle: formJobTitle,
      employer: formEmployer || null,
      dotCode: formDotCode || null,
      onetSocCode: formOnetCode || selectedOcc?.code || null,
      svp: formSvp ? parseInt(formSvp) : null,
      skillLevel: formSkillLevel || null,
      strengthLevel: formStrength || null,
      startDate: formStartDate || null,
      endDate: formEndDate || null,
      durationMonths: formDurationMonths ? parseInt(formDurationMonths) : null,
      dutiesDescription: formDuties || null,
      actualWageHourly: formActualWageHourly ? parseFloat(formActualWageHourly) : null,
      actualWageAnnual: formActualWageAnnual ? parseFloat(formActualWageAnnual) : null,
      wageYear: formWageYear ? parseInt(formWageYear) : null,
      hoursPerWeek: formHoursPerWeek ? parseFloat(formHoursPerWeek) : null,
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

          toast.info("Generating acquired skills from templates...");
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

        // Navigate back to case dashboard and force a refresh
        router.push(`/cases/${caseId}`);
        router.refresh();
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

  const STRENGTH_MAP: Record<string, string> = { S: "Sedentary", L: "Light", M: "Medium", H: "Heavy", V: "Very Heavy" };

  return (
    <div>
      <WizardNav caseId={caseId} currentStep={2} />
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <CaseBreadcrumb caseId={caseId} currentPage="Past Relevant Work" />

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
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Keyword Search (DOT + O*NET) */}
              <div className="space-y-2">
                <Label>Occupation Search (DOT + O*NET)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search by job title keyword (e.g., cashier, carpenter, nurse)..."
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
                <p className="text-xs text-muted-foreground">
                  Searches both DOT (12,700+ titles) and O*NET databases. DOT data provides accurate SVP, strength, and GED levels.
                </p>

                {/* Combined search results */}
                {combinedResults.length > 0 && (
                  <div className="max-h-60 overflow-y-auto border rounded-md">
                    {combinedResults.map((r, i) => (
                      <button
                        key={`${r.dotCode ?? ""}-${r.onetCode ?? ""}-${i}`}
                        type="button"
                        onClick={() => handleSelectCombined(r)}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{r.title}</span>
                          <Badge
                            variant={r.source === "DOT+O*NET" ? "default" : r.source === "DOT" ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {r.source}
                          </Badge>
                        </div>
                        <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                          {r.dotCode && <span>DOT: {r.dotCode}</span>}
                          {r.onetCode && <span>O*NET: {r.onetCode}</span>}
                          {r.svp !== null && <span>SVP: {r.svp}</span>}
                          {r.strength && <span>Str: {r.strength}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Fallback: old O*NET-only results */}
                {searchResults.length > 0 && combinedResults.length === 0 && (
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
                        onClick={() => { setSelectedDot(dot); applyDotToForm(dot); }}
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

              {/* Auto-filled fields section */}
              {(formDotCode || formSvp || formSkillLevel || formStrength) && (
                <div className="rounded-md border border-green-200 bg-green-50/50 dark:bg-green-950/20 p-3 space-y-2">
                  <p className="text-xs font-medium text-green-700 dark:text-green-400">
                    Auto-filled from {autoFillSource ?? "occupation data"} — editable if needed
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    {formDotCode && (
                      <div>
                        <span className="text-xs text-muted-foreground">DOT Code:</span>
                        <p className="font-mono text-xs">{formDotCode}</p>
                      </div>
                    )}
                    {formSvp && (
                      <div>
                        <span className="text-xs text-muted-foreground">SVP:</span>
                        <p className="text-xs">{getSvpLabel(parseInt(formSvp))}</p>
                      </div>
                    )}
                    {formSkillLevel && (
                      <div>
                        <span className="text-xs text-muted-foreground">Skill Level:</span>
                        <p className="text-xs capitalize">{formSkillLevel}</p>
                      </div>
                    )}
                    {formStrength && (
                      <div>
                        <span className="text-xs text-muted-foreground">Strength:</span>
                        <p className="text-xs">{STRENGTH_MAP[formStrength] ?? formStrength}</p>
                      </div>
                    )}
                  </div>
                  {/* Inline wage preview */}
                  {autoFillWages && (
                    <div className="pt-2 border-t border-green-200/50">
                      <div className="flex flex-wrap gap-3 text-xs">
                        <span className="text-muted-foreground">
                          Median Wage: <span className="font-semibold text-green-700">${autoFillWages.medianWage?.toLocaleString() ?? "—"}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Employment: <span className="font-medium">{autoFillWages.employment?.toLocaleString() ?? "—"}</span>
                        </span>
                        <span className="text-muted-foreground">
                          ({autoFillWages.areaName}, {autoFillWages.year})
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job Title *</Label>
                  <Input
                    id="jobTitle"
                    required
                    value={formJobTitle}
                    onChange={(e) => setFormJobTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employer">Employer</Label>
                  <Input
                    id="employer"
                    value={formEmployer}
                    onChange={(e) => setFormEmployer(e.target.value)}
                    placeholder="Company name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dotCode">DOT Code</Label>
                  <Input
                    id="dotCode"
                    placeholder="000.000-000"
                    value={formDotCode}
                    onChange={(e) => setFormDotCode(e.target.value)}
                    className={formDotCode && selectedDot ? "border-green-300 bg-green-50/30 dark:bg-green-950/10" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onetSocCode">O*NET Code</Label>
                  <Input
                    id="onetSocCode"
                    placeholder="00-0000.00"
                    value={formOnetCode}
                    onChange={(e) => setFormOnetCode(e.target.value)}
                    className={formOnetCode && selectedOcc ? "border-green-300 bg-green-50/30 dark:bg-green-950/10" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="svp">SVP</Label>
                  <Select
                    value={formSvp}
                    onValueChange={(v) => setFormSvp(v ?? "")}
                  >
                    <SelectTrigger className={formSvp && selectedDot ? "border-green-300 bg-green-50/30 dark:bg-green-950/10" : ""}>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="skillLevel">Skill Level</Label>
                  <Select
                    value={formSkillLevel}
                    onValueChange={(v) => setFormSkillLevel(v ?? "")}
                  >
                    <SelectTrigger className={formSkillLevel && selectedDot ? "border-green-300 bg-green-50/30 dark:bg-green-950/10" : ""}>
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
                    value={formStrength}
                    onValueChange={(v) => setFormStrength(v ?? "")}
                  >
                    <SelectTrigger className={formStrength && selectedDot ? "border-green-300 bg-green-50/30 dark:bg-green-950/10" : ""}>
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formStartDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formEndDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="durationMonths">Duration (months)</Label>
                  <Input
                    id="durationMonths"
                    type="number"
                    value={formDurationMonths}
                    onChange={(e) => setFormDurationMonths(e.target.value)}
                    className={formStartDate && formEndDate && formDurationMonths ? "border-green-300 bg-green-50/30 dark:bg-green-950/10" : ""}
                    placeholder="Auto-calculated from dates"
                  />
                </div>
              </div>

              {/* Actual Earnings */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Actual Earnings</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="actualWageHourly" className="text-xs text-muted-foreground">Hourly Wage</Label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        id="actualWageHourly"
                        type="number"
                        step="0.01"
                        min="0"
                        className="pl-6"
                        value={formActualWageHourly}
                        onChange={(e) => handleHourlyWageChange(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="actualWageAnnual" className="text-xs text-muted-foreground">Annual Wage</Label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        id="actualWageAnnual"
                        type="number"
                        step="1"
                        min="0"
                        className="pl-6"
                        value={formActualWageAnnual}
                        onChange={(e) => setFormActualWageAnnual(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="hoursPerWeek" className="text-xs text-muted-foreground">Hours/Week</Label>
                    <Input
                      id="hoursPerWeek"
                      type="number"
                      step="0.5"
                      min="0"
                      max="168"
                      value={formHoursPerWeek}
                      onChange={(e) => handleHoursPerWeekChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="wageYear" className="text-xs text-muted-foreground">Wage Year</Label>
                    <Select value={formWageYear} onValueChange={(v) => { if (v) setFormWageYear(v); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {getWageConsistencyWarning() && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    Consistency check: {getWageConsistencyWarning()}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dutiesDescription">Duties Description</Label>
                <Textarea
                  id="dutiesDescription"
                  rows={4}
                  value={formDuties}
                  onChange={(e) => setFormDuties(e.target.value)}
                  placeholder="Describe the primary duties, tools used, and work environment..."
                />
              </div>

              {/* Auto-populate info */}
              {!editingId && selectedOcc && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <p className="font-medium text-green-700 mb-1">
                    Auto-Populate on Save:
                  </p>
                  <ul className="text-muted-foreground space-y-1 text-xs">
                    {selectedDot && <li>Worker Profiles (all 4 rows) from DOT trait data</li>}
                    <li>Acquired Skills from DOT/O*NET templates</li>
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
                      {e.dotCode && <span className="font-mono ml-2">DOT {e.dotCode}</span>}
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
                    {e.strengthLevel && <Badge variant="secondary">{STRENGTH_MAP[e.strengthLevel] ?? e.strengthLevel}</Badge>}
                    {e.skillLevel && <Badge variant="secondary">{e.skillLevel}</Badge>}
                    {e.actualWageAnnual && (
                      <Badge variant="outline" className="text-green-700">
                        ${Math.round(e.actualWageAnnual).toLocaleString()}/yr
                        {e.wageYear ? ` (${e.wageYear})` : ""}
                      </Badge>
                    )}
                    {e.actualWageHourly && !e.actualWageAnnual && (
                      <Badge variant="outline" className="text-green-700">
                        ${e.actualWageHourly.toFixed(2)}/hr
                        {e.wageYear ? ` (${e.wageYear})` : ""}
                      </Badge>
                    )}
                    <Badge variant="outline">{(e.acquiredSkills ?? []).length} skills</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedPRW(expandedPRW === e.id ? null : e.id)}
                      title="Show DOT details"
                    >
                      {expandedPRW === e.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
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


                {/* Expanded DOT Details */}
                {expandedPRW === e.id && (
                  <div className="mt-3 pt-3 border-t space-y-3">
                    {e.dotOcc ? (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">DOT Title</p>
                            <p className="font-medium">{e.dotOcc.title}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">DOT Code</p>
                            <p className="font-mono">{e.dotOcc.id}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">SVP / Skill Level</p>
                            <p>{e.dotOcc.svp} ({e.dotOcc.svp <= 3 ? "Unskilled" : e.dotOcc.svp <= 6 ? "Semi-skilled" : "Skilled"})</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Strength</p>
                            <p>{STRENGTH_MAP[e.dotOcc.strength] ?? e.dotOcc.strength}</p>
                          </div>
                        </div>

                        {/* GED */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-1 font-medium">GED Levels</p>
                          <div className="flex gap-3">
                            <Badge variant="outline">R: {e.dotOcc.gedR}</Badge>
                            <Badge variant="outline">M: {e.dotOcc.gedM}</Badge>
                            <Badge variant="outline">L: {e.dotOcc.gedL}</Badge>
                          </div>
                        </div>

                        {/* Aptitudes */}
                        {e.dotOcc.aptitudes && Object.keys(e.dotOcc.aptitudes).length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1 font-medium">Aptitudes (1=High, 5=Low)</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(e.dotOcc.aptitudes).map(([key, val]) => (
                                <Badge key={key} variant="secondary" className="text-xs">
                                  {key}: {val as number}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Work Fields */}
                        {e.dotOcc.workFields?.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1 font-medium">Work Fields</p>
                            <div className="flex flex-wrap gap-1">
                              {e.dotOcc.workFields.map((wf) => (
                                <Badge key={wf} variant="outline" className="text-xs">{wf}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* MPSMS (Materials, Products, Subject Matter, Services) */}
                        {e.dotOcc.mpsms?.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1 font-medium">MPSMS (Materials/Products/Subject Matter/Services)</p>
                            <div className="flex flex-wrap gap-1">
                              {e.dotOcc.mpsms.map((m) => (
                                <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Temperaments */}
                        {e.dotOcc.temperaments?.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1 font-medium">Temperaments</p>
                            <div className="flex flex-wrap gap-1">
                              {e.dotOcc.temperaments.map((t) => (
                                <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Physical Demands */}
                        {e.dotOcc.physicalDemands && Object.keys(e.dotOcc.physicalDemands).length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1 font-medium">Physical Demands</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(e.dotOcc.physicalDemands).map(([key, val]) => (
                                <Badge key={key} variant="secondary" className="text-xs">
                                  {key}: {String(val)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Environmental Conditions */}
                        {e.dotOcc.envConditions && Object.keys(e.dotOcc.envConditions).length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1 font-medium">Environmental Conditions</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(e.dotOcc.envConditions).map(([key, val]) => (
                                <Badge key={key} variant="secondary" className="text-xs">
                                  {key}: {String(val)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No DOT crosswalk data linked. Edit this entry and select an O*NET occupation to auto-lookup DOT data.
                      </p>
                    )}

                    {/* Actual Earnings vs BLS */}
                    {(e.actualWageHourly || e.actualWageAnnual) && (
                      <div className="pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">Actual Earnings{e.wageYear ? ` (${e.wageYear})` : ""}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          {e.actualWageHourly && (
                            <div>
                              <p className="text-xs text-muted-foreground">Hourly</p>
                              <p className="font-medium text-green-700">${e.actualWageHourly.toFixed(2)}</p>
                            </div>
                          )}
                          {e.actualWageAnnual && (
                            <div>
                              <p className="text-xs text-muted-foreground">Annual</p>
                              <p className="font-medium text-green-700">${Math.round(e.actualWageAnnual).toLocaleString()}</p>
                            </div>
                          )}
                          {e.hoursPerWeek && (
                            <div>
                              <p className="text-xs text-muted-foreground">Hours/Week</p>
                              <p className="font-medium">{e.hoursPerWeek}</p>
                            </div>
                          )}
                          {e.onetSocCode && wageData[e.onetSocCode]?.medianWage && e.actualWageAnnual && (
                            <div>
                              <p className="text-xs text-muted-foreground">vs BLS Median</p>
                              <p className={`font-medium ${e.actualWageAnnual >= wageData[e.onetSocCode].medianWage! ? "text-green-700" : "text-amber-600"}`}>
                                {Math.round((e.actualWageAnnual / wageData[e.onetSocCode].medianWage!) * 100)}%
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* OEWS Wage Data */}
                    {e.onetSocCode && wageData[e.onetSocCode] && (() => {
                      const w = wageData[e.onetSocCode];
                      const fmt = (v: number | null) => v !== null ? `$${v.toLocaleString()}` : "—";
                      const fmtN = (v: number | null) => v !== null ? v.toLocaleString() : "—";
                      return (
                        <div className="pt-3 border-t">
                          <p className="text-xs text-muted-foreground mb-2 font-medium flex items-center gap-1">
                            <span className="text-green-600">$</span>
                            OEWS Wage Data ({w.areaName}, {w.year})
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Employment</p>
                              <p className="font-medium">{fmtN(w.employment)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Median Wage</p>
                              <p className="font-medium text-green-700">{fmt(w.medianWage)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Mean Wage</p>
                              <p className="font-medium">{fmt(w.meanWage)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Wage Range</p>
                              <p className="font-mono text-xs">{fmt(w.pct10)} – {fmt(w.pct90)}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">10th: {fmt(w.pct10)}</Badge>
                            <Badge variant="outline" className="text-xs">25th: {fmt(w.pct25)}</Badge>
                            <Badge variant="secondary" className="text-xs font-semibold">50th: {fmt(w.medianWage)}</Badge>
                            <Badge variant="outline" className="text-xs">75th: {fmt(w.pct75)}</Badge>
                            <Badge variant="outline" className="text-xs">90th: {fmt(w.pct90)}</Badge>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <WizardNavButtons caseId={caseId} currentStep={2} />
      </div>
    </div>
  );
}
