import Link from "next/link";
import { LogoIcon } from "@/components/icons";
import { brand } from "@/lib/brand.config";

export function Header() {
  return (
    <header className="w-full h-[56px] relative z-20 max-md:hidden">
      <div className="mx-auto max-w-[1080px] h-full py-3 px-6 grid grid-cols-2 md:grid-cols-[1fr_auto_1fr] items-center">
        <Link href="/" className="w-fit flex items-center gap-2">
          <LogoIcon height={32} width={24.42} />
          <span className="font-heading font-bold text-[20px] text-[var(--text-primary)]">{brand.name}</span>
        </Link>
        <nav className="justify-self-center hidden md:flex items-center gap-2 text-[var(--text-secondary)] text-sm font-[500]">
          <div className="px-3 py-1.5 rounded-[8px] hover:bg-[var(--fill-tsp-white-main)] clickable" aria-haspopup="dialog">
            Features
          </div>
          <div className="px-3 py-1.5 rounded-[8px] hover:bg-[var(--fill-tsp-white-main)] clickable" aria-haspopup="dialog">
            Solutions
          </div>
          <div className="px-3 py-1.5 rounded-[8px] hover:bg-[var(--fill-tsp-white-main)] clickable" aria-haspopup="dialog">
            Resources
          </div>
          <Link href="/team" className="px-3 py-1.5 rounded-[8px] hover:bg-[var(--fill-tsp-white-main)] clickable">
            Business
          </Link>
          <Link href="/pricing" className="px-3 py-1.5 rounded-[8px] hover:bg-[var(--fill-tsp-white-main)] clickable">
            Pricing
          </Link>
        </nav>
        <div className="justify-self-end flex items-center gap-2">
          <Link
            href="/login"
            className="h-8 px-3 rounded-lg bg-[var(--Button-black)] text-white text-sm font-medium leading-[18px] flex items-center justify-center gap-1"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="h-8 px-3 rounded-lg bg-transparent border border-[var(--border-main)] text-[var(--text-primary)] text-sm font-medium leading-[18px] flex items-center justify-center gap-1 hover:bg-[var(--fill-tsp-white-main)]"
          >
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}
