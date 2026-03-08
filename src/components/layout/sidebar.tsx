"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Search,
  Database,
  FileText,
  BookOpen,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cases", label: "Cases", icon: FolderOpen },
  { href: "/occupations", label: "Occupations", icon: Search },
  { href: "/methodology", label: "Methodology", icon: BookOpen },
  { href: "/how-it-works", label: "How It Works", icon: HelpCircle },
  { href: "/admin/data-sync", label: "Data Sync", icon: Database },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-muted/30">
      <div className="flex h-14 items-center border-b px-4">
        <FileText className="mr-2 h-5 w-5 text-primary" />
        <span className="text-lg font-semibold">PVQ-TM</span>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4 text-xs text-muted-foreground">
        Public Vocational Quotient
        <br />
        Transferability Method
      </div>
    </aside>
  );
}
