"use client";

import { Drawer } from "@onn/ui/components/drawer";
import type { TreePillar } from "@/lib/explorer-tree";
import { IndicatorTree, type TreeLabels } from "./indicator-tree";

export default function TreeDrawer({
  open,
  onOpenChange,
  title,
  close,
  tree,
  labels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  close: string;
  tree: TreePillar[];
  labels: TreeLabels;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={title} closeLabel={close} side="left">
      <IndicatorTree tree={tree} labels={labels} onNavigate={() => onOpenChange(false)} />
    </Drawer>
  );
}
