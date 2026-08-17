/** Site-wide constants. Keep URLs here so they appear once, not in ten files. */

export const SITE_NAME = "c3check";

export const REPO_URL = "https://github.com/revjim/c3check";

/** Where people report bugs and raise privacy questions. */
export const ISSUES_URL = `${REPO_URL}/issues`;

/**
 * Bumping this invalidates stored acceptance and re-prompts every user, so
 * only bump it when the terms change in a way that matters.
 */
export const CONSENT_KEY = "c3check.consent.v1";

/**
 * Interview progress, saved on the user's own device.
 *
 * The two keys sit next to each other and look as though they follow the same
 * rule. They do not, and the asymmetry is deliberate. Bumping `CONSENT_KEY`
 * *should* discard what is stored: re-prompting everyone is the point.
 * Bumping this one would silently orphan a half-finished six-generation line,
 * and both `clearStoredData` and the /privacy page name the old key. So this
 * value never changes; the version lives inside the stored JSON instead, and
 * `migrateDraft` in `src/lib/draft.ts` handles shape changes.
 */
export const DRAFT_KEY = "c3check.draft.v1";

/** Last substantive revision of /terms and /privacy. */
export const POLICY_UPDATED = "16 August 2026";

/**
 * Shown at the foot of a printed report, which leaves the site and loses the
 * chrome along with any way of telling where it came from. So it has to be the
 * address a stranger holding the paper can type, which is the domain rather
 * than the deploy that happens to serve it: c3check.vercel.app still answers,
 * but a printout outlives the hosting arrangement it was made under. Change it
 * here and the printout follows.
 */
export const SITE_URL = "https://c3check.com";
