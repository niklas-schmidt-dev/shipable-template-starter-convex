const DAY_MS = 24 * 60 * 60 * 1000;

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const absoluteFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en", {
  hour: "numeric",
  minute: "2-digit",
});

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export type DueLabelTone = "neutral" | "soon" | "today" | "overdue";

export type DueLabel = {
  text: string;
  tone: DueLabelTone;
};

export function formatDue(dueAt: number, now: number = Date.now()): DueLabel {
  const dayDelta = Math.round(
    (startOfDay(dueAt) - startOfDay(now)) / DAY_MS,
  );

  if (dueAt < now && dayDelta < 0) {
    return {
      text: relativeFormatter.format(dayDelta, "day"),
      tone: "overdue",
    };
  }
  if (dayDelta === 0) {
    return { text: `today, ${timeFormatter.format(dueAt)}`, tone: "today" };
  }
  if (dayDelta === 1) {
    return { text: "tomorrow", tone: "soon" };
  }
  if (dayDelta > 1 && dayDelta <= 7) {
    return { text: relativeFormatter.format(dayDelta, "day"), tone: "soon" };
  }
  return { text: absoluteFormatter.format(dueAt), tone: "neutral" };
}

export function formatRelativePast(timestamp: number, now: number = Date.now()): string {
  const seconds = Math.round((timestamp - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return relativeFormatter.format(Math.round(seconds), "second");
  if (abs < 60 * 60) return relativeFormatter.format(Math.round(seconds / 60), "minute");
  if (abs < 60 * 60 * 24) return relativeFormatter.format(Math.round(seconds / 3600), "hour");
  if (abs < 60 * 60 * 24 * 30)
    return relativeFormatter.format(Math.round(seconds / 86400), "day");
  return absoluteFormatter.format(timestamp);
}

export function parseTagsInput(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((tag) => tag.replace(/^#/, "").trim().toLowerCase())
    .filter(Boolean);
}

export function formatTagsInput(tags: string[]): string {
  return tags.map((tag) => `#${tag}`).join(" ");
}

export function toDateInputValue(timestamp: number | undefined): string {
  if (timestamp === undefined) return "";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDateInputValue(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T12:00:00`);
  const time = parsed.getTime();
  return Number.isNaN(time) ? undefined : time;
}
