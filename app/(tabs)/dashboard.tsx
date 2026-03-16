import { TabScreen } from "@/components/layout/TabScreen";
import { Text } from "@/components/Themed";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import Colors from "@/constants/Colors";
import { useDashboard } from "@/hooks/useDashboard";
import { useAuth } from "@/utils/authContext";
import { useTheme } from "@/utils/themeContext";
import { formatDurationCompact, formatMinutesCompact, getWeekRangeForDate } from "@/utils/time";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react-native";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

// --- MOCK DATA (subject distribution - can be wired to real data later) ---
const subjectData = [
  { name: "Programmation", value: 35 },
  { name: "Mathématiques", value: 25 },
  { name: "Physique", value: 20 },
  { name: "Anglais", value: 12 },
  { name: "Histoire", value: 8 },
];


const dayNumToKey: Record<number, string> = {
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
  7: "sun",
};

const HISTOGRAM_BAR_HEIGHT = 100;

type Period = "week" | "month" | "year";

const periodOptions: Period[] = ["week", "month", "year"];

export default function DashboardScreen() {
  const { user } = useAuth();
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const subjectPalette = theme.subjectPalette;
  const [period, setPeriod] = React.useState<Period>("week");
  const [focusDate, setFocusDate] = React.useState(() => new Date());
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string | null>(null);
  const [isSubjectMenuOpen, setSubjectMenuOpen] = React.useState(false);
  const { t } = useTranslation();
  const iconColor = theme.primary;

  const {
    profile,
    weeklyTotalSeconds,
    weeklyGoalMinutes,
    sessionTotals,
    subjectNameById,
    histogramData,
    histogramSubjects,
    parentSubjects,
  } = useDashboard(user?.id ?? null, period, focusDate);

  const histogramBuckets = histogramData(selectedSubjectId);
  const maxHistogramMinutes = Math.max(
    ...histogramBuckets.map((d) => Math.max(d.actualMinutes, d.plannedMinutes)),
    1
  );

  const dropdownSubjects = histogramSubjects.length > 0 ? histogramSubjects : parentSubjects;

  const handleSelectSubject = (subjectId: string | null) => {
    setSelectedSubjectId(subjectId);
    setSubjectMenuOpen(false);
  };

  const formatDayLabel = (day: number) => {
    const key = dayNumToKey[day] ?? "mon";
    return t(`common.days.${key}`, { defaultValue: key });
  };

  const formatNavLabel = () => {
    if (period === "week") {
      const d = new Date(focusDate);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(d);
      monday.setDate(d.getDate() + diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return `${monday.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${sunday.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    if (period === "month") {
      return focusDate.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
    }
    return focusDate.getFullYear().toString();
  };

  const goPrev = () => {
    const d = new Date(focusDate);
    if (period === "week") d.setDate(d.getDate() - 7);
    else if (period === "month") d.setMonth(d.getMonth() - 1);
    else d.setFullYear(d.getFullYear() - 1);
    setFocusDate(d);
  };

  const goNext = () => {
    const d = new Date(focusDate);
    if (period === "week") d.setDate(d.getDate() + 7);
    else if (period === "month") d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    setFocusDate(d);
  };

  const isCurrentPeriod = React.useMemo(() => {
    const now = new Date();
    if (period === "week") {
      const focusWeek = getWeekRangeForDate(focusDate);
      const nowWeek = getWeekRangeForDate(now);
      return focusWeek.fromIso === nowWeek.fromIso;
    }
    if (period === "month") {
      return focusDate.getMonth() === now.getMonth() && focusDate.getFullYear() === now.getFullYear();
    }
    return focusDate.getFullYear() === now.getFullYear();
  }, [period, focusDate]);

  return (
    <TabScreen title={t("dashboard.title")}>

        {/* TABS */}
        <Tabs
          options={periodOptions.map(option => ({
            value: option,
            label: t(`common.period.${option}`),
          }))}
          value={period}
          onChange={setPeriod}
        />

        {/* DATE NAVIGATION */}
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

        {/* WEEKLY OBJECTIVE (planned vs real) - week only */}
        {period === "week" && (
          <Card variant="border" style={styles.weeklyObjectiveCard}>
            <View style={styles.weeklyObjectiveHeader}>
              <Text variant="subtitle" colorName="textMuted" style={styles.weeklyObjectiveTitle}>
                {t("dashboard.weeklyObjective")}
              </Text>
              <Text variant="subtitle" style={styles.weeklyObjectiveValue}>
                {formatDurationCompact(weeklyTotalSeconds)} / {formatMinutesCompact(weeklyGoalMinutes)}
              </Text>
            </View>
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(
                      100,
                      weeklyGoalMinutes > 0
                        ? (weeklyTotalSeconds / 60 / weeklyGoalMinutes) * 100
                        : 0
                    )}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.weeklyObjectiveFooter}>
              <Text variant="micro" colorName="textMuted">
                {t("dashboard.percentComplete", {
                  percent: Math.min(
                    100,
                    Math.round(
                      weeklyGoalMinutes > 0
                        ? (weeklyTotalSeconds / 60 / weeklyGoalMinutes) * 100
                        : 0
                    )
                  ),
                })}
              </Text>
            </View>
          </Card>
        )}

        {/* METRIC CARDS: Total time | Streak | Sessions */}
        <View style={styles.metricsRow}>
          <StatCard
            icon={Clock}
            value={formatDurationCompact(weeklyTotalSeconds)}
            label={t("common.totalTime")}
            iconColor={iconColor}
          />
          <StatCard
            icon={Flame}
            value={(profile?.current_streak ?? 0) > 0
              ? t("dashboard.streakDays_other", { count: profile?.current_streak })
              : t("dashboard.streakDays_zero")}
            label={t("profile.stats.streak")}
            iconColor={theme.secondary}
          />
          <StatCard
            icon={Zap}
            value={String(sessionTotals?.count ?? 0)}
            label={t("profile.stats.sessions")}
            iconColor={iconColor}
          />
        </View>

        {/* DISTRIBUTION (Répartition) */}
        <Card variant="border" style={styles.distributionCard}>
          <View style={styles.distributionHeader}>
            <Target size={20} color={iconColor} />
            <Text variant="h2" style={styles.distributionTitle}>
              {t("dashboard.distribution")}
            </Text>
          </View>
          <Text variant="caption" colorName="textMuted" style={styles.distributionSubtitle}>
            {formatNavLabel()}
          </Text>
          {subjectData.length > 0 && weeklyTotalSeconds > 0 ? (
            <View style={styles.distributionBars}>
              {subjectData.map((s, i) => (
                <View key={i} style={styles.barRow}>
                  <View style={styles.barHeader}>
                    <Text variant="subtitle" colorName="textMuted" style={styles.barLabel}>
                      {s.name}
                    </Text>
                    <Text variant="subtitle" style={styles.barValue}>
                      {s.value}%
                    </Text>
                  </View>
                  <View style={styles.barBg}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${s.value}%`, backgroundColor: subjectPalette[i % subjectPalette.length] },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text variant="body" colorName="textMuted" style={styles.emptyStateText}>
              {t("dashboard.noSessionsForPeriod")}
            </Text>
          )}
        </Card>

        {/* DAILY PROGRESS (Histogram) */}
        <Card variant="border" style={styles.histogramCard}>
          <View style={styles.histogramCardHeader}>
            <TrendingUp size={18} color={iconColor} />
            <Text variant="h2" style={styles.histogramCardTitle}>
              {t("dashboard.dailyProgress")}
            </Text>
          </View>

          {period === "week" && (
            <View style={styles.histogramLegend}>
              <View style={styles.histogramLegendItem}>
                <View style={[styles.histogramLegendDot, { backgroundColor: theme.primary }]} />
                <Text variant="caption" colorName="textMuted">
                  {t("common.actual")}
                </Text>
              </View>
              <View style={styles.histogramLegendItem}>
                <View
                  style={[
                    styles.histogramLegendDot,
                    { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
                  ]}
                />
                <Text variant="caption" colorName="textMuted">
                  {t("common.planned")}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.dropdownSection}>
            <Pressable
              style={styles.dropdownTrigger}
              onPress={() => setSubjectMenuOpen((open) => !open)}
            >
              <Text variant="subtitle" style={styles.dropdownValue}>
                {selectedSubjectId === null
                  ? t("dashboard.filterAll")
                  : subjectNameById[selectedSubjectId] ?? t("dashboard.filterAll")}
              </Text>
              <Text variant="caption" colorName="textMuted" style={styles.dropdownChevron}>
                {isSubjectMenuOpen ? "▲" : "▼"}
              </Text>
            </Pressable>

            {isSubjectMenuOpen && (
              <View style={styles.dropdownList}>
                <Pressable
                  style={[styles.dropdownOption, styles.dropdownOptionFirst]}
                  onPress={() => handleSelectSubject(null)}
                >
                  <Text
                    variant="subtitle"
                    style={[
                      styles.dropdownOptionText,
                      selectedSubjectId === null && styles.dropdownOptionTextActive,
                    ]}
                  >
                    {t("dashboard.filterAll")}
                  </Text>
                </Pressable>

                {dropdownSubjects.map((subject, index) => (
                  <Pressable
                    key={subject.id}
                    style={[
                      styles.dropdownOption,
                      { borderLeftColor: subjectPalette[index % subjectPalette.length] },
                    ]}
                    onPress={() => handleSelectSubject(subject.id)}
                  >
                    <Text
                      variant="subtitle"
                      style={[
                        styles.dropdownOptionText,
                        selectedSubjectId === subject.id && styles.dropdownOptionTextActive,
                      ]}
                    >
                      {subject.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {period === "week" ? (
            <View style={styles.histogramChartArea}>
              {histogramBuckets.map((item) => {
                const chartHeight = HISTOGRAM_BAR_HEIGHT;
                const goalH = maxHistogramMinutes > 0
                  ? (item.plannedMinutes / maxHistogramMinutes) * chartHeight
                  : 0;
                const actualH = maxHistogramMinutes > 0
                  ? (item.actualMinutes / maxHistogramMinutes) * chartHeight
                  : 0;
                const actualBarHeight = item.actualMinutes > 0
                  ? Math.max(actualH, 4)
                  : 0;
                return (
                  <View key={item.key} style={styles.histogramColumn}>
                    <View style={styles.histogramBarsRow}>
                      <View
                        style={[
                          styles.histogramBarPlanned,
                          {
                            height: Math.max(goalH, item.plannedMinutes > 0 ? 2 : 0),
                            backgroundColor: theme.surface,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.histogramBarActual,
                          {
                            height: actualBarHeight,
                            backgroundColor: theme.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text variant="micro" colorName="textMuted" style={styles.histogramColumnLabel}>
                      {formatDayLabel(item.key)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.histogramMonthYearWrap}>
              <View style={styles.histogramChartArea}>
                {histogramBuckets.map((item) => {
                  const rawHeight =
                    (item.actualMinutes / maxHistogramMinutes) * HISTOGRAM_BAR_HEIGHT;
                  const actualHeight = item.actualMinutes > 0 ? Math.max(rawHeight, 4) : 0;
                  const axisLabel =
                    period === "year"
                      ? new Date(2024, item.key - 1, 1).toLocaleDateString(undefined, { month: "short" })
                      : item.label;
                  return (
                    <View key={item.key} style={styles.histogramColumn}>
                      <View style={styles.histogramBarsRowSingle}>
                        <View
                          style={[
                            styles.histogramBarActual,
                            styles.histogramBarFullWidth,
                            {
                              height: actualHeight,
                              backgroundColor: theme.primary,
                            },
                          ]}
                        />
                      </View>
                      <Text variant="micro" colorName="textMuted" style={styles.histogramColumnLabel}>
                        {axisLabel}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {period === "month" && histogramBuckets.length > 0 && (
                <View style={styles.histogramMonthLabels}>
                  <Text variant="micro" colorName="textMuted">1</Text>
                  <Text variant="micro" colorName="textMuted">{histogramBuckets.length}</Text>
                </View>
              )}
            </View>
          )}
        </Card>

    </TabScreen>
  );
}

// ---------------------------------------------------------------------------
// STYLES 
// ---------------------------------------------------------------------------
const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },


    // Weekly objective card (planned vs real)
    weeklyObjectiveCard: { marginBottom: 12, padding: 16 },
    weeklyObjectiveHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    weeklyObjectiveTitle: { fontWeight: "600" },
    weeklyObjectiveValue: { fontWeight: "700" },
    weeklyObjectiveFooter: { marginTop: 6, alignItems: "flex-end" },

    // Metric cards row
    metricsRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 16,
    },

    // Distribution card
    distributionCard: { marginBottom: 16, padding: 16 },
    distributionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    distributionTitle: { fontWeight: "600" },
    distributionSubtitle: { marginTop: 4, marginBottom: 12 },
    distributionBars: { marginTop: 8 },
    emptyStateText: { textAlign: "center", marginTop: 12, marginBottom: 8 },

    // Histogram card
    histogramCard: { padding: 12, marginBottom: 16 },
    histogramCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 10,
    },
    histogramCardTitle: { fontWeight: "600" },

    weeklyHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    weeklyLabel: { fontWeight: "600" },
    timeRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 4,
      marginVertical: 14,
    },
    // One-off large display size for time
    hoursText: { fontSize: 40, fontWeight: "700", color: theme.text },
    minutesText: { fontWeight: "600" },

    progressContainer: { marginTop: 8 },
    progressLabels: { flexDirection: "row", justifyContent: "space-between" },
    progressLabel: {},
    progressBg: {
      height: 10,
      backgroundColor: theme.border,
      borderRadius: 5,
      marginTop: 6,
    },
    progressFill: {
      height: "100%",
      backgroundColor: theme.primary,
      borderRadius: 5,
    },

    // Date navigation
    dateNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
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

    // Sections
    section: { marginBottom: 24 },
    sectionSubtitle: {},
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },

    // Bars
    barRow: { marginBottom: 12 },
    barHeader: { flexDirection: "row", justifyContent: "space-between" },
    barLabel: {},
    barValue: { fontWeight: "600" },
    barBg: {
      height: 8,
      backgroundColor: theme.border,
      borderRadius: 4,
      overflow: "hidden",
      marginTop: 4,
    },
    barFill: { height: "100%", borderRadius: 4 },

    // Heatmap
    heatmapGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    heatCell: { width: "12%", aspectRatio: 1, borderRadius: 6 },

    // Histogram
    histogramLegend: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 8,
    },
    histogramLegendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    histogramLegendDot: {
      width: 10,
      height: 10,
      borderRadius: 2,
    },
    dropdownSection: { gap: 6 },
    dropdownLabel: { fontWeight: "600" },
    dropdownTrigger: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: theme.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    dropdownValue: { fontWeight: "600" },
    dropdownChevron: { marginLeft: 12 },
    dropdownList: {
      marginTop: 6,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.surface,
      overflow: "hidden",
    },
    dropdownOption: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      borderLeftWidth: 3,
      borderLeftColor: "transparent",
    },
    dropdownOptionFirst: { borderTopWidth: 0 },
    dropdownOptionText: { color: theme.text, fontWeight: "500" },
    dropdownOptionTextActive: { color: theme.primary, fontWeight: "700" },
    histogramMonthYearWrap: { marginTop: 10 },
    histogramMonthLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 4,
      paddingHorizontal: 4,
    },
    // Vertical bar chart (Lovable-style: side-by-side planned/actual per column)
    histogramChartArea: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 4,
      marginTop: 10,
    },
    histogramColumn: {
      flex: 1,
      alignItems: "center",
      gap: 4,
    },
    histogramBarsRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 2,
      width: "100%",
      height: HISTOGRAM_BAR_HEIGHT,
    },
    histogramBarsRowSingle: {
      width: "100%",
      height: HISTOGRAM_BAR_HEIGHT,
      alignItems: "flex-end",
      justifyContent: "center",
    },
    histogramBarFullWidth: {
      width: "100%",
      flex: undefined,
    },
    histogramBarPlanned: {
      flex: 1,
      minHeight: 0,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    histogramBarActual: {
      flex: 1,
      minHeight: 0,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
    },
    histogramColumnLabel: {
      marginTop: 2,
    },
  });
