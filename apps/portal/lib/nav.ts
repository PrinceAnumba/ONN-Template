export const PRIMARY_NAV = [
  { key: "data", href: "/data" },
  { key: "map", href: "/map" },
  { key: "dashboards", href: "/dashboards" },
  { key: "publications", href: "/publications" },
  { key: "news", href: "/news" },
  { key: "openData", href: "/open-data" },
  { key: "about", href: "/about" },
] as const;

export const EXPLORE_NAV = [
  { key: "data", href: "/data" },
  { key: "map", href: "/map" },
  { key: "dashboards", href: "/dashboards" },
  { key: "benchmark", href: "/benchmark" },
  { key: "query", href: "/query" },
  { key: "catalogue", href: "/catalogue" },
  { key: "openData", href: "/open-data" },
] as const;

export const ABOUT_NAV = [
  { key: "about", href: "/about" },
  { key: "methodology", href: "/about/methodology" },
  { key: "partners", href: "/about/partners" },
  { key: "privacy", href: "/legal/privacy" },
  { key: "terms", href: "/legal/terms" },
  { key: "accessibility", href: "/accessibility" },
  { key: "feedback", href: "/feedback" },
] as const;

/** Everything the command palette offers under Pages. */
export const SEARCHABLE_PAGES = [
  ...PRIMARY_NAV,
  ...EXPLORE_NAV.slice(3),
  ...ABOUT_NAV.slice(1),
  { key: "developers", href: "/developers" },
].filter((page, index, list) => list.findIndex((item) => item.key === page.key) === index);
