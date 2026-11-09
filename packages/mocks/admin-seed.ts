// Starting state for the back-office mock (brief §7). Built from the country's fixtures when the
// server starts, so it needs no committed files and works for any country. Deterministic apart
// from dates, which are relative to "now" so deadlines and "last 30 days" stay meaningful.
import type {
  AdminRole,
  CalendarItem,
  FeedbackItem,
  Organisation,
  SourceMethod,
  SubmissionChannel,
  SubmissionStatus,
} from "@onn/api-client/types";
import type { QualityRule } from "@onn/api-client/types";
import type { StoredImport } from "./admin-intake";
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

export interface StoredConnector {
  id: string;
  name: string;
  org: string;
  lastRun: string;
  lastStatus: "ok" | "failed";
  error?: string;
}

export interface AdminState {
  orgs: StoredOrg[];
  users: StoredUser[];
  submissions: StoredSubmission[];
  calendar: (Omit<CalendarItem, "orgName" | "indicatorSet"> & { indicatorSet: Text })[];
  connectors: StoredConnector[];
  feedback: FeedbackItem[];
  usage: { date: string; visits: number }[];
  quality: { passRate: number; previous: number };
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

  const connectors: StoredConnector[] = orgs.slice(0, 4).map((org, index) => ({
    id: `CON-${index + 1}`,
    name: `${org.code} ${["SDMX", "REST", "SFTP", "CSV"][index]}`,
    org: org.code,
    lastRun: iso(ago(index * 0.5 + 0.1)),
    lastStatus: index === 1 ? "failed" : "ok",
    error: index === 1 ? "HTTP 503 from source endpoint" : undefined,
  }));

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
    feedback,
    usage,
    quality: { passRate: 0.87, previous: 0.83 },
    read: new Map(),
    indicatorOrg: Object.fromEntries(orgOfIndicator),
    imports: [],
  };
}
