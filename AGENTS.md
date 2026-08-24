# TaleTalk project handoff

Read this before changing the project. These are David's working conventions and should be followed in future chats.

## Shorthand messages

- `m` means **refresh/restart the local preview**. Ensure Vite is running at `http://localhost:5173` (`node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173 --strictPort`) and tell David it is ready. Do not ask what `m` means.
- After every completed project change, automatically refresh/restart the local preview at `http://localhost:5173`; David should not need to send `m` separately.
- `#` must work on **every screen**. It opens the global coordinate/debug overlay. It supports clicking points, drawing a bounding box, and copying ready-to-paste `x`, `y`, `width`, `height` coordinates.
- `'` toggles the global reference-code overlay. It must work everywhere: world map, Roam, adventures, menus, and game scenes. It shows large short `S1` scene codes and `N1`, `N2`, etc. for text/buttons.

## Asset rule

Whenever David asks to add, generate, or modify **any image**, save the project copy under `public/world-ai/` as appropriate **and** copy it to David's external world-map AI working folder:

`C:\Users\david\Desktop\ai world map\`

For Roam-specific art, use the `roam` subfolder in both places. Do not only save a generated asset under Codex's generated-images directory. This is a standing requirement even if David does not repeat it.

## Current world-map decisions

- World-map bubbles are identical standard circular buttons. Coordinates David supplies from `#` are placement coordinates only unless he explicitly says otherwise.
- Every new interactive bubble must use the same standard circular bubble size as the existing bubbles, even when supplied coordinate boxes have different widths or heights.
- Fractions on a map bubble mean **words unlocked / words in that scene**, not story milestones. Scene one has two words, so it shows `0/2` before completion and `2/2` after completion.
- The compact Woodstock, Vermont Roam card uses an aerial autumn photo. Keep its small default state; on hover it may expand to a spacious, readable card with the photo still visible.
- Roam uses the taller North America map (`public/maps/north-america-roam-map-v2.png`) so Canada and Mexico are part of the real map rather than black bars or a stretched/cropped USA map.

## Current asset locations

- North America Roam map: `public/maps/north-america-roam-map-v2.png`
- Woodstock card image: `public/roam/woodstock-vermont-aerial.png`
- Matching copies: `public/world-ai/roam/` and `C:\Users\david\Desktop\ai world map\roam\`
- Notebook wallpaper versions: `public/home-wallpapers/notebook-adventure-v3.png`; duplicate reference asset in `public/world-ai/`.

## Working style

- Make requested changes directly, then run a production build with the local Node executable if `npm` is blocked by PowerShell policy:
  `& 'C:\Program Files\nodejs\node.exe' .\node_modules\vite\bin\vite.js build`
- Keep David updated concisely while working.
- The worktree already contains substantial in-progress changes and generated audio/assets. Preserve unrelated changes; never reset or clean the repository to make a task easier.

## Useful code map

- Main menu, World Map, Roam and several compact adventures: `src/components/MainMenu.tsx`
- Main app shell/startup/preloading: `src/App.tsx`
- Shared styles: `src/index.css`
- Global apostrophe reference overlay: `src/components/StoryReferenceOverlay.tsx`
- Global `#` coordinate/copy overlay: `src/components/GlobalDebugOverlay.tsx`
- Larger adventures: `src/components/BackyardAdventure.tsx` and `src/components/ElderwoodAdventures.tsx`

## Map/image implementation notes

- If a newly generated Roam map appears unchanged in the browser, use a new versioned filename and update **all** references: the Roam image element, the CSS background, and preload lists in `src/App.tsx` and `src/components/MainMenu.tsx`. This avoids stale browser assets.
- Keep maps undistorted. Prefer `object-fit: contain` for a map that must remain fully visible; solve unused space with real expanded artwork rather than stretching or cropping the original map.
- The project currently has both older USA-map filenames and the active North America version. Do not accidentally switch Roam back to an old USA-only asset.
- When the user supplies exact coordinates from `#`, copy the values accurately and confirm whether they mean a point location or a bounding box before changing element dimensions.
