# Umbra Prime: design notes

## The idea
A shadow is a flattening. Many different objects cast the same shadow, and one object casts endlessly many. Umbra builds an object that casts one particular picture from one direction only. Each figure is drawn in profile from a few convex pieces. Each piece becomes a slab hung at a different depth, and a few smaller decoy slabs hang inside the outline. Seen along the light, the slabs line up exactly. Turned any other way, their shadows slide apart.

## Rules
- The light shines along the depth axis onto the screen. Each slab's shadow is the convex hull of its eight-or-more projected corners, and the picture is the union of those hulls.
- The answers are the original orientation and the sculpture turned 180° about the vertical. That second shadow is the figure's mirror image, the figure seen from behind, so it counts too.
- When the orientation comes within a tolerance of an answer (0.10 rad turning only, 0.14 turning and tipping, 0.19 free), the sculpture eases into it and the shadow is signed.
- **Controls by chapter:**
  - Turning only: a horizontal drag changes yaw.
  - Turning and tipping: yaw, then pitch.
  - Free: a trackball, where a drag rotates about the axis perpendicular to it; circling drags roll it.
- A flick keeps turning and slows down. Passing through the answer still settles there.
- The lamp (hint) shows the outline for 2.6 seconds. Seals are 3 with no hints, 2 with one, and 1 with more.

## Checks
- Matching rasterises shadows onto a 56 × 56 grid and compares them by intersection-over-union.
- The tests check every level:
  - The answer matches perfectly.
  - The start matches under 0.5 and is more than 1 rad from either answer.
  - Across 600 random orientations more than 0.45 rad from the answers, nothing matches 0.82 or better, so no false picture appears that the game would not accept.
  - The decoys stay inside the outline.
- Starting orientations are also chosen so that, from the player's viewpoint, the sculpture itself does not face them the way the answer does.

## Feel
- The sculpture is drawn from a viewpoint above and to the right of the lamp, and the screen glows warmer as the match improves. Players feel they are getting close without being told where to go.
