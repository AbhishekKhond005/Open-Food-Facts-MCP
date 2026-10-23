const PROMPTS = [
  "Search products for peanut butter",
  "Check nutrition for barcode 3017624010701",
  "Check allergens for barcode 3017624010701",
  "Is barcode 3017624010701 vegan?",
  "Find healthier alternatives to barcode 3017624010701",
  "Compare barcodes 3017624010701 and 5000159484695",
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
