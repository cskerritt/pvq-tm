import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { format } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportData {
  case: {
    clientName: string;
    clientDOB?: Date | null;
    evaluatorName?: string | null;
    referralSource?: string | null;
    dateOfInjury?: Date | null;
    dateOfEval?: Date | null;
    notes?: string | null;
  };
  profiles: Array<{ profileType: string; [key: string]: unknown }>;
  prw: Array<{
    jobTitle: string;
    dotCode?: string | null;
    onetSocCode?: string | null;
    svp?: number | null;
    strengthLevel?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
    durationMonths?: number | null;
  }>;
  skills: Array<{
    actionVerb: string;
    object: string;
    toolsSoftware?: string | null;
    materialsServices?: string | null;
    svpLevel?: number | null;
    isTransferable: boolean;
  }>;
  analysis: {
    name?: string | null;
    ageRule?: string | null;
    priorEarnings?: number | null;
    vqsPostEcMedian?: number | null;
    vqsPreEcMedian?: number | null;
    vqsEcLoss?: number | null;
    vqsEcLossPct?: number | null;
    // Comprehensive analysis JSON fields
    rfcNarrative?: Record<string, unknown> | null;
    nearMissAnalysis?: Record<string, unknown> | null;
    viableSetAnalysis?: Record<string, unknown> | null;
    confidenceExplanation?: Record<string, unknown> | null;
    regionalLaborMarket?: Record<string, unknown> | null;
  };
  targets: Array<{
    title: string;
    onetSocCode: string;
    stq?: number | null;
    tfq?: number | null;
    vaq?: number | null;
    lmq?: number | null;
    pvq?: number | null;
    confidenceGrade?: string | null;
    excluded: boolean;
    exclusionReason?: string | null;
    stqDetails?: unknown;
    tfqDetails?: unknown;
    vaqDetails?: unknown;
    lmqDetails?: unknown;
    // VQS fields
    vqScore?: number | null;
    vqBand?: number | null;
    tspScore?: number | null;
    tspTier?: number | null;
    tspLabel?: string | null;
    ecMedian?: number | null;
    ecMean?: number | null;
    ecConfLow?: number | null;
    ecConfHigh?: number | null;
    ecSee?: number | null;
    ecGeoAdjusted?: boolean | null;
    preEcMedian?: number | null;
    // Near-miss & trait margin fields
    nearMissSeverity?: string | null;
    nearMissDetails?: unknown;
    traitMarginMin?: number | null;
    traitMarginAvg?: number | null;
    closestFailTrait?: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MARGIN = 20;
const PAGE_WIDTH = 210; // A4 mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = 285;

const COLORS = {
  primary: [30, 64, 124] as [number, number, number], // dark blue
  secondary: [80, 120, 180] as [number, number, number], // medium blue
  accent: [0, 122, 204] as [number, number, number], // bright blue
  headerBg: [235, 241, 250] as [number, number, number], // light blue-gray
  lightGray: [245, 245, 245] as [number, number, number],
  darkText: [33, 33, 33] as [number, number, number],
  mutedText: [120, 120, 120] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  excludedBg: [255, 240, 240] as [number, number, number],
  successBg: [235, 250, 240] as [number, number, number],
  warningBg: [255, 248, 230] as [number, number, number], // light amber
  warningText: [180, 120, 20] as [number, number, number], // amber text
};

/** Worker profile trait labels (24 traits) */
const TRAIT_LABELS = [
  "Reasoning",
  "Math",
  "Language",
  "Spatial",
  "Form",
  "Clerical",
  "Motor Coord",
  "Finger Dex",
  "Manual Dex",
  "Eye-Hand-Foot",
  "Color Disc",
  "Strength",
  "Climb/Bal",
  "Stoop/Kneel",
  "Reach/Handle",
  "Talk/Hear",
  "See",
  "Work Loc",
  "Ext Cold",
  "Ext Heat",
  "Wet/Humid",
  "Noise/Vib",
  "Hazards",
  "Dusts/Fumes",
];

/** Profile trait keys matching the database columns */
const TRAIT_KEYS = [
  "reasoning",
  "math",
  "language",
  "spatialPerception",
  "formPerception",
  "clericalPerception",
  "motorCoordination",
  "fingerDexterity",
  "manualDexterity",
  "eyeHandFoot",
  "colorDiscrimination",
  "strength",
  "climbBalance",
  "stoopKneel",
  "reachHandle",
  "talkHear",
  "see",
  "workLocation",
  "extremeCold",
  "extremeHeat",
  "wetnessHumidity",
  "noiseVibration",
  "hazards",
  "dustsFumes",
];

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "N/A";
  const date = typeof d === "string" ? new Date(d) : d;
  return format(date, "MM/dd/yyyy");
}

function fmtNumber(n: number | null | undefined, decimals = 2): string {
  if (n == null) return "---";
  return n.toFixed(decimals);
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtHourly(n: number | null | undefined): string {
  if (n == null) return "---";
  return `$${n.toFixed(2)}/hr`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getVQBandName(band: number | null | undefined): string {
  switch (band) {
    case 1: return "Below/Mid-Avg";
    case 2: return "Mid/High-Avg";
    case 3: return "High/Very-High";
    case 4: return "Extremely High";
    default: return "---";
  }
}

/** Safely read a string from a JSON object */
function jsonStr(obj: Record<string, unknown> | null | undefined, key: string): string {
  if (!obj || obj[key] == null) return "";
  return String(obj[key]);
}

/** Safely read a number from a JSON object */
function jsonNum(obj: Record<string, unknown> | null | undefined, key: string): number | null {
  if (!obj || obj[key] == null) return null;
  const v = Number(obj[key]);
  return isNaN(v) ? null : v;
}

/** Safely read an array from a JSON object */
function jsonArr(obj: Record<string, unknown> | null | undefined, key: string): unknown[] {
  if (!obj || !Array.isArray(obj[key])) return [];
  return obj[key] as unknown[];
}

function addFooter(doc: jsPDF, pageNum: number, totalPages: number): void {
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.mutedText);

  doc.line(MARGIN, FOOTER_Y - 2, PAGE_WIDTH - MARGIN, FOOTER_Y - 2);

  doc.text("PVQ-TM Report \u2014 Confidential", MARGIN, FOOTER_Y);
  doc.text(
    `Page ${pageNum} of ${totalPages}`,
    PAGE_WIDTH - MARGIN,
    FOOTER_Y,
    { align: "right" }
  );
}

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text(title, MARGIN, y);

  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y + 2, MARGIN + CONTENT_WIDTH, y + 2);

  return y + 10;
}

function addSubsectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text(title, MARGIN, y);
  return y + 6;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > FOOTER_Y - 10) {
    doc.addPage();
    return MARGIN + 10;
  }
  return y;
}

/** Get the finalY from the last autoTable call */
function getLastTableY(doc: jsPDF, fallback: number): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable?.finalY ?? fallback;
}

/** Render a paragraph of text with word-wrap, returning the new Y position */
function renderParagraph(
  doc: jsPDF,
  text: string,
  y: number,
  opts?: { fontSize?: number; fontStyle?: string; maxWidth?: number }
): number {
  const fontSize = opts?.fontSize ?? 10;
  const fontStyle = opts?.fontStyle ?? "normal";
  const maxWidth = opts?.maxWidth ?? CONTENT_WIDTH;

  doc.setFontSize(fontSize);
  doc.setFont("helvetica", fontStyle);
  doc.setTextColor(...COLORS.darkText);

  const lines = doc.splitTextToSize(text, maxWidth);
  const lineHeight = fontSize * 0.4;

  // Check if we need a page break for the full block
  y = checkPageBreak(doc, y, lines.length * lineHeight + 2);
  doc.text(lines, MARGIN, y);
  return y + lines.length * lineHeight + 2;
}

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

function renderCoverPage(doc: jsPDF, data: ReportData): void {
  // Background accent bar
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, PAGE_WIDTH, 80, "F");

  // Title
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.white);
  doc.text("PVQ-TM", PAGE_WIDTH / 2, 35, { align: "center" });

  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.text("Vocational Analysis Report", PAGE_WIDTH / 2, 48, {
    align: "center",
  });

  // Thin accent line
  doc.setDrawColor(...COLORS.white);
  doc.setLineWidth(0.3);
  doc.line(60, 56, PAGE_WIDTH - 60, 56);

  // Client name
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.darkText);
  doc.text(data.case.clientName, PAGE_WIDTH / 2, 110, { align: "center" });

  // Meta info
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.mutedText);

  let metaY = 125;

  if (data.case.evaluatorName) {
    doc.text(`Evaluator: ${data.case.evaluatorName}`, PAGE_WIDTH / 2, metaY, {
      align: "center",
    });
    metaY += 8;
  }

  if (data.analysis.name) {
    doc.text(`Analysis: ${data.analysis.name}`, PAGE_WIDTH / 2, metaY, {
      align: "center",
    });
    metaY += 8;
  }

  doc.text(
    `Date Generated: ${format(new Date(), "MMMM d, yyyy")}`,
    PAGE_WIDTH / 2,
    metaY,
    { align: "center" }
  );

  // Confidential notice
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.mutedText);
  doc.text(
    "This report contains confidential vocational analysis information.",
    PAGE_WIDTH / 2,
    260,
    { align: "center" }
  );
  doc.text(
    "Unauthorized disclosure or distribution is prohibited.",
    PAGE_WIDTH / 2,
    266,
    { align: "center" }
  );
}

function renderCaseSummary(doc: jsPDF, data: ReportData): void {
  doc.addPage();
  let y = MARGIN + 5;

  y = addSectionTitle(doc, "1. Case Summary", y);

  const rows: RowInput[] = [
    ["Client Name", data.case.clientName],
    ["Date of Birth", fmtDate(data.case.clientDOB)],
    ["Evaluator", data.case.evaluatorName ?? "N/A"],
    ["Referral Source", data.case.referralSource ?? "N/A"],
    ["Date of Injury", fmtDate(data.case.dateOfInjury)],
    ["Date of Evaluation", fmtDate(data.case.dateOfEval)],
  ];

  if (data.analysis.ageRule) {
    rows.push(["Age Rule Classification", data.analysis.ageRule]);
  }
  if (data.analysis.priorEarnings != null) {
    rows.push(["Prior Earnings", fmtCurrency(data.analysis.priorEarnings)]);
  }

  autoTable(doc, {
    startY: y,
    head: [],
    body: rows,
    theme: "plain",
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: {
      0: {
        fontStyle: "bold",
        cellWidth: 55,
        textColor: COLORS.primary,
      },
      1: { cellWidth: CONTENT_WIDTH - 55 },
    },
    styles: {
      fontSize: 10,
      cellPadding: 4,
      textColor: COLORS.darkText,
    },
    alternateRowStyles: {
      fillColor: COLORS.lightGray,
    },
  });

  // Notes section if present
  if (data.case.notes) {
    const finalY = getLastTableY(doc, y + 60);
    let notesY = finalY + 10;
    notesY = checkPageBreak(doc, notesY, 30);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.primary);
    doc.text("Notes:", MARGIN, notesY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.darkText);
    const splitNotes = doc.splitTextToSize(data.case.notes, CONTENT_WIDTH);
    doc.text(splitNotes, MARGIN, notesY + 7);
  }
}

function renderPastRelevantWork(doc: jsPDF, data: ReportData): void {
  doc.addPage();
  let y = MARGIN + 5;

  y = addSectionTitle(doc, "2. Past Relevant Work", y);

  if (data.prw.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...COLORS.mutedText);
    doc.text("No past relevant work entries recorded.", MARGIN, y);
    return;
  }

  const head: RowInput[] = [
    ["Job Title", "DOT Code", "O*NET Code", "SVP", "Strength", "Dates", "Months"],
  ];

  const body: RowInput[] = data.prw.map((job) => [
    job.jobTitle,
    job.dotCode ?? "---",
    job.onetSocCode ?? "---",
    job.svp != null ? String(job.svp) : "---",
    job.strengthLevel ?? "---",
    `${fmtDate(job.startDate)} - ${fmtDate(job.endDate)}`,
    job.durationMonths != null ? String(job.durationMonths) : "---",
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 9,
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: COLORS.darkText,
    },
    alternateRowStyles: {
      fillColor: COLORS.lightGray,
    },
  });
}

function renderAcquiredSkills(doc: jsPDF, data: ReportData): void {
  doc.addPage();
  let y = MARGIN + 5;

  y = addSectionTitle(doc, "3. Acquired Skills Inventory", y);

  if (data.skills.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...COLORS.mutedText);
    doc.text("No acquired skills recorded.", MARGIN, y);
    return;
  }

  const head: RowInput[] = [
    ["Skill (Action + Object)", "Tools / Software", "Materials", "SVP", "Transferable"],
  ];

  const body: RowInput[] = data.skills.map((skill) => [
    `${skill.actionVerb} ${skill.object}`,
    skill.toolsSoftware ?? "---",
    skill.materialsServices ?? "---",
    skill.svpLevel != null ? String(skill.svpLevel) : "---",
    skill.isTransferable ? "Yes" : "No",
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 9,
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: COLORS.darkText,
    },
    alternateRowStyles: {
      fillColor: COLORS.lightGray,
    },
    columnStyles: {
      0: { cellWidth: 55 },
      4: { cellWidth: 22, halign: "center" },
    },
    didParseCell(hookData) {
      // Highlight transferable skills
      if (
        hookData.section === "body" &&
        hookData.column.index === 4 &&
        hookData.cell.raw === "Yes"
      ) {
        hookData.cell.styles.fillColor = COLORS.successBg;
        hookData.cell.styles.fontStyle = "bold";
      }
    },
  });
}

function renderWorkerProfiles(doc: jsPDF, data: ReportData): void {
  doc.addPage();
  let y = MARGIN + 5;

  y = addSectionTitle(doc, "4. Worker Profile Comparison", y);

  if (data.profiles.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...COLORS.mutedText);
    doc.text("No worker profiles recorded.", MARGIN, y);
    return;
  }

  // Build the comparison grid: Trait | Profile1 | Profile2 | ...
  const profileNames = data.profiles.map((p) => p.profileType);
  const head: RowInput[] = [["Trait", ...profileNames]];

  const body: RowInput[] = TRAIT_LABELS.map((label, idx) => {
    const key = TRAIT_KEYS[idx];
    const values = data.profiles.map((p) => {
      const v = p[key];
      return v != null ? String(v) : "---";
    });
    return [label, ...values];
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: COLORS.darkText,
      halign: "center",
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold", cellWidth: 35 },
    },
    alternateRowStyles: {
      fillColor: COLORS.lightGray,
    },
  });

  // Scale explanation note
  const finalY = getLastTableY(doc, y + 120);
  let noteY = finalY + 8;
  noteY = checkPageBreak(doc, noteY, 20);

  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...COLORS.mutedText);
  doc.text(
    "Scale: GED/Aptitudes use 1\u20136 (1 = highest demand). Physical/Environmental use 1\u20135 " +
      "(Sedentary to Very Heavy for Strength; frequency codes for others). " +
      "Lower values indicate higher capability requirements.",
    MARGIN,
    noteY,
    { maxWidth: CONTENT_WIDTH }
  );
}

// ---------------------------------------------------------------------------
// Section 4b: Residual Functional Capacity
// ---------------------------------------------------------------------------

function renderRFCNarrative(doc: jsPDF, data: ReportData): void {
  const rfc = data.analysis.rfcNarrative;
  if (!rfc) return;

  doc.addPage();
  let y = MARGIN + 5;

  y = addSectionTitle(doc, "4b. Residual Functional Capacity", y);

  // Functional level heading
  const funcLevelLabel = jsonStr(rfc, "functionalLevelLabel");
  const funcLevel = jsonStr(rfc, "functionalLevel");
  if (funcLevelLabel || funcLevel) {
    y = checkPageBreak(doc, y, 12);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.secondary);
    doc.text(`Functional Level: ${funcLevelLabel || funcLevel}`, MARGIN, y);
    y += 8;
  }

  // Physical summary paragraph
  const physicalSummary = jsonStr(rfc, "physicalSummary");
  if (physicalSummary) {
    y = checkPageBreak(doc, y, 20);
    y = addSubsectionTitle(doc, "Physical Demands", y);
    y = renderParagraph(doc, physicalSummary, y);
    y += 3;
  }

  // Cognitive/aptitude summary paragraph
  const cognitiveSummary = jsonStr(rfc, "cognitiveSummary");
  if (cognitiveSummary) {
    y = checkPageBreak(doc, y, 20);
    y = addSubsectionTitle(doc, "Cognitive / Aptitude Demands", y);
    y = renderParagraph(doc, cognitiveSummary, y);
    y += 3;
  }

  // Environmental summary paragraph
  const environmentalSummary = jsonStr(rfc, "environmentalSummary");
  if (environmentalSummary) {
    y = checkPageBreak(doc, y, 20);
    y = addSubsectionTitle(doc, "Environmental Tolerances", y);
    y = renderParagraph(doc, environmentalSummary, y);
    y += 3;
  }

  // Two-column layout: Suitable vs Unsuitable work types
  const suitable = jsonArr(rfc, "suitableWorkTypes");
  const unsuitable = jsonArr(rfc, "unsuitableWorkTypes");

  if (suitable.length > 0 || unsuitable.length > 0) {
    y = checkPageBreak(doc, y, 30);
    y = addSubsectionTitle(doc, "Work Type Suitability", y);

    const maxRows = Math.max(suitable.length, unsuitable.length);
    const twoColBody: RowInput[] = [];
    for (let i = 0; i < maxRows; i++) {
      twoColBody.push([
        i < suitable.length ? String(suitable[i]) : "",
        i < unsuitable.length ? String(unsuitable[i]) : "",
      ]);
    }

    autoTable(doc, {
      startY: y,
      head: [["Suitable Work Types", "Unsuitable Work Types"]],
      body: twoColBody,
      theme: "grid",
      margin: { left: MARGIN, right: MARGIN },
      headStyles: {
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 9,
      },
      styles: { fontSize: 9, cellPadding: 3, textColor: COLORS.darkText },
      columnStyles: {
        0: { cellWidth: CONTENT_WIDTH / 2, fillColor: COLORS.successBg },
        1: { cellWidth: CONTENT_WIDTH / 2, fillColor: COLORS.excludedBg },
      },
    });
    y = getLastTableY(doc, y + 30) + 8;
  }

  // Strengths and limitations summary
  const strengths = jsonArr(rfc, "strengths");
  const limitations = jsonArr(rfc, "limitations");
  const moderateCapabilities = jsonArr(rfc, "moderateCapabilities");

  if (strengths.length > 0 || limitations.length > 0) {
    y = checkPageBreak(doc, y, 20);
    y = addSubsectionTitle(doc, "Trait-Level Summary", y);

    if (strengths.length > 0) {
      y = checkPageBreak(doc, y, 10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.primary);
      doc.text("Retained Strengths (level 3-4):", MARGIN, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.darkText);
      const strengthLabels = strengths.map((s) => {
        const item = s as Record<string, unknown>;
        return String(item.description ?? item.label ?? "---");
      });
      const strengthText = strengthLabels.join("; ");
      y = renderParagraph(doc, strengthText, y, { fontSize: 9 });
      y += 2;
    }

    if (limitations.length > 0) {
      y = checkPageBreak(doc, y, 10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(180, 60, 60);
      doc.text("Significant Limitations (level 0-1):", MARGIN, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.darkText);
      for (const lim of limitations) {
        const item = lim as Record<string, unknown>;
        const desc = String(item.description ?? item.label ?? "---");
        const impact = jsonStr(item as Record<string, unknown>, "impactOnWork");
        y = checkPageBreak(doc, y, 8);
        const bulletText = impact ? `${desc} - ${impact}` : desc;
        const bullet = `  \u2022  ${bulletText}`;
        const splitBullet = doc.splitTextToSize(bullet, CONTENT_WIDTH - 8);
        doc.setFontSize(9);
        doc.text(splitBullet, MARGIN, y);
        y += splitBullet.length * 3.8 + 1;
      }
      y += 2;
    }

    if (moderateCapabilities.length > 0) {
      y = checkPageBreak(doc, y, 10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.warningText);
      doc.text("Moderate Capabilities (level 2):", MARGIN, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.darkText);
      const modText = moderateCapabilities.map((m) => String(m)).join(", ");
      y = renderParagraph(doc, modText, y, { fontSize: 9 });
      y += 2;
    }
  }

  // Pre-to-post changes (from traitChanges if available, or from fullNarrative changes)
  const traitChanges = jsonArr(rfc, "traitChanges");
  if (traitChanges.length > 0) {
    y = checkPageBreak(doc, y, 20);
    y = addSubsectionTitle(doc, "Significant Trait Changes (Pre- vs Post-Injury)", y);

    const changeBody: RowInput[] = traitChanges.map((change) => {
      const c = change as Record<string, unknown>;
      return [
        String(c.trait ?? "---"),
        String(c.preValue ?? "---"),
        String(c.postValue ?? "---"),
        String(c.change ?? "---"),
        String(c.impact ?? "---"),
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["Trait", "Pre-Injury", "Post-Injury", "Change", "Impact"]],
      body: changeBody,
      theme: "grid",
      margin: { left: MARGIN, right: MARGIN },
      headStyles: {
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 8,
      },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: COLORS.darkText },
      alternateRowStyles: { fillColor: COLORS.lightGray },
    });
  }
}

// ---------------------------------------------------------------------------
// Section 5: Target Occupation Rankings (existing)
// ---------------------------------------------------------------------------

function renderTargetRankings(doc: jsPDF, data: ReportData): void {
  doc.addPage();
  let y = MARGIN + 5;

  y = addSectionTitle(doc, "5. Target Occupation Rankings", y);

  if (data.targets.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...COLORS.mutedText);
    doc.text("No target occupations evaluated.", MARGIN, y);
    return;
  }

  const head: RowInput[] = [
    ["Title", "O*NET", "STQ", "TFQ", "VAQ", "LMQ", "PVQ", "Grade", "Status"],
  ];

  const sortedTargets = [...data.targets].sort((a, b) => {
    if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
    return (b.pvq ?? 0) - (a.pvq ?? 0);
  });

  const body: RowInput[] = sortedTargets.map((t) => [
    t.title,
    t.onetSocCode,
    fmtNumber(t.stq),
    fmtNumber(t.tfq),
    fmtNumber(t.vaq),
    fmtNumber(t.lmq),
    fmtNumber(t.pvq),
    t.confidenceGrade ?? "---",
    t.excluded ? "Excluded" : "Included",
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: COLORS.darkText,
      halign: "center",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 40 },
      1: { cellWidth: 22 },
    },
    didParseCell(hookData) {
      if (hookData.section !== "body") return;

      const rowIdx = hookData.row.index;
      const target = sortedTargets[rowIdx];

      // Red-tint excluded rows
      if (target?.excluded) {
        hookData.cell.styles.fillColor = COLORS.excludedBg;
        hookData.cell.styles.textColor = [180, 60, 60];
      }

      // Bold the PVQ column
      if (hookData.column.index === 6) {
        hookData.cell.styles.fontStyle = "bold";
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Section 5b: Near-Miss & Retrainability Analysis
// ---------------------------------------------------------------------------

function renderNearMissAnalysis(doc: jsPDF, data: ReportData): void {
  const nm = data.analysis.nearMissAnalysis;
  if (!nm) return;

  doc.addPage();
  let y = MARGIN + 5;

  y = addSectionTitle(doc, "5b. Near-Miss & Retrainability Analysis", y);

  // Summary: total near-misses and count by severity
  const totalExcluded = jsonNum(nm, "totalExcluded") ?? 0;
  const marginalCount = jsonNum(nm, "marginalCount") ?? 0;
  const moderateCount = jsonNum(nm, "moderateCount") ?? 0;
  const significantCount = jsonNum(nm, "significantCount") ?? 0;
  const nearMisses = jsonArr(nm, "nearMisses");

  // Summary sentence
  const totalNearMisses = nearMisses.length;
  if (totalExcluded > 0 || totalNearMisses > 0) {
    const summaryText = `Of ${totalExcluded} excluded occupations analyzed, ${totalNearMisses} are near-misses ` +
      `(${marginalCount} marginal, ${moderateCount} moderate, ${significantCount} significant).`;
    y = renderParagraph(doc, summaryText, y, { fontSize: 10 });
    y += 2;
  }

  // Severity summary table
  const summaryBody: RowInput[] = [
    ["Marginal (1 trait, \u22641 point deficit)", String(marginalCount)],
    ["Moderate (1-2 traits, \u22642 points total deficit)", String(moderateCount)],
    ["Significant (3+ traits or large deficits)", String(significantCount)],
    ["Total Near-Misses", String(totalNearMisses)],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Severity Category", "Count"]],
    body: summaryBody,
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 9,
    },
    styles: { fontSize: 9, cellPadding: 3, textColor: COLORS.darkText },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { halign: "center", cellWidth: 30 },
    },
    alternateRowStyles: { fillColor: COLORS.lightGray },
  });
  y = getLastTableY(doc, y + 30) + 8;

  // Limiting traits list (top traits causing most exclusions)
  const limitingTraits = jsonArr(nm, "limitingTraits");
  const commonFailingTraits = jsonArr(nm, "commonFailingTraits");
  if (limitingTraits.length > 0 || commonFailingTraits.length > 0) {
    y = checkPageBreak(doc, y, 20);
    y = addSubsectionTitle(doc, "Most Common Limiting Traits", y);

    if (commonFailingTraits.length > 0) {
      const cftBody: RowInput[] = commonFailingTraits.slice(0, 8).map((cft) => {
        const t = cft as Record<string, unknown>;
        return [
          String(t.label ?? t.trait ?? "---"),
          String(t.group ?? "---"),
          String(t.count ?? "---"),
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [["Trait", "Group", "Exclusion Count"]],
        body: cftBody,
        theme: "grid",
        margin: { left: MARGIN, right: MARGIN },
        headStyles: {
          fillColor: COLORS.secondary,
          textColor: COLORS.white,
          fontStyle: "bold",
          fontSize: 8,
        },
        styles: { fontSize: 8, cellPadding: 2.5, textColor: COLORS.darkText },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 40, halign: "center" },
          2: { cellWidth: 35, halign: "center" },
        },
        alternateRowStyles: { fillColor: COLORS.lightGray },
      });
      y = getLastTableY(doc, y + 20) + 6;
    } else {
      // Fallback to simple limitingTraits string list
      const limitingText = limitingTraits.map((lt) => String(lt)).join(", ");
      y = renderParagraph(doc, limitingText, y, { fontSize: 9 });
      y += 2;
    }
  }

  // Table of near-miss occupations: Title, Severity, Failed Traits count, Total Deficit, Retrainable
  if (nearMisses.length > 0) {
    y = checkPageBreak(doc, y, 20);
    y = addSubsectionTitle(doc, "Near-Miss Occupations", y);

    const occBody: RowInput[] = nearMisses.map((occ) => {
      const o = occ as Record<string, unknown>;
      const failedTraitCount = jsonNum(o as Record<string, unknown>, "failedTraitCount") ?? 0;
      const totalDeficit = jsonNum(o as Record<string, unknown>, "totalDeficit") ?? 0;
      return [
        String(o.occupationTitle ?? o.title ?? "---"),
        String(o.severity ?? "---"),
        String(failedTraitCount),
        fmtNumber(totalDeficit, 1),
        o.retrainable ? "Yes" : "No",
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["Title", "Severity", "Failed Traits", "Total Deficit", "Retrainable?"]],
      body: occBody,
      theme: "grid",
      margin: { left: MARGIN, right: MARGIN },
      headStyles: {
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 8,
      },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: COLORS.darkText, overflow: "linebreak" },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 25, halign: "center" },
        2: { cellWidth: 25, halign: "center" },
        3: { cellWidth: 30, halign: "center" },
        4: { cellWidth: 25, halign: "center" },
      },
      alternateRowStyles: { fillColor: COLORS.lightGray },
      didParseCell(hookData) {
        if (hookData.section !== "body") return;
        // Highlight severity
        if (hookData.column.index === 1) {
          const sev = String(hookData.cell.raw).toLowerCase();
          if (sev === "marginal") {
            hookData.cell.styles.fillColor = COLORS.warningBg;
          } else if (sev === "moderate") {
            hookData.cell.styles.fillColor = COLORS.warningBg;
            hookData.cell.styles.textColor = COLORS.warningText;
          } else if (sev === "significant") {
            hookData.cell.styles.fillColor = COLORS.excludedBg;
          }
        }
        // Highlight retrainable
        if (hookData.column.index === 4 && hookData.cell.raw === "Yes") {
          hookData.cell.styles.fillColor = COLORS.successBg;
          hookData.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = getLastTableY(doc, y + 30) + 8;

    // Retraining recommendations from retrainingNotes on marginal/moderate occupations
    const retrainableOccs = nearMisses.filter((occ) => {
      const o = occ as Record<string, unknown>;
      return o.retrainable === true &&
        (String(o.severity).toLowerCase() === "marginal" || String(o.severity).toLowerCase() === "moderate");
    });

    if (retrainableOccs.length > 0) {
      y = checkPageBreak(doc, y, 20);
      y = addSubsectionTitle(doc, "Retraining Recommendations", y);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.darkText);

      for (const occ of retrainableOccs) {
        const o = occ as Record<string, unknown>;
        const title = String(o.occupationTitle ?? o.title ?? "Unknown");
        const notes = jsonArr(o as Record<string, unknown>, "retrainingNotes");
        if (notes.length === 0) continue;

        y = checkPageBreak(doc, y, 12);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.secondary);
        doc.text(title, MARGIN, y);
        y += 4;

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.darkText);
        for (const note of notes) {
          y = checkPageBreak(doc, y, 5);
          const bullet = `  \u2022  ${String(note)}`;
          const splitBullet = doc.splitTextToSize(bullet, CONTENT_WIDTH - 8);
          doc.setFontSize(8);
          doc.text(splitBullet, MARGIN, y);
          y += splitBullet.length * 3.5 + 1;
        }
        y += 2;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Section 6: Quotient Detail (enhanced with trait analysis)
// ---------------------------------------------------------------------------

function renderQuotientDetails(doc: jsPDF, data: ReportData): void {
  const includedTargets = data.targets.filter((t) => !t.excluded);
  const excludedTargets = data.targets.filter((t) => t.excluded);

  if (includedTargets.length === 0 && excludedTargets.length === 0) return;

  // ---- Included targets ----
  if (includedTargets.length > 0) {
    doc.addPage();
    let y = MARGIN + 5;
    y = addSectionTitle(doc, "6. Quotient Detail \u2014 Included Targets", y);

    for (const target of includedTargets) {
      y = checkPageBreak(doc, y, 60);

      // Target header
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.secondary);
      doc.text(`${target.title} (${target.onetSocCode})`, MARGIN, y);
      y += 5;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.darkText);
      doc.text(
        `PVQ: ${fmtNumber(target.pvq)} | Grade: ${target.confidenceGrade ?? "N/A"}`,
        MARGIN,
        y
      );
      y += 7;

      // STQ Detail
      y = renderQuotientSection(doc, y, "STQ", target.stq, target.stqDetails);
      // TFQ Detail
      y = renderQuotientSection(doc, y, "TFQ", target.tfq, target.tfqDetails);
      // VAQ Detail
      y = renderQuotientSection(doc, y, "VAQ", target.vaq, target.vaqDetails);
      // LMQ Detail
      y = renderQuotientSection(doc, y, "LMQ", target.lmq, target.lmqDetails);

      // Section 6b: Trait margin detail for included targets
      y = renderTraitAnalysisForTarget(doc, y, target);

      y += 6;

      // Separator between targets
      doc.setDrawColor(...COLORS.headerBg);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
      y += 6;
    }
  }

  // ---- Excluded targets detail ----
  if (excludedTargets.length > 0) {
    doc.addPage();
    let y = MARGIN + 5;
    y = addSectionTitle(doc, "6a. Excluded Occupation Detail", y);

    for (const target of excludedTargets) {
      y = checkPageBreak(doc, y, 45);

      // Target header
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(180, 60, 60);
      doc.text(`${target.title} (${target.onetSocCode})`, MARGIN, y);
      y += 5;

      // Exclusion reason
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.darkText);
      doc.text(
        `Exclusion Reason: ${target.exclusionReason ?? "Trait-factor mismatch"}`,
        MARGIN,
        y
      );
      y += 5;

      // Near-miss severity
      if (target.nearMissSeverity) {
        doc.text(`Near-Miss Severity: ${target.nearMissSeverity}`, MARGIN, y);
        y += 5;
      }

      // Failed traits from nearMissDetails
      const nmDetails = target.nearMissDetails as Record<string, unknown> | null;
      if (nmDetails) {
        const failedTraits = jsonArr(nmDetails, "failedTraits");
        if (failedTraits.length > 0) {
          y = checkPageBreak(doc, y, 20);

          const ftBody: RowInput[] = failedTraits.map((ft) => {
            const f = ft as Record<string, unknown>;
            return [
              String(f.trait ?? "---"),
              String(f.workerValue ?? "---"),
              String(f.demandValue ?? "---"),
              String(f.deficit ?? "---"),
            ];
          });

          autoTable(doc, {
            startY: y,
            head: [["Failed Trait", "Worker", "Demand", "Deficit"]],
            body: ftBody,
            theme: "grid",
            margin: { left: MARGIN + 4, right: MARGIN },
            headStyles: {
              fillColor: [180, 60, 60],
              textColor: COLORS.white,
              fontStyle: "bold",
              fontSize: 7.5,
            },
            styles: { fontSize: 7.5, cellPadding: 2, textColor: COLORS.darkText },
            columnStyles: {
              0: { cellWidth: 35 },
              1: { halign: "center", cellWidth: 20 },
              2: { halign: "center", cellWidth: 20 },
              3: { halign: "center", cellWidth: 20 },
            },
            alternateRowStyles: { fillColor: COLORS.excludedBg },
          });
          y = getLastTableY(doc, y + 20) + 4;
        }

        // Retrainability notes
        const retrainNotes = jsonStr(nmDetails, "retrainabilityNotes");
        if (retrainNotes) {
          y = checkPageBreak(doc, y, 10);
          doc.setFontSize(8);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(...COLORS.mutedText);
          const splitNotes = doc.splitTextToSize(`Retrainability: ${retrainNotes}`, CONTENT_WIDTH - 8);
          doc.text(splitNotes, MARGIN + 4, y);
          y += splitNotes.length * 3.5 + 2;
        }
      }

      y += 4;
      doc.setDrawColor(...COLORS.headerBg);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
      y += 6;
    }
  }
}

/** Render trait margin detail table for an included target */
function renderTraitAnalysisForTarget(
  doc: jsPDF,
  y: number,
  target: ReportData["targets"][number]
): number {
  // Extract trait comparisons from tfqDetails
  const tfqDetails = target.tfqDetails as Record<string, unknown> | null;
  if (!tfqDetails) return y;

  // Look for trait comparisons in tfqDetails
  const traitComparisons = jsonArr(tfqDetails, "traitComparisons");

  // Filter to show only traits where margin < 2 or demand is non-null
  const relevantTraits = traitComparisons.length > 0
    ? traitComparisons.filter((tc) => {
        const t = tc as Record<string, unknown>;
        const margin = t.margin != null ? Number(t.margin) : null;
        const demand = t.demand ?? t.demandValue;
        return (margin != null && margin < 2) || demand != null;
      })
    : [];

  if (relevantTraits.length === 0) {
    // If no traitComparisons array, show summary from trait margin fields
    if (target.traitMarginMin != null || target.closestFailTrait) {
      y = checkPageBreak(doc, y, 12);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.mutedText);
      const marginInfo: string[] = [];
      if (target.traitMarginMin != null) marginInfo.push(`Min Margin: ${fmtNumber(target.traitMarginMin, 1)}`);
      if (target.traitMarginAvg != null) marginInfo.push(`Avg Margin: ${fmtNumber(target.traitMarginAvg, 1)}`);
      if (target.closestFailTrait) marginInfo.push(`Closest to Failing: ${target.closestFailTrait}`);
      doc.text(`Trait Analysis: ${marginInfo.join(" | ")}`, MARGIN + 4, y);
      y += 5;
    }
    return y;
  }

  y = checkPageBreak(doc, y, 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text("Trait Analysis", MARGIN + 2, y);
  y += 5;

  const traitBody: RowInput[] = relevantTraits.map((tc) => {
    const t = tc as Record<string, unknown>;
    const margin = t.margin != null ? Number(t.margin) : null;
    const status = margin != null
      ? margin < 0 ? "FAIL" : margin <= 1 ? "Close" : "Pass"
      : String(t.status ?? "---");
    return [
      String(t.trait ?? t.traitName ?? "---"),
      String(t.worker ?? t.workerValue ?? "---"),
      String(t.demand ?? t.demandValue ?? "---"),
      margin != null ? fmtNumber(margin, 1) : "---",
      status,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Trait", "Worker", "Demand", "Margin", "Status"]],
    body: traitBody,
    theme: "grid",
    margin: { left: MARGIN + 4, right: MARGIN },
    headStyles: {
      fillColor: COLORS.secondary,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 7.5,
    },
    styles: { fontSize: 7.5, cellPadding: 2, textColor: COLORS.darkText },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { halign: "center", cellWidth: 18 },
      2: { halign: "center", cellWidth: 18 },
      3: { halign: "center", cellWidth: 18 },
      4: { halign: "center", cellWidth: 18 },
    },
    alternateRowStyles: { fillColor: COLORS.lightGray },
    didParseCell(hookData) {
      if (hookData.section !== "body") return;
      // Bold barely-passing traits (margin 0-1)
      if (hookData.column.index === 4) {
        const status = String(hookData.cell.raw);
        if (status === "Close") {
          hookData.cell.styles.fillColor = COLORS.warningBg;
          hookData.cell.styles.fontStyle = "bold";
          hookData.cell.styles.textColor = COLORS.warningText;
        } else if (status === "FAIL") {
          hookData.cell.styles.fillColor = COLORS.excludedBg;
          hookData.cell.styles.fontStyle = "bold";
          hookData.cell.styles.textColor = [180, 60, 60];
        } else if (status === "Pass") {
          hookData.cell.styles.fillColor = COLORS.successBg;
        }
      }
      // Bold margin column for tight margins
      if (hookData.column.index === 3) {
        const raw = hookData.cell.raw;
        const val = raw != null ? Number(raw) : null;
        if (val != null && !isNaN(val) && val >= 0 && val <= 1) {
          hookData.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  y = getLastTableY(doc, y + 20) + 4;
  return y;
}

function renderQuotientSection(
  doc: jsPDF,
  y: number,
  label: string,
  score: number | null | undefined,
  details: unknown
): number {
  y = checkPageBreak(doc, y, 25);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text(`${label}: ${fmtNumber(score)}`, MARGIN + 2, y);
  y += 5;

  if (!details || typeof details !== "object") {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...COLORS.mutedText);
    doc.setFontSize(8);
    doc.text("No detail data available.", MARGIN + 4, y);
    return y + 5;
  }

  const detailObj = details as Record<string, unknown>;
  const entries = Object.entries(detailObj).filter(
    ([key]) => key !== "traitComparisons" // rendered separately in trait analysis
  );

  if (entries.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...COLORS.mutedText);
    doc.setFontSize(8);
    doc.text("No detail data available.", MARGIN + 4, y);
    return y + 5;
  }

  // Render detail entries as a compact key-value list
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.darkText);

  for (const [key, value] of entries) {
    y = checkPageBreak(doc, y, 6);

    const displayKey = key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();

    let displayValue: string;
    if (typeof value === "number") {
      displayValue = fmtNumber(value);
    } else if (typeof value === "object" && value !== null) {
      if (Array.isArray(value)) {
        // Skip arrays (like traitComparisons) in the key-value list
        continue;
      }
      // Nested objects: summarize as JSON-like
      displayValue = summarizeObject(value as Record<string, unknown>);
    } else {
      displayValue = String(value ?? "---");
    }

    const line = `  ${displayKey}: ${displayValue}`;
    const splitLine = doc.splitTextToSize(line, CONTENT_WIDTH - 8);
    doc.text(splitLine, MARGIN + 4, y);
    y += splitLine.length * 3.5;
  }

  return y + 2;
}

function summarizeObject(obj: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "number") {
      parts.push(`${k}: ${fmtNumber(v)}`);
    } else if (typeof v === "string") {
      parts.push(`${k}: ${v}`);
    } else if (typeof v === "boolean") {
      parts.push(`${k}: ${v ? "Yes" : "No"}`);
    }
    // Skip deeply nested objects to keep it compact
  }
  return parts.join(", ") || "---";
}

// ---------------------------------------------------------------------------
// Section 7: VQS Vocational Analysis (existing)
// ---------------------------------------------------------------------------

function renderVQSAnalysis(doc: jsPDF, data: ReportData): void {
  // Only render if any targets have VQ data
  const targetsWithVQ = data.targets.filter(t => t.vqScore != null);
  if (targetsWithVQ.length === 0) return;

  doc.addPage();
  let y = MARGIN + 5;

  y = addSectionTitle(doc, "7. VQS Vocational Analysis", y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.darkText);

  const intro =
    "The McCroskey Vocational Quotient System (VQS) provides standardized measures of " +
    "occupational complexity (VQ), skill transferability (TSP), and earning capacity (EC) " +
    "with published validity coefficients and confidence intervals.";
  const splitIntro = doc.splitTextToSize(intro, CONTENT_WIDTH);
  doc.text(splitIntro, MARGIN, y);
  y += splitIntro.length * 4.5 + 4;

  // EC Summary if available
  if (data.analysis.vqsPostEcMedian != null || data.analysis.vqsPreEcMedian != null) {
    y = checkPageBreak(doc, y, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.primary);
    doc.text("Earning Capacity Summary", MARGIN, y);
    y += 6;

    const ecRows: RowInput[] = [];
    if (data.analysis.vqsPreEcMedian != null) {
      ecRows.push(["Pre-Injury EC", fmtHourly(data.analysis.vqsPreEcMedian),
        `${fmtCurrency(data.analysis.vqsPreEcMedian * 2080)}/yr`]);
    }
    if (data.analysis.vqsPostEcMedian != null) {
      ecRows.push(["Post-Injury EC", fmtHourly(data.analysis.vqsPostEcMedian),
        `${fmtCurrency(data.analysis.vqsPostEcMedian * 2080)}/yr`]);
    }
    if (data.analysis.vqsEcLoss != null) {
      ecRows.push(["EC Loss", fmtHourly(data.analysis.vqsEcLoss),
        `${fmtCurrency(Math.abs(data.analysis.vqsEcLoss) * 2080)}/yr`]);
    }
    if (data.analysis.vqsEcLossPct != null) {
      ecRows.push(["Loss %", `${data.analysis.vqsEcLossPct.toFixed(1)}%`, ""]);
    }

    autoTable(doc, {
      startY: y,
      head: [["Metric", "Hourly", "Annual"]],
      body: ecRows,
      theme: "grid",
      headStyles: {
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontSize: 9,
        fontStyle: "bold",
      },
      styles: { fontSize: 9, cellPadding: 2 },
      margin: { left: MARGIN, right: MARGIN },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 50 },
        1: { halign: "right", cellWidth: 40 },
        2: { halign: "right" },
      },
    });
    y = getLastTableY(doc, y + 30) + 8;
  }

  // Per-occupation VQS table
  y = checkPageBreak(doc, y, 20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text("VQS Scores by Occupation", MARGIN, y);
  y += 6;

  const viable = targetsWithVQ.filter(t => !t.excluded);
  const vqsBody: RowInput[] = viable.map(t => [
    t.title.length > 28 ? t.title.substring(0, 26) + "..." : t.title,
    t.vqScore != null ? t.vqScore.toFixed(0) : "---",
    t.vqBand != null ? `B${t.vqBand}` : "---",
    t.tspScore != null ? `${t.tspScore.toFixed(0)}%` : "---",
    t.tspTier != null ? `T${t.tspTier}` : "---",
    fmtHourly(t.ecMedian),
    t.ecConfLow != null && t.ecConfHigh != null
      ? `[${fmtHourly(t.ecConfLow)}, ${fmtHourly(t.ecConfHigh)}]`
      : "---",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Occupation", "VQ", "Band", "TSP", "Tier", "EC Median", "95% CI"]],
    body: vqsBody,
    theme: "striped",
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontSize: 8,
      fontStyle: "bold",
    },
    styles: { fontSize: 7.5, cellPadding: 1.5, overflow: "linebreak" },
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: {
      0: { cellWidth: 48 },
      1: { halign: "center", cellWidth: 15 },
      2: { halign: "center", cellWidth: 15 },
      3: { halign: "center", cellWidth: 15 },
      4: { halign: "center", cellWidth: 12 },
      5: { halign: "right", cellWidth: 22 },
      6: { halign: "right", cellWidth: 43 },
    },
    alternateRowStyles: { fillColor: COLORS.lightGray },
  });
}

// ---------------------------------------------------------------------------
// Section 7b: Viable Set Analysis
// ---------------------------------------------------------------------------

function renderViableSetAnalysis(doc: jsPDF, data: ReportData): void {
  const vs = data.analysis.viableSetAnalysis;
  if (!vs) return;

  doc.addPage();
  let y = MARGIN + 5;

  y = addSectionTitle(doc, "7b. Viable Set Analysis", y);

  // Total viable count
  const totalViable = jsonNum(vs, "totalViable") ?? 0;

  // Coherence score and label
  const coherenceScore = jsonNum(vs, "coherenceScore");
  const coherenceLabel = jsonStr(vs, "coherenceLabel");
  const coherenceDisplayLabel = coherenceLabel
    ? coherenceLabel.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "";

  if (totalViable > 0 || coherenceScore != null) {
    y = checkPageBreak(doc, y, 16);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.secondary);
    doc.text(`Total Viable Occupations: ${totalViable}`, MARGIN, y);
    y += 7;
    if (coherenceDisplayLabel || coherenceScore != null) {
      const cohText = coherenceDisplayLabel
        ? `Set Coherence: ${coherenceDisplayLabel}${coherenceScore != null ? ` (score: ${fmtNumber(coherenceScore, 1)})` : ""}`
        : `Set Coherence Score: ${fmtNumber(coherenceScore, 1)}`;
      doc.text(cohText, MARGIN, y);
      y += 8;
    }
  }

  // Narrative summary
  const narrative = jsonStr(vs, "narrativeSummary") || jsonStr(vs, "narrative");
  if (narrative) {
    y = checkPageBreak(doc, y, 15);
    y = renderParagraph(doc, narrative, y, { fontSize: 10 });
    y += 4;
  }

  // Occupation cluster summary
  const clusters = jsonArr(vs, "clusters");
  if (clusters.length > 0) {
    y = checkPageBreak(doc, y, 20);
    y = addSubsectionTitle(doc, "Occupation Clusters", y);

    const clusterBody: RowInput[] = clusters.map((cluster) => {
      const c = cluster as Record<string, unknown>;
      const occList = Array.isArray(c.occupations) ? (c.occupations as unknown[]) : [];
      const commonTraits = Array.isArray(c.commonTraitStrengths)
        ? (c.commonTraitStrengths as string[]).slice(0, 4).join(", ")
        : "---";
      return [
        String(c.name ?? "---"),
        String(occList.length),
        fmtNumber(jsonNum(c as Record<string, unknown>, "avgStq"), 1),
        fmtNumber(jsonNum(c as Record<string, unknown>, "avgPvq"), 1),
        commonTraits || "---",
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["Cluster", "Count", "Avg STQ", "Avg PVQ", "Common Trait Strengths"]],
      body: clusterBody,
      theme: "grid",
      margin: { left: MARGIN, right: MARGIN },
      headStyles: {
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 8,
      },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: COLORS.darkText, overflow: "linebreak" },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: "bold" },
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 73 },
      },
      alternateRowStyles: { fillColor: COLORS.lightGray },
    });
    y = getLastTableY(doc, y + 20) + 8;
  }

  // Trait consistency assessment
  const traitDemandRange = jsonArr(vs, "traitDemandRange");
  if (traitDemandRange.length > 0) {
    // Show only traits with notable variance (wide range) or notable consistency (narrow)
    const narrowTraits = traitDemandRange.filter((t) => {
      const tr = t as Record<string, unknown>;
      return tr.isNarrow === true && (jsonNum(tr as Record<string, unknown>, "avgDemand") ?? 0) >= 2;
    });
    const wideTraits = traitDemandRange.filter((t) => {
      const tr = t as Record<string, unknown>;
      return tr.isWide === true;
    });

    if (narrowTraits.length > 0 || wideTraits.length > 0) {
      y = checkPageBreak(doc, y, 20);
      y = addSubsectionTitle(doc, "Trait Consistency Across Viable Set", y);

      if (narrowTraits.length > 0) {
        y = checkPageBreak(doc, y, 10);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.primary);
        doc.text("Consistent Requirements (narrow demand range):", MARGIN, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.darkText);
        const narrowLabels = narrowTraits.slice(0, 8).map((t) => {
          const tr = t as Record<string, unknown>;
          return String(tr.label ?? tr.trait ?? "---");
        }).join(", ");
        y = renderParagraph(doc, narrowLabels, y, { fontSize: 9 });
        y += 2;
      }

      if (wideTraits.length > 0) {
        y = checkPageBreak(doc, y, 10);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.warningText);
        doc.text("Variable Requirements (wide demand range):", MARGIN, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.darkText);
        const wideLabels = wideTraits.slice(0, 8).map((t) => {
          const tr = t as Record<string, unknown>;
          return String(tr.label ?? tr.trait ?? "---");
        }).join(", ");
        y = renderParagraph(doc, wideLabels, y, { fontSize: 9 });
        y += 2;
      }
    }
  }

  // Core vs peripheral placement breakdown
  const coreOccs = jsonArr(vs, "coreOccupations");
  const peripheralOccs = jsonArr(vs, "peripheralOccupations");

  if (coreOccs.length > 0 || peripheralOccs.length > 0) {
    y = checkPageBreak(doc, y, 20);
    y = addSubsectionTitle(doc, "Core vs. Peripheral Placement", y);

    // Summary line
    const middleCount = totalViable - coreOccs.length - peripheralOccs.length;
    const placementSummary = `${coreOccs.length} core (strong transfer, STQ >60), ` +
      `${middleCount > 0 ? middleCount + " middle-range, " : ""}` +
      `${peripheralOccs.length} peripheral (stretch placements, STQ <40)`;
    y = renderParagraph(doc, placementSummary, y, { fontSize: 9 });
    y += 2;

    const maxRows = Math.max(coreOccs.length, peripheralOccs.length);
    if (maxRows > 0) {
      const classBody: RowInput[] = [];
      for (let i = 0; i < maxRows; i++) {
        const coreItem = i < coreOccs.length ? coreOccs[i] : "";
        const periphItem = i < peripheralOccs.length ? peripheralOccs[i] : "";
        const coreTitle = typeof coreItem === "object" && coreItem != null
          ? String((coreItem as Record<string, unknown>).title ?? coreItem)
          : String(coreItem);
        const periphTitle = typeof periphItem === "object" && periphItem != null
          ? String((periphItem as Record<string, unknown>).title ?? periphItem)
          : String(periphItem);
        classBody.push([coreTitle, periphTitle]);
      }

      autoTable(doc, {
        startY: y,
        head: [["Core Occupations (STQ >60)", "Peripheral Occupations (STQ <40)"]],
        body: classBody,
        theme: "grid",
        margin: { left: MARGIN, right: MARGIN },
        headStyles: {
          fillColor: COLORS.primary,
          textColor: COLORS.white,
          fontStyle: "bold",
          fontSize: 9,
        },
        styles: { fontSize: 9, cellPadding: 3, textColor: COLORS.darkText },
        columnStyles: {
          0: { cellWidth: CONTENT_WIDTH / 2, fillColor: COLORS.successBg },
          1: { cellWidth: CONTENT_WIDTH / 2, fillColor: COLORS.warningBg },
        },
      });
      y = getLastTableY(doc, y + 20) + 8;
    }
  }
}

// ---------------------------------------------------------------------------
// Section 7c: Regional Labor Market
// ---------------------------------------------------------------------------

function renderRegionalLaborMarket(doc: jsPDF, data: ReportData): void {
  const rlm = data.analysis.regionalLaborMarket;
  if (!rlm) return;

  doc.addPage();
  let y = MARGIN + 5;

  y = addSectionTitle(doc, "7c. Regional Labor Market Context", y);

  // Full narrative summary (covers location, wages, employment, JOLTS, pre/post)
  const fullNarrative = jsonStr(rlm, "fullNarrative");
  if (fullNarrative) {
    // Split on double-newlines to render as separate paragraphs
    const paragraphs = fullNarrative.split(/\n\n+/).filter(Boolean);
    for (const para of paragraphs) {
      y = checkPageBreak(doc, y, 15);
      y = renderParagraph(doc, para, y, { fontSize: 10 });
      y += 3;
    }
    y += 2;
  } else {
    // Fallback: render individual fields if fullNarrative is not present
    const locationSummary = jsonStr(rlm, "locationSummary");
    if (locationSummary) {
      y = renderParagraph(doc, locationSummary, y, { fontSize: 10 });
      y += 3;
    }
  }

  // Metro area employment context
  const employmentConcentration = jsonStr(rlm, "employmentConcentration");
  const wagePremiumLabel = jsonStr(rlm, "wagePremiumLabel");
  const wagePremiumPct = jsonNum(rlm, "wagePremiumPct");

  if (employmentConcentration || wagePremiumLabel) {
    y = checkPageBreak(doc, y, 25);
    y = addSubsectionTitle(doc, "Metro Area Employment Context", y);

    const contextRows: RowInput[] = [];
    if (wagePremiumLabel) {
      contextRows.push(["Area Wage Level", wagePremiumLabel]);
    }
    if (wagePremiumPct != null) {
      contextRows.push(["Wage Differential", `${wagePremiumPct >= 0 ? "+" : ""}${wagePremiumPct.toFixed(1)}%`]);
    }
    if (employmentConcentration) {
      contextRows.push(["Employment Concentration", employmentConcentration]);
    }

    const areaToNationalRatio = jsonNum(rlm, "areaToNationalRatio");
    if (areaToNationalRatio != null) {
      contextRows.push(["Area/National Ratio", `${(areaToNationalRatio * 100).toFixed(2)}%`]);
    }

    const stateJoltsChangePct = jsonNum(rlm, "stateJoltsChangePct");
    if (stateJoltsChangePct != null) {
      const changeLabel = stateJoltsChangePct >= 0
        ? `+${stateJoltsChangePct.toFixed(1)}% since injury`
        : `${stateJoltsChangePct.toFixed(1)}% since injury`;
      contextRows.push(["State JOLTS Change", changeLabel]);
    }

    if (contextRows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [],
        body: contextRows,
        theme: "plain",
        margin: { left: MARGIN, right: MARGIN },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 55, textColor: COLORS.primary },
          1: { cellWidth: CONTENT_WIDTH - 55 },
        },
        styles: { fontSize: 9, cellPadding: 3, textColor: COLORS.darkText },
        alternateRowStyles: { fillColor: COLORS.lightGray },
      });
      y = getLastTableY(doc, y + 20) + 8;
    }
  }

  // State JOLTS narrative (if fullNarrative wasn't present)
  if (!fullNarrative) {
    const joltsNarrative = jsonStr(rlm, "stateJoltsNarrative");
    if (joltsNarrative) {
      y = checkPageBreak(doc, y, 20);
      y = addSubsectionTitle(doc, "State Labor Market Trends (JOLTS)", y);
      y = renderParagraph(doc, joltsNarrative, y);
      y += 3;
    }
  }

  // Industry trends summary
  const growingOccs = jsonArr(rlm, "growingOccupations");
  const decliningOccs = jsonArr(rlm, "decliningOccupations");
  const stableOccs = jsonArr(rlm, "stableOccupations");

  if (growingOccs.length > 0 || decliningOccs.length > 0 || stableOccs.length > 0) {
    y = checkPageBreak(doc, y, 20);
    y = addSubsectionTitle(doc, "Industry Trends", y);

    if (growingOccs.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(50, 140, 80);
      doc.text(`Growing (${growingOccs.length}):`, MARGIN, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.darkText);
      y = renderParagraph(doc, growingOccs.map(String).join(", "), y, { fontSize: 9 });
      y += 2;
    }

    if (decliningOccs.length > 0) {
      y = checkPageBreak(doc, y, 10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(180, 60, 60);
      doc.text(`Declining (${decliningOccs.length}):`, MARGIN, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.darkText);
      y = renderParagraph(doc, decliningOccs.map(String).join(", "), y, { fontSize: 9 });
      y += 2;
    }

    if (stableOccs.length > 0) {
      y = checkPageBreak(doc, y, 10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.mutedText);
      doc.text(`Stable (${stableOccs.length}):`, MARGIN, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.darkText);
      y = renderParagraph(doc, stableOccs.map(String).join(", "), y, { fontSize: 9 });
      y += 2;
    }
  }

  // Risks list
  const risks = jsonArr(rlm, "risks");
  if (risks.length > 0) {
    y = checkPageBreak(doc, y, 15);
    y = addSubsectionTitle(doc, "Risks", y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.darkText);
    for (const risk of risks) {
      y = checkPageBreak(doc, y, 6);
      const bullet = `  \u2022  ${String(risk)}`;
      const splitBullet = doc.splitTextToSize(bullet, CONTENT_WIDTH - 8);
      doc.text(splitBullet, MARGIN, y);
      y += splitBullet.length * 3.8 + 1;
    }
    y += 3;
  }

  // Opportunities list
  const opportunities = jsonArr(rlm, "opportunities");
  if (opportunities.length > 0) {
    y = checkPageBreak(doc, y, 15);
    y = addSubsectionTitle(doc, "Opportunities", y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.darkText);
    for (const opp of opportunities) {
      y = checkPageBreak(doc, y, 6);
      const bullet = `  \u2022  ${String(opp)}`;
      const splitBullet = doc.splitTextToSize(bullet, CONTENT_WIDTH - 8);
      doc.text(splitBullet, MARGIN, y);
      y += splitBullet.length * 3.8 + 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Section 8: Confidence Grade Detail
// ---------------------------------------------------------------------------

function renderConfidenceDetail(doc: jsPDF, data: ReportData): void {
  const ce = data.analysis.confidenceExplanation;
  if (!ce) return;

  doc.addPage();
  let y = MARGIN + 5;

  y = addSectionTitle(doc, "8. Confidence Grade Analysis", y);

  // Grade and numeric score
  const grade = jsonStr(ce, "grade");
  const totalScore = jsonNum(ce, "totalScore");
  const maxPossible = jsonNum(ce, "maxPossible");
  const summary = jsonStr(ce, "summary");

  if (grade) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.secondary);
    const scoreInfo = totalScore != null && maxPossible != null
      ? ` (${totalScore}/${maxPossible} points)`
      : "";
    doc.text(`Overall Confidence Grade: ${grade}${scoreInfo}`, MARGIN, y);
    y += 8;
  }

  if (summary) {
    y = renderParagraph(doc, summary, y);
    y += 4;
  }

  // Key contributions (positive factors)
  const contributions = jsonArr(ce, "contributions");
  if (contributions.length > 0) {
    y = checkPageBreak(doc, y, 20);
    y = addSubsectionTitle(doc, "Key Contributions", y);

    const contBody: RowInput[] = contributions.map((c) => {
      const item = c as Record<string, unknown>;
      const points = jsonNum(item as Record<string, unknown>, "points") ?? 0;
      const maxPoints = jsonNum(item as Record<string, unknown>, "maxPoints") ?? 0;
      return [
        String(item.label ?? item.component ?? "---"),
        `${points} / ${maxPoints}`,
        String(item.reason ?? "---"),
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["Data Source", "Points", "Detail"]],
      body: contBody,
      theme: "grid",
      margin: { left: MARGIN, right: MARGIN },
      headStyles: {
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 9,
      },
      styles: { fontSize: 8, cellPadding: 3, textColor: COLORS.darkText, overflow: "linebreak" },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: "bold" },
        1: { halign: "center", cellWidth: 25 },
        2: { cellWidth: 105 },
      },
      alternateRowStyles: { fillColor: COLORS.lightGray },
      didParseCell(hookData) {
        if (hookData.section !== "body" || hookData.column.index !== 1) return;
        const raw = String(hookData.cell.raw);
        const parts = raw.split(" / ");
        if (parts.length === 2) {
          const pts = Number(parts[0]);
          const max = Number(parts[1]);
          if (pts === max && max > 0) {
            hookData.cell.styles.fillColor = COLORS.successBg;
            hookData.cell.styles.fontStyle = "bold";
          } else if (pts === 0) {
            hookData.cell.styles.fillColor = COLORS.excludedBg;
          }
        }
      },
    });
    y = getLastTableY(doc, y + 20) + 8;
  }

  // Penalties (negative factors)
  const penalties = jsonArr(ce, "penalties");
  if (penalties.length > 0) {
    y = checkPageBreak(doc, y, 20);
    y = addSubsectionTitle(doc, "Penalties", y);

    const penBody: RowInput[] = penalties.map((p) => {
      const item = p as Record<string, unknown>;
      const points = jsonNum(item as Record<string, unknown>, "points") ?? 0;
      return [
        String(item.label ?? item.component ?? "---"),
        String(points),
        String(item.reason ?? "---"),
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["Penalty", "Points", "Reason"]],
      body: penBody,
      theme: "grid",
      margin: { left: MARGIN, right: MARGIN },
      headStyles: {
        fillColor: [180, 60, 60],
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 9,
      },
      styles: { fontSize: 8, cellPadding: 3, textColor: COLORS.darkText, overflow: "linebreak" },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: "bold" },
        1: { halign: "center", cellWidth: 25 },
        2: { cellWidth: 105 },
      },
      alternateRowStyles: { fillColor: COLORS.excludedBg },
    });
    y = getLastTableY(doc, y + 20) + 8;
  }

  // Recommendations list
  const recommendations = jsonArr(ce, "recommendations");
  if (recommendations.length > 0) {
    y = checkPageBreak(doc, y, 15);
    y = addSubsectionTitle(doc, "Recommendations to Improve Confidence", y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.darkText);
    for (const rec of recommendations) {
      y = checkPageBreak(doc, y, 6);
      const bullet = `  \u2022  ${String(rec)}`;
      const splitBullet = doc.splitTextToSize(bullet, CONTENT_WIDTH - 8);
      doc.text(splitBullet, MARGIN, y);
      y += splitBullet.length * 3.8 + 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Section 9: Methodology Disclosure (existing)
// ---------------------------------------------------------------------------

function renderMethodology(doc: jsPDF): void {
  doc.addPage();
  let y = MARGIN + 5;

  y = addSectionTitle(doc, "9. Methodology Disclosure", y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.darkText);

  const methodologyText =
    "The Placement Viability Quotient (PVQ) is a composite index derived from four " +
    "sub-quotients, each measuring a distinct dimension of vocational placement viability. " +
    "The final PVQ score is computed using the following weighted formula:\n\n" +
    "PVQ = 0.45 \u00d7 STQ + 0.25 \u00d7 TFQ + 0.15 \u00d7 VAQ + 0.15 \u00d7 LMQ\n\n" +
    "where:\n" +
    "  \u2022 STQ (Skill Transferability Quotient, weight 45%) \u2014 Measures the degree to which " +
    "the worker's acquired skills from past relevant work transfer to each target occupation, " +
    "accounting for SVP overlap, DOT/O*NET skill alignment, and industry relatedness.\n\n" +
    "  \u2022 TFQ (Trait-Factor Quotient, weight 25%) \u2014 Evaluates the match between the worker's " +
    "functional capacities (aptitudes, physical demands, and environmental tolerances from the " +
    "24-trait worker profile) and the requirements of the target occupation.\n\n" +
    "  \u2022 VAQ (Vocational Adjustment Quotient, weight 15%) \u2014 Considers age, education, prior " +
    "earnings, and other vocational adjustment factors relevant to the worker's ability to " +
    "transition into a new occupation.\n\n" +
    "  \u2022 LMQ (Labor Market Quotient, weight 15%) \u2014 Incorporates Bureau of Labor Statistics " +
    "wage data, employment projections, and regional labor market conditions to assess the " +
    "economic viability of each target occupation.\n\n" +
    "Data sources include the Dictionary of Occupational Titles (DOT), O*NET OnLine, " +
    "the Occupational Requirements Survey (ORS), Bureau of Labor Statistics Occupational " +
    "Employment and Wage Statistics (OEWS), and Bureau of Labor Statistics Employment Projections. " +
    "All quotient calculations use the most recent available data at the time of analysis.\n\n" +
    "VQS Analysis: The McCroskey Vocational Quotient System (VQS) components (VQ, TSP, EC) " +
    "use published regression weights and Standard Errors of Estimate from VQS validity research " +
    "(McCroskey et al., 2011). Earning capacity estimates incorporate real OEWS wage data with " +
    "ECLR geographic adjustments and VQ band-specific 95% confidence intervals.";

  const splitText = doc.splitTextToSize(methodologyText, CONTENT_WIDTH);
  doc.text(splitText, MARGIN, y);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateReport(data: ReportData): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // ---- Render all sections ----
  renderCoverPage(doc, data);                   // Cover
  renderCaseSummary(doc, data);                  // 1. Case Summary
  renderPastRelevantWork(doc, data);             // 2. Past Relevant Work
  renderAcquiredSkills(doc, data);               // 3. Acquired Skills
  renderWorkerProfiles(doc, data);               // 4. Worker Profile Comparison
  renderRFCNarrative(doc, data);                 // 4b. Residual Functional Capacity
  renderTargetRankings(doc, data);               // 5. Target Occupation Rankings
  renderNearMissAnalysis(doc, data);             // 5b. Near-Miss & Retrainability
  renderQuotientDetails(doc, data);              // 6. Quotient Detail (with 6a excluded + trait analysis)
  renderVQSAnalysis(doc, data);                  // 7. VQS Vocational Analysis
  renderViableSetAnalysis(doc, data);            // 7b. Viable Set Analysis
  renderRegionalLaborMarket(doc, data);          // 7c. Regional Labor Market
  renderConfidenceDetail(doc, data);             // 8. Confidence Grade Analysis
  renderMethodology(doc);                        // 9. Methodology Disclosure

  // ---- Add footers to all pages (except cover) ----
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i - 1, totalPages - 1);
  }

  // ---- Output ----
  const arrayBuffer = doc.output("arraybuffer");
  return new Uint8Array(arrayBuffer);
}
