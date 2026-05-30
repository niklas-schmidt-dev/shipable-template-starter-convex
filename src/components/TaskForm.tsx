import { type FormEvent, type KeyboardEvent, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { fromDateInputValue, parseTagsInput } from "../lib/format";

const PRIORITY_OPTIONS: ReadonlyArray<{
  value: "low" | "medium" | "high";
  label: string;
}> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

type TaskFormProps = {
  onCreated?: () => void;
};

export function TaskForm({ onCreated }: TaskFormProps) {
  const create = useMutation(api.tasks.create);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [tagsInput, setTagsInput] = useState("");
  const [dueInput, setDueInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);

  function reset() {
    setTitle("");
    setNotes("");
    setPriority("medium");
    setTagsInput("");
    setDueInput("");
    setExpanded(false);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("A title is required.");
      titleRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await create({
        title: trimmed,
        notes: notes.trim() ? notes.trim() : undefined,
        priority,
        tags: parseTagsInput(tagsInput),
        dueAt: fromDateInputValue(dueInput),
      });
      reset();
      titleRef.current?.focus();
      onCreated?.();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save task.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function onTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <form className="task-form" onSubmit={submit} noValidate>
      <div className="task-form__row">
        <input
          ref={titleRef}
          className="task-form__title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={onTitleKeyDown}
          placeholder="What needs to ship next?"
          aria-label="Task title"
          maxLength={200}
        />
        <select
          className="task-form__priority"
          value={priority}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "low" || next === "medium" || next === "high") {
              setPriority(next);
            }
          }}
          aria-label="Task priority"
        >
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="task-form__toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls="task-form-extras"
        >
          {expanded ? "Less" : "More"}
        </button>
        <button
          type="submit"
          className="task-form__submit"
          disabled={submitting}
        >
          {submitting ? "Saving..." : "Add task"}
        </button>
      </div>

      {expanded ? (
        <div className="task-form__extras" id="task-form-extras">
          <label className="task-form__field">
            <span>Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Context, links, acceptance criteria..."
              rows={3}
              maxLength={2000}
            />
          </label>
          <div className="task-form__meta">
            <label className="task-form__field">
              <span>Tags</span>
              <input
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                placeholder="#design #launch"
                aria-label="Tags"
              />
            </label>
            <label className="task-form__field">
              <span>Due</span>
              <input
                type="date"
                value={dueInput}
                onChange={(event) => setDueInput(event.target.value)}
                aria-label="Due date"
              />
            </label>
          </div>
        </div>
      ) : null}

      {error ? <p className="task-form__error">{error}</p> : null}
    </form>
  );
}
