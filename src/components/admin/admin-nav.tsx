"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, LayoutDashboard, PenLine, FileText, Inbox, Plug, Settings, LogOut, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/edit", label: "Edit", icon: PenLine },
  { href: "/admin/documents", label: "Documents", icon: FileText },
  { href: "/admin/requests", label: "Requests", icon: Inbox },
  { href: "/admin/integrations", label: "Integrations", icon: Plug },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminNav({ user, logoutAction }: { user: { name: string; email: string }; logoutAction: () => Promise<void> }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/admin" className="flex items-center gap-2 font-semibold text-ink">
          <span className="flex size-7 items-center justify-center rounded-md bg-ink text-ink-inverse">
            <ShieldCheck className="size-4" aria-hidden="true" />
          </span>
          <span className="hidden sm:inline">Trust Center</span>
        </Link>
        <nav aria-label="Admin" className="-mb-px ml-2 flex h-14 items-stretch gap-1 overflow-x-auto">
          {items.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-2.5 text-sm font-medium transition-colors",
                  active ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1 text-sm text-ink-muted hover:text-ink sm:flex"
          >
            View site <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
          <span className="hidden text-sm text-ink-muted lg:inline" title={user.email}>
            {user.name}
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-ink-muted hover:bg-neutral-soft hover:text-ink"
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
