import { TabScreen } from "@/components/layout/TabScreen";
import { Text } from "@/components/Themed";
import { Card } from "@/components/ui/Card";
import { SubjectBar } from "@/components/ui/SubjectBar";
import Colors from "@/constants/Colors";
import { INTER } from "@/constants/typography";
import { useTheme } from "@/utils/themeContext";
import {
    isCurrentPeriod as checkIsCurrentPeriod,
    formatStatMinutes,
} from "@/utils/time";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, TouchableOpacity, View } from "react-native";

type SubjectSlice = { name: string; minutes: number; color: string };
type DaySessions = { totalMinutes: number; subjects: SubjectSlice[] };

const MOCK_SESSIONS: Record<string, DaySessions> = {
  "2026-04-07": {
    totalMinutes: 245,
    subjects: [
      { name: "Mathématiques", minutes: 120, color: "#4AC9CC" },
      { name: "Physique", minutes: 80, color: "#F28C8C" },
      { name: "Anglais", minutes: 45, color: "#7B8FF5" },
    ],
  },
  "2026-04-08": {
    totalMinutes: 420,
    subjects: [
      { name: "Mathématiques", minutes: 180, color: "#4AC9CC" },
      { name: "Histoire", minutes: 120, color: "#F4A259" },
      { name: "Philosophie", minutes: 120, color: "#9B8FD4" },
    ],
  },
  "2026-04-09": {
    totalMinutes: 130,
    subjects: [
      { name: "Anglais", minutes: 90, color: "#7B8FF5" },
      { name: "SVT", minutes: 40, color: "#6BD9A4" },
    ],
  },
  "2026-04-10": {
    totalMinutes: 510,
    subjects: [
      { name: "Mathématiques", minutes: 240, color: "#4AC9CC" },
      { name: "Physique", minutes: 150, color: "#F28C8C" },
      { name: "Chimie", minutes: 120, color: "#F4A259" },
    ],
  },
  "2026-04-11": {
    totalMinutes: 680,
    subjects: [
      { name: "Mathématiques", minutes: 300, color: "#4AC9CC" },
      { name: "Physique", minutes: 200, color: "#F28C8C" },
      { name: "Philosophie", minutes: 180, color: "#9B8FD4" },
    ],
  },
  "2026-04-12": {
    totalMinutes: 90,
    subjects: [{ name: "Anglais", minutes: 90, color: "#7B8FF5" }],
  },
  "2026-04-14": {
    totalMinutes: 360,
    subjects: [
      { name: "Physique", minutes: 200, color: "#F28C8C" },
      { name: "Chimie", minutes: 160, color: "#F4A259" },
    ],
  },
  "2026-04-15": {
    totalMinutes: 480,
    subjects: [
      { name: "Mathématiques", minutes: 240, color: "#4AC9CC" },
      { name: "SVT", minutes: 120, color: "#6BD9A4" },
      { name: "Anglais", minutes: 120, color: "#7B8FF5" },
    ],
  },
  "2026-04-16": {
    totalMinutes: 200,
    subjects: [
      { name: "Histoire", minutes: 120, color: "#F4A259" },
      { name: "Géographie", minutes: 80, color: "#9B8FD4" },
    ],
  },
  "2026-04-17": {
    totalMinutes: 720,
    subjects: [
      { name: "Mathématiques", minutes: 360, color: "#4AC9CC" },
      { name: "Physique", minutes: 240, color: "#F28C8C" },
      { name: "Chimie", minutes: 120, color: "#F4A259" },
    ],
  },
};

type HeatThreshold = { label: string; min: number; bg: string };

function heatThresholds(theme: typeof Colors.light): HeatThreshold[] {
  const h = (n: number) => n * 60;
  return [
    { label: "0", min: 0, bg: theme.primaryTint },
    { label: "2+", min: h(2), bg: theme.primaryLight },
    { label: "4+", min: h(4), bg: theme.primary },
    { label: "6+", min: h(6), bg: theme.primaryDark },
    { label: "8+", min: h(8), bg: "#0D6E70" },
  ];
}

function getDayColor(minutes: number, thresholds: HeatThreshold[]): string | null {
  if (!minutes) return null;
  let t = thresholds[0];
  for (const th of thresholds) {
    if (minutes >= th.min) t = th;
  }
  return t.bg;
}

function dateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function buildCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells: { day: number; current: boolean }[] = [];
  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, current: false });
  }
  return cells;
}

function startOfWeekMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

const dayDetailStyles = StyleSheet.create({
  wrap: { paddingBottom: 0 },
  emptyStateText: { textAlign: "center", marginTop: 8, marginBottom: 6 },
  bars: { marginTop: 8 },
});

/** Barres par matière (jour, semaine ou mois agrégés). */
function DayDetailCombined({
  sessions,
  t,
  emptyKey = "calendarStats.emptyDay",
}: {
  sessions: DaySessions | undefined;
  t: (k: string, o?: Record<string, string | number>) => string;
  emptyKey?: "calendarStats.emptyDay" | "calendarStats.emptyPeriod";
}) {
  if (!sessions) {
    return (
      <Text variant="body" colorName="textMuted" style={dayDetailStyles.emptyStateText}>
        {t(emptyKey)}
      </Text>
    );
  }

  const { subjects, totalMinutes } = sessions;

  return (
    <View style={dayDetailStyles.wrap}>
      <View style={dayDetailStyles.bars}>
        {subjects.map((sub, i) => (
          <SubjectBar
            key={`${sub.name}-${i}`}
            color={sub.color}
            name={sub.name}
            value={formatStatMinutes(sub.minutes)}
            fillPercent={totalMinutes > 0 ? (sub.minutes / totalMinutes) * 100 : 0}
          />
        ))}
      </View>
    </View>
  );
}

function sumMonthMinutesMock(year: number, month: number): number {
  let total = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    total += MOCK_SESSIONS[dateKey(year, month, d)]?.totalMinutes ?? 0;
  }
  return total;
}

export default function CalendarStatsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const thresholds = useMemo(() => heatThresholds(theme), [theme]);

  const today = useMemo(() => new Date(), []);
  const [focusDate, setFocusDate] = useState(() => new Date());

  const locale = i18n.language?.startsWith("fr") ? "fr-FR" : "en-US";

  const viewYear = focusDate.getFullYear();
  const viewMonth = focusDate.getMonth();

  const cells = useMemo(() => buildCalendar(viewYear, viewMonth), [viewYear, viewMonth]);

  const monthTotal = useMemo(() => sumMonthMinutesMock(viewYear, viewMonth), [viewYear, viewMonth]);

  const formatNavLabel = () =>
    focusDate.toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    });

  const goPrev = () => {
    const d = new Date(focusDate);
    d.setMonth(d.getMonth() - 1);
    setFocusDate(d);
  };

  const goNext = () => {
    const d = new Date(focusDate);
    d.setMonth(d.getMonth() + 1);
    setFocusDate(d);
  };

  const isCurrentPeriod = useMemo(
    () => checkIsCurrentPeriod("month", focusDate),
    [focusDate]
  );

  const selKey = dateKey(focusDate.getFullYear(), focusDate.getMonth(), focusDate.getDate());
  const selSession = MOCK_SESSIONS[selKey];
  const selDateObj = new Date(focusDate.getFullYear(), focusDate.getMonth(), focusDate.getDate());
  const selLabel = selDateObj.toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const monthTitle = new Date(viewYear, viewMonth, 1).toLocaleDateString(locale, {
    month: "short",
  });

  const yearMonthBars = useMemo(() => {
    const y = focusDate.getFullYear();
    const rows = Array.from({ length: 12 }, (_, m) => ({
      key: m,
      label: new Date(y, m, 1).toLocaleDateString(locale, { month: "short" }),
      minutes: sumMonthMinutesMock(y, m),
    }));
    const maxMin = Math.max(...rows.map((r) => r.minutes), 1);
    const yearTotal = rows.reduce((a, r) => a + r.minutes, 0);
    return { rows, maxMin, yearTotal };
  }, [focusDate, locale]);

  const weekMeta = useMemo(() => {
    const anchor = new Date(focusDate.getFullYear(), focusDate.getMonth(), focusDate.getDate());
    const monday = startOfWeekMonday(anchor);
    const keys: string[] = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(monday);
      dt.setDate(monday.getDate() + i);
      keys.push(dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate()));
    }
    const dayKeys: ("mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun")[] = [
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat",
      "sun",
    ];
    const labels = dayKeys.map((k) => t(`common.days.${k}`));
    const weekTotal = keys.reduce((a, k) => a + (MOCK_SESSIONS[k]?.totalMinutes ?? 0), 0);
    const maxMin = Math.max(...keys.map((k) => MOCK_SESSIONS[k]?.totalMinutes ?? 0), 1);
    const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
    return { keys, labels, weekTotal, maxMin, todayKey };
  }, [focusDate, t, today]);

  const calendarWeekdayLabels = useMemo(() => {
    const keys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
    return keys.map((k) => t(`common.days.${k}`));
  }, [t]);

  const handleBack = () => router.back();

  return (
    <TabScreen
      title={t("calendarStats.title")}
      gap={8}
      leftAction={
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ChevronLeft size={24} color={theme.text} />
        </TouchableOpacity>
      }
    >
      <View style={styles.dateNav}>
        <Pressable style={styles.dateNavButton} onPress={goPrev} hitSlop={12}>
          <ChevronLeft size={22} color={theme.textMuted} />
        </Pressable>
        <Text variant="subtitle" style={styles.dateNavLabel}>
          {formatNavLabel()}
        </Text>
        <Pressable
          style={[styles.dateNavButton, isCurrentPeriod && styles.dateNavButtonDisabled]}
          onPress={goNext}
          hitSlop={12}
          disabled={isCurrentPeriod}
        >
          <ChevronRight size={22} color={theme.textMuted} />
        </Pressable>
      </View>

      <Card variant="border" style={styles.sectionCard}>
        <View style={styles.weekHeader}>
          {calendarWeekdayLabels.map((d) => (
            <Text key={d} variant="micro" colorName="textMuted" style={styles.weekHeaderCell}>
              {d}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((cell, i) => {
            const isToday =
              cell.current &&
              cell.day === today.getDate() &&
              viewYear === today.getFullYear() &&
              viewMonth === today.getMonth();
            const isSelected =
              cell.current &&
              cell.day === focusDate.getDate() &&
              viewYear === focusDate.getFullYear() &&
              viewMonth === focusDate.getMonth();
            const k = cell.current ? dateKey(viewYear, viewMonth, cell.day) : null;
            const mins = k ? (MOCK_SESSIONS[k]?.totalMinutes ?? 0) : 0;
            const heat = cell.current ? getDayColor(mins, thresholds) : null;

            return (
              <Pressable
                key={i}
                disabled={!cell.current}
                onPress={() => {
                  if (cell.current) setFocusDate(new Date(viewYear, viewMonth, cell.day));
                }}
                style={styles.cellWrap}
              >
                <View
                  style={[
                    styles.cellInner,
                    isSelected && { backgroundColor: theme.text },
                    !isSelected && heat && { backgroundColor: heat },
                    isToday && !isSelected && { borderWidth: 2, borderColor: theme.text },
                  ]}
                >
                  <Text
                    variant="body"
                    style={[
                      styles.cellNum,
                      isSelected && { color: theme.surface },
                      cell.current && !isSelected && { color: theme.text },
                      !cell.current && { color: theme.textMuted, opacity: 0.45 },
                    ]}
                  >
                    {cell.day}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendPills}>
            {thresholds.map((th, idx) => (
              <View
                key={th.label}
                style={[
                  styles.legendPill,
                  { backgroundColor: th.bg },
                  idx === 0 && { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: theme.border },
                ]}
              >
                <Text
                  variant="micro"
                  style={{
                    fontFamily: INTER.bold,
                    color:
                      idx === 0
                        ? theme.textMuted
                        : idx >= 3
                          ? theme.onPrimaryDark
                          : theme.text,
                  }}
                >
                  {th.label}
                </Text>
              </View>
            ))}
          </View>
          <Text variant="micro" colorName="textMuted" style={styles.monthTotal}>
            {t("calendarStats.monthTotal", {
              month: monthTitle.trim(),
              time: formatStatMinutes(monthTotal),
            })}
          </Text>
        </View>
      </Card>

      <Card variant="border" style={styles.sectionCard}>
        <View style={styles.goalVsActualHeaderTitleRow}>
          <Text
            variant="subtitle"
            colorName="text"
            style={[styles.dayDistributionSectionTitle, styles.distributionTitle]}
            numberOfLines={2}
          >
            {selLabel}
          </Text>
          {selSession ? (
            <Text variant="micro" colorName="textMuted" style={styles.goalVsActualTime}>
              {formatStatMinutes(selSession.totalMinutes)}
            </Text>
          ) : null}
        </View>
        <DayDetailCombined sessions={selSession} t={t} />
      </Card>

      <Card variant="border" style={styles.sectionCard}>
        <View style={styles.weekSummaryHeader}>
          <Text variant="subtitle" colorName="text">
            {t("calendarStats.thisWeek")}
          </Text>
          <Text variant="caption" colorName="primary" style={styles.weekTotalStrong}>
            {formatStatMinutes(weekMeta.weekTotal)}
          </Text>
        </View>
        <View style={styles.weekChartRow}>
          {weekMeta.keys.map((key, idx) => {
            const mins = MOCK_SESSIONS[key]?.totalMinutes ?? 0;
            const pct = mins / weekMeta.maxMin;
            const isTodayBar = key === weekMeta.todayKey;
            return (
              <View key={key} style={styles.weekChartCol}>
                <View style={styles.weekChartTrack}>
                  <View
                    style={[
                      styles.weekChartFill,
                      {
                        height: `${Math.max(pct * 100, mins > 0 ? 12 : 0)}%`,
                        backgroundColor: isTodayBar
                          ? theme.primary
                          : mins > 0
                            ? theme.primaryLight
                            : theme.surfaceElevated,
                      },
                    ]}
                  />
                </View>
                <Text
                  variant="micro"
                  style={{
                    marginTop: 6,
                    fontFamily: isTodayBar ? INTER.bold : INTER.regular,
                    color: isTodayBar ? theme.primary : theme.textMuted,
                  }}
                >
                  {weekMeta.labels[idx]}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>

      <Card variant="border" style={styles.sectionCard}>
        <View style={styles.weekSummaryHeader}>
          <Text variant="subtitle" colorName="text">
            {String(focusDate.getFullYear())}
          </Text>
          <Text variant="caption" colorName="primary" style={styles.weekTotalStrong}>
            {formatStatMinutes(yearMonthBars.yearTotal)}
          </Text>
        </View>
        <View style={[styles.weekChartRow, styles.yearBarRow]}>
          {yearMonthBars.rows.map((row) => {
            const pct = row.minutes / yearMonthBars.maxMin;
            const isCalendarMonth = row.key === viewMonth;
            return (
              <View key={row.key} style={styles.weekChartCol}>
                <View style={styles.weekChartTrack}>
                  <View
                    style={[
                      styles.weekChartFill,
                      {
                        height: `${Math.max(pct * 100, row.minutes > 0 ? 12 : 0)}%`,
                        backgroundColor:
                          row.minutes > 0
                            ? isCalendarMonth
                              ? theme.primary
                              : theme.primaryLight
                            : theme.surfaceElevated,
                      },
                    ]}
                  />
                </View>
                <Text
                  variant="micro"
                  colorName={isCalendarMonth ? "primary" : "textMuted"}
                  style={[styles.yearMonthLabel, isCalendarMonth && styles.yearMonthLabelActive]}
                >
                  {row.label}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>
    </TabScreen>
  );
}
const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    backButton: { padding: 4, marginLeft: -4 },
    sectionCard: { marginBottom: 8, padding: 12 },
    weekTotalStrong: { fontFamily: INTER.bold },
    dateNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
      paddingHorizontal: 4,
    },
    dateNavButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    dateNavButtonDisabled: {
      opacity: 0.4,
    },
    dateNavLabel: {
      flex: 1,
      textAlign: "center",
      fontWeight: "600",
    },
    yearBarRow: { height: 112, gap: 2 },
    yearMonthLabel: { marginTop: 4, textAlign: "center", fontSize: 10 },
    yearMonthLabelActive: { fontFamily: INTER.bold },
    weekHeader: {
      flexDirection: "row",
      marginBottom: 4,
    },
    weekHeaderCell: {
      flex: 1,
      textAlign: "center",
      fontWeight: "600",
      paddingBottom: 6,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    cellWrap: {
      width: `${100 / 7}%`,
      alignItems: "center",
      paddingVertical: 4,
    },
    cellInner: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    cellNum: { fontSize: 14 },
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.divider,
      gap: 8,
    },
    legendPills: {
      flexDirection: "row",
      flexWrap: "wrap",
      flex: 1,
      gap: 4,
      alignItems: "center",
      minWidth: 0,
      marginRight: 8,
    },
    legendPill: {
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    monthTotal: { fontFamily: INTER.semiBold, flexShrink: 0 },
    /** Aligné sur `dashboard` — carte « Objectif vs réel » / temps par matière */
    goalVsActualHeaderTitleRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      minWidth: 0,
    },
    dayDistributionSectionTitle: {
      fontSize: 15,
      fontWeight: "600",
      flexShrink: 1,
    },
    distributionTitle: { fontWeight: "600" },
    goalVsActualTime: { fontWeight: "700" },
    weekSummaryHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    weekChartRow: { flexDirection: "row", gap: 6, alignItems: "flex-end", height: 100 },
    weekChartCol: { flex: 1, alignItems: "center" },
    weekChartTrack: {
      width: "100%",
      height: 60,
      justifyContent: "flex-end",
    },
    weekChartFill: {
      width: "100%",
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
      minHeight: 0,
    },
  });


