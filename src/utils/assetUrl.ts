/**
 * Makes files in `public` work both at a domain root and when the game is
 * uploaded below a path (for example, `example.com/my-game/`).
 */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
