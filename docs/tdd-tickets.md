# TDD Tickets — Auth & Session (E2E)

Test-driven backlog for the auth surface. Each ticket follows the red → green → refactor loop: write the Playwright spec first, watch it fail, then implement until green. Specs live under `e2e/`.

Conventions:

- Framework: Playwright (`bun run test:e2e`).
- Required env: `E2E_EMAIL`, `E2E_PASSWORD` (specs auto-skip when missing).
- Optional env per ticket noted inline (e.g. `E2E_RESET_EMAIL`).
- "Browser restart" = close the `BrowserContext` and reopen with the same `storageState` (drops `sessionStorage`, keeps `localStorage` + cookies). Already implemented as `restartBrowser()` in `e2e/remember-me.spec.ts` — extract to `e2e/_helpers.ts` in ticket A1.

---

## A1 — Test helpers & fixtures

**As** a test author
**I want** shared sign-in / restart helpers
**So that** every auth spec is short and consistent.

```gherkin
Feature: Shared auth test helpers

  Scenario: signIn helper authenticates and lands on /admin
    Given a valid E2E account
    When I call signIn(page, { remember: true })
    Then the URL pathname starts with "/admin"
    And localStorage contains the Supabase auth token

  Scenario: restartBrowser drops sessionStorage but keeps localStorage
    Given an authenticated context
    When I call restartBrowser(ctx)
    Then the new context has the same localStorage
    And the new context has empty sessionStorage
```

**Acceptance criteria**

- [ ] `e2e/_helpers.ts` exports `signIn`, `signOut`, `restartBrowser`, `expectAuthed`, `expectLoggedOut`.
- [ ] `e2e/remember-me.spec.ts` refactored to use the helpers (no behavior change).
- [ ] `playwright.config.ts` exposes `baseURL` via a typed helper so specs don't read `test.info().project.use.baseURL!`.

---

## A2 — Login: happy path

```gherkin
Feature: Email + password login

  Scenario: Valid credentials sign in and redirect
    Given I am on "/login"
    When I fill Email and Password with valid credentials
    And I click "Sign in"
    Then I am redirected to a route under "/admin" within 15s
    And the header shows my email or avatar
```

**AC**

- [ ] Spec: `e2e/login-happy.spec.ts`.
- [ ] No "Loading…" text remains 10s after landing.
- [ ] `supabase.auth.getSession()` resolves to a non-null session (asserted via `page.evaluate`).

---

## A3 — Login: invalid credentials

```gherkin
Feature: Login error handling

  Scenario: Wrong password shows an inline error and stays on /login
    Given I am on "/login"
    When I submit Email "<E2E_EMAIL>" and Password "definitely-wrong"
    Then I remain on "/login"
    And a visible error mentions "Invalid" or "incorrect"
    And no Supabase session is written to localStorage

  Scenario: Empty fields block submission
    Given I am on "/login"
    When I click "Sign in" with both fields empty
    Then the browser's required-field validation fires
    And no network request is made to /auth/v1/token
```

**AC**

- [ ] Spec: `e2e/login-errors.spec.ts`.
- [ ] Error is rendered in an `aria-live` region (a11y).
- [ ] After error, the password field is cleared OR focused (pick one and assert).

---

## A4 — Remember me: extend existing coverage

Builds on `e2e/remember-me.spec.ts`. Add two missing branches.

```gherkin
Feature: Remember me preference is sticky across logins

  Scenario: Last-used preference pre-fills the checkbox
    Given I previously logged in with Remember me unchecked
    When I open "/login" in a new context (localStorage preserved)
    Then the Remember me checkbox is unchecked by default

  Scenario: Reload within the same tab always keeps me logged in
    Given I logged in with Remember me unchecked
    When I reload "/admin/courses"
    Then I remain on "/admin/courses"
    # sessionStorage flag is still present in the same tab
```

**AC**

- [ ] Spec: `e2e/remember-me-extra.spec.ts`.
- [ ] Both scenarios green; no flake on 3 consecutive runs.

---

## A5 — Logout

```gherkin
Feature: Sign out clears the session everywhere

  Scenario: Clicking Sign out returns to /login and forgets the session
    Given I am signed in on "/admin/courses"
    When I click the Sign out control
    Then I am redirected to "/login"
    And localStorage has no "sb-*-auth-token" entry
    And visiting "/admin/courses" redirects me back to "/login"

  Scenario: Sign out in tab A logs out tab B
    Given two tabs A and B are both signed in
    When I click Sign out in tab A
    Then tab B navigates to "/login" within 5s
    # relies on supabase.auth.onAuthStateChange across tabs
```

**AC**

- [ ] Spec: `e2e/logout.spec.ts`.
- [ ] Multi-tab scenario uses two `page` objects from the same context.

---

## A6 — Protected route guard

```gherkin
Feature: _authenticated layout requires a session

  Scenario: Anonymous user hitting /admin is bounced to /login
    Given I have no session
    When I navigate to "/admin/courses"
    Then I land on "/login"
    And the login form is visible

  Scenario: After login, I am sent back to the originally requested route
    Given I have no session
    And I navigated to "/admin/courses" and was bounced to "/login"
    When I sign in with valid credentials
    Then I land on "/admin/courses" (not the default /admin)
```

**AC**

- [ ] Spec: `e2e/route-guard.spec.ts`.
- [ ] The second scenario may be marked `test.fixme` if redirect-back isn't implemented yet — that's the TDD driver for the feature.

---

## A7 — Password reset request

Requires `E2E_RESET_EMAIL` (an inbox the test can read) **or** a stub. If no inbox is available, scope the test to the UI side only and mark the link-follow scenario `test.skip`.

```gherkin
Feature: Forgot password requests an email

  Scenario: Submitting a known email shows a success toast
    Given I am on "/login"
    When I click "Forgot password"
    And I submit the email "<E2E_RESET_EMAIL>"
    Then I see a confirmation that an email was sent
    And I stay on the same page (no redirect to /admin)

  Scenario: Unknown email still shows a generic success (no user enumeration)
    When I submit "noone-xyz@example.com" to the forgot-password form
    Then the response message is identical to the known-email case
```

**AC**

- [ ] Spec: `e2e/password-reset-request.spec.ts`.
- [ ] No response text leaks whether the email exists.

---

## A8 — `/reset-password` page

```gherkin
Feature: Reset password page sets a new password

  Scenario: Visiting /reset-password without a recovery token shows an error
    Given I have no recovery hash in the URL
    When I open "/reset-password"
    Then I see "invalid or expired link"
    And the password fields are disabled

  Scenario: Submitting matching passwords updates the account
    Given I have a valid recovery token in the URL hash
    When I enter matching new passwords and submit
    Then I see a success message
    And I can sign in with the new password on /login
```

**AC**

- [ ] Spec: `e2e/reset-password.spec.ts`.
- [ ] Valid-token scenario uses a Supabase-issued recovery link captured from `E2E_RESET_EMAIL` or is `test.fixme` until inbox plumbing exists.

---

## A9 — Session expiry / refresh

```gherkin
Feature: Expired access tokens are silently refreshed

  Scenario: Forcing an expired access_token still loads /admin/courses
    Given I am signed in with Remember me checked
    When I overwrite the cached access_token with one expired 1h ago
    And I reload "/admin/courses"
    Then Supabase refreshes the session using the refresh_token
    And I remain on "/admin/courses"

  Scenario: Refresh token revoked → bounce to /login
    Given my refresh_token has been invalidated server-side
    When I reload "/admin/courses"
    Then I land on "/login"
    And localStorage has no "sb-*-auth-token" entry
```

**AC**

- [ ] Spec: `e2e/session-refresh.spec.ts`.
- [ ] Token mutation done via `page.evaluate` on the localStorage entry.
- [ ] Second scenario uses `supabase.auth.admin.signOut(userId, 'others')` from a small server-fn or is `test.fixme`.

---

## Execution order

1. A1 (helpers) — unblocks everything else.
2. A2, A3 — login basics.
3. A5, A6 — logout + guard.
4. A4 — Remember-me extras.
5. A7, A8 — password reset (gated on inbox access).
6. A9 — refresh edge cases.

Each ticket: write the spec → run `bun run test:e2e -- <file>` → confirm red → implement → green → commit.
