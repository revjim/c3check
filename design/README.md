# Source art

`logo.jpg` is the artwork the site mark is drawn from: a maple leaf with three
arrows branching from one hub.

`src/components/Logo.tsx` and `src/app/icon.svg` carry a trace of it, not a copy
of it. The trace was made by masking the red, taking the enclosed non-red as the
arrows, smoothing the mask, mirroring it about its own axis so the halves match,
and simplifying the boundary. Retrace from this file rather than nudging a
vertex by hand: the symmetry is the first thing hand-editing loses.
