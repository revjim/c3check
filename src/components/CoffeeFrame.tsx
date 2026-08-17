/**
 * The Buy Me a Coffee widget, in a frame it cannot get out of.
 *
 * The widget is a `<script>` tag served from Buy Me a Coffee's own CDN, and it
 * calls `document.writeln`, so it can only run while a document is being
 * parsed. It cannot go in a React tree, and it must not go on this site's own
 * pages: the results page holds a whole family line in the DOM, and
 * `localStorage` beside it holds every name, birth date and place of birth the
 * user typed. Any script on that page can read both, and /privacy says in bold
 * that those details never leave the browser and enumerates the only two keys
 * that are stored.
 *
 * So the script gets a document of its own, `public/coffee.html`, and this
 * loads it in a sandboxed frame. **No `allow-same-origin`**, which is the whole
 * mechanism: without it the frame gets an opaque origin, so `localStorage` is
 * unreachable from inside it and the parent DOM is cross-origin. `allow-scripts`
 * is what the widget needs; the two popup permissions are what lets the button
 * open buymeacoffee.com in a new tab, which is the only thing it does.
 *
 * That guarantee is one token in one attribute deep, so `src/isolation.test.ts`
 * holds it rather than memory: it fails the build if any iframe loses its
 * sandbox, if `allow-same-origin` appears anywhere, or if a third-party script
 * host turns up under `src/`.
 *
 * The size is pinned rather than measured at runtime. An iframe has no
 * content-driven height, and a `postMessage` handshake to learn one would mean
 * listening for messages from a frame whose whole point is that it is not
 * trusted. The button renders at 217x60 with these data attributes.
 */

export function CoffeeFrame({ className }: { className?: string }) {
  return (
    <iframe
      src="/coffee.html"
      title="Buy me a coffee"
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      loading="lazy"
      className={
        className === undefined
          ? "h-[60px] w-[220px] border-0"
          : `h-[60px] w-[220px] border-0 ${className}`
      }
    />
  );
}
