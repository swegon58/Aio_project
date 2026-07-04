export interface QuickSuggestion {
  id: string;
  label: string;
  prompt: string;
}

// Up to 3 chips shown right above the composer, derived from the actual
// text of the last assistant reply — never fabricated/generic when there's
// no real conversation to base them on (empty text -> empty array).
export function deriveQuickSuggestions(lastAssistantText: string): QuickSuggestion[] {
  if (!lastAssistantText.trim()) return [];
  const suggestions: QuickSuggestion[] = [];

  if (lastAssistantText.includes("```")) {
    suggestions.push({
      id: "quick-refine-code",
      label: "Refine the code",
      prompt: "Refine the code you just shared — tighten it up and cover edge cases.",
    });
  }
  const listItems = lastAssistantText.match(/^\s*(?:\d+\.|[-*])\s+.+$/gm) ?? [];
  if (listItems.length >= 2) {
    suggestions.push({
      id: "quick-turn-into-plan",
      label: "Turn into a plan",
      prompt: "Turn the steps above into a saved plan I can follow and check off.",
    });
  }
  if (/https?:\/\//.test(lastAssistantText)) {
    suggestions.push({
      id: "quick-dig-deeper",
      label: "Dig deeper on sources",
      prompt: "Dig deeper into the sources above and summarize what's most important.",
    });
  }
  if (suggestions.length < 3) {
    suggestions.push({
      id: "quick-continue",
      label: "Continue this",
      prompt: "Continue from where we left off — keep going on this.",
    });
  }
  return suggestions.slice(0, 3);
}

export function QuickSuggestionsBar({
  suggestions,
  onSelect,
}: {
  suggestions: QuickSuggestion[];
  onSelect: (prompt: string) => void;
}) {
  return (
    <div className="quick-suggestions" role="group" aria-label="Quick suggestions">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.id}
          type="button"
          className="quick-suggestion-chip"
          onClick={() => onSelect(suggestion.prompt)}
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}
