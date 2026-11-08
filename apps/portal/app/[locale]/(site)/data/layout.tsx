import type { ReactNode } from "react";
import { ExplorerFrame } from "@/components/explorer/explorer-frame";
import { DataShell } from "@/components/selector/data-shell";

export default function DataLayout({ children }: { children: ReactNode }) {
  return (
    <DataShell>
      <ExplorerFrame>{children}</ExplorerFrame>
    </DataShell>
  );
}
