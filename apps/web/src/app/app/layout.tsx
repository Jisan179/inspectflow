"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, User as UserIcon } from "lucide-react";
import { SWRConfig } from "swr";
import { Loading, Logo } from "@/components/ui";
import { fetcher } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Everything under /app needs a signed-in user. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return <Loading label="Checking your session..." />;

  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: true, shouldRetryOnError: false }}>
      <div className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/app/projects" aria-label="Projects"><Logo size={26} /></Link>
            <div className="relative">
              <button onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-surface2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brandsoft text-xs font-semibold text-brand">
                  {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <span className="hidden sm:block">{user.name}</span>
              </button>
              {menu && (
                <div role="menu" className="absolute right-0 mt-2 w-52 rounded-xl border border-line bg-surface p-1 shadow-lg" onMouseLeave={() => setMenu(false)}>
                  <p className="truncate px-3 py-2 text-xs text-muted">{user.email}</p>
                  <Link role="menuitem" href="/app/profile" onClick={() => setMenu(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface2">
                    <UserIcon className="h-4 w-4" aria-hidden="true" /> Profile
                  </Link>
                  <button role="menuitem" onClick={async () => { await logout(); router.replace("/login"); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface2">
                    <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </div>
    </SWRConfig>
  );
}
