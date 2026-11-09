// Starting state for the back-office mock (brief §7). Built from the country's fixtures when the
// server starts, so it needs no committed files and works for any country. Deterministic apart
// from dates, which are relative to "now" so deadlines and "last 30 days" stay meaningful.
import type {
  AdminRole,
  CalendarItem,
  ConnectorAuth,
  ConnectorMapping,
  ConnectorRunStatus,
  ConnectorType,
  ImportField,
  IndicatorRecord,
  IntlRef,
  Periodicity,
  FeedbackItem,
  Organisation,
  SourceMethod,
  SubmissionChannel,
  SubmissionStatus,
} from "@onn/api-client/types";
import type { QualityRule } from "@onn/api-client/types";
import { autoMatch, type StoredImport } from "./admin-intake";
import { nextPeriod, type HistoryEvent, type StoredRow } from "./admin-submissions";
import { createRandom, type Fixtures } from "./fixtures";

/** Stored text: one string per language, resolved by the localiser in each response. */
type Text = Record<string, string>;

export interface StoredOrg extends Omit<Organisation, "name"> {
  name: Text;
}

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  roles: AdminRole[];
  orgs: string[];
  mfa: boolean;
  active: boolean;
  lastLogin: string;
}

export interface StoredSubmission {
  id: string;
  org: string;
  indicators: string[];
  period: string;
  channel: SubmissionChannel;
  status: SubmissionStatus;
  submittedBy: string;
  updated: string;
  rows: StoredRow[];
  justifications: Partial<Record<QualityRule, string>>;
  history: HistoryEvent[];
  verifiedBy?: string;
}

export interface StoredRun {
  id: string;
  started: string;
  finished: string;
  status: ConnectorRunStatus;
  trigger: "schedule" | "manual";
  by?: string;
  rows: number;
  submission?: string;
  error?: string;
  log: { time: string; level: "info" | "warn" | "error"; message: Text }[];
}

export interface StoredConnector {
  id: string;
  name: string;
  org: string;
  type: ConnectorType;
  endpoint: string;
  auth: ConnectorAuth;
  schedule: string;
  enabled: boolean;
  sourceFields: string[];
  mapping: ConnectorMapping[];
  /** Newest first. */
  runs: StoredRun[];
  /** Mirrors runs[0], for the dashboard and notifications. */
  lastRun: string;
  lastStatus: ConnectorRunStatus;
  error?: string;
  /** Mock only: this endpoint answers 503 until the connector points somewhere else. */
  brokenEndpoint?: string;
}

export interface StoredIndicator extends IndicatorRecord {
  version: number;
  updated: string;
  versions: {
    version: number;
    date: string;
    note: string;
    author: string;
    changes: (keyof IndicatorRecord)[];
  }[];
}

/** Fields each kind of source offers in its sample (mock only). */
export const SOURCE_FIELDS: Record<ConnectorType, string[]> = {
  sdmx: ["INDICATOR", "REF_AREA", "TIME_PERIOD", "OBS_VALUE", "OBS_STATUS", "SEX"],
  rest: ["indicatorCode", "areaCode", "year", "value", "status", "operator"],
  sftp: ["indicateur", "zone", "periode", "valeur", "statut"],
  csv: ["indicator", "area", "period", "value", "flag"],
};

export interface AdminState {
  orgs: StoredOrg[];
  users: StoredUser[];
  submissions: StoredSubmission[];
  calendar: (Omit<CalendarItem, "orgName" | "indicatorSet"> & { indicatorSet: Text })[];
  connectors: StoredConnector[];
  indicators: StoredIndicator[];
  feedback: FeedbackItem[];
  usage: { date: string; visits: number }[];
  /** Notification ids each user has read. */
  read: Map<string, Set<string>>;
  /** The organisation that reports each indicator (its catalogue source). */
  indicatorOrg: Record<string, string>;
  imports: StoredImport[];
}

const DAY = 24 * 60 * 60 * 1000;
const KIND: Record<SourceMethod, Organisation["kind"]> = {
  survey: "statistics",
  computed: "statistics",
  administrative: "regulator",
  international: "international",
};

const iso = (date: Date) => date.toISOString();
const day = (date: Date) => iso(date).slice(0, 10);

/** Short code from the English name's initials, made unique with a number. */
function orgCode(name: string, taken: Set<string>) {
  const base =
    name
      .split(/[\s-]+/)
      .filter((word) => word.length > 2)
      .map((word) => word[0]!.toUpperCase())
      .join("")
      .slice(0, 4) || "ORG";
  let code = base;
  for (let n = 2; taken.has(code); n++) code = `${base}${n}`;
  taken.add(code);
  return code;
}

/** Demo people, one per role plus a second admin for the "can't approve your own" rule. */
function demoUsers(orgs: StoredOrg[], now: Date): StoredUser[] {
  const all = orgs.map((org) => org.code);
  const people: [string, string, AdminRole, string[]][] = [
    ["u-super", "Sam Martin", "super_admin", all],
    ["u-admin", "Alex Moreau", "admin", all],
    ["u-admin2", "Jordan Petit", "admin", all],
    ["u-editor", "Camille Laurent", "editor", all],
    ["u-contributor", "Robin Bernard", "contributor", all.slice(0, 2)],
    ["u-reader", "Morgan Lefèvre", "reader", all],
  ];
  return people.map(([id, name, role, orgCodes], index) => ({
    id,
    name,
    email: `${id.slice(2)}@example.org`,
    roles: [role],
    orgs: orgCodes,
    mfa: role !== "reader",
    active: true,
    lastLogin: iso(new Date(now.getTime() - (index + 1) * 0.7 * DAY)),
  }));
}

const STATUSES: SubmissionStatus[] = [
  "draft",
  "submitted",
  "submitted",
  "submitted",
  "verified",
  "verified",
  "approved",
  "published",
  "published",
  "returned",
];
const CHANNELS: SubmissionChannel[] = ["import", "entry", "connector"];

export function buildAdminState(data: Fixtures, now = new Date()): AdminState {
  const random = createRandom(7);
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)] as T;
  const ago = (days: number) => new Date(now.getTime() - days * DAY);

  // Organisations: the distinct data sources named in the catalogue.
  const taken = new Set<string>();
  const orgs: StoredOrg[] = [];
  const orgOfIndicator = new Map<string, string>();
  for (const indicator of data.indicators) {
    const name = indicator.source.org as unknown as Text;
    const key = name[data.meta.defaultLocale] ?? Object.values(name)[0] ?? "";
    let org = orgs.find((item) => item.name[data.meta.defaultLocale] === key);
    if (!org) {
      org = {
        code: orgCode(name.en ?? key, taken),
        name,
        kind: KIND[indicator.source.method as SourceMethod] ?? "other",
      };
      orgs.push(org);
    }
    orgOfIndicator.set(indicator.code as string, org.code);
  }
  const users = demoUsers(orgs, now);
  const contributor = users.find((user) => user.roles.includes("contributor"))!;
  const indicatorsOf = (org: string) =>
    data.indicators
      .filter((item) => orgOfIndicator.get(item.code as string) === org)
      .map((item) => item.code as string);

  // Submissions: a spread of statuses over the last two months, with values built from the
  // published series so the *Diff* tab and the portal stay consistent.
  const editor = users.find((user) => user.roles.includes("editor"))!;
  const admins = users.filter((user) => user.roles.includes("admin"));
  const seriesOf = new Map<string, Fixtures["observations"]>();
  for (const row of data.observations) {
    if (Object.keys(row.dims).length) continue;
    const key = `${row.indicator}|${row.area}`;
    const list = seriesOf.get(key);
    if (list) list.push(row);
    else seriesOf.set(key, [row]);
  }
  const periodicityOf = new Map(
    data.indicators.map((item) => [item.code as string, item.periodicity as string]),
  );
  const adm1 = data.areas
    .filter((area) => area.level === "adm1")
    .map((area) => area.code as string);
  let ownVerified = false;

  const submissions: StoredSubmission[] = Array.from({ length: 30 }, (_, index) => {
    const status = STATUSES[index % STATUSES.length]!;
    const org = index % 3 === 2 ? pick(orgs).code : pick(contributor.orgs);
    // Indicators with published data and the same periodicity, so they share one period.
    const withData = indicatorsOf(org).filter((code) => seriesOf.has(`${code}|${data.meta.iso3}`));
    const first = withData[Math.floor(random() * withData.length)];
    const sameKind = withData.filter(
      (code) => periodicityOf.get(code) === periodicityOf.get(first ?? ""),
    );
    const codes = [first, ...sameKind.filter((code) => code !== first)]
      .filter((code): code is string => Boolean(code))
      .slice(0, 1 + Math.floor(random() * 2));
    const national = seriesOf.get(`${codes[0]}|${data.meta.iso3}`) ?? [];
    const latest = national.at(-1)?.period ?? "2025";
    // Published submissions restate the latest values; a third of the rest revise them.
    const revise = status === "published" || index % 3 === 0;
    const period = revise
      ? latest
      : nextPeriod(latest, periodicityOf.get(codes[0] ?? "") ?? "annual");
    const channel = pick(CHANNELS);
    let submittedBy = channel === "connector" || index % 4 === 3 ? pick(users).id : contributor.id;
    // One verified submission is the second admin's own, for the "can't approve your own" rule.
    if (status === "verified" && !ownVerified) {
      submittedBy = admins[0]!.id;
      ownVerified = true;
    }
    if (status === "draft" || status === "returned") submittedBy = contributor.id;

    const rows: StoredRow[] = [];
    for (const code of codes) {
      const areas = [
        data.meta.iso3,
        ...adm1.filter((area) => seriesOf.has(`${code}|${area}`)).slice(0, 3),
      ];
      for (const area of areas) {
        const series = seriesOf.get(`${code}|${area}`) ?? [];
        const last = series.at(-1);
        const current = series.find((item) => item.period === period);
        if (!last) continue;
        const base = last.value ?? 0;
        const grown = Math.round(base * (1 + 0.02 + random() * 0.06) * 10) / 10;
        const value =
          status === "published"
            ? (current?.value ?? base)
            : last.unit === "%"
              ? Math.min(100, grown)
              : grown;
        rows.push({
          id: `${index + 1}-${rows.length + 1}`,
          indicator: code,
          area,
          period,
          dims: {},
          value,
          unit: last.unit,
          status: status === "published" ? (current?.status ?? "A") : "P",
          published: current?.value ?? null,
        });
      }
    }
    // Seeded problems: drafts and returned submissions have errors, some others a large jump.
    const target = rows[rows.length > 1 ? 1 : 0];
    if (target && status === "draft") target.value = null;
    if (target && status === "returned") target.value = -Math.abs(target.value ?? 1);
    if (target && ["submitted", "verified", "approved"].includes(status) && index % 2 === 0) {
      target.value = Math.round((target.value ?? 1) * 1.6 * 10) / 10;
    }

    const updated = ago(Math.floor(random() * 60) + random());
    const reached =
      status === "returned"
        ? 1
        : ["draft", "submitted", "verified", "approved", "published"].indexOf(status);
    const actors = [submittedBy, submittedBy, editor.id, admins[1]!.id, admins[1]!.id];
    const history: HistoryEvent[] = [];
    const flow: SubmissionStatus[] = ["draft", "submitted", "verified", "approved", "published"];
    for (let step = 0; step <= reached; step++) {
      history.push({
        id: `${index + 1}-h${step}`,
        date: iso(
          new Date(
            updated.getTime() - (reached - step + (status === "returned" ? 1 : 0)) * 1.5 * DAY,
          ),
        ),
        ...(step > 0 ? { from: flow[step - 1] } : {}),
        to: flow[step]!,
        actor: actors[step]!,
      });
    }
    if (status === "returned") {
      history.push({
        id: `${index + 1}-hr`,
        date: iso(updated),
        from: "submitted",
        to: "returned",
        actor: editor.id,
        comment: "Negative value for one region: please check the source file.",
      });
    }
    const verified = ["verified", "approved", "published"].includes(status);
    return {
      id: `SUB-${String(index + 1).padStart(4, "0")}`,
      org,
      indicators: codes,
      period,
      channel,
      status,
      submittedBy,
      updated: iso(updated),
      rows,
      justifications: verified
        ? { jump: "Confirmed with the provider: network expansion this period." }
        : {},
      history,
      ...(verified ? { verifiedBy: editor.id } : {}),
    };
  });

  // Collection calendar: one item per organisation and quarter, deadlines around today.
  const calendar: AdminState["calendar"] = [];
  orgs.forEach((org, orgIndex) => {
    for (let offset = -2; offset <= 2; offset++) {
      const deadline = new Date(now.getTime() + (offset * 21 + orgIndex * 4 + 3) * DAY);
      const received = offset < 0 && random() > 0.35;
      calendar.push({
        id: `CAL-${org.code}-${offset + 3}`,
        org: org.code,
        indicatorSet: {
          fr: `Indicateurs ${org.code} — trimestriels`,
          en: `${org.code} indicators — quarterly`,
        },
        period: `2025-Q${offset + 3 > 4 ? 4 : offset + 3}`,
        deadline: day(deadline),
        status: received ? "received" : deadline < now ? "overdue" : "upcoming",
      });
    }
  });

  // Connectors: one of each kind for the first organisations, with a week of daily runs. The
  // second one is failing: its endpoint answers 503 until someone points it elsewhere.
  const types: ConnectorType[] = ["sdmx", "rest", "sftp", "csv"];
  const endpoints: Record<ConnectorType, string> = {
    sdmx: "https://sdmx.example.org/rest/data/ONN,DF_ICT,1.0",
    rest: "https://api.example.org/v2/indicators",
    sftp: "sftp://files.example.org/onn/exports",
    csv: "https://data.example.org/onn/latest.csv",
  };
  const message = (fr: string, en: string): Text => ({ fr, en });
  const connectors: StoredConnector[] = orgs.slice(0, 4).map((org, index) => {
    const type = types[index]!;
    const dims = [
      ...new Set(
        data.indicators
          .filter((item) => orgOfIndicator.get(item.code as string) === org.code)
          .flatMap((item) => item.disaggregations as string[]),
      ),
    ];
    const targets: ImportField[] = [
      "indicator",
      "area",
      "period",
      "value",
      "flag",
      ...dims.map((dim) => `dim:${dim}` as ImportField),
      "ignore",
    ];
    const failing = index === 1;
    const runs: StoredRun[] = Array.from({ length: 6 }, (_, run) => {
      const started = ago(run + 0.1 + index * 0.02);
      const finished = new Date(started.getTime() + (20 + index * 7) * 1000);
      const failed = failing && run < 2;
      const rows = failed ? 0 : 24 + index * 6;
      const time = (offset: number) => iso(new Date(started.getTime() + offset * 1000));
      return {
        id: `RUN-${index + 1}-${6 - run}`,
        started: iso(started),
        finished: iso(finished),
        status: failed ? "failed" : "ok",
        trigger: "schedule",
        rows,
        ...(failed ? { error: "HTTP 503 Service Unavailable" } : {}),
        log: failed
          ? [
              {
                time: time(0),
                level: "info",
                message: message("Connexion à la source", "Connecting to the source"),
              },
              {
                time: time(10),
                level: "warn",
                message: message("Nouvelle tentative (1/3)", "Retrying (1/3)"),
              },
              {
                time: time(20),
                level: "error",
                message: message("HTTP 503 Service Unavailable", "HTTP 503 Service Unavailable"),
              },
            ]
          : [
              {
                time: time(0),
                level: "info",
                message: message("Connexion à la source", "Connecting to the source"),
              },
              {
                time: time(5),
                level: "info",
                message: message(`${rows} enregistrements reçus`, `${rows} records received`),
              },
              {
                time: time(9),
                level: "info",
                message: message("Aucune nouvelle valeur", "No new values"),
              },
            ],
      };
    });
    const last = runs[0]!;
    return {
      id: `CON-${index + 1}`,
      name: `${org.code} ${type.toUpperCase()}`,
      org: org.code,
      type,
      endpoint: endpoints[type],
      auth: type === "sftp" ? "basic" : type === "rest" ? "token" : "none",
      schedule: ["0 6 * * 1", "30 2 * * *", "0 7 1 * *", "0 5 * * 1-5"][index]!,
      enabled: true,
      sourceFields: SOURCE_FIELDS[type],
      mapping: autoMatch(SOURCE_FIELDS[type], targets).map(({ source, target }) => ({
        source,
        target,
      })),
      runs,
      lastRun: last.finished,
      lastStatus: last.status,
      ...(last.error ? { error: last.error } : {}),
      ...(failing ? { brokenEndpoint: endpoints[type] } : {}),
    };
  });

  // Indicator referential: the catalogue plus what only the back office keeps (thresholds,
  // goalposts, prioritisation, version authors).
  const score = () => 1 + Math.floor(random() * 5);
  const text = (value: unknown): Text =>
    typeof value === "string"
      ? Object.fromEntries(data.meta.locales.map((locale) => [locale, value]))
      : { ...((value as Text | undefined) ?? {}) };
  const indicators: StoredIndicator[] = data.indicators.map((item) => {
    const percent = (item.unit as unknown as Text).en === "%";
    const versions = (item.versions as unknown as { version: number; date: string; note: Text }[])
      .map((version) => ({
        version: version.version,
        date: `${version.date}T09:00:00.000Z`,
        note: version.note[data.meta.defaultLocale] ?? version.note.en ?? "",
        author: admins[0]!.id,
        changes: [] as (keyof IndicatorRecord)[],
      }))
      .reverse();
    return {
      code: item.code as string,
      status: item.status as StoredIndicator["status"],
      pillar: item.pillar as string,
      theme: item.theme as string,
      org: orgOfIndicator.get(item.code as string) ?? orgs[0]!.code,
      name: text(item.name),
      shortDefinition: text(item.shortDefinition),
      definition: text(item.definition),
      computation: text(item.computation),
      qualityNotes: text(item.qualityNotes),
      synonyms: [...((item.synonyms as string[] | undefined) ?? [])],
      licence: (item.licence as string | undefined) ?? "CC BY 4.0",
      unit: text(item.unit),
      unitVariants: (item.unitVariants as unknown as { code: string; label: Text }[]).map(
        (variant) => ({ code: variant.code, label: { ...variant.label } }),
      ),
      higherIsBetter: Boolean(item.higherIsBetter),
      isHeadline: Boolean(item.isHeadline),
      disaggregations: [...(item.disaggregations as string[])],
      geoLevels: [...(item.geoLevels as string[])],
      thresholds: { min: percent ? 0 : null, max: percent ? 100 : null, jumpPct: 30 },
      goalposts: {
        min: percent ? 0 : null,
        max: percent ? 100 : null,
        target: null,
        targetYear: null,
      },
      intlRefs: (
        item.intlRefs as unknown as { org: IntlRef["org"]; code: string; name: Text; url: string }[]
      ).map((ref) => ({ org: ref.org, code: ref.code, name: { ...ref.name }, url: ref.url })),
      periodicity: item.periodicity as Periodicity,
      nextRelease: (item.nextRelease as string | undefined) ?? null,
      priority: {
        availability: score(),
        quality: score(),
        strategic: score(),
        comparability: score(),
      },
      version: versions[0]?.version ?? 1,
      updated: versions[0]?.date ?? iso(now),
      versions,
    };
  });

  const pages = ["/data", "/map", "/dashboards", "/publications", "/", "/catalogue"];
  const feedback: FeedbackItem[] = Array.from({ length: 8 }, (_, index) => ({
    id: `FB-${String(index + 1).padStart(4, "0")}`,
    date: iso(ago(index * 2.3 + random())),
    rating: 1 + Math.floor(random() * 5),
    message: [
      "The map is very useful, thank you.",
      "Could you add 2024 data for my region?",
      "The CSV export is missing the units.",
      "Hard to find the methodology note.",
    ][index % 4],
    page: `/${data.meta.defaultLocale}${pages[index % pages.length]}`,
    status: index < 3 ? "new" : index < 5 ? "planned" : "done",
  }));

  const usage = Array.from({ length: 30 }, (_, index) => {
    const date = ago(29 - index);
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    return {
      date: day(date),
      visits: Math.round((weekend ? 380 : 620) * (0.85 + random() * 0.3) * (1 + index / 120)),
    };
  });

  return {
    orgs,
    users,
    submissions,
    calendar,
    connectors,
    indicators,
    feedback,
    usage,
    read: new Map(),
    indicatorOrg: Object.fromEntries(orgOfIndicator),
    imports: [],
  };
}
