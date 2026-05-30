type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  let result = "";
  for (const value of values) {
    if (!value) continue;
    if (result.length > 0) result += " ";
    result += String(value);
  }
  return result;
}
