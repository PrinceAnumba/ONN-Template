import type {
  CmsPage,
  HomeData,
  HomeModulesAdmin,
  MediaUpload,
  NewsAdmin,
  NewsAdminSummary,
  NewsItem,
  Page,
  PageAdmin,
  PageAdminSummary,
  Problem,
  WatchItem,
  WatchQueue,
  WatchSettings,
} from "@onn/api-client/types";
import SEN from "@onn/config/countries/SEN";
import { getResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedMarkdownToHtml } from "./admin-editorial";
import { generateFixtures } from "./fixtures";
import { createHandlers } from "./handlers";
import { loadBoundaries } from "./load";

const onPublished = vi.fn();
const handlers = createHandlers(generateFixtures(SEN, 42, loadBoundaries("SEN")), {
  latency: [0, 0],
  onPublished,
});

async function call(
  path: string,
  user: string | null,
  init: { method?: string; body?: unknown; form?: FormData } = {},
) {
  const headers = new Headers({ "Accept-Language": "en" });
  if (user) headers.set("Authorization", `Bearer ${user}`);
  let body: BodyInit | undefined;
  if (init.form) body = init.form;
  else if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.body);
  }
  const response = await getResponse(
    handlers,
    new Request(`http://localhost/api/v1${path}`, {
      method: init.method ?? (body ? "POST" : "GET"),
      headers,
      body,
    }),
  );
  if (!response) throw new Error(`No handler for ${path}`);
  return response;
}
const json = async <T>(response: Response) => (await response.json()) as T;
const article = (slug: string, title = "Article de test") => ({
  slug,
  title: { fr: title },
  excerpt: { fr: "Résumé" },
  body: { fr: "<p>Texte</p>" },
  tags: ["test", "test", " 5G "],
  date: "2026-03-01",
});

beforeEach(() => onPublished.mockClear());
afterEach(() => vi.useRealTimers());

describe("news", () => {
  it("lists the seeded items as published, with HTML bodies, and hides them from contributors", async () => {
    const list = await json<Page<NewsAdminSummary>>(await call("/admin/news", "u-editor"));
    expect(list.meta.total).toBe(18);
    expect(list.items.every((item) => item.status === "published")).toBe(true);
    const item = await json<NewsAdmin>(
      await call(`/admin/news/${list.items[0]!.slug}`, "u-editor"),
    );
    expect(item.body.fr).toMatch(/^<p>.*<h2>.*<ul><li>/);
    expect((await call("/admin/news", "u-contributor")).status).toBe(403);
    expect((await call("/admin/news", null)).status).toBe(401);
  });

  it("filters by text, kind and status", async () => {
    const watch = await json<Page<NewsAdminSummary>>(
      await call("/admin/news?kind=watch", "u-editor"),
    );
    expect(watch.items.length).toBe(6);
    const drafts = await json<Page<NewsAdminSummary>>(
      await call("/admin/news?status=draft&q=5G", "u-editor"),
    );
    expect(drafts.meta.total).toBe(0);
  });

  it("refuses bad input with field paths", async () => {
    const response = await call("/admin/news", "u-editor", {
      body: {
        slug: "new",
        title: { en: "Only English" },
        body: { fr: "<p> </p>" },
        date: "soon",
        sourceUrl: "ftp://x",
      },
    });
    expect(response.status).toBe(422);
    const paths = (await json<Problem>(response)).errors!.map(
      (error) => `${error.path}:${error.message}`,
    );
    expect(paths).toEqual(
      expect.arrayContaining([
        "slug:duplicate",
        "title.fr:required",
        "excerpt.fr:required",
        "body.fr:required",
        "date:format",
        "sourceUrl:url",
      ]),
    );
  });

  it("keeps a draft off the portal until it is published, then unpublishes it", async () => {
    const created = await call("/admin/news", "u-editor", { body: article("essai-brouillon") });
    expect(created.status).toBe(201);
    expect((await json<NewsAdmin>(created)).tags).toEqual(["test", "5G"]);
    expect((await call("/news/essai-brouillon", null)).status).toBe(404);
    expect(onPublished).not.toHaveBeenCalled();

    const live = await json<NewsAdmin>(
      await call("/admin/news/essai-brouillon/publish", "u-editor", { body: {} }),
    );
    expect(live.status).toBe("published");
    expect(onPublished).toHaveBeenCalledWith(["news", "news:essai-brouillon", "home"]);
    const shown = await json<NewsItem>(await call("/news/essai-brouillon", null));
    expect(shown.title).toBe("Article de test");
    expect(shown.fallback).toBe(true);

    // Saving a live article updates the portal at once.
    await call("/admin/news/essai-brouillon", "u-editor", {
      method: "PUT",
      body: { ...article("x", "Titre corrigé"), title: { fr: "Titre corrigé", en: "Fixed" } },
    });
    expect((await json<NewsItem>(await call("/news/essai-brouillon", null))).title).toBe("Fixed");

    await call("/admin/news/essai-brouillon/unpublish", "u-editor", { body: {} });
    expect((await call("/news/essai-brouillon", null)).status).toBe(404);
  });

  it("publishes a scheduled article when its time comes", async () => {
    vi.useFakeTimers({ now: new Date("2026-05-01T08:00:00Z"), toFake: ["Date"] });
    await call("/admin/news", "u-editor", { body: article("essai-programme") });
    const scheduled = await json<NewsAdmin>(
      await call("/admin/news/essai-programme/publish", "u-editor", {
        body: { at: "2026-05-02T08:00:00Z" },
      }),
    );
    expect(scheduled.status).toBe("scheduled");
    expect(scheduled.publishAt).toBe("2026-05-02T08:00:00.000Z");
    expect((await call("/news/essai-programme", null)).status).toBe(404);

    vi.setSystemTime(new Date("2026-05-02T08:00:01Z"));
    expect((await call("/news/essai-programme", null)).status).toBe(200);
    const after = await json<NewsAdmin>(await call("/admin/news/essai-programme", "u-editor"));
    expect(after.status).toBe("published");
    expect(after.publishAt).toBeUndefined();
    expect(onPublished).toHaveBeenCalledWith(["news", "news:essai-programme", "home"]);
  });
});

describe("watch queue", () => {
  it("approves a story onto the portal, rejects and restores another", async () => {
    const before = await json<WatchQueue>(await call("/admin/news-watch", "u-editor"));
    expect(before.counts).toEqual({ pending: 6, approved: 0, rejected: 1 });
    const [first, second] = before.items;

    const approved = await json<WatchItem>(
      await call(`/admin/news-watch/${first!.id}/approve`, "u-editor", { body: {} }),
    );
    expect(approved.status).toBe("approved");
    const shown = await json<NewsItem>(await call(`/news/${approved.article}`, null));
    expect(shown.kind).toBe("watch");
    expect(shown.sourceUrl).toBe(first!.sourceUrl);
    expect(
      (await call(`/admin/news-watch/${first!.id}/approve`, "u-editor", { body: {} })).status,
    ).toBe(409);

    await call(`/admin/news-watch/${second!.id}/reject`, "u-editor", { body: {} });
    const rejected = await json<WatchQueue>(
      await call("/admin/news-watch?status=rejected", "u-editor"),
    );
    expect(rejected.items.map((item) => item.id)).toContain(second!.id);
    await call(`/admin/news-watch/${second!.id}/restore`, "u-editor", { body: {} });
    const after = await json<WatchQueue>(await call("/admin/news-watch", "u-editor"));
    expect(after.counts).toEqual({ pending: 5, approved: 1, rejected: 1 });
  });

  it("opens a story as a draft, and counts it approved once that draft is published", async () => {
    const queue = await json<WatchQueue>(await call("/admin/news-watch", "u-editor"));
    const item = queue.items.at(-1)!;
    const drafted = await json<WatchItem>(
      await call(`/admin/news-watch/${item.id}/draft`, "u-editor", { body: {} }),
    );
    expect(drafted.status).toBe("pending");
    const draft = await json<NewsAdmin>(await call(`/admin/news/${drafted.article}`, "u-editor"));
    expect(draft.status).toBe("draft");
    expect(draft.title.fr).toBe(item.title);
    // Asking again reuses the same draft.
    const again = await json<WatchItem>(
      await call(`/admin/news-watch/${item.id}/draft`, "u-editor", { body: {} }),
    );
    expect(again.article).toBe(drafted.article);

    await call(`/admin/news/${drafted.article}/publish`, "u-editor", { body: {} });
    const approved = await json<WatchQueue>(
      await call("/admin/news-watch?status=approved", "u-editor"),
    );
    expect(approved.items.map((entry) => entry.id)).toContain(item.id);
  });

  it("saves keyword and source settings", async () => {
    const bad = await call("/admin/news-watch/settings", "u-editor", {
      method: "PUT",
      body: { keywords: [" "], sources: [{ name: "", url: "nope" }] },
    });
    expect((await json<Problem>(bad)).errors!.map((error) => error.path)).toEqual([
      "keywords",
      "sources.0.name",
      "sources.0.url",
    ]);
    const saved = await json<WatchSettings>(
      await call("/admin/news-watch/settings", "u-editor", {
        method: "PUT",
        body: {
          keywords: ["fibre", "fibre", "IA"],
          sources: [{ name: "Demo", url: "https://example.org/feed", enabled: false }],
        },
      }),
    );
    expect(saved).toEqual({
      keywords: ["fibre", "IA"],
      sources: [{ name: "Demo", url: "https://example.org/feed", enabled: false }],
    });
  });
});

describe("pages", () => {
  it("lists the CMS pages with their text in every language", async () => {
    const list = await json<PageAdminSummary[]>(await call("/admin/pages", "u-editor"));
    expect(list.map((item) => item.slug)).toEqual([
      "about",
      "methodology",
      "partners",
      "privacy",
      "terms",
      "accessibility",
    ]);
    const page = await json<PageAdmin>(await call("/admin/pages/methodology", "u-editor"));
    expect(page.title).toEqual({ fr: "Méthodologie", en: "Methodology" });
    expect(page.blocks.at(-1)!.rows![0]![0]).toEqual({ fr: "Étape", en: "Step" });
    expect((await call("/admin/pages", "u-reader")).status).toBe(403);
  });

  it("saves a draft without touching the portal, then publishes it", async () => {
    const page = await json<PageAdmin>(await call("/admin/pages/terms", "u-editor"));
    const blocks = [
      ...page.blocks,
      { type: "callout", body: { fr: "Nouvel encadré", en: "New callout" } },
    ];
    const saved = await json<PageAdmin>(
      await call("/admin/pages/terms", "u-editor", {
        method: "PUT",
        body: { title: page.title, blocks },
      }),
    );
    expect(saved.status).toBe("changed");
    expect((await json<CmsPage>(await call("/pages/terms", null))).blocks.length).toBe(
      page.blocks.length,
    );
    expect(onPublished).not.toHaveBeenCalled();

    const live = await json<PageAdmin>(
      await call("/admin/pages/terms/publish", "u-editor", { body: {} }),
    );
    expect(live.status).toBe("published");
    expect(onPublished).toHaveBeenCalledWith(["page:terms"]);
    const shown = await json<CmsPage>(await call("/pages/terms", null));
    expect(shown.blocks.at(-1)).toEqual({ type: "callout", body: "New callout" });

    // Saving the published content again is not a change.
    const again = await json<PageAdmin>(
      await call("/admin/pages/terms", "u-editor", {
        method: "PUT",
        body: { title: live.title, blocks: live.blocks },
      }),
    );
    expect(again.status).toBe("published");
  });

  it("checks each block type", async () => {
    const response = await call("/admin/pages/about", "u-editor", {
      method: "PUT",
      body: {
        title: {},
        blocks: [
          { type: "richText", body: { en: "English only" } },
          { type: "image", src: "", alt: {} },
          { type: "table", rows: [[{ fr: "A" }, { fr: "B" }], [{ fr: "1" }]] },
          { type: "partners", partners: [{ name: {}, url: "x" }] },
          { type: "video" },
        ],
      },
    });
    expect(response.status).toBe(422);
    expect(
      (await json<Problem>(response)).errors!.map((error) => `${error.path}:${error.message}`),
    ).toEqual([
      "title.fr:required",
      "blocks.0.body.fr:required",
      "blocks.1.src:required",
      "blocks.1.alt.fr:required",
      "blocks.2.rows:shape",
      "blocks.3.partners.0.name.fr:required",
      "blocks.3.partners.0.url:url",
      "blocks.4.type:unknown",
      "blocks.4.body.fr:required",
    ]);
  });
});

describe("home modules", () => {
  it("publishes new chips and featured indicators to /home", async () => {
    const home = await json<HomeModulesAdmin>(await call("/admin/pages/home", "u-editor"));
    expect(home.status).toBe("published");
    const next = {
      ...home,
      exampleChips: [{ label: { fr: "Fibre", en: "Fibre" }, href: "/data/CONN.4G_POP" }],
      featuredIndicators: home.featuredIndicators.slice(0, 3),
    };
    const saved = await json<HomeModulesAdmin>(
      await call("/admin/pages/home", "u-editor", { method: "PUT", body: next }),
    );
    expect(saved.status).toBe("changed");
    expect((await json<HomeData>(await call("/home", null))).exampleChips.length).toBe(5);

    await call("/admin/pages/home/publish", "u-editor", { body: {} });
    expect(onPublished).toHaveBeenCalledWith(["home"]);
    const shown = await json<HomeData>(await call("/home", null));
    expect(shown.exampleChips).toEqual([{ label: "Fibre", href: "/data/CONN.4G_POP" }]);
    expect(shown.featuredIndicators).toEqual(next.featuredIndicators);
    expect(shown.mission).toBeTruthy();
  });

  it("refuses outside links and unknown indicators", async () => {
    const response = await call("/admin/pages/home", "u-editor", {
      method: "PUT",
      body: {
        exampleChips: [{ label: { fr: "Ailleurs" }, href: "https://example.org" }],
        featuredIndicators: ["NOPE"],
        mapTeaserIndicator: "",
        benchmarkIndicator: "CONN.4G_POP",
      },
    });
    expect(
      (await json<Problem>(response)).errors!.map((error) => `${error.path}:${error.message}`),
    ).toEqual([
      "exampleChips.0.href:path",
      "featuredIndicators:unknown",
      "mapTeaserIndicator:required",
    ]);
  });
});

describe("media", () => {
  it("stores an uploaded picture and serves it publicly", async () => {
    const form = new FormData();
    form.set("image", new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" }));
    const response = await call("/admin/media", "u-editor", { form });
    expect(response.status).toBe(201);
    const upload = await json<MediaUpload>(response);
    expect(upload.bytes).toBe(3);
    const served = await call(upload.url.replace("/api/v1", ""), null);
    expect(served.headers.get("Content-Type")).toBe("image/png");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("refuses other file types", async () => {
    const form = new FormData();
    form.set("image", new File(["x"], "notes.txt", { type: "text/plain" }));
    const response = await call("/admin/media", "u-editor", { form });
    expect((await json<Problem>(response)).errors).toEqual([{ path: "image", message: "type" }]);
  });
});

describe("seedMarkdownToHtml", () => {
  it("turns the seed's Markdown into editor HTML and escapes the rest", () => {
    expect(seedMarkdownToHtml("Un <b>\n\n## Titre\n\n- **a**\n- b")).toBe(
      "<p>Un &lt;b&gt;</p><h2>Titre</h2><ul><li><p><strong>a</strong></p></li><li><p>b</p></li></ul>",
    );
  });
});
