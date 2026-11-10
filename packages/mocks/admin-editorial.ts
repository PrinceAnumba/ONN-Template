// Back-office mock for Phase 7f (brief §7): news with its watch queue, CMS pages and the home
// modules. Publishing writes the public fixture in place and refreshes the portal, as dashboards
// and publications do. Uploaded pictures are kept in memory and served from /media.
import { can } from "@onn/api-client/permissions";
import type {
  CmsBlock,
  ContentStatus,
  HomeModules,
  HomeModulesAdmin,
  MediaUpload,
  NewsAdmin,
  NewsAdminSummary,
  NewsRecord,
  NewsStatus,
  Page,
  PageAdmin,
  PageAdminSummary,
  PageBlock,
  PageRecord,
  WatchItem,
  WatchQueue,
  WatchSettings,
  WatchStatus,
} from "@onn/api-client/types";
import { HttpResponse, type RequestHandler } from "msw";
import type { RouteContext } from "./admin";
import type { StoredFile } from "./admin-content";
import type { AdminState, StoredUser } from "./admin-seed";
import type { Fixtures } from "./fixtures";

type Method = "get" | "post" | "put" | "patch" | "delete";
type Text = Record<string, string>;
type FieldError = { path: string; message: string };

export interface StoredNews extends NewsRecord {
  slug: string;
  kind: "news" | "watch";
  status: NewsStatus;
  publishAt?: string;
  updated: string;
}

export interface StoredWatch extends Omit<WatchItem, "article"> {
  article?: string;
}

export interface StoredPage extends PageRecord {
  slug: string;
  status: ContentStatus;
  updated: string;
  /** What the portal shows, so "changed" can be worked out. */
  live: PageRecord;
}

export interface StoredHome extends HomeModules {
  status: ContentStatus;
  updated: string;
  live: HomeModules;
}

export interface EditorialState {
  news: StoredNews[];
  watch: StoredWatch[];
  watchSettings: WatchSettings;
  pages: StoredPage[];
  home: StoredHome;
  media: Map<string, StoredFile>;
  /** Publishes scheduled articles that are due; the public news routes call it too. */
  tick: () => void;
}

export interface EditorialDeps {
  authed: (
    method: Method,
    path: string,
    resolver: (ctx: RouteContext & { user: StoredUser }) => Response | Promise<Response>,
  ) => RequestHandler;
  problem: (status: number, title: string, detail?: string) => Response;
  state: AdminState;
  locales: string[];
  defaultLocale: string;
  /** Published indicator codes, for the home modules. */
  indicatorCodes: () => string[];
  /** The public stores the portal reads (fixtures, edited in place). */
  publicNews: Fixtures["news"];
  publicPages: Fixtures["pages"];
  publicHome: Fixtures["home"];
  revalidate: (tags: string[]) => void;
}

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const WEB = /^https?:\/\/[^\s/]+\.[^\s]+$/i;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};
const NEWS_STATUSES: NewsStatus[] = ["draft", "scheduled", "published"];
const WATCH_STATUSES: WatchStatus[] = ["pending", "approved", "rejected"];
const BLOCK_TYPES: CmsBlock["type"][] = ["richText", "image", "callout", "table", "partners"];
const PAGE_SIZES = [25, 50, 100];
const MAX_TAGS = 10;
const MAX_CHIPS = 8;
const MAX_FEATURED = 8;
const MAX_ROWS = 30;
const MAX_COLUMNS = 6;
/** Addresses the admin uses for its own screens. */
const RESERVED = ["new", "watch"];

/** Stories the collector "found", in the language they were written in (stored content). */
const WATCH_SEED: { lang: string; title: string; excerpt: string; keywords: string[] }[] = [
  {
    lang: "fr",
    title: "Démonstration : un opérateur annonce l'extension de son réseau 4G",
    excerpt: "Texte de démonstration collecté automatiquement. Il ne décrit aucun événement réel.",
    keywords: ["4G", "couverture"],
  },
  {
    lang: "en",
    title: "Demo: regional report compares mobile broadband prices",
    excerpt: "Demo text collected automatically. It does not describe a real event.",
    keywords: ["broadband", "prices"],
  },
  {
    lang: "fr",
    title: "Démonstration : lancement d'un programme de compétences numériques",
    excerpt: "Texte de démonstration collecté automatiquement, à relire avant publication.",
    keywords: ["compétences numériques"],
  },
  {
    lang: "en",
    title: "Demo: new submarine cable expected to add capacity",
    excerpt: "Demo text collected automatically, to be checked before it is published.",
    keywords: ["submarine cable", "capacity"],
  },
  {
    lang: "fr",
    title: "Démonstration : consultation publique sur l'identité numérique",
    excerpt: "Texte de démonstration collecté automatiquement.",
    keywords: ["identité numérique"],
  },
  {
    lang: "en",
    title: "Demo: survey looks at internet use among small businesses",
    excerpt: "Demo text collected automatically.",
    keywords: ["internet use", "SMEs"],
  },
  {
    lang: "fr",
    title: "Démonstration : un article sans rapport avec le numérique",
    excerpt: "Texte de démonstration qui illustre un élément écarté.",
    keywords: ["réseau"],
  },
];

const invalid = (errors: FieldError[]) =>
  HttpResponse.json(
    { type: "validation", title: "Invalid", status: 422, errors },
    { status: 422, headers: { "Content-Type": "application/problem+json" } },
  );
const typed = (status: number, type: string, title: string) =>
  HttpResponse.json(
    { type, title, status },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
const clone = <T>(value: T): T => structuredClone(value);
const isText = (value: unknown): value is Text =>
  Boolean(value) &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.values(value as object).every((item) => typeof item === "string");
const cleanText = (value: unknown, locales: string[]): Text =>
  isText(value)
    ? Object.fromEntries(
        locales.filter((locale) => value[locale]?.trim()).map((locale) => [locale, value[locale]!]),
      )
    : {};
const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
/** Whether rich text holds anything a reader would see. */
const hasWords = (html: string | undefined) =>
  Boolean(
    html
      ?.replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim(),
  );

/** The seeded articles are Markdown; the editor works in HTML. Covers what the seed uses. */
export function seedMarkdownToHtml(source: string) {
  const inline = (text: string) =>
    escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
  return source
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const heading = /^(#{2,3})\s+(.*)$/.exec(chunk);
      if (heading) {
        const level = heading[1]!.length;
        return `<h${level}>${inline(heading[2]!)}</h${level}>`;
      }
      const lines = chunk.split("\n");
      if (lines.every((line) => line.startsWith("- "))) {
        return `<ul>${lines.map((line) => `<li><p>${inline(line.slice(2))}</p></li>`).join("")}</ul>`;
      }
      return `<p>${inline(lines.join(" "))}</p>`;
    })
    .join("");
}

const mapText = (value: unknown, change: (text: string) => string): Text =>
  Object.fromEntries(
    Object.entries((value ?? {}) as Text).map(([locale, text]) => [locale, change(text)]),
  );

const homeModules = (home: Record<string, unknown>): HomeModules => ({
  exampleChips: clone((home.exampleChips ?? []) as HomeModules["exampleChips"]),
  featuredIndicators: [...((home.featuredIndicators ?? []) as string[])],
  mapTeaserIndicator: String(home.mapTeaserIndicator ?? ""),
  benchmarkIndicator: String(home.benchmarkIndicator ?? ""),
});

/** Everything published as the fixtures have it, plus a watch queue to work through. */
export function seedEditorial(data: Fixtures, now: Date): EditorialState {
  const at = now.toISOString();
  const news: StoredNews[] = data.news.map((item) => {
    const record: StoredNews = {
      slug: item.slug as string,
      kind: item.kind as StoredNews["kind"],
      title: { ...(item.title as unknown as Text) },
      excerpt: { ...(item.excerpt as unknown as Text) },
      body: mapText(item.body, seedMarkdownToHtml),
      tags: [...(item.tags as string[])],
      date: item.date as string,
      status: "published",
      updated: `${item.date}T09:00:00.000Z`,
    };
    if (item.sourceUrl) record.sourceUrl = item.sourceUrl as string;
    if (item.imageUrl) record.imageUrl = item.imageUrl as string;
    return record;
  });
  const sources = [
    { name: "Agence de presse (démo)", url: "https://example.org/agence", enabled: true },
    { name: "Regional telecom news (demo)", url: "https://example.org/telecom", enabled: true },
    { name: "Blog institutionnel (démo)", url: "https://example.org/blog", enabled: false },
  ];
  const watch: StoredWatch[] = WATCH_SEED.map((seed, index) => {
    const source = sources[index % 2]!;
    return {
      id: `W-${index + 1}`,
      ...seed,
      source: source.name,
      sourceUrl: `${source.url}/${index + 1}`,
      found: new Date(now.getTime() - (index * 7 + 3) * HOUR).toISOString(),
      status: index === WATCH_SEED.length - 1 ? "rejected" : "pending",
    };
  });
  const pages: StoredPage[] = data.pages.map((item) => {
    const record = clone({
      title: item.title as unknown as Text,
      blocks: item.blocks as unknown as PageBlock[],
    });
    return {
      slug: item.slug as string,
      ...clone(record),
      status: "published",
      updated: new Date(now.getTime() - 20 * DAY).toISOString(),
      live: record,
    };
  });
  const modules = homeModules(data.home);
  return {
    news,
    watch,
    watchSettings: {
      keywords: [
        "4G",
        "5G",
        "fibre",
        "haut débit",
        "broadband",
        "identité numérique",
        "cybersécurité",
      ],
      sources,
    },
    pages,
    home: { ...clone(modules), status: "published", updated: at, live: modules },
    media: new Map(),
    tick: () => {},
  };
}

export function createEditorialHandlers(deps: EditorialDeps) {
  const { authed, problem, state, locales, defaultLocale } = deps;
  const editorial = state.editorial;
  const pick = (value: Text | undefined, locale: string) =>
    value?.[locale] || value?.[defaultLocale] || Object.values(value ?? {})[0] || "";
  const forbidden = () => typed(403, "role", "Your role can't edit content");
  const guard = (user: StoredUser) => can(user.roles, "content.edit");
  const now = () => new Date().toISOString();
  const today = () => now().slice(0, 10);

  // ---- News ----
  const newsTags = (slug: string) => ["news", `news:${slug}`, "home"];
  const findNews = (slug: string) => editorial.news.find((item) => item.slug === slug);
  const newsAdmin = (item: StoredNews): NewsAdmin => clone(item);
  const writePublicNews = (item: StoredNews) => {
    const entry = {
      slug: item.slug,
      kind: item.kind,
      title: item.title,
      excerpt: item.excerpt,
      body: item.body,
      date: item.date,
      tags: item.tags,
      sourceUrl: item.sourceUrl,
      imageUrl: item.imageUrl,
    } as unknown as Fixtures["news"][number];
    const index = deps.publicNews.findIndex((news) => news.slug === item.slug);
    if (index >= 0) deps.publicNews[index] = entry;
    else deps.publicNews.push(entry);
  };
  const removePublicNews = (slug: string) => {
    const index = deps.publicNews.findIndex((news) => news.slug === slug);
    if (index >= 0) deps.publicNews.splice(index, 1);
  };
  const goLive = (item: StoredNews) => {
    item.status = "published";
    delete item.publishAt;
    item.updated = now();
    writePublicNews(item);
    deps.revalidate(newsTags(item.slug));
    // A watch item opened for editing counts as approved once its article is out.
    for (const found of editorial.watch) {
      if (found.article === item.slug && found.status === "pending") found.status = "approved";
    }
  };
  /** Scheduled articles go live when their time has come (checked on each request). */
  const settleNews = () => {
    const time = Date.now();
    for (const item of editorial.news) {
      if (item.status === "scheduled" && item.publishAt && Date.parse(item.publishAt) <= time) {
        goLive(item);
      }
    }
  };
  editorial.tick = settleNews;
  const newsErrors = (input: Partial<NewsRecord>) => {
    const errors: FieldError[] = [];
    const at = (path: string, message: string) => errors.push({ path, message });
    const title = cleanText(input.title, locales);
    if (!title[defaultLocale]) at(`title.${defaultLocale}`, "required");
    const excerpt = cleanText(input.excerpt, locales);
    if (!excerpt[defaultLocale]) at(`excerpt.${defaultLocale}`, "required");
    const body = Object.fromEntries(
      Object.entries(cleanText(input.body, locales)).filter(([, html]) => hasWords(html)),
    );
    if (!body[defaultLocale]) at(`body.${defaultLocale}`, "required");
    const tags = [
      ...new Set((Array.isArray(input.tags) ? input.tags : []).map((tag) => String(tag).trim())),
    ].filter(Boolean);
    if (tags.length > MAX_TAGS) at("tags", "count");
    else if (tags.some((tag) => tag.length > 40)) at("tags", "length");
    const date = String(input.date ?? "");
    if (!DATE.test(date) || Number.isNaN(Date.parse(date)))
      at("date", date ? "format" : "required");
    const sourceUrl = String(input.sourceUrl ?? "").trim();
    if (sourceUrl && !WEB.test(sourceUrl)) at("sourceUrl", "url");
    const imageUrl = String(input.imageUrl ?? "").trim();
    if (imageUrl && !imageUrl.startsWith("/") && !WEB.test(imageUrl)) at("imageUrl", "url");
    return {
      errors,
      value: {
        title,
        excerpt,
        body,
        tags,
        date,
        ...(sourceUrl ? { sourceUrl } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      } satisfies NewsRecord,
    };
  };
  const slugErrors = (slug: string): FieldError[] => {
    if (!slug) return [{ path: "slug", message: "required" }];
    if (!SLUG.test(slug)) return [{ path: "slug", message: "format" }];
    if (RESERVED.includes(slug) || findNews(slug)) return [{ path: "slug", message: "duplicate" }];
    return [];
  };
  const freeSlug = (text: string) => {
    const base =
      text
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50)
        .replace(/-+$/, "") || "watch";
    let slug = base;
    for (let n = 2; RESERVED.includes(slug) || findNews(slug); n++) slug = `${base}-${n}`;
    return slug;
  };

  // ---- Watch queue ----
  const findWatch = (id: string) => editorial.watch.find((item) => item.id === id);
  const queue = (status: WatchStatus): WatchQueue => ({
    items: editorial.watch
      .filter((item) => item.status === status)
      .sort((a, b) => b.found.localeCompare(a.found))
      .map((item) => clone(item)),
    counts: Object.fromEntries(
      WATCH_STATUSES.map((key) => [
        key,
        editorial.watch.filter((item) => item.status === key).length,
      ]),
    ) as Record<WatchStatus, number>,
    settings: clone(editorial.watchSettings),
  });
  /** The news item for a watch story, created on first use. */
  const articleFor = (item: StoredWatch) => {
    const existing = item.article ? findNews(item.article) : undefined;
    if (existing) return existing;
    // The portal needs text in the default language, so a story found in another one is copied
    // there until an editor translates it.
    const text = (value: string): Text => ({ [defaultLocale]: value, [item.lang]: value });
    const article: StoredNews = {
      slug: freeSlug(item.title),
      kind: "watch",
      title: text(item.title),
      excerpt: text(item.excerpt),
      body: text(`<p>${escapeHtml(item.excerpt)}</p>`),
      tags: [...item.keywords],
      date: today(),
      sourceUrl: item.sourceUrl,
      status: "draft",
      updated: now(),
    };
    editorial.news.push(article);
    item.article = article.slug;
    return article;
  };

  // ---- Pages ----
  const findPage = (slug: string) => editorial.pages.find((item) => item.slug === slug);
  const pageRecord = (item: PageRecord): PageRecord => ({ title: item.title, blocks: item.blocks });
  const pageAdmin = (item: StoredPage): PageAdmin => ({
    slug: item.slug,
    ...clone(pageRecord(item)),
    status: item.status,
    updated: item.updated,
  });
  const pageErrors = (input: Partial<PageRecord>) => {
    const errors: FieldError[] = [];
    const title = cleanText(input.title, locales);
    if (!title[defaultLocale]) errors.push({ path: `title.${defaultLocale}`, message: "required" });
    if (!Array.isArray(input.blocks)) {
      errors.push({ path: "blocks", message: "required" });
      return { errors, value: { title, blocks: [] } };
    }
    const blocks = input.blocks.map((raw, index): PageBlock => {
      const block = (raw ?? {}) as Partial<PageBlock>;
      const at = (field: string, message: string) =>
        errors.push({ path: `blocks.${index}.${field}`, message });
      const type = BLOCK_TYPES.includes(block.type as CmsBlock["type"])
        ? (block.type as CmsBlock["type"])
        : "richText";
      if (type !== block.type) at("type", "unknown");
      switch (type) {
        case "richText":
        case "callout": {
          const body = cleanText(block.body, locales);
          if (!body[defaultLocale]) at(`body.${defaultLocale}`, "required");
          return { type, body };
        }
        case "image": {
          const src = String(block.src ?? "").trim();
          if (!src) at("src", "required");
          else if (!src.startsWith("/") && !WEB.test(src)) at("src", "url");
          const alt = cleanText(block.alt, locales);
          if (!alt[defaultLocale]) at(`alt.${defaultLocale}`, "required");
          return { type, src, alt };
        }
        case "table": {
          const rows = (Array.isArray(block.rows) ? block.rows : []).map((row) =>
            (Array.isArray(row) ? row : []).map((cell) => cleanText(cell, locales)),
          );
          const columns = rows[0]?.length ?? 0;
          if (rows.length < 2 || columns === 0) at("rows", "required");
          else if (rows.length > MAX_ROWS || columns > MAX_COLUMNS) at("rows", "count");
          else if (rows.some((row) => row.length !== columns)) at("rows", "shape");
          else {
            rows[0]!.forEach((cell, column) => {
              if (!cell[defaultLocale]) at(`rows.0.${column}.${defaultLocale}`, "required");
            });
          }
          return { type, rows };
        }
        case "partners": {
          const list = Array.isArray(block.partners) ? block.partners : [];
          if (list.length === 0) at("partners", "required");
          const partners = list.map((raw, position) => {
            const partner = (raw ?? {}) as NonNullable<PageBlock["partners"]>[number];
            const name = cleanText(partner.name, locales);
            if (!name[defaultLocale]) at(`partners.${position}.name.${defaultLocale}`, "required");
            const url = String(partner.url ?? "").trim();
            if (url && !WEB.test(url)) at(`partners.${position}.url`, "url");
            return {
              name,
              ...(url ? { url } : {}),
              ...(partner.logo ? { logo: String(partner.logo) } : {}),
            };
          });
          return { type, partners };
        }
      }
    });
    return { errors, value: { title, blocks } satisfies PageRecord };
  };
  const writePublicPage = (item: StoredPage) => {
    const entry = {
      slug: item.slug,
      title: item.title,
      // The localiser reads `{}` as an object, not as missing text, so empty cells get the
      // default language's key.
      blocks: item.blocks.map((block) =>
        block.rows
          ? {
              ...block,
              rows: block.rows.map((row) =>
                row.map((cell) => (Object.keys(cell).length ? cell : { [defaultLocale]: "" })),
              ),
            }
          : block,
      ),
    } as unknown as Fixtures["pages"][number];
    const index = deps.publicPages.findIndex((page) => page.slug === item.slug);
    if (index >= 0) deps.publicPages[index] = entry;
    else deps.publicPages.push(entry);
  };

  // ---- Home modules ----
  const homeRecord = (item: HomeModules): HomeModules => ({
    exampleChips: item.exampleChips,
    featuredIndicators: item.featuredIndicators,
    mapTeaserIndicator: item.mapTeaserIndicator,
    benchmarkIndicator: item.benchmarkIndicator,
  });
  const homeAdmin = (): HomeModulesAdmin => ({
    ...clone(homeRecord(editorial.home)),
    status: editorial.home.status,
    updated: editorial.home.updated,
  });
  const homeErrors = (input: Partial<HomeModules>) => {
    const errors: FieldError[] = [];
    const at = (path: string, message: string) => errors.push({ path, message });
    const codes = new Set(deps.indicatorCodes());
    const chips = (Array.isArray(input.exampleChips) ? input.exampleChips : []).map(
      (raw, index) => {
        const chip = (raw ?? {}) as HomeModules["exampleChips"][number];
        const label = cleanText(chip.label, locales);
        if (!label[defaultLocale]) at(`exampleChips.${index}.label.${defaultLocale}`, "required");
        const href = String(chip.href ?? "").trim();
        if (!href) at(`exampleChips.${index}.href`, "required");
        else if (!href.startsWith("/") || href.startsWith("//"))
          at(`exampleChips.${index}.href`, "path");
        return { label, href };
      },
    );
    if (chips.length > MAX_CHIPS) at("exampleChips", "count");
    const featured = Array.isArray(input.featuredIndicators)
      ? input.featuredIndicators.map(String)
      : [];
    if (featured.length === 0) at("featuredIndicators", "required");
    else if (featured.length > MAX_FEATURED) at("featuredIndicators", "count");
    else if (new Set(featured).size !== featured.length) at("featuredIndicators", "duplicate");
    else if (featured.some((code) => !codes.has(code))) at("featuredIndicators", "unknown");
    const one = (key: "mapTeaserIndicator" | "benchmarkIndicator") => {
      const code = String(input[key] ?? "");
      if (!code) at(key, "required");
      else if (!codes.has(code)) at(key, "unknown");
      return code;
    };
    return {
      errors,
      value: {
        exampleChips: chips,
        featuredIndicators: featured,
        mapTeaserIndicator: one("mapTeaserIndicator"),
        benchmarkIndicator: one("benchmarkIndicator"),
      } satisfies HomeModules,
    };
  };

  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  return [
    // ---- Media ----
    authed("post", "/media", async ({ user, request }) => {
      if (!guard(user)) return forbidden();
      const form = await request.formData().catch(() => null);
      const entry = form?.get("image") ?? null;
      if (!entry || typeof entry === "string")
        return invalid([{ path: "image", message: "required" }]);
      const type = IMAGE_TYPES[entry.name.split(".").pop()?.toLowerCase() ?? ""];
      if (!type) return invalid([{ path: "image", message: "type" }]);
      const data = new Uint8Array(await entry.arrayBuffer());
      if (data.byteLength === 0) return invalid([{ path: "image", message: "empty" }]);
      if (data.byteLength > MAX_IMAGE_BYTES) return invalid([{ path: "image", message: "size" }]);
      const id = `m${editorial.media.size + 1}-${Date.now().toString(36)}`;
      editorial.media.set(id, { name: entry.name, type, data });
      const body: MediaUpload = {
        url: `/api/v1/media/${id}`,
        name: entry.name,
        bytes: data.byteLength,
      };
      return HttpResponse.json(body, { status: 201 });
    }),

    // ---- Watch queue (before /news/:slug so the paths can't be confused) ----
    authed("get", "/news-watch", ({ user, q }) => {
      if (!guard(user)) return forbidden();
      settleNews();
      const status = WATCH_STATUSES.find((item) => item === q.get("status")) ?? "pending";
      return HttpResponse.json(queue(status));
    }),

    authed("put", "/news-watch/settings", async ({ user, request }) => {
      if (!guard(user)) return forbidden();
      const input = (await request.json().catch(() => ({}))) as Partial<WatchSettings>;
      const errors: FieldError[] = [];
      const keywords = [
        ...new Set(
          (Array.isArray(input.keywords) ? input.keywords : []).map((item) => String(item).trim()),
        ),
      ].filter(Boolean);
      if (keywords.length === 0) errors.push({ path: "keywords", message: "required" });
      else if (keywords.length > 50) errors.push({ path: "keywords", message: "count" });
      const seen = new Set<string>();
      const sources = (Array.isArray(input.sources) ? input.sources : []).map((raw, index) => {
        const source = (raw ?? {}) as Partial<WatchSettings["sources"][number]>;
        const name = String(source.name ?? "").trim();
        const url = String(source.url ?? "").trim();
        if (!name) errors.push({ path: `sources.${index}.name`, message: "required" });
        if (!url) errors.push({ path: `sources.${index}.url`, message: "required" });
        else if (!WEB.test(url)) errors.push({ path: `sources.${index}.url`, message: "url" });
        else if (seen.has(url)) errors.push({ path: `sources.${index}.url`, message: "duplicate" });
        seen.add(url);
        return { name, url, enabled: source.enabled !== false };
      });
      if (errors.length) return invalid(errors);
      editorial.watchSettings = { keywords, sources };
      return HttpResponse.json(clone(editorial.watchSettings));
    }),

    authed("post", "/news-watch/:id/:action", ({ user, params }) => {
      if (!guard(user)) return forbidden();
      const item = findWatch(params.id!);
      if (!item) return problem(404, "Not found");
      switch (params.action) {
        case "approve": {
          if (item.status !== "pending") return typed(409, "state", "Already handled");
          const article = articleFor(item);
          if (article.status !== "published") goLive(article);
          item.status = "approved";
          break;
        }
        case "reject":
          if (item.status !== "pending") return typed(409, "state", "Already handled");
          item.status = "rejected";
          break;
        case "restore":
          if (item.status !== "rejected") return typed(409, "state", "Not rejected");
          item.status = "pending";
          break;
        case "draft":
          if (item.status === "rejected") return typed(409, "state", "Rejected");
          articleFor(item);
          break;
        default:
          return problem(404, "Not found");
      }
      return HttpResponse.json(clone(item));
    }),

    // ---- News ----
    authed("get", "/news", ({ user, q, locale }) => {
      if (!guard(user)) return forbidden();
      settleNews();
      const text = q.get("q")?.trim().toLowerCase();
      const status = NEWS_STATUSES.find((item) => item === q.get("status"));
      const kind = q.get("kind");
      const rows = editorial.news
        .filter((item) => !status || item.status === status)
        .filter((item) => (kind !== "news" && kind !== "watch" ? true : item.kind === kind))
        .filter(
          (item) =>
            !text ||
            [item.slug, ...Object.values(item.title), ...item.tags]
              .join(" ")
              .toLowerCase()
              .includes(text),
        )
        .sort((a, b) => b.date.localeCompare(a.date) || b.updated.localeCompare(a.updated));
      const requested = Number(q.get("pageSize"));
      const pageSize = PAGE_SIZES.includes(requested) ? requested : PAGE_SIZES[0]!;
      const pages = Math.max(1, Math.ceil(rows.length / pageSize));
      const page = Math.min(Math.max(1, Number(q.get("page")) || 1), pages);
      const body: Page<NewsAdminSummary> = {
        items: rows.slice((page - 1) * pageSize, page * pageSize).map((item) => ({
          slug: item.slug,
          title: pick(item.title, locale),
          kind: item.kind,
          status: item.status,
          date: item.date,
          tags: item.tags,
          ...(item.publishAt ? { publishAt: item.publishAt } : {}),
          updated: item.updated,
        })),
        meta: { total: rows.length, page, pageSize },
      };
      return HttpResponse.json(body);
    }),

    authed("post", "/news", async ({ user, request }) => {
      if (!guard(user)) return forbidden();
      const input = (await request.json().catch(() => ({}))) as Partial<NewsRecord> & {
        slug?: string;
      };
      const checked = newsErrors(input);
      const errors = [...checked.errors, ...slugErrors(String(input.slug ?? "").trim())];
      if (errors.length) return invalid(errors);
      const item: StoredNews = {
        slug: String(input.slug).trim(),
        kind: "news",
        ...checked.value,
        status: "draft",
        updated: now(),
      };
      editorial.news.push(item);
      return HttpResponse.json(newsAdmin(item), { status: 201 });
    }),

    authed("get", "/news/:slug", ({ user, params }) => {
      if (!guard(user)) return forbidden();
      settleNews();
      const item = findNews(params.slug!);
      return item ? HttpResponse.json(newsAdmin(item)) : problem(404, "Not found");
    }),

    authed("put", "/news/:slug", async ({ user, params, request }) => {
      if (!guard(user)) return forbidden();
      settleNews();
      const item = findNews(params.slug!);
      if (!item) return problem(404, "Not found");
      const input = (await request.json().catch(() => ({}))) as Partial<NewsRecord>;
      const checked = newsErrors(input);
      if (checked.errors.length) return invalid(checked.errors);
      delete item.sourceUrl;
      delete item.imageUrl;
      Object.assign(item, checked.value, { updated: now() });
      if (item.status === "published") {
        writePublicNews(item);
        deps.revalidate(newsTags(item.slug));
      }
      return HttpResponse.json(newsAdmin(item));
    }),

    // `at` in the future schedules the article; otherwise it goes live now.
    authed("post", "/news/:slug/publish", async ({ user, params, request }) => {
      if (!guard(user)) return forbidden();
      const item = findNews(params.slug!);
      if (!item) return problem(404, "Not found");
      const input = (await request.json().catch(() => ({}))) as { at?: string };
      const checked = newsErrors(item);
      if (checked.errors.length) return invalid(checked.errors);
      if (input.at) {
        const time = Date.parse(input.at);
        if (Number.isNaN(time)) return invalid([{ path: "at", message: "format" }]);
        if (time > Date.now()) {
          if (item.status === "published") {
            removePublicNews(item.slug);
            deps.revalidate(newsTags(item.slug));
          }
          item.status = "scheduled";
          item.publishAt = new Date(time).toISOString();
          item.updated = now();
          return HttpResponse.json(newsAdmin(item));
        }
      }
      goLive(item);
      return HttpResponse.json(newsAdmin(item));
    }),

    authed("post", "/news/:slug/unpublish", ({ user, params }) => {
      if (!guard(user)) return forbidden();
      const item = findNews(params.slug!);
      if (!item) return problem(404, "Not found");
      const wasLive = item.status === "published";
      item.status = "draft";
      delete item.publishAt;
      item.updated = now();
      if (wasLive) {
        removePublicNews(item.slug);
        deps.revalidate(newsTags(item.slug));
      }
      return HttpResponse.json(newsAdmin(item));
    }),

    // ---- Home modules (before /pages/:slug) ----
    authed("get", "/pages/home", ({ user }) =>
      guard(user) ? HttpResponse.json(homeAdmin()) : forbidden(),
    ),

    authed("put", "/pages/home", async ({ user, request }) => {
      if (!guard(user)) return forbidden();
      const input = (await request.json().catch(() => ({}))) as Partial<HomeModules>;
      const checked = homeErrors(input);
      if (checked.errors.length) return invalid(checked.errors);
      Object.assign(editorial.home, checked.value, { updated: now() });
      editorial.home.status = same(homeRecord(editorial.home), editorial.home.live)
        ? "published"
        : "changed";
      return HttpResponse.json(homeAdmin());
    }),

    authed("post", "/pages/home/publish", ({ user }) => {
      if (!guard(user)) return forbidden();
      const checked = homeErrors(editorial.home);
      if (checked.errors.length) return invalid(checked.errors);
      editorial.home.live = clone(homeRecord(editorial.home));
      editorial.home.status = "published";
      editorial.home.updated = now();
      Object.assign(deps.publicHome, clone(editorial.home.live), { lastUpdated: today() });
      deps.revalidate(["home"]);
      return HttpResponse.json(homeAdmin());
    }),

    // ---- Pages ----
    authed("get", "/pages", ({ user, locale }) => {
      if (!guard(user)) return forbidden();
      return HttpResponse.json(
        editorial.pages.map((item): PageAdminSummary => ({
          slug: item.slug,
          title: pick(item.title, locale),
          blockCount: item.blocks.length,
          status: item.status,
          updated: item.updated,
        })),
      );
    }),

    authed("get", "/pages/:slug", ({ user, params }) => {
      if (!guard(user)) return forbidden();
      const item = findPage(params.slug!);
      return item ? HttpResponse.json(pageAdmin(item)) : problem(404, "Not found");
    }),

    authed("put", "/pages/:slug", async ({ user, params, request }) => {
      if (!guard(user)) return forbidden();
      const item = findPage(params.slug!);
      if (!item) return problem(404, "Not found");
      const input = (await request.json().catch(() => ({}))) as Partial<PageRecord>;
      const checked = pageErrors(input);
      if (checked.errors.length) return invalid(checked.errors);
      Object.assign(item, checked.value, { updated: now() });
      item.status = same(pageRecord(item), item.live) ? "published" : "changed";
      return HttpResponse.json(pageAdmin(item));
    }),

    authed("post", "/pages/:slug/publish", ({ user, params }) => {
      if (!guard(user)) return forbidden();
      const item = findPage(params.slug!);
      if (!item) return problem(404, "Not found");
      const checked = pageErrors(item);
      if (checked.errors.length) return invalid(checked.errors);
      item.live = clone(pageRecord(item));
      item.status = "published";
      item.updated = now();
      writePublicPage(item);
      deps.revalidate([`page:${item.slug}`]);
      return HttpResponse.json(pageAdmin(item));
    }),
  ];
}
