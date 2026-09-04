/** Sentence-case a standalone Latin-script vocabulary label without changing
 * the stored answer used for matching. Hangul and other scripts are untouched. */
export function capitaliseStandalone(value: string): string {
  return value.replace(/[A-Za-z]/, (letter) => letter.toUpperCase());
}
