import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { cn } from "../lib/cn";
import {
  formatDue,
  formatRelativePast,
  formatTagsInput,
  fromDateInputValue,
  parseTagsInput,
  toDateInputValue,
} from "../lib/format";

type Task = Doc<"tasks">;
type Priority = Task["priority"];

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

type TaskItemProps = {
  clientId: string;
  task: Task;
};

export function TaskItem({ clientId, task }: TaskItemProps) {
  const toggle = useMutation(api.tasks.toggle);
  const remove = useMutation(api.tasks.remove);
  const update = useMutation(api.tasks.update);

  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftNotes, setDraftNotes] = useState(task.notes ?? "");
  const [draftTags, setDraftTags] = useState(formatTagsInput(task.tags));
  const [draftDue, setDraftDue] = useState(toDateInputValue(task.dueAt));
  const [draftPriority, setDraftPriority] = useState<Priority>(task.priority);
  const [editError, setEditError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editing]);

  function startEdit() {
    setActionError(null);
    setDraftTitle(task.title);
    setDraftNotes(task.notes ?? "");
    setDraftTags(formatTagsInput(task.tags));
    setDraftDue(toDateInputValue(task.dueAt));
    setDraftPriority(task.priority);
    setEditError(null);
    setExpanded(true);
    setEditing(true);
  }

  function cancelEdit() {
    setEditError(null);
    setEditing(false);
  }

  async function saveEdit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = draftTitle.trim();
    if (!trimmed) {
      titleInputRef.current?.focus();
      return;
    }
    setEditError(null);
    try {
      await update({
        clientId,
        id: task._id,
        title: trimmed,
        notes: draftNotes,
        priority: draftPriority,
        tags: parseTagsInput(draftTags),
        dueAt: draftDue ? fromDateInputValue(draftDue) : null,
      });
      setEditing(false);
    } catch {
      setEditError("Could not save task. Try again.");
      titleInputRef.current?.focus();
    }
  }

  function onTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  }

  async function onToggle() {
    setActionError(null);
    try {
      await toggle({ clientId, id: task._id });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not update task.",
      );
    }
  }

  async function onDelete() {
    setActionError(null);
    try {
      await remove({ clientId, id: task._id });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not delete task.",
      );
    }
  }

  const due = task.dueAt != null ? formatDue(task.dueAt) : null;
  const created = formatRelativePast(task.createdAt);

  return (
    <article
      className={cn(
        "task",
        task.completed && "task--done",
        expanded && "task--expanded",
      )}
    >
      <button
        type="button"
        className="task__check"
        onClick={onToggle}
        aria-pressed={task.completed}
        aria-label={task.completed ? "Mark task open" : "Mark task done"}
      >
        <span className="task__check-mark" aria-hidden="true">
          {task.completed ? "✓" : ""}
        </span>
      </button>

      <div className="task__body">
        {editing ? (
          <form className="task__edit" onSubmit={saveEdit}>
            <input
              ref={titleInputRef}
              className="task__edit-title"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onKeyDown={onTitleKeyDown}
              maxLength={200}
              aria-label="Task title"
            />
            <textarea
              className="task__edit-notes"
              value={draftNotes}
              onChange={(event) => setDraftNotes(event.target.value)}
              placeholder="Notes"
              rows={3}
              maxLength={2000}
              aria-label="Notes"
            />
            <div className="task__edit-meta">
              <label className="task__edit-field">
                <span>Priority</span>
                <select
                  value={draftPriority}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (
                      next === "low" ||
                      next === "medium" ||
                      next === "high"
                    ) {
                      setDraftPriority(next);
                    }
                  }}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label className="task__edit-field">
                <span>Tags</span>
                <input
                  value={draftTags}
                  onChange={(event) => setDraftTags(event.target.value)}
                  placeholder="#design #launch"
                />
              </label>
              <label className="task__edit-field">
                <span>Due</span>
                <input
                  type="date"
                  value={draftDue}
                  onChange={(event) => setDraftDue(event.target.value)}
                />
              </label>
            </div>
            {editError ? <p className="task-form__error">{editError}</p> : null}
            <div className="task__edit-actions">
              <button
                type="button"
                className="task__ghost"
                onClick={cancelEdit}
              >
                Cancel
              </button>
              <button type="submit" className="task__primary">
                Save
              </button>
            </div>
          </form>
        ) : (
          <>
            <button
              type="button"
              className="task__title"
              onClick={() => setExpanded((value) => !value)}
              onDoubleClick={startEdit}
              title="Click to expand. Double-click to edit."
            >
              {task.title}
            </button>
            <div className="task__meta">
              <span
                className={cn(
                  "task__priority",
                  `task__priority--${task.priority}`,
                )}
              >
                {PRIORITY_LABEL[task.priority]}
              </span>
              {due ? (
                <span className={cn("task__due", `task__due--${due.tone}`)}>
                  Due {due.text}
                </span>
              ) : null}
              <span className="task__created">Added {created}</span>
              {task.tags.map((tag: string) => (
                <span key={tag} className="task__tag">
                  #{tag}
                </span>
              ))}
            </div>
            {expanded && task.notes ? (
              <p className="task__notes">{task.notes}</p>
            ) : null}
          </>
        )}
      </div>

      {!editing ? (
        <div className="task__actions">
          <button
            type="button"
            className="task__icon"
            onClick={startEdit}
            aria-label={`Edit ${task.title}`}
          >
            Edit
          </button>
          <button
            type="button"
            className="task__icon task__icon--danger"
            onClick={onDelete}
            aria-label={`Delete ${task.title}`}
          >
            Delete
          </button>
        </div>
      ) : null}
      {actionError ? <p className="task__action-error">{actionError}</p> : null}
    </article>
  );
}
