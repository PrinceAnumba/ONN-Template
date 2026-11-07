import type { Indicator } from "@onn/api-client/types";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { useState } from "react";
import { MetadataDrawer } from "./metadata-drawer";
import { Button } from "./ui/button";

const indicator: Indicator = {
  code: "ACCESS.INTERNET_USERS",
  name: "Internet users",
  shortDefinition: "Share of people who used the Internet in the last 3 months.",
  synonyms: [],
  pillar: "ACCESS",
  theme: "INDIVIDUALS",
  unit: "%",
  unitVariants: [
    { code: "pct", label: "%" },
    { code: "people", label: "people" },
  ],
  periodicity: "annual",
  geoLevels: ["national", "adm1", "adm2"],
  disaggregations: ["sex", "age_group", "area"],
  higherIsBetter: true,
  isHeadline: true,
  source: { org: "National ICT survey", method: "survey" },
  intlRefs: [{ org: "ITU", code: "i99H", name: "Internet users", url: "https://datahub.itu.int/" }],
  status: "published",
  lastUpdated: "2026-10-15",
  definition:
    "Share of people who used the Internet from any location in the last **3 months**. See the [ITU manual](https://example.org).",
  computation: "$$\\text{value} = 100 \\times \\frac{N}{P}$$",
  coverage: { from: "2015", to: "2025", areas: 61 },
  qualityNotes: "Margin of error of ±2 points.",
  nextRelease: "2027-03",
  versions: [
    { version: 2, date: "2026-10-15", note: "2025 figures added" },
    { version: 1, date: "2025-10-01", note: "First release" },
  ],
  licence: "CC BY 4.0",
  related: [],
  dashboards: [],
};

const labels = {
  title: "Full metadata",
  close: "Close",
  code: "Code",
  definition: "Definition",
  computation: "Computation",
  unit: "Unit",
  periodicity: "Periodicity",
  source: "Source",
  intlRefs: "International references",
  disaggregations: "Breakdowns",
  coverage: "Coverage",
  quality: "Quality notes",
  versions: "Version history",
  licence: "Licence",
  reportIssue: "Report an issue",
};

function Demo({ data = indicator }: { data?: Indicator }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {labels.title}
      </Button>
      <MetadataDrawer
        indicator={data}
        display={{
          periodicity: "Annual",
          method: "Survey",
          coverage: "2015–2025, 61 areas",
          disaggregations: "Sex, age group, urban/rural",
        }}
        labels={labels}
        open={open}
        onOpenChange={setOpen}
        onReportIssue={() => setOpen(false)}
      />
    </>
  );
}

const meta = {
  title: "UI/MetadataDrawer",
  component: Demo,
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Full metadata" });
    await userEvent.click(trigger);
    const dialog = within(document.body).getByRole("dialog");
    await expect(dialog).toHaveTextContent("ACCESS.INTERNET_USERS");
    await waitFor(() => expect(dialog.querySelector(".katex")).not.toBeNull());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const LongText: Story = {
  args: {
    data: {
      ...indicator,
      name: "Proportion of individuals in rural households who used a mobile phone to access the Internet",
      definition: `${indicator.definition} `.repeat(6),
    },
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
  },
};

export const Rtl: Story = {
  parameters: { direction: "rtl" },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
  },
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile360" } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
  },
};
