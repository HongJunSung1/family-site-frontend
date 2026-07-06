/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import dayjs from "dayjs";

import type { CalEvent } from "../src/pages/utility/calendar/types";
import { expandRecurringEvents } from "../src/pages/utility/calendar/utils/recurrence";

const event = (overrides: Partial<CalEvent>): CalEvent => ({
  id: "1",
  title: "Family dinner",
  start: "2026-01-01T09:00",
  end: "2026-01-01T10:00",
  allDay: false,
  createdBy: "user-1",
  createdByName: "User One",
  repeat: "none",
  repeatInterval: 1,
  repeatRangeStart: "",
  repeatRangeEnd: "",
  ...overrides,
});

const expand = (item: CalEvent, start: string, end: string) =>
  expandRecurringEvents([item], dayjs(`${start}T00:00`), dayjs(`${end}T00:00`));

const starts = (items: CalEvent[]) => items.map((item) => item.start);

test("expands daily recurring events inside the visible range", () => {
  const items = expand(
    event({
      repeat: "daily",
      repeatRangeStart: "2026-01-01",
      repeatRangeEnd: "2026-01-04",
    }),
    "2026-01-01",
    "2026-01-05"
  );

  assert.deepEqual(starts(items), [
    "2026-01-01T09:00",
    "2026-01-02T09:00",
    "2026-01-03T09:00",
    "2026-01-04T09:00",
  ]);
});

test("honors repeat intervals for weekly recurring events", () => {
  const items = expand(
    event({
      repeat: "weekly",
      repeatInterval: 2,
      repeatRangeStart: "2026-01-01",
      repeatRangeEnd: "2026-02-01",
    }),
    "2026-01-01",
    "2026-02-02"
  );

  assert.deepEqual(starts(items), [
    "2026-01-01T09:00",
    "2026-01-15T09:00",
    "2026-01-29T09:00",
  ]);
});

test("keeps monthly repeats sticky to the anchor day at month end", () => {
  const items = expand(
    event({
      start: "2026-01-31T09:00",
      end: "2026-01-31T10:00",
      repeat: "monthly",
      repeatAnchorDom: 31,
      repeatRangeStart: "2026-01-31",
      repeatRangeEnd: "2026-04-30",
    }),
    "2026-01-01",
    "2026-05-01"
  );

  assert.deepEqual(starts(items), [
    "2026-01-31T09:00",
    "2026-02-28T09:00",
    "2026-03-31T09:00",
    "2026-04-30T09:00",
  ]);
});

test("applies occurrence exceptions and overrides", () => {
  const items = expand(
    event({
      repeat: "daily",
      repeatRangeStart: "2026-01-01",
      repeatRangeEnd: "2026-01-04",
      repeatExceptions: ["2026-01-02T09:00"],
      repeatOverrides: {
        "2026-01-03T09:00": {
          title: "Moved dinner",
          start: "2026-01-03T11:00",
          end: "2026-01-03T12:00",
        },
      },
    }),
    "2026-01-01",
    "2026-01-05"
  );

  assert.deepEqual(
    items.map((item) => [item.title, item.start, item.end]),
    [
      ["Family dinner", "2026-01-01T09:00", "2026-01-01T10:00"],
      ["Moved dinner", "2026-01-03T11:00", "2026-01-03T12:00"],
      ["Family dinner", "2026-01-04T09:00", "2026-01-04T10:00"],
    ]
  );
});

test("does not emit recurring occurrences outside the visible range", () => {
  const items = expand(
    event({
      repeat: "daily",
      repeatRangeStart: "2026-01-01",
      repeatRangeEnd: "2026-01-10",
    }),
    "2026-01-04",
    "2026-01-07"
  );

  assert.deepEqual(starts(items), [
    "2026-01-04T09:00",
    "2026-01-05T09:00",
    "2026-01-06T09:00",
  ]);
});
