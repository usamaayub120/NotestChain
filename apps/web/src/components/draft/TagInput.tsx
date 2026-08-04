import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { LIMITS } from "@noteschain/shared";

export function TagInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function commit() {
    const tag = draft.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    if (!tag) return;
    if (value.includes(tag)) {
      setDraft("");
      return;
    }
    if (value.length >= LIMITS.MAX_TAGS_PER_PUBLICATION) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div>
      <label htmlFor="tag-input" className="text-sm font-medium">
        Tags
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-input bg-background px-2 py-2">
        {value.map((tag) => (
          <span key={tag} className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
            #{tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {value.length < LIMITS.MAX_TAGS_PER_PUBLICATION && (
          <input
            id="tag-input"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commit}
            placeholder={value.length === 0 ? "Add a tag and press Enter" : ""}
            className="min-w-[100px] flex-1 bg-transparent text-base outline-none"
          />
        )}
      </div>
    </div>
  );
}
