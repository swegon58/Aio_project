import { ICON_RAIL_ITEMS, type IconRailKey } from "../app-home-utils";

type IconRailVariant = "compact" | "mobile";

interface IconRailProps {
  variant: IconRailVariant;
  onItemClick: (key: IconRailKey) => void;
  notificationsUnread?: number;
}

export function IconRail({ variant, onItemClick, notificationsUnread = 0 }: IconRailProps) {
  const isCompact = variant === "compact";
  
  return (
    <>
      {ICON_RAIL_ITEMS.map(({ key, label, icon: Icon, active, disabled }) => (
        <button
          key={key}
          type="button"
          className={`icon-rail-item${isCompact ? " icon-rail-item--compact" : ""}${active ? " active" : ""}`}
          disabled={disabled}
          onClick={() => onItemClick(key)}
          aria-label={isCompact ? (disabled ? `${label} (coming soon)` : label) : undefined}
          title={disabled ? "Coming soon" : undefined}
        >
          <Icon className={isCompact ? "w-6 h-6" : "w-5.5 h-5.5"} />
          {isCompact && key === "notifications" && notificationsUnread > 0 && (
            <span className="icon-rail-badge">
              {notificationsUnread > 9 ? "9+" : notificationsUnread}
            </span>
          )}
          <span className="icon-rail-label icon-rail-label-inner">{label}{disabled ? " (coming soon)" : ""}</span>
        </button>
      ))}
    </>
  );
}
