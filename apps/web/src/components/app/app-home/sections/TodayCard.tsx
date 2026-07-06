"use client";

import type { TodayAction, TodayCard as TodayCardData } from "@/components/app/app-home-types";

interface TodayCardProps {
  card: TodayCardData;
  onAction: (card: TodayCardData, action: TodayAction) => void;
}

export function TodayCard({ card, onAction }: TodayCardProps) {
  return (
    <button
      type="button"
      className={`today-card today-card--${card.kind}`}
      onClick={() => onAction(card, "plan")}
    >
      <div className="today-card-topline">
        <span className="today-card-label">{card.label}</span>
        <span className="today-card-source">{card.source}</span>
      </div>
      <div className="today-card-title">{card.title}</div>
      <div className="today-card-reason">{card.reason}</div>
    </button>
  );
}
