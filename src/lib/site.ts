/** Site-wide constants. Keep URLs here so they appear once, not in ten files. */

export const SITE_NAME = "c3check";

export const REPO_URL = "https://github.com/revjim/c3check";

/** Where people report bugs and raise privacy questions. */
export const ISSUES_URL = `${REPO_URL}/issues`;

/**
 * The author, as the community this is for knows them: the footer credit signs
 * the tool with a Reddit handle rather than a name, because r/LostCanadians is
 * where the questions this answers are actually being asked.
 */
export const AUTHOR_REDDIT_URL = "https://www.reddit.com/user/revjim/";

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
export const POLICY_UPDATED = "17 August 2026";

/**
 * Last substantive change to the tool itself, shown in the footer on every page.
 *
 * Hand-maintained, like `POLICY_UPDATED`, and for the same reason: it is a claim
 * about whether somebody thought about the rules recently, not a build stamp. A
 * deploy date would move on a typo fix and tell a reader nothing, and the date
 * that matters to them is whether the encoded law has been looked at since the
 * last time IRCC moved. So bump it when the rules, the sources, or the reasoning
 * change; leave it alone for wording and layout.
 */
export const SITE_UPDATED = "18 August 2026";

/**
 * Shown at the foot of a printed report, which leaves the site and loses the
 * chrome along with any way of telling where it came from. So it has to be the
 * address a stranger holding the paper can type, which is the domain rather
 * than the deploy that happens to serve it: c3check.vercel.app still answers,
 * but a printout outlives the hosting arrangement it was made under. Change it
 * here and the printout follows.
 */
export const SITE_URL = "https://c3check.com";
