import React, { useEffect, useState } from "react";

import { ApiError, hasAccessToken } from "../../../../api/client";
import { getMe } from "../../../../api/authApi";
import {
  getCalendarEvents,
  getMyCalendars,
  type MyCalendar,
} from "../../../../api/calendarApi";
import type { CalEvent } from "../types";

type UseCalendarDataParams = {
  setFormError: (message: string) => void;
};

// 로그인 사용자, 캘린더 탭, 이벤트 목록 조회를 한 곳에서 관리한다.
export function useCalendarData({ setFormError }: UseCalendarDataParams) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [calendars, setCalendars] = useState<MyCalendar[]>([]);
  const [calendarId, setCalendarId] = useState<number | null>(null);
  const [calendarName, setCalendarName] = useState<string>("");

  useEffect(() => {
    const fetchMyCalendars = async () => {
      if (!hasAccessToken()) return;

      const list = await getMyCalendars();

      setCalendars(list);

      const defaultCalendar = list.find((c) => c.isDefault === 1) ?? list[0];

      if (defaultCalendar) {
        setCalendarId(defaultCalendar.calendarId);
        setCalendarName(defaultCalendar.name);
      }
    };

    fetchMyCalendars().catch(() => undefined);
  }, []);

  // 탭 클릭 시 현재 캘린더를 교체한다.
  const handleCalendarTabClick = (calendar: MyCalendar) => {
    setCalendarId(calendar.calendarId);
    setCalendarName(calendar.name);
  };

  useEffect(() => {
    (async () => {
      const token = hasAccessToken();
      if (!token) {
        setFormError("로그인이 필요합니다.");
        return;
      }

      const data = await getMe();
      if (!data.ok) {
        setFormError(data?.message ?? "로그인 정보를 불러오지 못했습니다.");
        return;
      }

      const uid = String(data.user?.id ?? "");
      setUserId(uid);
    })().catch((error) => {
      if (error instanceof ApiError) {
        setFormError(error.data?.message ?? "로그인 정보를 불러오지 못했습니다.");
        return;
      }
      setFormError("로그인 정보를 불러오지 못했습니다.");
    });
  }, [setFormError]);

  const loadEventsByCalendarId = React.useCallback(
    async (targetCalendarId: number) => {
      if (!hasAccessToken()) return;

      try {
        const data = await getCalendarEvents(targetCalendarId);
        setEvents(data);
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          setFormError("이 캘린더에 대한 권한이 없습니다. (calendar_members 확인)");
        }
      }
    },
    [setFormError]
  );

  const loadEvents = React.useCallback(async () => {
    if (!calendarId) return;
    await loadEventsByCalendarId(calendarId);
  }, [calendarId, loadEventsByCalendarId]);

  useEffect(() => {
    if (!calendarId) return;

    const timeoutId = window.setTimeout(() => {
      void loadEventsByCalendarId(calendarId);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [calendarId, loadEventsByCalendarId]);

  return {
    events,
    userId,
    calendars,
    calendarId,
    calendarName,
    loadEvents,
    handleCalendarTabClick,
  };
}

