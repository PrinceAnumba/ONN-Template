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

  // Submissions: a spread of statuses over the last two months.
  const submissions: StoredSubmission[] = Array.from({ length: 30 }, (_, index) => {
    const org = index % 3 === 2 ? pick(orgs).code : pick(contributor.orgs);
    const codes = indicatorsOf(org);
    const count = Math.min(codes.length, 1 + Math.floor(random() * 3));
    const start = Math.floor(random() * Math.max(1, codes.length - count + 1));
    const quarter = 1 + Math.floor(random() * 4);
    const channel = pick(CHANNELS);
    return {
      id: `SUB-${String(index + 1).padStart(4, "0")}`,
      org,
      indicators: codes.slice(start, start + count),
      period: `2025-Q${quarter}`,
      channel,
      status: STATUSES[index % STATUSES.length]!,
      submittedBy: channel === "connector" || index % 4 === 3 ? pick(users).id : contributor.id,
      updated: iso(ago(Math.floor(random() * 60) + random())),
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
  };
}
