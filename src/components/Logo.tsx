/**
 * A deliberately stylized maple leaf — seven points, rounded joins, and a
 * non-flag colour.
 *
 * This is NOT the eleven-point device from the national flag, and that is on
 * purpose. c3check is about citizenship applications, so a logo resembling the
 * flag would imply official Government of Canada status, which is exactly what
 * the terms of service disclaim. Section 9 of the Trademarks Act also restricts
 * national flags and public-authority marks. Keep it Canada-adjacent, never
 * Canada-official.
 *
 * Colour comes from `currentColor`, so callers theme it with a text colour.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="c3check"
      fill="currentColor"
      stroke="currentColor"
    >
      <path
        d="M16 2L17.8 9.8L23.2 7.2L21.8 13.2L29 12L23 16.8L25.5 21L16 22.6L6.5 21L9 16.8L3 12L10.2 13.2L8.8 7.2L14.2 9.8Z"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M16 20.5V29.4" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
