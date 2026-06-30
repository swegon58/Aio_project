"use client";

import { useState } from "react";

const USE_CASES = ["Research", "Documents", "Automation", "Just exploring"] as const;

interface OnboardingOverlayProps {
  onDismiss: () => void;
}

// R6.1 onboarding: a single lightweight card on the welcome screen, not a
// multi-step wizard. Use-case chips are cosmetic only (no persistence beyond
// local UI state) — they help the user orient, nothing more. The data-use
// sentence stays a short factual statement; full policy content is R6.5.
export function OnboardingOverlay({ onDismiss }: OnboardingOverlayProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const complete = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/onboarding", { method: "POST" });
    } finally {
      onDismiss();
    }
  };

  return (
    <div className="modal-overlay">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-dialog-title"
        style={{ maxWidth: 440 }}
      >
        <div className="modal-header">
          <h2 id="onboarding-dialog-title">Welcome to Aio</h2>
        </div>

        <div className="setting-group" style={{ borderBottom: "none" }}>
          <div className="setting-label">What brings you here?</div>
          <div className="setting-desc">Optional — just helps Aio tailor suggestions.</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {USE_CASES.map((useCase) => (
              <button
                key={useCase}
                type="button"
                className="mcp-add-btn"
                style={{
                  width: "auto",
                  padding: "6px 12px",
                  fontSize: 13,
                  background: selected === useCase ? "var(--accent-primary)" : undefined,
                  color: selected === useCase ? "#fff" : undefined,
                }}
                onClick={() => setSelected((cur) => (cur === useCase ? null : useCase))}
              >
                {useCase}
              </button>
            ))}
          </div>
        </div>

        <p className="memory-text" style={{ marginTop: 4 }}>
          Aio stores your chats and uploaded files to answer you, and tracks usage for billing.
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="mcp-add-btn" style={{ width: "auto" }} disabled={submitting} onClick={complete}>
            Skip
          </button>
          <button
            type="button"
            className="mcp-add-btn"
            style={{ width: "auto", background: "var(--accent-primary)", color: "#fff" }}
            disabled={submitting}
            onClick={complete}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
