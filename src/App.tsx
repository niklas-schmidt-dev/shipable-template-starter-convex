import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import { TaskForm } from "./components/TaskForm";
import { TaskItem } from "./components/TaskItem";

type Task = Doc<"tasks">;
type StatusFilter = "all" | "open" | "done";
type PriorityFilter = "all" | "high" | "medium" | "low";
type SortKey = "created" | "due" | "priority";

const STATUS_FILTERS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "done", label: "Done" },
];

const PRIORITY_FILTERS: ReadonlyArray<{
  value: PriorityFilter;
  label: string;
}> = [
  { value: "all", label: "Any priority" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: "created", label: "Newest first" },
  { value: "due", label: "Earliest due" },
  { value: "priority", label: "Priority" },
];

const PRIORITY_RANK: Record<Task["priority"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function applyFilters(
  tasks: ReadonlyArray<Task>,
  priority: PriorityFilter,
  searchTerm: string,
): Task[] {
  const needle = searchTerm.trim().toLowerCase();
  return tasks.filter((task) => {
    if (priority !== "all" && task.priority !== priority) return false;
    if (!needle) return true;
    if (task.title.toLowerCase().includes(needle)) return true;
    if (task.notes && task.notes.toLowerCase().includes(needle)) return true;
    return task.tags.some((tag) => tag.toLowerCase().includes(needle));
  });
}

function applySort(tasks: ReadonlyArray<Task>, sort: SortKey): Task[] {
  const copy = tasks.slice();
  switch (sort) {
    case "due":
      return copy.sort((a, b) => {
        if (a.dueAt === undefined && b.dueAt === undefined) {
          return b.createdAt - a.createdAt;
        }
        if (a.dueAt === undefined) return 1;
        if (b.dueAt === undefined) return -1;
        return a.dueAt - b.dueAt;
      });
    case "priority":
      return copy.sort((a, b) => {
        const delta = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
        return delta !== 0 ? delta : b.createdAt - a.createdAt;
      });
    case "created":
    default:
      return copy.sort((a, b) => b.createdAt - a.createdAt);
  }
}

function createAnonymousClientId() {
  const fallback = () =>
    `preview-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  try {
    const key = "shipable:convex-client-id";
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const next = window.crypto?.randomUUID?.() ?? fallback();
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return fallback();
  }
}

export default function App() {
  const [clientId] = useState(createAnonymousClientId);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  const userTimezoneOffset = new Date().getTimezoneOffset();

  const tasks = useQuery(api.tasks.list, { clientId, filter: statusFilter });
  const stats = useQuery(api.tasks.stats, {
    clientId,
    userTimezoneOffset,
  });
  const seed = useMutation(api.tasks.seed);

  const visibleTasks = useMemo<Task[] | null>(() => {
    if (tasks === undefined) return null;
    return applySort(
      applyFilters(tasks, priorityFilter, deferredSearch),
      sortKey,
    );
  }, [tasks, priorityFilter, deferredSearch, sortKey]);

  const isLoading = tasks === undefined;
  const isEmpty = visibleTasks !== null && visibleTasks.length === 0;
  const totalTasks = tasks?.length ?? 0;

  return (
    <main className="app">
      <div className="layout">
        <aside className="side-panel" aria-label="Workspace">
          <div>
            <p className="eyebrow">Shipable starter</p>
            <h1>Task operations</h1>
            <p className="side-panel__copy">
              A compact workflow surface for queues, ownership, and delivery
              status.
            </p>
          </div>
          <div className="side-panel__meta">
            <span>Mode</span>
            <strong>Realtime Convex</strong>
          </div>
        </aside>

        <section className="workspace" aria-label="Task workspace">
          <header className="workspace-header">
            <div>
              <p className="eyebrow">Today</p>
              <h2>Review queue</h2>
            </div>
            <div className="workspace-header__status">
              <span className="status-dot" aria-hidden="true" />
              Live sync
            </div>
          </header>

          <section className="summary-grid" aria-label="Queue summary">
            <Metric label="Open" value={stats?.open} />
            <Metric label="Due today" value={stats?.dueToday} />
            <Metric label="Overdue" value={stats?.overdue} />
            <Metric label="Done" value={stats?.done} />
          </section>

          <section className="control-stack" aria-label="Task controls">
            <TaskForm clientId={clientId} />

            <div className="control-bar" role="region" aria-label="Filter tasks">
              <label className="search">
                <span>Search</span>
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Title, notes, or tag"
                  aria-label="Search tasks"
                />
              </label>

              <div className="segmented" role="group" aria-label="Status">
                {STATUS_FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={statusFilter === option.value ? "is-active" : ""}
                    onClick={() => setStatusFilter(option.value)}
                    aria-pressed={statusFilter === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <label className="select">
                <span>Priority</span>
                <select
                  value={priorityFilter}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (
                      next === "all" ||
                      next === "high" ||
                      next === "medium" ||
                      next === "low"
                    ) {
                      setPriorityFilter(next);
                    }
                  }}
                >
                  {PRIORITY_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="select">
                <span>Sort</span>
                <select
                  value={sortKey}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (
                      next === "created" ||
                      next === "due" ||
                      next === "priority"
                    ) {
                      setSortKey(next);
                    }
                  }}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="task-surface" aria-live="polite">
            {isLoading ? (
              <LoadingSkeleton />
            ) : isEmpty ? (
              <EmptyState
                hasAnyTasks={totalTasks > 0}
                onSeed={async () => {
                  await seed({ clientId });
                }}
              />
            ) : (
              <ul className="task-list">
                {visibleTasks?.map((task) => (
                  <li key={task._id}>
                    <TaskItem clientId={clientId} task={task} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

type MetricProps = {
  label: string;
  value: number | undefined;
};

function Metric({ label, value }: MetricProps) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value === undefined ? "–" : value}</strong>
    </article>
  );
}

function LoadingSkeleton() {
  return (
    <div className="skeleton" aria-label="Loading tasks">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="skeleton__row">
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  hasAnyTasks,
  onSeed,
}: {
  hasAnyTasks: boolean;
  onSeed: () => Promise<void>;
}) {
  const [seeding, setSeeding] = useState(false);
  return (
    <div className="empty">
      <strong>{hasAnyTasks ? "No matching tasks" : "No tasks yet"}</strong>
      <p>
        {hasAnyTasks
          ? "Adjust the filters or search term to bring work back into view."
          : "Create a task or seed the workspace with a few sample requests."}
      </p>
      {!hasAnyTasks ? (
        <button
          type="button"
          disabled={seeding}
          onClick={async () => {
            setSeeding(true);
            try {
              await onSeed();
            } finally {
              setSeeding(false);
            }
          }}
        >
          {seeding ? "Seeding..." : "Seed tasks"}
        </button>
      ) : null}
    </div>
  );
}
