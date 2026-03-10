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
    mvqsPostEcMedian?: number | null;
    mvqsPreEcMedian?: number | null;
    mvqsEcLoss?: number | null;
    mvqsEcLossPct?: number | null;
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
    // MVQS fields
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

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > FOOTER_Y - 10) {
    doc.addPage();
    return MARGIN + 10;
  }
  return y;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = (doc as any).lastAutoTable?.finalY ?? y + 60;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 120;
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

function renderQuotientDetails(doc: jsPDF, data: ReportData): void {
  const includedTargets = data.targets.filter((t) => !t.excluded);

  if (includedTargets.length === 0) return;

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

    y += 6;

    // Separator between targets
    doc.setDrawColor(...COLORS.headerBg);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 6;
  }
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
  const entries = Object.entries(detailObj);

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

function fmtHourly(n: number | null | undefined): string {
  if (n == null) return "---";
  return `$${n.toFixed(2)}/hr`;
}

function getVQBandName(band: number | null | undefined): string {
  switch (band) {
    case 1: return "Below/Mid-Avg";
    case 2: return "Mid/High-Avg";
    case 3: return "High/Very-High";
    case 4: return "Extremely High";
    default: return "---";
  }
}

function renderMVQSAnalysis(doc: jsPDF, data: ReportData): void {
  // Only render if any targets have VQ data
  const targetsWithVQ = data.targets.filter(t => t.vqScore != null);
  if (targetsWithVQ.length === 0) return;

  doc.addPage();
  let y = MARGIN + 5;

  y = addSectionTitle(doc, "7. MVQS Vocational Analysis", y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.darkText);

  const intro =
    "The McCroskey Vocational Quotient System (MVQS) provides standardized measures of " +
    "occupational complexity (VQ), skill transferability (TSP), and earning capacity (EC) " +
    "with published validity coefficients and confidence intervals.";
  const splitIntro = doc.splitTextToSize(intro, CONTENT_WIDTH);
  doc.text(splitIntro, MARGIN, y);
  y += splitIntro.length * 4.5 + 4;

  // EC Summary if available
  if (data.analysis.mvqsPostEcMedian != null || data.analysis.mvqsPreEcMedian != null) {
    y = checkPageBreak(doc, y, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.primary);
    doc.text("Earning Capacity Summary", MARGIN, y);
    y += 6;

    const ecRows: RowInput[] = [];
    if (data.analysis.mvqsPreEcMedian != null) {
      ecRows.push(["Pre-Injury EC", fmtHourly(data.analysis.mvqsPreEcMedian),
        `$${((data.analysis.mvqsPreEcMedian) * 2080).toLocaleString("en-US", { maximumFractionDigits: 0 })}/yr`]);
    }
    if (data.analysis.mvqsPostEcMedian != null) {
      ecRows.push(["Post-Injury EC", fmtHourly(data.analysis.mvqsPostEcMedian),
        `$${((data.analysis.mvqsPostEcMedian) * 2080).toLocaleString("en-US", { maximumFractionDigits: 0 })}/yr`]);
    }
    if (data.analysis.mvqsEcLoss != null) {
      ecRows.push(["EC Loss", fmtHourly(data.analysis.mvqsEcLoss),
        `$${(Math.abs(data.analysis.mvqsEcLoss) * 2080).toLocaleString("en-US", { maximumFractionDigits: 0 })}/yr`]);
    }
    if (data.analysis.mvqsEcLossPct != null) {
      ecRows.push(["Loss %", `${data.analysis.mvqsEcLossPct.toFixed(1)}%`, ""]);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Per-occupation MVQS table
  y = checkPageBreak(doc, y, 20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text("MVQS Scores by Occupation", MARGIN, y);
  y += 6;

  const viable = targetsWithVQ.filter(t => !t.excluded);
  const mvqsBody: RowInput[] = viable.map(t => [
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
    body: mvqsBody,
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

function renderMethodology(doc: jsPDF): void {
  doc.addPage();
  let y = MARGIN + 5;

  y = addSectionTitle(doc, "8. Methodology Disclosure", y);

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
    "MVQS Analysis: The McCroskey Vocational Quotient System (MVQS) components (VQ, TSP, EC) " +
    "use published regression weights and Standard Errors of Estimate from MVQS validity research " +
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
  renderCoverPage(doc, data);
  renderCaseSummary(doc, data);
  renderPastRelevantWork(doc, data);
  renderAcquiredSkills(doc, data);
  renderWorkerProfiles(doc, data);
  renderTargetRankings(doc, data);
  renderQuotientDetails(doc, data);
  renderMVQSAnalysis(doc, data);
  renderMethodology(doc);

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
