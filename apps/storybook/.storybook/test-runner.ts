import { waitForPageReady, type TestRunnerConfig } from "@storybook/test-runner";
import { checkA11y, injectAxe } from "axe-playwright";

// Runs every story's play function, then axe. Fails on serious or critical issues (brief §10).
const config: TestRunnerConfig = {
  async preVisit(page) {
    await injectAxe(page);
  },
  async postVisit(page) {
    // Lets play functions and dialog animations settle so two axe runs never overlap.
    await waitForPageReady(page);
    await checkA11y(page, undefined, {
      includedImpacts: ["serious", "critical"],
      detailedReport: true,
      detailedReportOptions: { html: false },
      axeOptions: { rules: { region: { enabled: false } } },
    });
  },
};

export default config;
