/** Junta classes condicionais sem depender de biblioteca externa. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
