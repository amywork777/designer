/**
 * Utility function to join CSS classes conditionally.
 * @param classes - Array of class names.
 * @returns Joined string of class names.
 */
export function cn(...classes: string[]): string {
  return classes.filter(Boolean).join(' ');
}