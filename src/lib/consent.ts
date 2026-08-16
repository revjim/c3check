/**
 * Terms acceptance, modelled as an external store so components can read it
 * with `useSyncExternalStore` instead of syncing localStorage into state.
 *
 * Shared between the consent gate and the "Clear my data" button so that
 * clearing storage immediately re-arms the gate.
 */
import { CONSENT_KEY, DRAFT_KEY } from "@/lib/site";

export type ConsentStatus = "loading" | "granted" | "needed";

/**
 * Honours acceptance when localStorage is unavailable (private browsing,
 * strict privacy settings). Without this the button would appear to do
 * nothing for those users. Session-only: they are asked again next visit.
 */
let acceptedThisSession = false;

/**
 * `storage` events only fire in *other* tabs, so same-tab changes have to
 * notify subscribers explicitly.
 */
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getSnapshot(): ConsentStatus {
  if (acceptedThisSession) return "granted";
  try {
    return window.localStorage.getItem(CONSENT_KEY) ? "granted" : "needed";
  } catch {
    return "needed";
  }
}

/**
 * Used for SSR and the hydration render. A distinct "loading" state, rather
 * than "needed", keeps the gate from flashing at people who already accepted.
 */
export function getServerSnapshot(): ConsentStatus {
  return "loading";
}

export function acceptTerms() {
  acceptedThisSession = true;
  try {
    window.localStorage.setItem(CONSENT_KEY, new Date().toISOString());
  } catch {
    // Storage blocked; acceptance holds for this session only.
  }
  notify();
}

/** Erases everything c3check has stored on this device. */
export function clearStoredData() {
  acceptedThisSession = false;
  try {
    window.localStorage.removeItem(CONSENT_KEY);
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing was stored in the first place.
  }
  notify();
}
