"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, ArrowRight, ChevronLeft, ChevronRight, Fingerprint } from "lucide-react";

interface CPCResult {
  onetCode: string;
  title: string;
  jobZone: number;
  cpcCode: string;
  topKnowledge: string[];
  topSkills: string[];
  topAbilities: string[];
  strength: string;
  orsTraits: Record<string, number> | null;
  employment: number | null;
  medianWage: number | null;
  meanWage: number | null;
  matchScore?: number;
  cosineSimilarity?: number;
}

interface ComparisonResult {
  occupationA: CPCResult;
  occupationB: CPCResult;
  cosineSimilarity: number;
  similarityPercent: number;
  topMatchingComponents: Array<{ id: string; name: string; taxonomy: string; score: number }>;
  topGapComponents: Array<{ id: string; name: string; taxonomy: string; score: number }>;
}

type Mode = "search" | "similar" | "compare";

export default function CPCLookupPage() {
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [compareCodeA, setCompareCodeA] = useState("");
  const [compareCodeB, setCompareCodeB] = useState("");
  const [results, setResults] = useState<CPCResult[]>([]);
  const [sourceOcc, setSourceOcc] = useState<CPCResult | null>(null);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Autocomplete
  const [suggestions, setSuggestions] = useState<CPCResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    try {
      const res = await fetch(`/api/occupations/cpc-lookup?q=${encodeURIComponent(q.trim())}&pageSize=10`);
      if (res.ok) {
        const data = await res.json();
        const items: CPCResult[] = (data.results ?? []).slice(0, 10);
        setSuggestions(items);
        setShowDropdown(items.length > 0);
        setHighlightIndex(-1);
      }
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }, []);

  useEffect(() => {
    if (mode !== "search") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchSuggestions, mode]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSearch(p = 1) {
    if (!query.trim()) return;
    setShowDropdown(false);
    setSearching(true);
    setComparison(null);
    setSourceOcc(null);
    try {
      const res = await fetch(`/api/occupations/cpc-lookup?q=${encodeURIComponent(query)}&page=${p}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? 1);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      setResults([]);
    }
    setSearching(false);
  }

  async function handleFindSimilar(onetCode: string) {
    setMode("similar");
    setSearching(true);
    setComparison(null);
    try {
      const res = await fetch(`/api/occupations/cpc-lookup?similar=${encodeURIComponent(onetCode)}&pageSize=25`);
      const data = await res.json();
      setSourceOcc(data.source ?? null);
      setResults(data.results ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? 1);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      setResults([]);
    }
    setSearching(false);
  }

  async function handleCompare() {
    if (!compareCodeA.trim() || !compareCodeB.trim()) return;
    setSearching(true);
    setResults([]);
    setSourceOcc(null);
    try {
      const res = await fetch(
        `/api/occupations/cpc-lookup?compare=${encodeURIComponent(compareCodeA.trim())},${encodeURIComponent(compareCodeB.trim())}`
      );
      const data = await res.json();
      if (data.error) {
        setComparison(null);
        alert(data.error);
      } else {
        setComparison(data.comparison ?? null);
      }
    } catch {
      setComparison(null);
    }
    setSearching(false);
  }

  function handleSelectSuggestion(r: CPCResult) {
    setShowDropdown(false);
    setQuery(r.title);
    handleFindSimilar(r.onetCode);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === "Enter") handleSearch();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0) handleSelectSuggestion(suggestions[highlightIndex]);
      else { setShowDropdown(false); handleSearch(); }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  }

  function strengthLabel(s: string): string {
    const labels: Record<string, string> = { S: "Sedentary", L: "Light", M: "Medium", H: "Heavy", V: "Very Heavy", "?": "Unknown" };
    return labels[s] ?? s;
  }

  function taxonomyColor(t: string): string {
    const colors: Record<string, string> = {
      knowledge: "bg-blue-100 text-blue-800",
      skills: "bg-green-100 text-green-800",
      abilities: "bg-purple-100 text-purple-800",
      workActivities: "bg-amber-100 text-amber-800",
      workContext: "bg-rose-100 text-rose-800",
      workStyles: "bg-cyan-100 text-cyan-800",
    };
    return colors[t] ?? "bg-gray-100 text-gray-800";
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Fingerprint className="h-6 w-6 text-primary" />
          Component Profile Code (CPC) Lookup
        </h1>
        <p className="text-muted-foreground">
          Search occupations by component profile, find similar occupations, or compare two occupations
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2">
        <Button
          variant={mode === "search" ? "default" : "outline"}
          size="sm"
          onClick={() => { setMode("search"); setComparison(null); setSourceOcc(null); }}
        >
          Search
        </Button>
        <Button
          variant={mode === "similar" ? "default" : "outline"}
          size="sm"
          onClick={() => { setMode("similar"); setComparison(null); }}
        >
          Find Similar
        </Button>
        <Button
          variant={mode === "compare" ? "default" : "outline"}
          size="sm"
          onClick={() => { setMode("compare"); setResults([]); setSourceOcc(null); }}
        >
          Compare
        </Button>
      </div>

      {/* Search / Compare inputs */}
      {mode !== "compare" ? (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
            <Input
              ref={inputRef}
              placeholder="Search by title, O*NET code, CPC code, or component name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
              className="pl-10"
              autoComplete="off"
            />
            {showDropdown && suggestions.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-80 overflow-y-auto"
              >
                {suggestions.map((r, i) => (
                  <button
                    key={`${r.onetCode}-${i}`}
                    className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-accent transition-colors cursor-pointer ${
                      i === highlightIndex ? "bg-accent" : ""
                    } ${i !== suggestions.length - 1 ? "border-b border-border/50" : ""}`}
                    onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(r); }}
                    onMouseEnter={() => setHighlightIndex(i)}
                  >
                    <span className="font-mono text-xs text-muted-foreground shrink-0">{r.onetCode}</span>
                    <span className="text-sm font-medium truncate flex-1">{r.title}</span>
                    <Badge variant="outline" className="text-xs shrink-0">Z{r.jobZone}</Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={() => handleSearch()} disabled={searching}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Occupation A (O*NET Code)</label>
            <Input
              placeholder="e.g., 11-1011.00"
              value={compareCodeA}
              onChange={(e) => setCompareCodeA(e.target.value)}
              className="font-mono"
            />
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground mb-2 shrink-0" />
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Occupation B (O*NET Code)</label>
            <Input
              placeholder="e.g., 11-1021.00"
              value={compareCodeB}
              onChange={(e) => setCompareCodeB(e.target.value)}
            />
          </div>
          <Button onClick={handleCompare} disabled={searching} className="mb-0">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Compare"}
          </Button>
        </div>
      )}

      {/* Source occupation (for similar mode) */}
      {sourceOcc && mode === "similar" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3">
            <div className="text-xs text-muted-foreground mb-1">Source Occupation</div>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-sm text-primary mr-2">{sourceOcc.onetCode}</span>
                <span className="font-semibold">{sourceOcc.title}</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">Z{sourceOcc.jobZone}</Badge>
                <Badge variant="outline">{strengthLabel(sourceOcc.strength)}</Badge>
              </div>
            </div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">{sourceOcc.cpcCode}</div>
          </CardContent>
        </Card>
      )}

      {/* Result counts */}
      {total > 0 && !comparison && (
        <div className="flex gap-2 text-sm text-muted-foreground">
          <span>{total} {mode === "similar" ? "similar occupations" : "results"}</span>
        </div>
      )}

      {/* Comparison result */}
      {comparison && (
        <div className="space-y-4">
          <Card>
            <CardContent className="py-4">
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-primary">{comparison.similarityPercent}%</div>
                <div className="text-sm text-muted-foreground">Component Similarity</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="font-mono text-sm text-primary">{comparison.occupationA.onetCode}</div>
                  <div className="font-semibold text-sm">{comparison.occupationA.title}</div>
                  <div className="font-mono text-xs text-muted-foreground mt-1 break-all">{comparison.occupationA.cpcCode}</div>
                </div>
                <div className="text-center">
                  <div className="font-mono text-sm text-primary">{comparison.occupationB.onetCode}</div>
                  <div className="font-semibold text-sm">{comparison.occupationB.title}</div>
                  <div className="font-mono text-xs text-muted-foreground mt-1 break-all">{comparison.occupationB.cpcCode}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Matching components */}
          {comparison.topMatchingComponents.length > 0 && (
            <Card>
              <CardContent className="py-4">
                <h3 className="font-semibold text-sm mb-3">Top Shared Components</h3>
                <div className="flex flex-wrap gap-2">
                  {comparison.topMatchingComponents.map((c, i) => (
                    <Badge key={i} className={`text-xs ${taxonomyColor(c.taxonomy)}`}>
                      {c.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Gap components */}
          {comparison.topGapComponents.length > 0 && (
            <Card>
              <CardContent className="py-4">
                <h3 className="font-semibold text-sm mb-3">Top Differentiating Components</h3>
                <div className="flex flex-wrap gap-2">
                  {comparison.topGapComponents.map((c, i) => (
                    <Badge key={i} variant="outline" className={`text-xs ${taxonomyColor(c.taxonomy)}`}>
                      {c.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Search / Similar results list */}
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <Card key={`${r.onetCode}-${i}`} className="hover:bg-muted/50 transition-colors">
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-primary">{r.onetCode}</span>
                      <span className="font-medium truncate">{r.title}</span>
                      {r.cosineSimilarity != null && (
                        <Badge className="text-xs bg-primary/10 text-primary border-primary/20 shrink-0">
                          {Math.round(r.cosineSimilarity * 100)}% similar
                        </Badge>
                      )}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground break-all">{r.cpcCode}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {r.topKnowledge.map((k, j) => (
                        <Badge key={`k-${j}`} className="text-xs bg-blue-100 text-blue-800">K: {k}</Badge>
                      ))}
                      {r.topSkills.map((s, j) => (
                        <Badge key={`s-${j}`} className="text-xs bg-green-100 text-green-800">S: {s}</Badge>
                      ))}
                      {r.topAbilities.map((a, j) => (
                        <Badge key={`a-${j}`} className="text-xs bg-purple-100 text-purple-800">A: {a}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end shrink-0">
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-xs">Z{r.jobZone}</Badge>
                      <Badge variant="outline" className="text-xs">{strengthLabel(r.strength)}</Badge>
                    </div>
                    {r.employment != null && (
                      <span className="text-xs text-muted-foreground">{r.employment.toLocaleString()} empl.</span>
                    )}
                    {r.medianWage != null && (
                      <span className="text-xs text-muted-foreground">${r.medianWage.toLocaleString()}/yr</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-6 px-2"
                      onClick={() => handleFindSimilar(r.onetCode)}
                    >
                      Find Similar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => { setPage(page - 1); handleSearch(page - 1); }}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => { setPage(page + 1); handleSearch(page + 1); }}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && !comparison && !searching && !sourceOcc && (
        <Card>
          <CardContent className="py-8 text-center">
            <Fingerprint className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">
              Search for an occupation to see its 237-dimensional component profile
            </p>
            <p className="text-xs text-muted-foreground">
              Each occupation is decomposed into knowledge, skills, abilities, work activities,
              work context, and work styles. Use &quot;Find Similar&quot; to discover occupations
              with matching component DNA, or &quot;Compare&quot; to analyze two occupations side-by-side.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
