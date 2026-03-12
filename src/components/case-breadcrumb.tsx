"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface CaseBreadcrumbProps {
  caseId: string;
  currentPage: string;
}

export function CaseBreadcrumb({ caseId, currentPage }: CaseBreadcrumbProps) {
  const [clientName, setClientName] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/cases/${caseId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((data) => setClientName(data.clientName ?? "Untitled Case"))
      .catch(() => setClientName("Case"));
  }, [caseId]);

  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 flex-wrap">
      <Link href="/" className="hover:text-foreground transition-colors">
        <Home className="h-3.5 w-3.5" />
      </Link>
      <ChevronRight className="h-3 w-3" />
      <Link href="/cases" className="hover:text-foreground transition-colors">
        Cases
      </Link>
      <ChevronRight className="h-3 w-3" />
      <Link
        href={`/cases/${caseId}`}
        className="hover:text-foreground transition-colors font-medium text-foreground"
      >
        {clientName ?? "Loading..."}
      </Link>
      {currentPage && (
        <>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">{currentPage}</span>
        </>
      )}
    </nav>
  );
}
