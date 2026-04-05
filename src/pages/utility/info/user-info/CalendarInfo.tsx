import { useEffect, useState } from "react";
import styles from "./CalendarInfo.module.css";

const API_BASE = import.meta.env.VITE_API_URL || "";

type CalendarInfoItem = {
  id: number;
  name: string;
  owner_id: number;
  created_at: string;
  user_id: number;
  role: string;
};

type GetMyCalendarsInfoResponse = {
  ok: boolean;
  calendars: CalendarInfoItem[];
  defaultCalendarId: number | null;
};

export default function CalendarInfo() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [data, setData] = useState<GetMyCalendarsInfoResponse | null>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState<number | null>(null);

  useEffect(() => {
    const fetchCalendarInfo = async () => {
      const token = localStorage.getItem("accessToken");

      if (!token) {
        setErrorMsg("로그인 정보가 없습니다.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/calendars/getMyCalendarsInfo`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = (await res.json()) as GetMyCalendarsInfoResponse;
        if (!res.ok || !result.ok) {
          setErrorMsg("캘린더 정보를 불러오지 못했습니다.");
          return;
        }

        setData(result);
        setSelectedCalendarId(result.defaultCalendarId ?? null);
      } catch (err) {
        console.error(err);
        setErrorMsg("서버 통신 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchCalendarInfo();
  }, []);

  const handleCheckChange = (calendarId: number) => {
    setSelectedCalendarId(calendarId);
  };

  if (loading) {
    return (
      <div className={styles.pageStateBox}>
        캘린더 정보를 불러오는 중...
      </div>
    );
  }

  if (errorMsg && !data) {
    return (
      <div className={styles.pageStateBoxError}>
        {errorMsg}
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.sectionTitle}>캘린더 정보</div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>캘린더명</th>
              <th>구분</th>
              <th>메인 캘린더</th>
            </tr>
          </thead>
          <tbody>
            {data?.calendars && data.calendars.length > 0 ? (
              data.calendars.map((calendar) => {
                const ownerText =
                  calendar.owner_id === calendar.user_id
                    ? "캘린더장"
                    : "일반회원";

                const isChecked = selectedCalendarId === calendar.id;

                return (
                  <tr key={calendar.id}>
                    <td>{calendar.name}</td>
                    <td>{ownerText}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleCheckChange(calendar.id)}
                      />
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={3} className={styles.emptyRow}>
                  조회된 캘린더가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}