# National Digital Observatory (ONN), frontend

A reusable, country-agnostic National Digital Observatory: a public data portal and a back-office, built as two Next.js apps that share one design system. This repository is frontend only. Until the backend exists it runs fully against a stateful mock server. Changing one environment variable switches it to the real API.

- `apps/portal`: the public portal (`:3000`).
- `apps/admin`: the back-office, served under `/admin` (`:3001`).
- `packages/ui`, `packages/charts`: components, tokens, ECharts and map wrappers.
- `packages/config`: country configuration, its schema, and the token generator.
- `packages/api-client`: the API contract (`types.ts`), the typed client and the permissions.
- `packages/mocks`: the mock server, its handlers and the generated fixtures for each country.
- `packages/i18n`: message catalogues.
- `apps/storybook`: component stories.
- `e2e`: Playwright journeys, visual regression, performance budgets and Lighthouse CI.

`CLAUDE.md` describes the architecture and the decisions behind it. `docs/onn-frontend-prompt.md` is the brief. `docs/api-contract-changes.md` lists what the frontend added to the brief's API contract.

## Setup

You need Node 22 or later and pnpm (the version is pinned in `package.json` under `packageManager`; `corepack enable` picks it up).

```sh
pnpm install
cp .env.example .env        # optional: every value has a working default for the mocks
pnpm dev                    # mock server :4000, portal :3000, admin :3001
```

Open `http://localhost:3000` for the portal and `http://localhost:3000/admin` for the back-office. When mocks are on, the sign-in page offers SSO; any six-digit code except `000000` passes MFA. After sign-in, the profile menu lists the demo users, one per role. Restarting the mock server resets everything done in the back-office.

| Command                                      | What it does                                                       |
| -------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm build`                                 | Validates the country config, then builds every package and app.   |
| `pnpm test`                                  | Vitest unit tests.                                                 |
| `pnpm lint`, `pnpm typecheck`, `pnpm format` | ESLint, TypeScript, Prettier.                                      |
| `pnpm storybook`, `pnpm build-storybook`     | Storybook on `:6006`, or a static build.                           |
| `pnpm check:stories`                         | Checks that every component story covers every required state.     |
| `pnpm e2e`                                   | The ten §10 journeys in Chromium, WebKit and Pixel 5, with axe.    |
| `pnpm visual`                                | Visual regression of every story at 360, 768 and 1280 px.          |
| `pnpm budgets`                               | §9 performance budgets (JS, transfer, fonts, TopoJSON).            |
| `pnpm lhci`                                  | Lighthouse CI on home, `/data`, an indicator, `/map`, a dashboard. |
| `pnpm mocks:gen --country=SEN --seed=42`     | Regenerates the fixtures deterministically.                        |

### Running the test suites

The end-to-end suites run against production builds, because the service worker, Lite mode and code splitting only behave as shipped in a build.

```sh
pnpm build
pnpm --filter @onn/e2e exec playwright install chromium webkit   # once
pnpm e2e              # starts the mock, portal and admin itself, or reuses running ones
```

`pnpm budgets` and `pnpm lhci` expect the mock server and the portal to be running already:

```sh
MOCK_LATENCY=0 pnpm --filter @onn/mocks start &
pnpm --filter @onn/portal start &
pnpm budgets && pnpm lhci
```

For Storybook interaction and axe tests, run `pnpm build-storybook` first, then `node e2e/visual/serve.mjs`, then `pnpm --filter @onn/storybook test-storybook --url http://localhost:6006`.

### Visual baselines

Screenshots depend on the operating system's font rendering, so baselines are stored per platform under `e2e/visual/__screenshots__/{platform}`. CI runs on Linux and compares against `linux/`. Only that folder is committed; Windows and macOS baselines stay on your machine.

To create or refresh the Linux baselines after an intended visual change, run the suite in Playwright's Linux image and commit the result:

```sh
pnpm build-storybook
docker run --rm -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.65.0-noble \
  sh -c "corepack enable && pnpm install --frozen-lockfile && pnpm --filter @onn/e2e visual:update"
```

When the Linux baselines are missing, the CI visual job fails and uploads the screenshots it took as the `visual-diffs` artifact. You can review them and commit them as the first baselines.

## Adding a country

Every country-specific value comes from configuration, and no component names a country. Adding one is mostly data:

1. **Configuration.** Copy `packages/config/countries/SEN.ts` to `{ISO3}.ts` and fill in every key: names, observatory and owner, locales, brand colours and logos, institutions, peer groups, geography, data protection law and authority, social links, and the SSO name. The schema in `packages/config/schema.ts` validates it, so a missing or malformed key fails the build with its path. Put logos in `packages/config/assets`.
2. **Geography for the mocks.** Add the country's administrative areas to `packages/mocks/geography.ts`, with adm1 regions and adm2 areas that name their parent. If the country appears in peer groups, add it to the peer list at the bottom of that file.
3. **Boundaries.** Run `pnpm --filter @onn/mocks boundaries --country={ISO3}`. It downloads stand-in boundaries from geoBoundaries, simplifies them and matches each shape to a name in `geography.ts`. A mismatch fails the run; add the spelling to `ALIASES` in `boundaries/import.ts`. Official files from the national statistics office replace these when they arrive. They need the same format: one `areas` object whose geometries carry `name`, plus `parent` at adm2. Keep adm1 under 150 KB, which `pnpm budgets` checks. Set the boundary credit in the country config.
4. **Fixtures.** Run `pnpm mocks:gen --country={ISO3} --seed=42` and commit `packages/mocks/fixtures/{ISO3}`.
5. **Switch.** Set `NEXT_PUBLIC_COUNTRY={ISO3}` and run `pnpm build`. Each build carries one country. If a build fails, the cause is the configuration, not a component. CI builds Togo (`TGO`) on every push to prove the switch needs no component edits.

Togo's boundary files are share-alike (ODbL, CC BY-SA), so check the licence of the files you use.

## Adding a locale

1. **Messages.** Copy `packages/i18n/messages/en.json` to `{locale}.json` and translate it. Register the file in `packages/i18n/index.ts`. Set `Meta.status` to `placeholder` while the strings are unreviewed: the portal then shows `Meta.notice` as a banner. Set it to `reviewed` once they have been checked. `pnpm test` fails on any key that is missing from a catalogue.
2. **Configuration.** Add the locale to `locales.enabled` in the country config, and to `locales.rtl` if it is written right to left. Components use logical utilities, so the layout mirrors automatically. Add the locale's text to every localised value in the config. If `Intl` may lack data for the language, map it to a tested tag in `numberFormat`, as Wolof does with `wo → fr-SN`. `tagFor()` falls back through the configured tag, the locale, the default locale's tag, and then `en`.
3. **Content.** API text arrives in the requested language. If the backend has no translation, it sends the default language with `fallback: true`, and the portal marks that text "Not yet translated". The mocks store `{fr, en}` text, so a new locale shows that fallback until the fixtures carry its text.

The locale switcher, `hreflang` links, sitemaps and the `NEXT_LOCALE` cookie all follow `locales.enabled`, so you don't need to change any routing.

## Connecting the real API

The frontend owns the contract in `packages/api-client/types.ts`, and the mock server implements it. The backend implements the same contract, including the additions listed in `docs/api-contract-changes.md`. To switch:

1. Set `NEXT_PUBLIC_API_BASE` to the API origin, for example `https://api.example.gov`. Every call goes to `${NEXT_PUBLIC_API_BASE}/api/v1/…`, including boundaries, which come from `/areas/{code}/geometry?level=adm1` as TopoJSON. When the variable is empty, both apps use the mock server.
2. Set `NEXT_PUBLIC_SITE_URL` to the public origin and `ADMIN_ORIGIN` to where the admin app runs. The portal serves `/admin` from that origin through Next.js multi-zones.
3. Set `REVALIDATE_SECRET` to a secret shared with the backend. When the backend publishes, it should `POST` the affected cache tags (`{"tags": ["indicator:CODE", …]}`) to `${NEXT_PUBLIC_SITE_URL}/api/revalidate` with the header `X-Revalidate-Secret`. New values then appear on the next request.
4. **Sign-in.** Configure the identity provider through Auth.js (OIDC). Until then, the SSO step of the admin sign-in shows an error against a real API. The admin session sends the user's bearer token on every `/api/v1/admin/*` call.
5. Rebuild. `NEXT_PUBLIC_*` values are inlined at build time, so no code changes are needed.

When mocks are on, every page shows a "Demo data" ribbon. It disappears once the API base is set.

## Status

All eight build phases are done. CI (`.github/workflows/ci.yml`) runs lint, types, unit tests, Storybook interaction, axe and visual tests, the e2e journeys, the budgets, Lighthouse and the Togo build. On `main`, it also publishes the Storybook build to GitHub Pages; enable Pages with "GitHub Actions" as the source in the repository settings. Placeholders remain for official boundaries, logos, brand colours, reviewed Wolof strings and Togo's configuration; each is marked where it appears.
