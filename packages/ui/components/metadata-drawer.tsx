"use client";

import type { Indicator } from "@onn/api-client/types";
import type { ReactNode } from "react";
import { Drawer } from "./drawer";
import { Markdown } from "./markdown";
import { Button } from "./ui/button";

export interface MetadataLabels {
  title: string;
  close: string;
  code: string;
  definition: string;
  computation: string;
  unit: string;
  periodicity: string;
  source: string;
  intlRefs: string;
  disaggregations: string;
  coverage: string;
  quality: string;
  versions: string;
  licence: string;
  reportIssue: string;
}

export interface MetadataDrawerProps {
  indicator: Indicator;
  /** Already translated text for periodicity, method and coverage. */
  display: { periodicity: string; method: string; coverage: string; disaggregations: string };
  labels: MetadataLabels;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReportIssue: () => void;
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="border-b py-3 last:border-0">
      <dt className="text-muted-foreground text-sm">{term}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

const SEPARATOR = " · ";

/** Full indicator metadata (brief §5.3). */
export function MetadataDrawer({
  indicator,
  display,
  labels,
  open,
  onOpenChange,
  onReportIssue,
}: MetadataDrawerProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={indicator.name}
      description={labels.title}
      closeLabel={labels.close}
    >
      <dl>
        <Row term={labels.code}>
          <code>{indicator.code}</code>
        </Row>
        <Row term={labels.definition}>
          <Markdown source={indicator.definition} />
        </Row>
        {indicator.computation && (
          <Row term={labels.computation}>
            <Markdown source={indicator.computation} />
          </Row>
        )}
        <Row term={labels.unit}>
          {indicator.unitVariants.map((variant) => variant.label).join(SEPARATOR)}
        </Row>
        <Row term={labels.periodicity}>{display.periodicity}</Row>
        <Row term={labels.source}>
          {indicator.source.org}
          {SEPARATOR}
          {display.method}
        </Row>
        {indicator.intlRefs.length > 0 && (
          <Row term={labels.intlRefs}>
            <ul>
              {indicator.intlRefs.map((ref) => (
                <li key={`${ref.org}-${ref.code}`}>
                  <a href={ref.url} rel="noreferrer" className="text-primary underline">
                    {ref.org}
                    {SEPARATOR}
                    {ref.code}
                  </a>
                </li>
              ))}
            </ul>
          </Row>
        )}
        {indicator.disaggregations.length > 0 && (
          <Row term={labels.disaggregations}>{display.disaggregations}</Row>
        )}
        <Row term={labels.coverage}>{display.coverage}</Row>
        {indicator.qualityNotes && <Row term={labels.quality}>{indicator.qualityNotes}</Row>}
        <Row term={labels.versions}>
          <ol>
            {indicator.versions.map((version) => (
              <li key={version.version}>
                <span className="tabular-nums">{version.date}</span>
                {SEPARATOR}
                {version.note}
              </li>
            ))}
          </ol>
        </Row>
        <Row term={labels.licence}>{indicator.licence}</Row>
      </dl>
      <Button variant="secondary" className="mt-4" onClick={onReportIssue}>
        {labels.reportIssue}
      </Button>
    </Drawer>
  );
}
