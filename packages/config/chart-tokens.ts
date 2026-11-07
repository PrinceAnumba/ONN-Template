// Written by generate.ts from the active country's brand, so no colour maths ships to the browser.
import generated from "./generated/tokens.json";
import type { ChartTokens } from "./tokens";

export const chartTokens = generated as ChartTokens;
export type { ChartTokens };
