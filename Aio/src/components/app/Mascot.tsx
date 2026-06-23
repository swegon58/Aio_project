"use client";

import Image from "next/image";
import type { MascotImageState } from "@/lib/hermes/chat-types";

export const MASCOT_LABEL: Record<MascotImageState, string> = {
  idle: "Idle",
  coding: "Coding",
  reading: "Reading",
  research: "Researching",
  thinking: "Thinking",
  writing: "Writing",
};

export const MASCOT_IMAGE_FILE: Record<MascotImageState, string> = {
  idle: "coffee_break.png",
  coding: "coding.png",
  reading: "reading.png",
  research: "research.png",
  thinking: "thinking.png",
  writing: "writing.png",
};

export function Mascot({ state }: { state: MascotImageState }) {
  return (
    <div className="flex flex-col items-center gap-2.5 py-4">
      <div className="flex h-32 w-32 items-center justify-center overflow-hidden">
        <Image
          src={`/mascot/${MASCOT_IMAGE_FILE[state]}`}
          alt={MASCOT_LABEL[state]}
          width={112}
          height={112}
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
}

export function MascotStatusBadge({ state }: { state: MascotImageState }) {
  return (
    <div className="bubble-status">
      <Image
        src={`/mascot/${MASCOT_IMAGE_FILE[state]}`}
        alt={MASCOT_LABEL[state]}
        width={64}
        height={64}
        className="bubble-status-icon"
      />
      <span className="bubble-status-label">{MASCOT_LABEL[state]}</span>
    </div>
  );
}
