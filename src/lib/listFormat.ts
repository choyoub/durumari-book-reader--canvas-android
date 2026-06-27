import type { SortConfig } from "../types";

export function formatDate(value?: number) {
  if (!value) return "-";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

export function percent(value = 0) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

export function sortIndicator(sort: SortConfig, column: string) {
  if (sort.column !== column || sort.direction === "none") return "";
  return sort.direction === "asc" ? " \u25B2" : " \u25BC";
}
