import { OPTIMIZED_IMAGE_PATHS } from "../generated/optimizedImagePaths";

/**
 * Makes files in `public` work both at a domain root and when the game is
 * uploaded below a path (for example, `example.com/my-game/`).
 */
export function assetUrl(path: string): string {
  const normalizedPath = path.replace(/^\/+/, '');
  const deliveredPath = OPTIMIZED_IMAGE_PATHS.has(normalizedPath)
    ? normalizedPath.replace(/\.png$/i, '.webp')
    : normalizedPath;
  return `${import.meta.env.BASE_URL}${deliveredPath}`;
}
