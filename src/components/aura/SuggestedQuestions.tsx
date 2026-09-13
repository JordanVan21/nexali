export function SuggestedQuestions({
  questions,
  onSelect,
}: {
  questions: string[];
  onSelect: (question: string) => void;
}) {
  if (questions.length === 0) return null;

  return (
    <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Suggested questions">
      {questions.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onSelect(q)}
          className="min-h-9 rounded-full border border-outline-variant bg-surface-low px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
