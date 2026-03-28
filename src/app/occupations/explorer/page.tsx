"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, ChevronRight, ChevronDown, ArrowLeft, Building2,
  Briefcase, DollarSign, Users, BarChart3, Activity,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────

interface OccGroup {
  code: string;
  name: string;
  occupationCount: number;
  avgVQ: number;
  totalEmployment: number;
  strengthDistribution: Record<string, number>;
}

interface OccSummary {
  onetCode: string;
  socCode: string;
  title: string;
  vqScore: number;
  vqBand: number;
  svp: number;
  strengthLevel: string;
  employment: number | null;
  medianWage: number | null;
  traitCoverage: number;
  dataSources: string[];
  dotTitleCount: number;
}

interface OccDetail {
  onetCode: string;
  socCode: string;
  title: string;
  description: string;
  traits: Record<string, { value: number; source: string; rawValue?: string }>;
  vqScore: number;
  vqBand: number;
  svp: number;
  svpRange: [number, number];
  jobZone: number | null;
  strengthLevel: string;
  strengthRange: string[];
  wages: {
    median: number | null;
    mean: number | null;
    p10: number | null;
    p25: number | null;
    p75: number | null;
    p90: number | null;
  };
  employment: number | null;
  projections: { growthPercent: number | null; annualOpenings: number | null } | null;
  dotTitles: Array<{ code: string; title: string; svp: number; strength: string }>;
  dotTitleCount: number;
  tasks: string[];
  dwas: string[];
  tools: string[];
  dataSources: string[];
  traitCoverage: number;
  hasORS: boolean;
  hasDOT: boolean;
  hasOEWS: boolean;
  hasBLSProjections: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────

const STRENGTH_LABELS: Record<string, string> = {
  S: "Sedentary", L: "Light", M: "Medium", H: "Heavy", V: "Very Heavy",
};

const STRENGTH_COLORS: Record<string, string> = {
  S: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  L: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  M: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  H: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  V: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const VQ_BAND_LABELS: Record<number, string> = {
  1: "Below Avg–Mid Avg", 2: "Mid–High Avg", 3: "High Avg–Very High", 4: "Extremely High",
};

const VQ_BAND_COLORS: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-800", 2: "bg-sky-100 text-sky-800",
  3: "bg-violet-100 text-violet-800", 4: "bg-rose-100 text-rose-800",
};

const SOURCE_COLORS: Record<string, string> = {
  ors: "bg-purple-200 text-purple-900",
  dot: "bg-amber-200 text-amber-900",
  onet: "bg-blue-200 text-blue-900",
  proxy: "bg-gray-200 text-gray-600",
};

function fmt$(val: number | null): string {
  if (val == null) return "N/A";
  return "$" + val.toLocaleString();
}

function fmtN(val: number | null): string {
  if (val == null) return "N/A";
  return val.toLocaleString();
}

// ─── Trait Bar Component ───────────────────────────────────────────

function TraitBar({ name, value, source }: { name: string; value: number; source: string }) {
  const pct = (value / 4) * 100;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-36 truncate text-right">{name}</span>
      <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden relative">
        <div
          className={`h-full rounded ${
            source === "ors" ? "bg-purple-500" :
            source === "dot" ? "bg-amber-500" :
            source === "onet" ? "bg-blue-500" : "bg-gray-300"
          }`}
          style={{ width: `${pct}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium">
          {value.toFixed(1)}
        </span>
      </div>
      <Badge variant="outline" className={`text-[9px] px-1 ${SOURCE_COLORS[source] || ""}`}>
        {source.toUpperCase()}
      </Badge>
    </div>
  );
}

// ─── Strength Distribution Bar ─────────────────────────────────────

function StrengthBar({ dist }: { dist: Record<string, number> }) {
  const total = Object.values(dist).reduce((s, v) => s + v, 0);
  if (total === 0) return null;
  return (
    <div className="flex h-3 rounded overflow-hidden w-full">
      {["S", "L", "M", "H", "V"].map(level => {
        const pct = (dist[level] || 0) / total * 100;
        if (pct === 0) return null;
        return (
          <div
            key={level}
            className={`${STRENGTH_COLORS[level]} flex items-center justify-center text-[8px] font-bold`}
            style={{ width: `${pct}%` }}
            title={`${STRENGTH_LABELS[level]}: ${dist[level]} (${pct.toFixed(0)}%)`}
          >
            {pct > 8 ? level : ""}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────

export default function OccupationExplorerPage() {
  const [groups, setGroups] = useState<OccGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupOccs, setGroupOccs] = useState<OccSummary[]>([]);
  const [selectedOcc, setSelectedOcc] = useState<OccDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OccSummary[]>([]);
  const [loading, setLoading] = useState(false);

  // Load groups on mount
  useEffect(() => {
    fetch("/api/unified-occupations?summary=groups")
      .then(r => r.json())
      .then(setGroups);
  }, []);

  // Load group occupations
  const loadGroup = useCallback(async (code: string) => {
    setLoading(true);
    setSelectedGroup(code);
    setSelectedOcc(null);
    const res = await fetch(`/api/unified-occupations?group=${code}`);
    const data = await res.json();
    setGroupOccs(data.occupations || []);
    setLoading(false);
  }, []);

  // Load occupation detail
  const loadOcc = useCallback(async (code: string) => {
    setLoading(true);
    const res = await fetch(`/api/unified-occupations?code=${code}`);
    const data = await res.json();
    if (!data.error) setSelectedOcc(data);
    setLoading(false);
  }, []);

  // Search
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/unified-occupations?search=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/occupations" className="text-sm text-muted-foreground hover:underline">
            Occupations
          </Link>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
          <span className="text-sm font-medium">Unified Explorer</span>
        </div>
        <h1 className="text-2xl font-bold">Occupation Explorer</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Browse {groups.reduce((s, g) => s + g.occupationCount, 0).toLocaleString()} unified occupations
          — search by SOC, O*NET, or DOT code
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by code (11-1021, 11-1021.00, 169.167-010) or title..."
          className="pl-10"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Search Results ({searchResults.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-96 overflow-y-auto">
              {searchResults.map(occ => (
                <button
                  key={occ.onetCode}
                  className="w-full text-left px-4 py-2 hover:bg-muted/50 flex items-center gap-3"
                  onClick={() => { loadOcc(occ.onetCode); setSearchQuery(""); setSearchResults([]); }}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{occ.title}</div>
                    <div className="text-xs text-muted-foreground">{occ.onetCode} | VQ {occ.vqScore} | SVP {occ.svp}</div>
                  </div>
                  <Badge className={STRENGTH_COLORS[occ.strengthLevel]}>{STRENGTH_LABELS[occ.strengthLevel]}</Badge>
                  <span className="text-xs text-muted-foreground">{fmt$(occ.medianWage)}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail view */}
      {selectedOcc && (
        <OccupationDetail occ={selectedOcc} onBack={() => setSelectedOcc(null)} />
      )}

      {/* Group occupation list */}
      {!selectedOcc && selectedGroup && (
        <Card className="mb-6">
          <CardHeader className="py-3 flex flex-row items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedGroup(null); setGroupOccs([]); }}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <CardTitle className="text-sm">
              {groups.find(g => g.code === selectedGroup)?.name} ({groupOccs.length} occupations)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {groupOccs.sort((a, b) => b.vqScore - a.vqScore).map(occ => (
                <button
                  key={occ.onetCode}
                  className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-center gap-3"
                  onClick={() => loadOcc(occ.onetCode)}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{occ.title}</div>
                    <div className="text-xs text-muted-foreground flex gap-2 mt-0.5">
                      <span>{occ.onetCode}</span>
                      <span>SVP {occ.svp}</span>
                      <span>{fmtN(occ.employment)} jobs</span>
                      {occ.dotTitleCount > 0 && <span>{occ.dotTitleCount} DOT titles</span>}
                    </div>
                  </div>
                  <Badge className={VQ_BAND_COLORS[occ.vqBand]}>VQ {occ.vqScore}</Badge>
                  <Badge className={STRENGTH_COLORS[occ.strengthLevel]}>{occ.strengthLevel}</Badge>
                  <span className="text-sm font-medium w-20 text-right">{fmt$(occ.medianWage)}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SOC Major Group Grid */}
      {!selectedOcc && !selectedGroup && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.sort((a, b) => b.totalEmployment - a.totalEmployment).map(group => (
            <Card
              key={group.code}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => loadGroup(group.code)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <Badge variant="outline" className="text-xs mb-1">{group.code}</Badge>
                    <h3 className="font-semibold text-sm leading-tight">{group.name}</h3>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground mt-1" />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <div className="flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-muted-foreground" />
                    <span>{group.occupationCount} occs</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BarChart3 className="w-3 h-3 text-muted-foreground" />
                    <span>VQ {group.avgVQ}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    <span>{(group.totalEmployment / 1000000).toFixed(1)}M</span>
                  </div>
                </div>
                <div className="mt-2">
                  <StrengthBar dist={group.strengthDistribution} />
                  <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                    <span>Sedentary</span>
                    <span>Very Heavy</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {loading && (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      )}
    </div>
  );
}

// ─── Occupation Detail Panel ───────────────────────────────────────

function OccupationDetail({ occ, onBack }: { occ: OccDetail; onBack: () => void }) {
  const traitEntries = Object.entries(occ.traits) as [string, { value: number; source: string }][];

  const TRAIT_LABELS: Record<string, string> = {
    reasoning: "Reasoning (GED-R)",
    math: "Math (GED-M)",
    language: "Language (GED-L)",
    spatialPerception: "Spatial Perception",
    formPerception: "Form Perception",
    clericalPerception: "Clerical Perception",
    motorCoordination: "Motor Coordination",
    fingerDexterity: "Finger Dexterity",
    manualDexterity: "Manual Dexterity",
    eyeHandFoot: "Eye-Hand-Foot Coord",
    colorDiscrimination: "Color Discrimination",
    strength: "Strength",
    climbing: "Climbing/Balancing",
    stooping: "Stooping/Kneeling",
    reaching: "Reaching/Handling",
    talking: "Talking",
    hearing: "Hearing",
    seeing: "Seeing",
    workLocation: "Work Location (Outdoor)",
    cold: "Extreme Cold",
    heat: "Extreme Heat",
    wetness: "Wetness/Humidity",
    noise: "Noise/Vibration",
    hazards: "Hazards",
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>

      {/* Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">{occ.title}</h2>
              <div className="flex gap-2 mt-1 flex-wrap">
                <Badge variant="outline">O*NET: {occ.onetCode}</Badge>
                <Badge variant="outline">SOC: {occ.socCode}</Badge>
                <Badge className={VQ_BAND_COLORS[occ.vqBand]}>
                  VQ {occ.vqScore} — Band {occ.vqBand}: {VQ_BAND_LABELS[occ.vqBand]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{occ.description}</p>
            </div>
          </div>

          {/* Key stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            <Stat icon={<Activity className="w-4 h-4" />} label="SVP" value={`${occ.svp} (range: ${occ.svpRange[0]}-${occ.svpRange[1]})`} />
            <Stat icon={<Building2 className="w-4 h-4" />} label="Strength" value={STRENGTH_LABELS[occ.strengthLevel] || occ.strengthLevel} />
            <Stat icon={<DollarSign className="w-4 h-4" />} label="Median Wage" value={fmt$(occ.wages.median)} />
            <Stat icon={<Users className="w-4 h-4" />} label="Employment" value={fmtN(occ.employment)} />
            <Stat icon={<BarChart3 className="w-4 h-4" />} label="Growth" value={occ.projections ? `${occ.projections.growthPercent}%` : "N/A"} />
          </div>

          {/* Data sources */}
          <div className="flex gap-1 mt-3">
            {occ.dataSources.map(s => (
              <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
            ))}
            <span className="text-xs text-muted-foreground ml-2">
              Trait coverage: {occ.traitCoverage}/24
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 24-Trait Profile */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">24-Trait Demand Profile</CardTitle>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-purple-500" /> ORS</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500" /> DOT</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-500" /> O*NET</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-gray-300" /> Proxy</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {traitEntries.map(([key, trait]) => (
            <TraitBar
              key={key}
              name={TRAIT_LABELS[key] || key}
              value={trait.value}
              source={trait.source}
            />
          ))}
        </CardContent>
      </Card>

      {/* Wage Distribution */}
      {occ.wages.median && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Wage Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 h-8">
              {[
                { label: "10th", val: occ.wages.p10, color: "bg-blue-200" },
                { label: "25th", val: occ.wages.p25, color: "bg-blue-300" },
                { label: "Median", val: occ.wages.median, color: "bg-blue-500" },
                { label: "75th", val: occ.wages.p75, color: "bg-blue-300" },
                { label: "90th", val: occ.wages.p90, color: "bg-blue-200" },
              ].map((p, i) => (
                <div key={i} className="flex-1 text-center">
                  <div className={`h-6 ${p.color} rounded flex items-center justify-center`}>
                    <span className="text-[10px] font-medium">{fmt$(p.val)}</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground">{p.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* DOT Titles */}
      {occ.dotTitles.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">
              DOT Titles ({occ.dotTitleCount} mapped)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-60 overflow-y-auto">
              {occ.dotTitles.map(d => (
                <div key={d.code} className="px-4 py-1.5 text-xs flex items-center gap-2">
                  <code className="text-muted-foreground w-28">{d.code}</code>
                  <span className="flex-1">{d.title}</span>
                  <span>SVP {d.svp}</span>
                  <Badge className={`text-[9px] ${STRENGTH_COLORS[d.strength]}`}>
                    {d.strength}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks & Tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {occ.tasks.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Key Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-xs space-y-1">
                {occ.tasks.map((t, i) => (
                  <li key={i} className="flex gap-1">
                    <span className="text-muted-foreground">{i + 1}.</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        {occ.tools.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Tools & Technology</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {occ.tools.map((t, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}
