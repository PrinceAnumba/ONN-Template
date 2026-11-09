import { describe, expect, it } from "vitest";
import { cronText, type CronT } from "./cron-text";

// Echoes the key and values so the test checks what reaches the message, not the wording.
const t: CronT = (key, values) => `${key}:${JSON.stringify(values ?? {})}`;

describe("cronText", () => {
  it("names weekdays and times in the locale", () => {
    expect(cronText("0 6 * * 1", t, "en")).toBe('weekly:{"days":"Monday","time":"06:00"}');
    expect(cronText("0 6 * * 1,3", t, "fr")).toBe(
      'weekly:{"days":"lundi et mercredi","time":"06:00"}',
    );
    expect(cronText("30 2 * * *", t, "en")).toBe('daily:{"time":"02:30"}');
    expect(cronText("0 7 1 * *", t, "en")).toBe('monthly:{"day":1,"time":"07:00"}');
    expect(cronText("0 */4 * * *", t, "en")).toBe("custom:{}");
    expect(cronText("bad", t, "en")).toBeNull();
  });
});
