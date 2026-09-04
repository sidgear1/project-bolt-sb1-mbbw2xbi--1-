# TaleTalk project handoff

Read this before changing the project. These are David's working conventions and should be followed in future chats.

## Shorthand messages

- `m` means **refresh/restart the local preview**. Ensure Vite is running at `http://localhost:5173` (`node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173 --strictPort`) and tell David it is ready. Do not ask what `m` means.
- After every completed project change, automatically refresh/restart the local preview at `http://localhost:5173`; David should not need to send `m` separately.
- `#` must work on **every screen**. It opens the global coordinate/debug overlay. It supports clicking points, drawing a bounding box, and copying ready-to-paste `x`, `y`, `width`, `height` coordinates.
- `'` toggles the global reference-code overlay. It must work everywhere: world map, Roam, adventures, menus, and game scenes. It shows large short `S1` scene codes and `N1`, `N2`, etc. for text/buttons.
- `=` toggles the global image-number overlay. It must work everywhere and labels each visible image with its number and filename.

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
- Night Music uses the clean full-screen `*-v4.png` frames in `public/scenes/music/`, in the fixed order `1a, 2, 3, 4, 5, 6, 7, 8, 9`. Keep them free of all numbers, labels, and other text, especially in the top-left corner; matching files also live in `public/world-ai/music/` and `C:\Users\david\Desktop\ai world map\music 10\`.
- Night Music frames 10–21 use `test-*-v2.png` in `public/scenes/music/`, in their existing story order. They must be sharp full-screen 16:9 frames with no embedded numbers, labels, borders, or text; matching copies are in `public/world-ai/music/` and `C:\Users\david\Desktop\ai world map\10 music test\`.

## Working style

- Make requested changes directly, then run a production build with the local Node executable if `npm` is blocked by PowerShell policy:
  `& 'C:\Program Files\nodejs\node.exe' .\node_modules\vite\bin\vite.js build`
- Keep David updated concisely while working.
- Preserve David's current preview location while making changes. When he is viewing an adventure frame (for example, Shopping Centre image 1), restore the preview directly to that same adventure and image after the refresh instead of returning him to the loading screen or main menu.
- Task bars must fit their actual content. Never leave a wide empty task panel around a short prompt; use a compact, centred, responsive width and expand it only when the content genuinely needs more room.
- Romanisation is one global persistent preference across every task bar and vocabulary panel. Switching it on anywhere must keep it on everywhere and across refreshes until David explicitly switches it off; switching it off anywhere must likewise update every Romanisation control.
- Standalone English vocabulary cues and standalone Romanisation labels in task bars must begin with a capital letter (for example, `View` and `Boda`). This is display-only: never make typed answers case-sensitive because of the visual capitalisation.
- Every Korean vocabulary task automatically speaks its Korean target once when the task appears and repeats the Korean target once after the player enters it correctly. Let the success repeat finish before advancing to the next task so it is never cut off, including Scene One, Revision, Bus Stop, Sports Day, and Night Music.
- The worktree already contains substantial in-progress changes and generated audio/assets. Preserve unrelated changes; never reset or clean the repository to make a task easier.
- Every passive story dialogue/narration box in every adventure uses Scene 1 as the permanent exact standard: a full-width click-anywhere lower third, `max-w-lg` (32rem) centred content, `px-6 pb-5 pt-8` spacing, blue translucent gradient, speaker dot plus 11px uppercase label, `text-2xl leading-snug` Playfair dialogue, and an 11px footer with the continue prompt on the left and `Listen` on the right. Never use a centred or rounded card for story dialogue. Task bars, quizzes, choices, and other interactive panels are explicitly separate and retain their shared task UI.
- Detective Mason must keep that universal Scene 1 dialogue presentation, its unlocked Words control on the left, and its task close control high at the top-right. Do not add a yellow end-of-dialogue box or button.
- Task boxes must use the same shared visual design in every adventure, including Detective Mason and Shop Trip. Their close control must stay inside the top-right of the task box and always cancel a partially typed word without exiting the scene. Right Arrow must always select/complete the correct path or answer.
- When David asks to customise any task bar, copy the Bus Stop quiz editor exactly as the implementation reference: `[` toggles edit mode; the task bar can be moved, width/height resized, and each visible task-bar line/control individually dragged with the same grips, behaviour, and persistence. Do not substitute a separate or simplified editor.
- Every vocabulary task must present its Chinese instruction as: `[Chinese prompt]。输入 **[Chinese target]**`, followed on the next line by the English word or phrase to type. Detective Mason's task close control is explicitly positioned at `x:91.9%, y:69.2%, width:2.6%, height:2.9%`.
- While a task is open, hide its scene's exploration bubbles. Put the bold Chinese target on its own line between the instruction and the English answer. Capitalization shown in an answer cue (for example, `Bed`) must not be required from the player when typing.
- Detective Mason continues after the final hallway image through `i8.png`–`i12.png`: show a standard bubble on the police car in `i8`; clicking it boards the car, then play the partner conversation in image order and end the adventure after `i12`.
- Mason's final police-car image uses the widescreen `i12-v2.png`, copied to `public/scenes/cop/`, `public/world-ai/cop/`, and `C:\Users\david\Desktop\ai world map\9 cop\`.
- Night Music uses only the improved image sequence `1a-v2, 2-v2, 3-v2, 4-v2, 5-v2, 6-v2, 7-v2, 8-v2, 9-v2`, followed by the `test-*` ending sequence. The boy hides/approaches/throws the rock first; Emily's indoor reaction images only begin after the rock throw. Assets are in `public/scenes/music/`, with matching copies in `public/world-ai/music/` and `C:\Users\david\Desktop\ai world map\music 10\`.
- Night Music's word quiz is the same quiz type as Bus Stop and must use the Bus Stop quiz layout exactly: the same panel geometry, structure, positions, Mode and Romanisation controls, progress/cue/hint/input arrangement, draggable wrappers, `[` editor behaviour, and shared persisted layout. Only the tested words and Night Music story behaviour differ.
- Night Music ends with `test-1, test-3, test-4, test-6, test-7, test-8, test-9, test-10, test-11, test-12, test-14, test-16` from `10 music test`, in that order: he sings to impress Emily; she enjoys the song, checks her watch, and leaves.

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
