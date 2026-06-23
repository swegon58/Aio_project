import { Globe, ChevronDown } from "lucide-react";
import {
  LogoIcon,
  LinkedInIcon,
  XIcon,
  YouTubeIcon,
  InstagramIcon,
  TikTokIcon,
} from "@/components/icons";
import { brand } from "@/lib/brand.config";

type FooterLink = {
  text: string;
  href: string;
};

type FooterColumn = {
  heading: string;
  links: FooterLink[];
};

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { text: "Pricing", href: "#" },
      { text: "Web app", href: "/features/webapp" },
      { text: "AI design", href: "#" },
      { text: "AI slides", href: "#" },
      { text: "AI image generator", href: "#" },
      { text: "AI music generator", href: "#" },
      { text: "Browser operator", href: "/features/browser-operator" },
      { text: "Wide Research", href: "/features/wide-research" },
      { text: "Mail", href: "/features/mail" },
      { text: "Slack integration", href: "#" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { text: "Blog", href: "#" },
      { text: "Docs", href: "#" },
      { text: "Updates", href: "#" },
      { text: "Help center", href: "#" },
      { text: "Trust center", href: "#" },
      { text: "API", href: "#" },
      { text: "Team plan", href: "#" },
      { text: "Startups", href: "#" },
      { text: "Playbook", href: "#" },
      { text: "Brand assets", href: "#" },
    ],
  },
  {
    heading: "Community",
    links: [
      { text: "Events", href: "#" },
      { text: "Fellows", href: "#" },
    ],
  },
  {
    heading: "Compare",
    links: [
      { text: "VS ChatGPT", href: "#" },
      { text: "VS Lovable", href: "#" },
      { text: "VS Replit", href: "#" },
    ],
  },
  {
    heading: "Download",
    links: [
      { text: "Mobile app", href: "#" },
      { text: "Desktop app", href: "#" },
      { text: "My Browser", href: "#" },
    ],
  },
  {
    heading: "Business",
    links: [
      { text: "Team plan", href: "#" },
      { text: "SSO", href: "#" },
      { text: "API", href: "#" },
    ],
  },
  {
    heading: "Company",
    links: [
      { text: "About us", href: "#" },
      { text: "Careers", href: "#" },
      { text: "For business", href: "#" },
      { text: "For media", href: "#" },
      { text: "Terms of service", href: "#" },
      { text: "Privacy policy", href: "#" },
    ],
  },
];

const SOCIAL_LINKS = [
  { Icon: LinkedInIcon, href: "#" },
  { Icon: XIcon, href: "#" },
  { Icon: YouTubeIcon, href: "#" },
  { Icon: InstagramIcon, href: "#" },
  { Icon: TikTokIcon, href: "#" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <section className="bg-[var(--Button-black)] w-full">
      <div className="mx-auto max-w-[1080px] py-[100px] px-6 space-y-12">
        <h2 className="text-[var(--text-white)] text-4xl italic leading-[44px]">
          Less structure,
          <br /> more intelligence.
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-7 gap-6">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading} className="space-y-2">
              <h3 className="text-[var(--text-white)] text-sm font-[500]">
                {column.heading}
              </h3>
              {column.links.map((link) => (
                <a
                  key={link.text}
                  href={link.href}
                  className="block text-[var(--text-white-tsp)] text-sm hover:underline"
                >
                  {link.text}
                </a>
              ))}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {SOCIAL_LINKS.map(({ Icon, href }, i) => (
                <a key={i} href={href} className="cursor-pointer">
                  <Icon />
                </a>
              ))}
            </div>
            <button className="w-[max-content] hover:bg-[var(--fill-tsp-white-light)] cursor-pointer h-9 px-3 flex items-center justify-center gap-1.5 rounded-md">
              <Globe className="size-5 text-[var(--text-primary)]" />
              <span className="text-sm text-[var(--text-primary)]">English</span>
              <ChevronDown className="size-5 text-[var(--text-primary)]" />
            </button>
          </div>

          <div className="h-px w-full border-t border-[rgba(255,255,255,0.12)]" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[var(--text-white)]">
              <LogoIcon className="size-6 [&_path]:fill-white [&_path]:stroke-white" />
              <span className="text-sm font-[500]">{brand.name}</span>
            </div>
            <div className="text-[var(--text-white-tsp)] text-[14px]">
              © {year} {brand.name}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
