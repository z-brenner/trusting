"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, LayoutDashboard, PenLine, FileText, Inbox, Plug, Settings, LogOut, ArrowUpRight } from "lucide-react";
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
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-13 max-w-7xl items-center gap-5 px-4 sm:px-6">
        <Link href="/admin" className="flex shrink-0 items-center gap-2.5 rounded-md text-ink">
          <span className="flex size-6 items-center justify-center rounded-[6px] bg-ink text-ink-inverse">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
          </span>
          <span className="hidden text-sm font-semibold tracking-[-0.01em] sm:inline">Trust Center</span>
        </Link>
        <nav aria-label="Admin" className="flex h-13 min-w-0 items-stretch gap-0.5 overflow-x-auto">
          {items.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-8 shrink-0 items-center gap-1.5 self-center rounded-md px-2.5 text-[13px] font-medium transition-colors duration-150",
                  active ? "text-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                <Icon className="size-4 md:hidden" aria-hidden="true" />
                <span className="hidden md:inline">{item.label}</span>
                <span
                  aria-hidden="true"
                  className={cn("absolute inset-x-2.5 -bottom-2.5 h-0.5 rounded-t-full bg-ink transition-opacity", active ? "opacity-100" : "opacity-0")}
                />
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="hidden h-8 items-center gap-1 rounded-md px-2 text-[13px] text-ink-muted transition-colors hover:bg-neutral-soft hover:text-ink sm:flex"
          >
            View site <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
          <span className="hidden px-2 text-[13px] text-ink-faint lg:inline" title={user.email}>
            {user.name}
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-ink-muted transition-colors hover:bg-neutral-soft hover:text-ink"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
