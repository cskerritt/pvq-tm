"use client";

import { useState } from "react";
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
  Menu,
  X,
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
  const [open, setOpen] = useState(false);

  const navContent = (
    <>
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
              onClick={() => setOpen(false)}
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
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center border-b bg-background px-4 md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="mr-3 rounded-md p-1.5 hover:bg-muted"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <FileText className="mr-2 h-5 w-5 text-primary" />
        <span className="text-lg font-semibold">PVQ-TM</span>
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-background transition-transform duration-200 ease-in-out md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center">
            <FileText className="mr-2 h-5 w-5 text-primary" />
            <span className="text-lg font-semibold">PVQ-TM</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 hover:bg-muted"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen w-64 flex-col border-r bg-muted/30">
        <div className="flex h-14 items-center border-b px-4">
          <FileText className="mr-2 h-5 w-5 text-primary" />
          <span className="text-lg font-semibold">PVQ-TM</span>
        </div>
        {navContent}
      </aside>
    </>
  );
}
