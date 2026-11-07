import { chartTokens } from "@onn/config/tokens";
import { formatValue } from "@onn/ui/format";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import topology from "../mocks/fixtures/SEN/geo/adm1.topo.json";
import { ChoroplethMap } from "./choropleth-map";
import { ChoroplethSvg } from "./choropleth-svg";
import { choropleth, type ClassMethod } from "./classify";
import { MapLegend } from "./map-legend";

const codes = Array.from({ length: 14 }, (_, i) => `SN-${String(i + 1).padStart(2, "0")}`);
const sample = Object.fromEntries(codes.map((code, i) => [code, 98 - i * 4.3]));
const names = Object.fromEntries(
  (
    topology as {
      objects: { areas: { geometries: { properties: { code: string; name: string } }[] } };
    }
  ).objects.areas.geometries.map((g) => [g.properties.code, g.properties.name]),
);

function MapStory({
  values,
  method = "quantile",
  interactive = false,
  title = "4G population coverage by region, 2025",
}: {
  values: Record<string, number | null>;
  method?: ClassMethod;
  interactive?: boolean;
  title?: string;
}) {
  const [selected, setSelected] = useState<string>();
  const { fills, classes, noData } = choropleth(values, method, chartTokens.sequential);
  const labels = Object.fromEntries(
    Object.entries(values).map(([code, value]) => [
      code,
      `${names[code] ?? code}: ${formatValue(value, "pct", "en-SN")}`,
    ]),
  );
  const svg = (
    <ChoroplethSvg
      id="story-map"
      topology={topology}
      codeProperty="code"
      fills={fills}
      labels={labels}
      title={title}
      selected={selected}
    />
  );
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_240px]">
      {interactive ? (
        <ChoroplethMap
          topology={topology}
          codeProperty="code"
          fills={fills}
          bbox={[-17.6, 12.3, -11.3, 16.7]}
          selected={selected}
          onSelect={setSelected}
          fallback={svg}
          height={480}
        />
      ) : (
        svg
      )}
      <MapLegend
        id="story"
        title="Population covered"
        classes={classes}
        rangeLabel={(item) =>
          `${formatValue(item.from, "pct", "en-SN")} – ${formatValue(item.to, "pct", "en-SN")}`
        }
        noData={{ label: "No data", count: noData }}
      />
    </div>
  );
}

const meta = {
  title: "Charts/ChoroplethMap",
  component: MapStory,
  args: { values: sample },
} satisfies Meta<typeof MapStory>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Server-rendered SVG: what every visitor sees first, and all they see without JavaScript. */
export const Default: Story = {};

export const NaturalBreaks: Story = { args: { method: "jenks" } };

export const EqualInterval: Story = { args: { method: "equal" } };

/** MapLibre, loaded when the map nears the viewport. Click a region to select it. */
export const Interactive: Story = { args: { interactive: true } };

export const Empty: Story = {
  args: {
    values: Object.fromEntries(codes.map((code, i) => [code, i < 10 ? null : 40 + i])),
  },
};

export const LongText: Story = {
  args: {
    title: "Share of the population covered by a 4G mobile signal, by administrative region, 2025",
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
