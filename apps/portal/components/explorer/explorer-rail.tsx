"use client";

import { Button } from "@onn/ui/components/ui/button";
import { ListTreeIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import type { TreePillar } from "@/lib/explorer-tree";
import { IndicatorTree, type TreeLabels } from "./indicator-tree";

const TreeDrawer = dynamic(() => import("./tree-drawer"), { ssr: false });

/**
 * The tree as a sticky left rail at ≥ 1024 px, and behind a "Browse indicators" button opening
 * a left drawer below that (brief §5.2). The drawer's code loads on first use.
 */
export function ExplorerRail({
  tree,
  labels,
  browse,
  close,
}: {
  tree: TreePillar[];
  labels: TreeLabels;
  browse: string;
  close: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  if (!tree.length) return null;
  return (
    <>
      <nav
        aria-label={labels.tree}
        className="sticky top-[73px] hidden max-h-[calc(100dvh-73px)] w-72 shrink-0 overflow-y-auto py-6 pe-2 lg:block"
      >
        <IndicatorTree tree={tree} labels={labels} />
      </nav>
      <div className="pt-4 lg:hidden">
        <Button
          ref={trigger}
          variant="secondary"
          onClick={() => {
            setMounted(true);
            setOpen(true);
          }}
        >
          <ListTreeIcon aria-hidden />
          {browse}
        </Button>
        {mounted && (
          <TreeDrawer
            open={open}
            onOpenChange={setOpen}
            title={browse}
            close={close}
            tree={tree}
            labels={labels}
          />
        )}
      </div>
    </>
  );
}
