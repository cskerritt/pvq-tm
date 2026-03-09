"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronLeft, ChevronRight, ArrowRight, Database, Loader2 } from "lucide-react";

interface CrosswalkEntry {
  dotCode: string;
  dotTitle: string;
  dotSvp: number;
  dotStrength: string;
  dotGedR: number;
  dotGedM: number;
  dotGedL: number;
  onetCode: string;
  onetTitle: string;
  onetJobZone: number | null;
}

interface CrosswalkStats {
  totalCrosswalk: number;
  totalDOT: number;
  totalONET: number;
}

interface CrosswalkResponse {
  results: CrosswalkEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: CrosswalkStats | null;
}

export default function CrosswalkPage() {
  const [data, setData] = useState<CrosswalkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const fetchCrosswalk = useCallback(async (q: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/occupations/crosswalk?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
    } catch {
      console.error("Failed to load crosswalk data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCrosswalk(query, page);
  }, [query, page, fetchCrosswalk]);

  function handleSearch() {
    setQuery(searchInput);
    setPage(1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  function clearSearch() {
    setSearchInput("");
    setQuery("");
    setPage(1);
  }

  const strengthLabel: Record<string, string> = {
    S: "Sedentary",
    L: "Light",
    M: "Medium",
    H: "Heavy",
    V: "Very Heavy",
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href="/occupations" className="hover:underline">
            Occupations
          </Link>
          <span>/</span>
          <span>DOT–O*NET Crosswalk</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">DOT – O*NET Crosswalk</h1>
        <p className="text-muted-foreground">
          Browse and search the mappings between Dictionary of Occupational Titles (DOT)
          codes and modern O*NET-SOC codes. Each entry links a DOT occupation with its
          corresponding O*NET classification.
        </p>
      </div>

      {/* Stats */}
      {data?.stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold">{data.stats.totalCrosswalk.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Crosswalk Entries</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold">{data.stats.totalDOT.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">DOT Occupations</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold">{data.stats.totalONET.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">O*NET Occupations</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2 mb-6">
        <div className="flex-1 relative">
          <Input
            placeholder="Search by DOT title, O*NET title, DOT code, or O*NET code..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pr-10"
          />
          {searchInput && (
            <button
              onClick={clearSearch}
              className="absolute right-10 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
            >
              ✕
            </button>
          )}
        </div>
        <Button onClick={handleSearch} variant="default">
          <Search className="h-4 w-4 mr-1" />
          Search
        </Button>
      </div>

      {/* Search state */}
      {query && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <Badge variant="secondary">
            Showing results for: &ldquo;{query}&rdquo;
          </Badge>
          <span className="text-muted-foreground">
            {data?.total ?? 0} entries found
          </span>
          <button onClick={clearSearch} className="text-blue-600 hover:underline text-sm">
            Clear
          </button>
        </div>
      )}

      {/* Results table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading crosswalk data...</span>
        </div>
      ) : data && data.results.length > 0 ? (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left p-3 font-medium">DOT Code</th>
                  <th className="text-left p-3 font-medium">DOT Title</th>
                  <th className="text-center p-3 font-medium w-8"></th>
                  <th className="text-left p-3 font-medium">O*NET Code</th>
                  <th className="text-left p-3 font-medium">O*NET Title</th>
                  <th className="text-center p-3 font-medium">SVP</th>
                  <th className="text-center p-3 font-medium">Strength</th>
                  <th className="text-center p-3 font-medium">GED</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((entry, i) => (
                  <tr
                    key={`${entry.dotCode}-${entry.onetCode}`}
                    className={`border-b hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                  >
                    <td className="p-3 font-mono text-xs">
                      <Link
                        href={`/occupations/${entry.onetCode}`}
                        className="text-blue-600 hover:underline"
                      >
                        {entry.dotCode}
                      </Link>
                    </td>
                    <td className="p-3">
                      <span className="font-medium">{entry.dotTitle}</span>
                    </td>
                    <td className="p-3 text-center">
                      <ArrowRight className="h-4 w-4 text-muted-foreground inline" />
                    </td>
                    <td className="p-3 font-mono text-xs">
                      <Link
                        href={`/occupations/${entry.onetCode}`}
                        className="text-blue-600 hover:underline"
                      >
                        {entry.onetCode}
                      </Link>
                    </td>
                    <td className="p-3">
                      <span>{entry.onetTitle}</span>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className="text-xs">
                        {entry.dotSvp}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          entry.dotStrength === "S"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : entry.dotStrength === "L"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : entry.dotStrength === "M"
                                ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                : entry.dotStrength === "H"
                                  ? "bg-orange-50 text-orange-700 border-orange-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        {strengthLabel[entry.dotStrength] ?? entry.dotStrength}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-xs text-muted-foreground">
                        R:{entry.dotGedR} M:{entry.dotGedM} L:{entry.dotGedL}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {(data.page - 1) * data.pageSize + 1}–
              {Math.min(data.page * data.pageSize, data.total)} of {data.total.toLocaleString()} entries
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No crosswalk entries found</p>
          {query && <p className="text-sm mt-1">Try a different search term</p>}
        </div>
      )}
    </div>
  );
}
