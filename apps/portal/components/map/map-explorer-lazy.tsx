"use client";

import dynamic from "next/dynamic";

/**
 * The map explorer as a separate chunk, for pages where it is one view among several (the
 * indicator page). Still server-rendered; its JS loads only when the map view is shown.
 */
export const MapExplorerLazy = dynamic(() =>
  import("./map-explorer").then((mod) => mod.MapExplorer),
);
