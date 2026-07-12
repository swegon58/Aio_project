import { ICON_RAIL_ITEMS, type IconRailKey } from "../app-home-utils";

type IconRailVariant = "compact" | "mobile";

interface IconRailProps {
  variant: IconRailVariant;
  onItemClick: (key: IconRailKey) => void;
  notificationsUnread?: number;
}

export function IconRail({ variant, onItemClick, notificationsUnread = 0 }: IconRailProps) {
  const isCompact = variant === "compact";
  // Disabled ("coming soon") entries hidden in prod (4/9 items disabled read
  // as clutter, not roadmap — P1, icon-rail critique 2026-07-11), but shown
  // in dev so WIP nav is visible while building.
  const isDev = process.env.NODE_ENV === "development";
  const items = ICON_RAIL_ITEMS.filter(({ disabled }) => !disabled || isDev);

  return (
    <>
      {items.map(({ key, label, icon: Icon, active, disabled }) => {
        // Dev unlock only lifts the hide-in-prod filter above; the wip
        // dimmed/no-cursor/no-hover styling still applies whenever an item
        // is `disabled` (dev or prod) so dev-visible WIP items stay
        // distinguishable from real nav items instead of looking fully
        // clickable (kimo critique 2026-07-11).
        const wip = disabled;
        return (
          <button
            key={key}
            type="button"
            className={`icon-rail-item${isCompact ? " icon-rail-item--compact" : ""}${active ? " active" : ""}${wip ? " icon-rail-item--wip" : ""}`}
            onClick={() => onItemClick(key)}
            aria-label={isCompact ? `${label}${wip ? " (coming soon)" : ""}` : undefined}
          >
            <span className="icon-rail-icon-inner">
              <Icon className={isCompact ? "w-6 h-6" : "w-5.5 h-5.5"} />
            </span>
            <span className="icon-rail-label icon-rail-label-inner">{label}</span>
          </button>
        );
      })}
    </>
  );
}
