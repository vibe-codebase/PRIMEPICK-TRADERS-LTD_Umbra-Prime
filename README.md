# Umbra Prime

By **PRIMEPICK TRADERS LTD** · package `com.primepicktradersltd.umbraprime` · Expo owner `jahidbappi`.

A touch puzzle game for Android about shadows. A lamp lights a sculpture of floating fragments, and you turn it until its shadow on the paper screen becomes a picture.

**How it plays.**
- Drag to turn the sculpture.
- **The shadow:** turned the wrong way, it is a jumble. From one direction (or turned right round, which shows the same picture from behind) the fragments line up into a heron, a teapot or a lighthouse.
- **Settling:** get close and the sculpture settles into place. The shadow sharpens, the lamp warms, and the screen is signed with a red seal.
- **The lamp:** it shows the outline for a moment, at the cost of a seal.

**Content.**
- 24 sculptures in three chapters, each one freeing the controls further:
  - **Paper Lantern:** folded paper by candlelight, turning left and right only.
  - **Bamboo House:** carved wood under a hanging lamp, turning and tipping.
  - **Moon Theatre:** red lacquer and gold, free to roll every way like a ball.
- **Seals are the stars:** three for finding a shadow without the lamp, two after one look, one after more.

**Look and sound.**
- Visuals:
  - A shoji screen in a wooden lattice, a clay wall framed by bamboo blinds, and an indigo theatre screen under the moon.
  - The sculpture is flat-shaded from a viewpoint above and to the right of the lamp, so it never simply shows its answer.
  - The soft shadow is drawn live, and the lamp's glow rises as the shadow comes right.
- Sound:
  - A shō-like reed drone, a breathy bamboo flute and a singing bowl.
  - Turning makes a rustle, a creak or a hum, depending on the material.
  - Chimes rise as you get close, and the bowl rings when the shadow settles.

## Structure

| Path | What it is |
| --- | --- |
| `web/src/game/figures.ts` | 24 figures, each drawn in profile from a few convex pieces (ellipses, polygons, bars) |
| `web/src/game/geo.ts` | Quaternions; slabs, one per piece at its own depth plus hidden decoys inside the outline; the shadow as convex hulls; matching by rasterised intersection-over-union; the answers and how close you must come to them |
| `web/src/game/levels.ts` | The 24 sculptures, each with a start far from its answers whose shadow looks nothing like the figure |
| `src/native/` | Expo WebView shell |

```bash
npm install && npm run web:install
npm run web:test     # 34 tests
npm run build:game && npm run validate:assets && npm run android
```

## Release builds

The Android release is configured for Google Play: target and compile SDK 36, R8 minification and resource shrinking, a non-debuggable release build, no Internet permission, and the game served offline from the app's own assets. Builds run on EAS; `eas.json` has two profiles:

```bash
npm install -g eas-cli && eas login
eas init                     # once: links this folder to your Expo project
npm run eas:apk              # preview profile: a signed APK for testing on devices
npm run eas:aab              # production profile: an AAB for Google Play (versionCode auto-increments)
```
