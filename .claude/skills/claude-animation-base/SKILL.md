---
name: claude-animation-base
description: Make a short hand-painted 2D cartoon (p5.js + p5.brush) starring Clawd, Claude's mascot, or any character you design, rendered headless to MP4. Use when the user asks for a hand-painted, watercolour or brush-stroke cartoon animation, a Clawd video, or an animation built with p5.brush. Not for editing existing video files.
---

# Claude Animation Base

Wraps the [ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase) starter kit by John Heibel (MIT). The kit is vendored unchanged in `kit/`, except for the animated README image, which is left out.

## When to Use

- The user wants a short cartoon in a hand-painted look: brush strokes, flat 2D, boiling ink lines.
- The user asks for a video of Clawd, or wants to animate their own character in the same style.
- The user names p5.js or p5.brush for an animation.

## How It Works

1. **Make a project folder.** Create `<name>/` in the folder the user started from (lowercase letters, digits, hyphens) and copy the kit into it: `cp -R "<this skill's directory>/kit/." "<name>/"`. Never edit `kit/` itself.
2. **Install.** Run `npm install` inside `<name>/`. The renderer needs Node.js, Google Chrome or a Playwright Chromium, and ffmpeg. Report anything missing to the user instead of installing system software yourself.
3. **Read the guide.** Read `<name>/ANIMATION_GUIDE.md` in full and look at `docs/emotions.jpg` and `docs/views.jpg` before drawing anything. The guide holds the rules, the workflow and the full API; follow it.
4. **Storyboard, build, review.** Storyboard first, write the scenes in `src/scenes/`, and check the work with the contact sheets, frame strips and crops the guide describes.
5. **Render.** `node render.mjs --clip --out=out/video.mp4`. Add `--soft-gl` on a machine with no GPU (slow on watercolour fills), and `--chrome=<path>` or `CHROME_PATH` when Chrome is not in a standard location.
6. **Deliver.** Tell the user where `out/video.mp4` is.

## Examples

- "Make a 15-second video of Clawd trying to catch a butterfly."
- "Animate Clawd celebrating a successful deploy, with a brush-wipe transition into a sunset."
- "Swap Clawd for a small fox and make a 10-second loop of it sleeping by a fire."
