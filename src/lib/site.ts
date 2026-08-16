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

/** Interview progress, saved on the user's own device. */
export const DRAFT_KEY = "c3check.draft.v1";

/** Last substantive revision of /terms and /privacy. */
export const POLICY_UPDATED = "16 August 2026";
