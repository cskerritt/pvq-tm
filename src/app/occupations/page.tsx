"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2 } from "lucide-react";

interface OccResult {
  dotCode: string | null;
  onetCode: string | null;
  title: string;
  svp: number | null;
  strength: string | null;
  skillLevel: string | null;
  gedR: number | null;
  gedM: number | null;
  gedL: number | null;
  source: string;
}

export default function OccupationsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OccResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [counts, setCounts] = useState<{ dot: number; onet: number; total: number } | null>(null);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<OccResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced autocomplete fetch
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setLoadingSuggestions(true);
    try {
      const res = await fetch(
        `/api/occupations/combined-search?q=${encodeURIComponent(q.trim())}`
      );
      if (res.ok) {
        const data = await res.json();
        const items: OccResult[] = (data.results ?? []).slice(0, 10);
        setSuggestions(items);
        setShowDropdown(items.length > 0);
        setHighlightIndex(-1);
      }
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    }
    setLoadingSuggestions(false);
  }, []);

  // Trigger debounced autocomplete on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSearch() {
    if (!query.trim()) return;
    setShowDropdown(false);
    setSearching(true);
    try {
      const res = await fetch(
        `/api/occupations/combined-search?q=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      setResults(data.results ?? []);
      setCounts(data.counts ?? null);
    } catch {
      setResults([]);
      setCounts(null);
    }
    setSearching(false);
  }

  function getDetailLink(r: OccResult): string {
    if (r.onetCode) return `/occupations/${r.onetCode}`;
    if (r.dotCode) return `/occupations/${r.dotCode}`;
    return "#";
  }

  function handleSelectSuggestion(r: OccResult) {
    setShowDropdown(false);
    router.push(getDetailLink(r));
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
      if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[highlightIndex]);
      } else {
        setShowDropdown(false);
        handleSearch();
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  }

  function strengthLabel(s: string | null): string {
    if (!s) return "";
    const labels: Record<string, string> = { S: "Sedentary", L: "Light", M: "Medium", H: "Heavy", V: "Very Heavy" };
    return labels[s] ?? s;
  }

  function formatCode(r: OccResult): string {
    const parts: string[] = [];
    if (r.dotCode) parts.push(`DOT ${r.dotCode}`);
    if (r.onetCode) parts.push(`O*NET ${r.onetCode}`);
    return parts.join(" | ");
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Occupation Browser</h1>
          <p className="text-muted-foreground">
            Search DOT and O*NET occupations by title, code, or keyword
          </p>
        </div>
        <Link href="/occupations/crosswalk">
          <Button variant="outline" size="sm">
            DOT–O*NET Crosswalk
          </Button>
        </Link>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
          <Input
            ref={inputRef}
            placeholder="Search occupations (e.g., construction worker, accountant, 869.664-014, 47-2061)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) setShowDropdown(true);
            }}
            className="pl-10"
            autoComplete="off"
          />
          {/* Autocomplete dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-80 overflow-y-auto"
            >
              {suggestions.map((r, i) => (
                <button
                  key={`${r.dotCode ?? ""}-${r.onetCode ?? ""}-${i}`}
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-accent transition-colors cursor-pointer ${
                    i === highlightIndex ? "bg-accent" : ""
                  } ${i !== suggestions.length - 1 ? "border-b border-border/50" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion(r);
                  }}
                  onMouseEnter={() => setHighlightIndex(i)}
                >
                  <div className="flex flex-col gap-0.5 shrink-0 min-w-[140px]">
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatCode(r)}
                    </span>
                  </div>
                  <span className="text-sm font-medium truncate flex-1">{r.title}</span>
                  <Badge
                    variant={r.source === "DOT+O*NET" ? "default" : "secondary"}
                    className="text-xs shrink-0"
                  >
                    {r.source}
                  </Badge>
                </button>
              ))}
              {loadingSuggestions && (
                <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                </div>
              )}
            </div>
          )}
        </div>
        <Button onClick={handleSearch} disabled={searching}>
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Search"
          )}
        </Button>
      </div>

      {/* Result counts */}
      {counts && (
        <div className="flex gap-2 text-sm text-muted-foreground">
          <span>{counts.total} results</span>
          {counts.dot > 0 && <Badge variant="outline" className="text-xs">DOT: {counts.dot}</Badge>}
          {counts.onet > 0 && <Badge variant="outline" className="text-xs">O*NET: {counts.onet}</Badge>}
        </div>
      )}

      {results.length > 0 ? (
        <div className="space-y-2">
          {results.map((r, i) => (
            <Link key={`${r.dotCode ?? r.onetCode ?? i}`} href={getDetailLink(r)}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Codes */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      {r.dotCode && (
                        <span className="font-mono text-xs text-muted-foreground">
                          DOT {r.dotCode}
                        </span>
                      )}
                      {r.onetCode && (
                        <span className="font-mono text-xs text-muted-foreground">
                          O*NET {r.onetCode}
                        </span>
                      )}
                    </div>
                    {/* Title */}
                    <span className="font-medium truncate">{r.title}</span>
                  </div>
                  <div className="flex gap-2 items-center shrink-0 ml-2">
                    {/* Source badge */}
                    <Badge
                      variant={r.source === "DOT+O*NET" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {r.source}
                    </Badge>
                    {/* SVP */}
                    {r.svp != null && (
                      <Badge variant="outline" className="text-xs">
                        SVP {r.svp}
                      </Badge>
                    )}
                    {/* Strength */}
                    {r.strength && (
                      <Badge variant="outline" className="text-xs">
                        {strengthLabel(r.strength)}
                      </Badge>
                    )}
                    {/* Skill level */}
                    {r.skillLevel && (
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          r.skillLevel === "skilled"
                            ? "border-blue-500 text-blue-600"
                            : r.skillLevel === "semiskilled"
                            ? "border-amber-500 text-amber-600"
                            : "border-gray-400 text-gray-500"
                        }`}
                      >
                        {r.skillLevel}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        !searching && (
          <Card>
            <CardContent className="py-8 text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Search for an occupation by title (e.g., &quot;construction worker&quot;), DOT code, or O*NET code
              </p>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
