import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function PanelLoading() {
  return (
    <div className="panel-empty-state">
      <Loader2 className="w-5 h-5 icon-spin" />
      <span className="memory-text">Loading…</span>
    </div>
  );
}

export function PanelEmpty({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="panel-empty-state">
      {icon}
      <span className="memory-text">{children}</span>
    </div>
  );
}
