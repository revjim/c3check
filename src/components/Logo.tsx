/**
 * A maple leaf with three arrows cut out of it, branching from a single hub:
 * one line of descent splitting into the lines a family actually has. That is
 * the whole product in one mark, because c3check follows a line generation by
 * generation and lets it fork.
 *
 * The paths are a trace of the artwork in `design/logo.jpg`, cleaned rather
 * than redrawn: the mask was smoothed, mirrored about its own axis so the two
 * halves match exactly, and simplified to 54 and 47 points. Do not hand-edit a
 * vertex; retrace from the source art and mirror again, or the symmetry goes.
 *
 * **This is close to the flag device, and closer than the mark it replaced.**
 * Eleven points and a red fill is the national leaf, give or take the arrows,
 * and section 9 of the Trademarks Act restricts national flags and
 * public-authority marks. The choice was made deliberately with that known. The
 * arrows are the only thing distinguishing it, so keep them prominent, and keep
 * the disclaimers on the home page, in the footer and in the terms exactly
 * where they are: they are what says this is not a Government of Canada site.
 *
 * The arrows are a true cut-out, one path with `fill-rule="evenodd"`, so they
 * are whatever is behind the mark. That is one fewer colour to theme than the
 * old drawing needed, and it stays right on a card, on paper and in dark mode.
 *
 * The leaf takes `currentColor`, so callers theme it with a text colour.
 *
 * `src/app/icon.svg` is the same drawing as a standalone favicon. The two are
 * separate files because a favicon cannot reach the page's CSS variables;
 * change one and change the other.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="c3check">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M31.88 1.50L32.35 1.62L36.86 10.53L37.67 11.45L38.48 11.57L42.19 9.60L43.00 9.60L40.57 24.65L41.72 25.00L48.09 17.94L48.55 18.05L49.48 21.52L50.17 21.99L58.28 20.25L55.96 29.63L56.77 30.55L59.20 31.59L58.97 32.29L46.24 42.24L46.01 44.10L47.05 46.99L46.93 47.68L37.32 46.06L36.28 46.06L35.13 46.76L34.66 51.62L35.47 62.15L33.74 62.62L30.38 62.62L28.64 62.15L29.45 51.62L28.99 46.76L27.83 46.06L26.79 46.06L17.18 47.68L17.07 46.99L18.11 44.10L17.88 42.24L4.91 32.06L5.03 31.48L7.35 30.55L8.16 29.63L5.84 20.25L13.94 21.99L14.64 21.52L15.56 18.05L16.03 17.94L22.39 25.00L23.55 24.65L21.12 9.60L21.93 9.60L25.63 11.57L26.44 11.45L27.25 10.53ZM32.00 8.56L36.86 16.55L36.63 17.13L34.31 16.66L33.62 17.13L33.50 34.72L33.97 36.34L35.24 37.15L35.82 37.04L46.70 28.93L47.05 28.12L45.20 26.73L45.08 25.92L54.22 24.53L53.53 27.78L52.83 28.82L51.45 33.45L50.52 32.98L49.48 31.13L47.39 32.17L46.70 33.10L37.56 39.81L36.17 43.86L33.27 45.83L30.38 45.72L28.64 44.56L27.49 42.82L26.56 39.81L15.10 31.13L14.17 31.59L13.60 32.98L12.79 33.56L9.89 25.11L9.89 24.53L10.24 24.53L19.04 25.92L18.92 26.73L17.07 28.12L17.42 28.93L28.30 37.04L28.87 37.15L30.15 36.34L30.61 34.72L30.50 17.13L30.15 16.66L27.49 17.13L27.25 16.55Z"
      />
    </svg>
  );
}
