"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2 } from "lucide-react";

interface OccResult {
  code: string;
  title: string;
  relevance_score?: number;
  cached?: boolean;
  jobZone?: number;
}

export default function OccupationsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OccResult[]>([]);
  const [searching, setSearching] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    const res = await fetch(
      `/api/occupations/search?q=${encodeURIComponent(query)}`
    );
    const data = await res.json();
    // Deduplicate by code, preferring O*NET API results over local cached
    const merged = [...(data.onet ?? []), ...(data.local ?? [])];
    const seen = new Set<string>();
    const deduped = merged.filter((r: OccResult) => {
      if (seen.has(r.code)) return false;
      seen.add(r.code);
      return true;
    });
    setResults(deduped);
    setSearching(false);
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Occupation Browser</h1>
        <p className="text-muted-foreground">
          Search O*NET occupations by title, DOT code, or keyword
        </p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search occupations (e.g., accountant, welder, 13-2011)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && handleSearch()
            }
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={searching}>
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Search"
          )}
        </Button>
      </div>

      {results.length > 0 ? (
        <div className="space-y-2">
          {results.map((r) => (
            <Link key={r.code} href={`/occupations/${r.code}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <span className="font-mono text-sm mr-3 text-muted-foreground">
                      {r.code}
                    </span>
                    <span className="font-medium">{r.title}</span>
                  </div>
                  <div className="flex gap-2">
                    {r.cached && (
                      <Badge variant="secondary">Cached</Badge>
                    )}
                    {r.jobZone && (
                      <Badge variant="outline">Zone {r.jobZone}</Badge>
                    )}
                    {r.relevance_score && (
                      <span className="text-xs text-muted-foreground">
                        {(r.relevance_score * 100).toFixed(0)}% match
                      </span>
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
                Search for an occupation to view its details
              </p>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
