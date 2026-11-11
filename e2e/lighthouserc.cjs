// Lighthouse CI (brief §10): home, /data, an indicator page, /map and a dashboard, on
// Lighthouse's default mobile emulation (Moto G Power, simulated slow 4G). Targets from §9:
// performance ≥ 90, accessibility, best practices and SEO 100, LCP < 2.5 s, CLS < 0.1.
// The servers (mock, portal) must already be running: `pnpm lhci` doesn't start them.
const PORTAL = process.env.E2E_PORTAL ?? "http://localhost:3000";

module.exports = {
  ci: {
    collect: {
      url: [
        `${PORTAL}/en`,
        `${PORTAL}/en/data`,
        `${PORTAL}/en/data/ACCESS.INTERNET_USERS`,
        `${PORTAL}/en/map?i=ACCESS.INTERNET_USERS`,
        `${PORTAL}/en/dashboards/public`,
      ],
      numberOfRuns: 3,
      settings: {
        // Chrome flags for CI containers; harmless locally.
        chromeFlags: "--no-sandbox --headless=new",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9, aggregationMethod: "median-run" }],
        "categories:accessibility": ["error", { minScore: 1, aggregationMethod: "median-run" }],
        "categories:best-practices": ["error", { minScore: 1, aggregationMethod: "median-run" }],
        "categories:seo": ["error", { minScore: 1, aggregationMethod: "median-run" }],
        "largest-contentful-paint": [
          "error",
          { maxNumericValue: 2500, aggregationMethod: "median-run" },
        ],
        "cumulative-layout-shift": [
          "error",
          { maxNumericValue: 0.1, aggregationMethod: "median-run" },
        ],
        "interaction-to-next-paint": "off",
      },
    },
    upload: { target: "filesystem", outputDir: "./lhci-report" },
  },
};
