import { TabScreen } from "@/components/layout/TabScreen";
import { Text } from "@/components/Themed";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import Colors from "@/constants/Colors";
import { getSubjectDisplayName } from "@/constants/subjectCatalog";
import { useDashboard } from "@/hooks/useDashboard";
import { createSubjectColorMap } from "@/utils/color";
import { useAuth } from "@/utils/authContext";
import { useTheme } from "@/utils/themeContext";
import { formatDurationCompact, formatMinutesCompact, getWeekRangeForDate } from "@/utils/time";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react-native";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

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

type Period = "day" | "week" | "month" | "year";

const periodOptions: Period[] = ["day", "week", "month", "year"];

function formatStatMinutes(minutes: number): string {
  if (minutes <= 0) return "0m";
  return formatMinutesCompact(minutes);
}

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
    weeklyTotalSeconds,
    longestSessionSeconds,
    subjectNameById,
    subjectGoalVsActual,
    distributionBySubject,
    histogramData,
    histogramSubjects,
    parentSubjects,
  } = useDashboard(user?.id ?? null, period, focusDate);

  const subjectColorById = React.useMemo(
    () =>
      createSubjectColorMap(
        parentSubjects.map((s) => ({
          ...s,
          children: [] as { id: string; custom_color?: string | null; color?: string | null }[],
        })),
        subjectPalette,
        theme.primary
      ),
    [parentSubjects, subjectPalette, theme.primary]
  );

  const goalVsActualTotals = React.useMemo(() => {
    if (!subjectGoalVsActual.length) return null;
    const actual = subjectGoalVsActual.reduce((s, r) => s + r.actualMinutes, 0);
    const goal = subjectGoalVsActual.reduce((s, r) => s + r.goalMinutes, 0);
    return { actual, goal };
  }, [subjectGoalVsActual]);

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
    if (period === "day") {
      return focusDate.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
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
    if (period === "day") d.setDate(d.getDate() - 1);
    else if (period === "week") d.setDate(d.getDate() - 7);
    else if (period === "month") d.setMonth(d.getMonth() - 1);
    else d.setFullYear(d.getFullYear() - 1);
    setFocusDate(d);
  };

  const goNext = () => {
    const d = new Date(focusDate);
    if (period === "day") d.setDate(d.getDate() + 1);
    else if (period === "week") d.setDate(d.getDate() + 7);
    else if (period === "month") d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    setFocusDate(d);
  };

  const isCurrentPeriod = React.useMemo(() => {
    const now = new Date();
    if (period === "day") {
      return (
        focusDate.getFullYear() === now.getFullYear() &&
        focusDate.getMonth() === now.getMonth() &&
        focusDate.getDate() === now.getDate()
      );
    }
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
    <TabScreen title={t("dashboard.title")} gap={8}>

        {/* TABS */}
        <Tabs
          style={styles.periodTabs}
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

        {/* METRIC CARDS: Total time | Longest session */}
        <View style={styles.metricsRow}>
          <StatCard
            icon={Clock}
            value={formatDurationCompact(weeklyTotalSeconds)}
            label={t("common.totalTime")}
            iconColor={iconColor}
          />
          <StatCard
            icon={Timer}
            value={formatDurationCompact(longestSessionSeconds)}
            label={t("dashboard.longestSession")}
            iconColor={iconColor}
          />
        </View>

        {(period === "day" || period === "week") && (
          <Card variant="border" style={styles.distributionCard}>
            <View style={styles.distributionHeader}>
              <Target size={18} color={iconColor} />
              <View style={styles.goalVsActualHeaderTitleRow}>
                <Text
                  variant="subtitle"
                  style={[styles.dashboardSectionTitle, styles.distributionTitle]}
                >
                  {t("dashboard.goalVsActual.title")}
                </Text>
                {goalVsActualTotals ? (
                  <Text variant="micro" colorName="textMuted" style={styles.goalVsActualTime}>
                    {formatStatMinutes(goalVsActualTotals.actual)} /{" "}
                    {formatStatMinutes(goalVsActualTotals.goal)}
                  </Text>
                ) : null}
              </View>
            </View>

            {subjectGoalVsActual.length === 0 ? (
              <Text variant="body" colorName="textMuted" style={styles.emptyStateText}>
                {t("dashboard.goalVsActual.empty")}
              </Text>
            ) : (
              <View style={[styles.distributionBars, styles.goalVsActualBars]}>
                {subjectGoalVsActual.map((row) => {
                  const dotColor = subjectColorById[row.subjectId] ?? theme.primary;
                  const pctFill =
                    row.goalMinutes > 0
                      ? Math.min(100, (row.actualMinutes / row.goalMinutes) * 100)
                      : 0;
                  return (
                    <View key={row.subjectId} style={styles.barRow}>
                      <View style={styles.barHeader}>
                        <View style={styles.goalVsActualLabelWithDot}>
                          <View style={[styles.goalVsActualDot, { backgroundColor: dotColor }]} />
                          <Text variant="caption" colorName="textMuted" style={styles.barLabel}>
                            {row.subjectName}
                          </Text>
                        </View>
                        <Text variant="caption" colorName="textMuted">
                          {formatStatMinutes(row.actualMinutes)} /{" "}
                          {formatStatMinutes(row.goalMinutes)}
                        </Text>
                      </View>
                      <View style={styles.barBg}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${pctFill}%`,
                              backgroundColor: dotColor,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        )}

        {/* Mois / année : chart type Objectif vs réel, temps réel uniquement */}
        {(period === "month" || period === "year") && (
          <Card variant="border" style={styles.distributionCard}>
            <View style={styles.distributionHeader}>
              <Target size={18} color={iconColor} />
              <View style={styles.goalVsActualHeaderTitleRow}>
                <Text variant="subtitle" style={[styles.dashboardSectionTitle, styles.distributionTitle]}>
                  {t("dashboard.timeBySubject")}
                </Text>
                {weeklyTotalSeconds > 0 ? (
                  <Text variant="micro" colorName="textMuted" style={styles.goalVsActualTime}>
                    {formatDurationCompact(weeklyTotalSeconds)}
                  </Text>
                ) : null}
              </View>
            </View>
            {distributionBySubject.length > 0 ? (
              <View style={[styles.distributionBars, styles.goalVsActualBars]}>
                {distributionBySubject.map((s, i) => {
                  const dotColor = subjectColorById[s.subjectId] ?? subjectPalette[i % subjectPalette.length];
                  return (
                    <View key={s.subjectId} style={styles.barRow}>
                      <View style={styles.barHeader}>
                        <View style={styles.goalVsActualLabelWithDot}>
                          <View style={[styles.goalVsActualDot, { backgroundColor: dotColor }]} />
                          <Text variant="caption" colorName="textMuted" style={styles.barLabel}>
                            {s.name}
                          </Text>
                        </View>
                        <Text variant="caption" colorName="textMuted">
                          {formatDurationCompact(s.seconds)}
                        </Text>
                      </View>
                      <View style={styles.barBg}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${s.percent}%`, backgroundColor: dotColor },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text variant="body" colorName="textMuted" style={styles.emptyStateText}>
                {t("dashboard.noSessionsForPeriod")}
              </Text>
            )}
          </Card>
        )}

        {/* Répartition (%) — jour & semaine uniquement */}
        {(period === "day" || period === "week") && (
          <Card variant="border" style={styles.distributionCard}>
            <View style={styles.distributionHeader}>
              <Target size={18} color={iconColor} />
              <View style={styles.goalVsActualHeaderTitleRow}>
                <Text variant="subtitle" style={[styles.dashboardSectionTitle, styles.distributionTitle]}>
                  {t("dashboard.distribution")}
                </Text>
                <Text variant="micro" colorName="textMuted">
                  {formatNavLabel()}
                </Text>
              </View>
            </View>
            {distributionBySubject.length > 0 ? (
              <View style={[styles.distributionBars, styles.goalVsActualBars]}>
                {distributionBySubject.map((s, i) => {
                  const dotColor = subjectColorById[s.subjectId] ?? subjectPalette[i % subjectPalette.length];
                  return (
                    <View key={s.subjectId} style={styles.barRow}>
                      <View style={styles.barHeader}>
                        <View style={styles.goalVsActualLabelWithDot}>
                          <View style={[styles.goalVsActualDot, { backgroundColor: dotColor }]} />
                          <Text variant="micro" colorName="textMuted" style={styles.barLabel}>
                            {s.name}
                          </Text>
                        </View>
                        <Text variant="micro" colorName="textMuted" style={styles.goalVsActualTime}>
                          {s.percent}%
                        </Text>
                      </View>
                      <View style={styles.barBg}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${s.percent}%`, backgroundColor: dotColor },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text variant="body" colorName="textMuted" style={styles.emptyStateText}>
                {t("dashboard.noSessionsForPeriod")}
              </Text>
            )}
          </Card>
        )}

        {/* Progression (histogramme inutile pour la vue « Jour » : un seul jour) */}
        {period !== "day" && (
        <Card variant="border" style={styles.histogramCard}>
          <View style={styles.histogramCardHeader}>
            <TrendingUp size={18} color={iconColor} />
            <Text variant="subtitle" style={[styles.dashboardSectionTitle, styles.histogramCardTitle]}>
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
                      {subjectNameById[subject.id] ?? getSubjectDisplayName(subject, t)}
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
                      <Text
                        variant="micro"
                        colorName="textMuted"
                        style={[styles.histogramColumnLabel, styles.histogramAxisLabel]}
                      >
                        {axisLabel}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </Card>
        )}

    </TabScreen>
  );
}

// ---------------------------------------------------------------------------
// STYLES 
// ---------------------------------------------------------------------------
const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },

    periodTabs: { marginBottom: 6 },

    dashboardSectionTitle: {
      fontSize: 15,
      fontWeight: "600",
      flexShrink: 1,
    },

    goalVsActualHeaderTitleRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      minWidth: 0,
    },
    goalVsActualBars: { marginTop: 8 },
    goalVsActualTime: { fontWeight: "700" },
    goalVsActualLabelWithDot: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minWidth: 0,
    },
    goalVsActualDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },

    // Metric cards row
    metricsRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 8,
    },

    // Distribution card
    distributionCard: { marginBottom: 8, padding: 12 },
    distributionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    distributionTitle: { fontWeight: "600" },
    distributionBars: { marginTop: 6 },
    emptyStateText: { textAlign: "center", marginTop: 8, marginBottom: 6 },

    // Histogram card
    histogramCard: { padding: 12, marginBottom: 8 },
    histogramCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 8,
    },
    histogramCardTitle: {},

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

    // Date navigation
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
    barRow: { marginBottom: 8 },
    barHeader: { flexDirection: "row", justifyContent: "space-between" },
    barLabel: {},
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
    // Vertical bar chart (Lovable-style: side-by-side planned/actual per column)
    histogramChartArea: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 2,
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
    /** Compteur sous les barres (jour du mois, mois, jour de la semaine) — plus compact. */
    histogramAxisLabel: {
      fontSize: 7,
      lineHeight: 11,
    },
  });
