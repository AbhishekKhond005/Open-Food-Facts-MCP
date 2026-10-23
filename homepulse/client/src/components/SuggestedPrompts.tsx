const PROMPTS = [
  "What chores are due today?",
  "Add buying groceries for tomorrow",
  "List all my tasks",
  "What's the Wi-Fi note?",
  "What chores are due this week?",
  "Give me a household summary",
]

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void
  disabled?: boolean
}

export function SuggestedPrompts({ onSelect, disabled = false }: SuggestedPromptsProps) {
  return (
    <div className="suggested-prompts" role="list" aria-label="Suggested prompts">
      {PROMPTS.map((p) => (
        <button
          key={p}
          role="listitem"
          className="suggested-prompt-btn"
          onClick={() => onSelect(p)}
          disabled={disabled}
          aria-label={`Try: ${p}`}
        >
          {p}
        </button>
      ))}
    </div>
  )
}
