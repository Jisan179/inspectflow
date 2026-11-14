import Link from "next/link";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link href="/" aria-label="InspectFlow home" className="mb-6"><Logo size={34} /></Link>
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">{children}</div>
    </main>
  );
}
