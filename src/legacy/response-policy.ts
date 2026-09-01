// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * The exact approved response-header matrix for the Wave 1 legacy trust
 * portal, by response class. This is a strict, first-party, zero-JavaScript
 * surface: no script runs, no cookie is ever set, and no third-party
 * request is made, so the policy below is written to make every one of
 * those properties true by construction rather than by omission.
 *
 * `HTML_HEADERS` applies to every navigable document: the home page, every
 * product/version/verify/keys/about page, the not-found page, and the
 * degraded-model page. `ASSET_HEADERS` applies to every non-navigable static
 * response (currently only the stylesheet). No response of any class ever
 * carries a `Set-Cookie` header — that is an absence, not a value, and is
 * asserted by its absence, never a header set to an empty string.
 */

/** Applies to every HTML document response, including error and degraded-model pages. */
export const HTML_HEADERS: Readonly<Record<string, string>> = {
	"Content-Type": "text/html; charset=utf-8",
	// Zero JavaScript ships on this surface, so `default-src 'none'` already
	// blocks script execution; `script-src 'none'` is stated explicitly
	// anyway so a reviewer never has to infer it from a default. Only
	// same-origin styles and images are needed; nothing else is fetched.
	"Content-Security-Policy":
		"default-src 'none'; script-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	// Deliberately stricter than this org's usual `strict-origin-when-cross-origin`
	// pattern (services.solstone.app, scouts.solstone.app, solpbc.org): this
	// surface's own defining feature is a raw-evidence link to
	// transparency.solstone.app on nearly every page, and the CPO spec's own
	// privacy considerations rule out any visitor being measured, including
	// by referrer leakage on an outbound click. No referrer is sent, ever.
	"Referrer-Policy": "no-referrer",
	"Permissions-Policy":
		"camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), browsing-topics=()",
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
	// The content is a build-time snapshot of the register, not per-request
	// state, and a redeploy is the only thing that ever changes it. `no-cache`
	// (not `no-store`) still lets Cloudflare's edge and the browser cache the
	// response and revalidate cheaply by ETag, while guaranteeing nobody is
	// ever served a stale build past the next request after a redeploy.
	"Cache-Control": "no-cache",
};

/** Applies to every non-navigable static asset response (the stylesheet). */
export const ASSET_HEADERS: Readonly<Record<string, string>> = {
	"Content-Type": "text/css; charset=utf-8",
	"X-Content-Type-Options": "nosniff",
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
	"Cache-Control": "no-cache",
};

/**
 * Header names that must never appear on ANY response from this surface, at
 * any response class. `Set-Cookie` is the one a naive framework default can
 * add without anyone asking for it; NEL/Report-To belong to CLO condition
 * D1 (edge/platform telemetry) and are the zone-wide operator's to strip,
 * not this Worker's to add.
 */
export const FORBIDDEN_HEADERS: readonly string[] = [
	"Set-Cookie",
	"NEL",
	"Report-To",
];
