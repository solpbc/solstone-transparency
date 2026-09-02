// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Served CSS for the Wave 1 portal. Token custom properties are copied from
 * public/static/tokens.css (values, not @import). Production code does not
 * read the filesystem; drift is caught by stylesheet.test.ts.
 *
 * @font-face points at Comfortaa-Variable.woff2 beside this stylesheet URL.
 * The font file is not routed this lode.
 */

export const PORTAL_CSS = `@font-face {
  font-family: 'Comfortaa';
  src: url('Comfortaa-Variable.woff2') format('woff2');
  font-weight: 400 700;
  font-display: swap;
}

:root {
  --gold: #FFCC33;
  --orange: #E8913A;
  --orange-ink: #B06A1A;
  --orange-text-aa: #A15F17;
  --orange-wash: #FBEFDD;
  --cream: #FCF3E4;
  --cream-bright: #FEFCF8;
  --paper: #FFFFFF;
  --surface-dark: #1A1A1A;
  --ink: #1A1A1A;
  --ink-soft: #5B5246;
  --ink-faint: #6E6453;
  --ink-on-dark: #FFFFFF;
  --ink-soft-paper: #555555;
  --ink-faint-paper: #767676;
  --hairline: #ECE3D0;
  --hairline-2: #E2D7BF;
  --danger: #9F2D2D;
  --danger-wash: #F8E9E6;
  --success: #3F9D6A;
  --success-ink: #166534;
  --success-wash: #E7F1E9;
  --warn: #C99A2E;
  --warn-ink: #7C4A0C;
  --warn-wash: #FBF1D6;
  --focus: #B06A1A;
  --font-display: 'Comfortaa', ui-rounded, 'Trebuchet MS', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: ui-monospace, 'SF Mono', Menlo, monospace;
  --text-min: 12px;
  --text-body: 16px;
  --weight-body: 400;
  --weight-medium: 600;
  --weight-display: 700;
  --radius: 14px;
  --radius-sm: 9px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 14px;
  --space-4: 18px;
  --space-5: 22px;
  --space-6: 28px;
  --space-7: 36px;
  --space-8: 48px;
  --touch-min: 44px;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  color: var(--ink);
  background: var(--cream);
  font-family: var(--font-body);
  font-size: var(--text-body);
  font-weight: var(--weight-body);
  line-height: 1.5;
}

body {
  margin: 0;
  min-height: 100vh;
  overflow-wrap: anywhere;
}

.skip-link {
  position: absolute;
  left: var(--space-2);
  top: var(--space-2);
  z-index: 2;
  padding: var(--space-2) var(--space-3);
  background: var(--paper);
  color: var(--ink);
  min-height: var(--touch-min);
  min-width: var(--touch-min);
}

.skip-link:not(:focus) {
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  height: 1px;
  overflow: hidden;
  white-space: nowrap;
  width: 1px;
}

.lockup,
h1,
h2,
h3 {
  font-family: var(--font-display);
  font-weight: var(--weight-display);
}

.lockup {
  color: var(--ink);
  text-decoration: none;
  min-height: var(--touch-min);
  display: inline-flex;
  align-items: center;
}

.shell-header {
  border-bottom: 1px solid var(--hairline);
  background: var(--cream-bright);
}

.shell-header__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
  max-width: 72rem;
  margin: 0 auto;
}

.primary-nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.primary-nav a,
.shell-footer a,
.breadcrumbs a,
.card-link {
  min-height: var(--touch-min);
  display: inline-flex;
  align-items: center;
}

a {
  color: var(--orange-text-aa);
}

a:focus-visible,
button:focus-visible,
.skip-link:focus-visible,
.card-link:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.breadcrumbs ol {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  list-style: none;
  padding: var(--space-3) var(--space-5);
  max-width: 72rem;
  margin: 0 auto;
}

main {
  max-width: 72rem;
  margin: 0 auto;
  padding: var(--space-5);
}

.shell-footer {
  border-top: 1px solid var(--hairline);
  padding: var(--space-5);
  color: var(--ink-soft);
}

.shell-footer .inner {
  max-width: 72rem;
  margin: 0 auto;
}

.shell-footer ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  list-style: none;
  padding: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.card-grid {
  display: grid;
  gap: var(--space-4);
}

.card {
  background: var(--cream-bright);
  border: 1px solid var(--hairline);
  border-radius: var(--radius);
  padding: var(--space-4);
}

.card-link {
  color: inherit;
  text-decoration: none;
}

.register-table,
.evidence-table {
  width: 100%;
  border-collapse: collapse;
}

table.evidence-table {
  table-layout: fixed;
}

.register-table th,
.register-table td,
.evidence-table th,
.evidence-table td {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--hairline);
  vertical-align: top;
}

.table-scroll {
  overflow-x: auto;
}

.axis-block {
  display: grid;
  gap: var(--space-3);
  margin: var(--space-5) 0;
  padding: var(--space-4);
  background: var(--cream-bright);
  border-radius: var(--radius);
  border: 1px solid var(--hairline);
}

.axis-row {
  display: grid;
  gap: var(--space-2);
}

.axis-name {
  font-weight: var(--weight-medium);
}

.state-success {
  color: var(--success-ink);
}

.state-warn {
  color: var(--warn-ink);
}

.state-danger {
  color: var(--danger);
}

.state-neutral {
  color: var(--ink-soft);
}

.kind {
  margin-right: var(--space-2);
}

.declaration {
  padding: var(--space-4);
  background: var(--cream-bright);
  border-radius: var(--radius);
  border: 1px solid var(--hairline);
}

.prove-columns {
  display: grid;
  gap: var(--space-4);
  margin: var(--space-5) 0;
}

.timeline {
  list-style: none;
  padding: 0;
}

.timeline li {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--hairline);
}

.is-gap {
  background: var(--cream-bright);
}

.mono,
pre.mono {
  font-family: var(--font-mono);
  font-size: 0.95em;
}

pre,
.mono {
  white-space: pre-wrap;
}

pre {
  background: var(--paper);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--hairline);
}

.raw-link {
  overflow-wrap: anywhere;
}

.marker {
  font-weight: var(--weight-medium);
}

details.tech {
  margin: var(--space-3) 0;
}

details.tech .body {
  padding: var(--space-3) 0;
}

@media print {
  details.tech[open],
  details.tech[open] > .body {
    display: block;
  }
}
`;
