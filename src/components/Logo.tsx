/**
 * A maple leaf with a family tree growing inside it: the leaf's stem is the
 * trunk, and each branch ends in a filled node, one per person in a line of
 * descent. That is the whole product in one mark: c3check walks a family line
 * generation by generation, so the tree is not decoration.
 *
 * It is NOT the eleven-point device from the national flag, and that is on
 * purpose. This leaf has nine points, carries a tree the flag leaf does not,
 * and is drawn in a non-flag colour. A logo resembling the flag would imply
 * official Government of Canada status, which is exactly what the terms of
 * service disclaim; section 9 of the Trademarks Act also restricts national
 * flags and public-authority marks. Keep it Canada-adjacent, never
 * Canada-official.
 *
 * The strokes are heavier than a drawing of this leaf wants to be, because the
 * mark has to survive 24px in the header and 32px in a browser tab. Thinning
 * them makes the tree read as noise at those sizes.
 *
 * The leaf takes `currentColor`, so callers theme it with a text colour. The
 * tree is cut in `--background` rather than white so it stays a cut-out in
 * dark mode and in print, where that token flips.
 *
 * `src/app/icon.svg` is the same drawing as a standalone favicon. The two are
 * separate files because a favicon cannot reach the page's CSS variables;
 * change one and change the other.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="c3check"
    >
      <path
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeLinejoin="round"
        d="M32 6.5L38.35 17.95L43.93 15.45L41.81 32.95L50.09 25.06L51.53 29.49L61.15 27.57L58.26 37.77L62.02 40.17L47.29 52.96L48.54 57.48L15.46 57.48L16.71 52.96L1.98 40.17L5.74 37.77L2.85 27.57L12.47 29.49L13.91 25.06L22.19 32.95L20.07 15.45L25.65 17.95Z"
      />
      <g
        fill="none"
        stroke="var(--background)"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path strokeWidth="2.9" strokeLinecap="butt" d="M32 51.1V57.8" />
        <path strokeWidth="1.6" d="M32 15.4V54.1" />
        <path
          strokeWidth="1.6"
          d="M32 54.6C31 50.1 27.6 46.1 22.6 42.7C20.2 41.4 15 40.9 8.6 40.9M32 54.6C33 50.1 36.4 46.1 41.4 42.7C43.8 41.4 49 40.9 55.4 40.9"
        />
        <path
          strokeWidth="1.25"
          d="M24.6 21.9C25.8 24.7 27.7 27.4 31.6 32.4M39.4 21.9C38.2 24.7 36.3 27.4 32.4 32.4M8.4 32.5L19 40.9M55.6 32.5L45 40.9"
        />
        <path
          strokeWidth="0.85"
          d="M16 31.3L18.3 40M48 31.3L45.7 40M25.6 34.3C25.6 36.5 27.6 38.5 31.8 41M38.4 34.3C38.4 36.5 36.4 38.5 32.2 41M24.4 44.7C21.5 46.1 18.5 46.6 15.7 46.5M39.6 44.7C42.5 46.1 45.5 46.6 48.3 46.5"
        />
      </g>
      <g fill="var(--background)">
        <circle cx="32" cy="13.9" r="1.85" />
        <circle cx="24.2" cy="21.2" r="1.85" />
        <circle cx="39.8" cy="21.2" r="1.85" />
        <circle cx="7.8" cy="32.2" r="1.85" />
        <circle cx="56.2" cy="32.2" r="1.85" />
        <circle cx="7.8" cy="40.85" r="1.85" />
        <circle cx="56.2" cy="40.85" r="1.85" />
      </g>
    </svg>
  );
}
