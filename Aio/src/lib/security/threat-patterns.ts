// Lightweight prompt-injection / exfiltration scanner for inbound user
// messages, applied at Aio's own API boundary (this repo never imports
// hermes-agent source — Phase 1 = wrap, no core edits). Mirrors the
// pattern philosophy of Aio_harness/hermes-agent/tools/threat_patterns.py
// (TS port, "all"-scope subset only: classic injection + exfil, near-zero
// false-positive). Hermes's own scan_for_threats() still runs server-side
// on context assembly — this is an additional, independent layer, not a
// replacement.
//
// Strip is safe to always apply (invisible unicode has no legitimate use
// in chat text). Pattern hits are flagged, not blocked — GUARDRAIL_SYSTEM_PROMPT
// in app/api/chat/route.ts is the actual enforcement layer; blocking here
// would risk false-positive UX breaks on a regex alone.

const INVISIBLE_CHARS = [
  "​", "‌", "‍", "⁠", "⁢", "⁣", "⁤",
  "﻿", "‪", "‫", "‬", "‭", "‮",
  "⁦", "⁧", "⁨", "⁩",
];

const INVISIBLE_CHARS_RE = new RegExp(`[${INVISIBLE_CHARS.join("")}]`, "g");

interface ThreatPattern {
  id: string;
  re: RegExp;
}

// "all" scope only — applies everywhere, minimal false positives.
const PATTERNS: ThreatPattern[] = [
  { id: "prompt_injection", re: /ignore\s+(?:\w+\s+)*(previous|all|above|prior)\s+(?:\w+\s+)*instructions/i },
  { id: "sys_prompt_override", re: /system\s+prompt\s+override/i },
  { id: "disregard_rules", re: /disregard\s+(?:\w+\s+)*(your|all|any)\s+(?:\w+\s+)*(instructions|rules|guidelines)/i },
  { id: "bypass_restrictions", re: /act\s+as\s+(if|though)\s+(?:\w+\s+)*you\s+(?:\w+\s+)*(have\s+no|don't\s+have)\s+(?:\w+\s+)*(restrictions|limits|rules)/i },
  { id: "html_comment_injection", re: /<!--[^>]*(?:ignore|override|system|secret|hidden)[^>]*-->/i },
  { id: "hidden_div", re: /<\s*div\s+style\s*=\s*["'][\s\S]*?display\s*:\s*none/i },
  { id: "translate_execute", re: /translate\s+.*\s+into\s+.*\s+and\s+(execute|run|eval)/i },
  { id: "deception_hide", re: /do\s+not\s+(?:\w+\s+)*tell\s+(?:\w+\s+)*the\s+user/i },
  { id: "exfil_curl", re: /curl\s+[^\n]*\$\{?\w*(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|API)/i },
  { id: "exfil_wget", re: /wget\s+[^\n]*\$\{?\w*(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|API)/i },
  { id: "read_secrets", re: /cat\s+[^\n]*(\.env|credentials|\.netrc|\.pgpass|\.npmrc|\.pypirc)/i },
];

export interface ThreatScanResult {
  cleaned: string;
  strippedInvisibleUnicode: boolean;
  matchedPatternIds: string[];
}

// Strips invisible/bidi unicode unconditionally (zero legitimate use case
// in chat text) and flags (does not block) classic injection/exfil regex
// hits for logging.
export function scanAndCleanInput(content: string): ThreatScanResult {
  if (!content) {
    return { cleaned: content, strippedInvisibleUnicode: false, matchedPatternIds: [] };
  }

  const strippedInvisibleUnicode = INVISIBLE_CHARS_RE.test(content);
  const cleaned = strippedInvisibleUnicode ? content.replace(INVISIBLE_CHARS_RE, "") : content;

  const matchedPatternIds = PATTERNS.filter((p) => p.re.test(content)).map((p) => p.id);

  return { cleaned, strippedInvisibleUnicode, matchedPatternIds };
}
