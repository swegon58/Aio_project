"use client";

import type { Dispatch, SetStateAction } from "react";
import { Columns, Menu } from "lucide-react";
import { ICON_RAIL_ITEMS } from "@/components/app/app-home-utils";

interface FloatingChromeProps {
  creditBalance: number | null;
  usageLevel: "critical" | "warning" | "normal";
  setRightPanelCollapsed: Dispatch<SetStateAction<boolean>>;
  iconRailMobileOpen: boolean;
  setIconRailMobileOpen: Dispatch<SetStateAction<boolean>>;
  handleRailItemClick: (key: (typeof ICON_RAIL_ITEMS)[number]["key"]) => void;
  userAvatarUrl?: string | null;
  userInitial: string;
  username: string;
}

export function FloatingChrome({
  creditBalance,
  usageLevel,
  setRightPanelCollapsed,
  iconRailMobileOpen,
  setIconRailMobileOpen,
  handleRailItemClick,
  userAvatarUrl,
  userInitial,
  username,
}: FloatingChromeProps) {
  return (
    <>
      {/* Floating chrome (R11.3): replaces the removed top bar. Each side
          groups into one fixed flex row instead of guessing fixed offsets
          per element, so the credit chip's variable width never collides
          with the toggle button next to it. (R11.5b: the left group's sidebar
          toggle was removed — "New Chat" pinned in the icon rail plus the
          existing sidebar close/X button now cover that job, and it removed
          a duplicate-looking circular button next to the mobile hamburger.) */}
      <div className="floating-actions floating-actions--right">
        {creditBalance !== null && (
          <span
            className={`credit-badge${usageLevel !== "normal" ? ` credit-badge--${usageLevel}` : ""}`}
          >
            {creditBalance} credits
          </span>
        )}
        <button
          type="button"
          className="toggle-btn toggle-btn--floating toggle-btn--right-panel"
          onClick={() => setRightPanelCollapsed((c) => !c)}
          aria-label="Toggle panel"
        >
          <Columns className="w-4.5 h-4.5" />
        </button>
      </div>

      <button
        type="button"
        className="icon-rail-mobile-toggle"
        style={iconRailMobileOpen ? { display: "none" } : undefined}
        onClick={() => setIconRailMobileOpen(true)}
        aria-label="Open nav"
      >
        <Menu className="w-4.5 h-4.5" />
      </button>

      <div className={`icon-rail-mobile-sheet${iconRailMobileOpen ? " open" : ""}`}>
        <div
          className="icon-rail-mobile-sheet-backdrop"
          onClick={() => setIconRailMobileOpen(false)}
        />
        <nav className="icon-rail" style={{ width: "80vw", maxWidth: 320 }}>
          {ICON_RAIL_ITEMS.map(({ key, label, icon: Icon, active, disabled }) => (
            <button
              key={key}
              type="button"
              className={`icon-rail-item${active ? " active" : ""}`}
              disabled={disabled}
              title={disabled ? "Coming soon" : undefined}
              onClick={() => {
                setIconRailMobileOpen(false);
                handleRailItemClick(key);
              }}
            >
              <Icon className="w-5.5 h-5.5" />
              <span className="icon-rail-label icon-rail-label-inner">{label}{disabled ? " (coming soon)" : ""}</span>
            </button>
          ))}
          <div className="icon-rail-footer">
            <div className="icon-rail-footer-avatar">
              {userAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={userAvatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              ) : (
                userInitial
              )}
            </div>
            <span className="icon-rail-label" style={{ opacity: 1 }}>{username}</span>
          </div>
        </nav>
      </div>
    </>
  );
}
