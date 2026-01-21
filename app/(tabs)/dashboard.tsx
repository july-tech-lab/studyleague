import { TabScreen } from "@/components/layout/TabScreen";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import Colors from "@/constants/Colors";
import { useTheme } from "@/utils/themeContext";
import { Clock, Flame, Trophy, Zap } from "lucide-react-native";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/Themed";

// --- MOCK DATA ---
const weeklyStudyTime = { hours: 25, minutes: 30, goal: 30 };

const subjectData = [
  { name: "Programmation", value: 35 },
  { name: "Mathématiques", value: 25 },
  { name: "Physique", value: 20 },
  { name: "Anglais", value: 12 },
  { name: "Histoire", value: 8 },
];

// Histogram (mock) — total minutes per day and subject
const studyTimeSeries = [
  { day: "Lun", subject: "Programmation", minutes: 120 },
  { day: "Lun", subject: "Mathématiques", minutes: 80 },
  { day: "Mar", subject: "Programmation", minutes: 90 },
  { day: "Mar", subject: "Physique", minutes: 60 },
  { day: "Mer", subject: "Mathématiques", minutes: 100 },
  { day: "Mer", subject: "Anglais", minutes: 40 },
  { day: "Jeu", subject: "Programmation", minutes: 110 },
  { day: "Jeu", subject: "Histoire", minutes: 30 },
  { day: "Ven", subject: "Mathématiques", minutes: 70 },
  { day: "Ven", subject: "Physique", minutes: 50 },
  { day: "Sam", subject: "Programmation", minutes: 95 },
  { day: "Sam", subject: "Anglais", minutes: 35 },
  { day: "Dim", subject: "Histoire", minutes: 45 },
  { day: "Dim", subject: "Physique", minutes: 55 },
];

const personalRecords = [
  { label: "Record Session", value: "4h 15m", icon: Clock },
  { label: "Meilleure Série", value: "14 jours", icon: Flame },
  { label: "Matière Top", value: "Maths", icon: Zap },
];

const dayKeyMap: Record<string, string> = {
  // French abbreviations (existing mock data)
  Lun: "mon",
  Mar: "tue",
  Mer: "wed",
  Jeu: "thu",
  Ven: "fri",
  Sam: "sat",
  Dim: "sun",
  // English abbreviations (fallback)
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

// Heatmap
const generateHeatmapData = () =>
  Array.from({ length: 28 }).map(() => ({
    intensity: Math.random() > 0.3 ? Math.floor(Math.random() * 4) + 1 : 0,
  }));

const heatmapData = generateHeatmapData();

const HISTOGRAM_BAR_HEIGHT = 160;

type Period = "day" | "week" | "month";

const periodOptions: Period[] = ["day", "week", "month"];

export default function DashboardScreen() {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const subjectPalette = theme.subjectPalette;
  const heatmapPalette = [theme.border, ...subjectPalette.slice(0, 4)];
  const [period, setPeriod] = React.useState<Period>("day");
  const [selectedSubject, setSelectedSubject] = React.useState<string | null>(null);
  const [isSubjectMenuOpen, setSubjectMenuOpen] = React.useState(false);
  const { t } = useTranslation();

  const progressPercent = Math.min(
    ((weeklyStudyTime.hours + weeklyStudyTime.minutes / 60) /
      weeklyStudyTime.goal) *
      100,
    100
  );

  // Histogram: compute totals for selected subjects (empty = all)
  const uniqueSubjects = React.useMemo(
    () => Array.from(new Set(studyTimeSeries.map((d) => d.subject))),
    []
  );
  const uniqueDays = React.useMemo(
    () => Array.from(new Set(studyTimeSeries.map((d) => d.day))),
    []
  );

  const aggregatedByDay = React.useMemo(() => {
    const activeSubjects =
      selectedSubject === null ? uniqueSubjects : [selectedSubject];
    const totals = uniqueDays.map((day) => {
      const minutes = studyTimeSeries
        .filter((entry) => entry.day === day && activeSubjects.includes(entry.subject))
        .reduce((sum, entry) => sum + entry.minutes, 0);
      return { day, minutes };
    });
    const maxMinutes = Math.max(...totals.map((t) => t.minutes), 1);
    return { totals, maxMinutes };
  }, [selectedSubject, uniqueSubjects, uniqueDays]);

  const handleSelectSubject = (subject: string | null) => {
    setSelectedSubject(subject);
    setSubjectMenuOpen(false);
  };

  const formatDayLabel = (day: string) => {
    const key = dayKeyMap[day] ?? day.toLowerCase().slice(0, 3);
    return t(`dashboard.days.${key}`, { defaultValue: day });
  };

  return (
    <TabScreen title={t("dashboard.title")}>

        {/* TABS */}
        <Tabs
          options={periodOptions.map(option => ({
            value: option,
            label: t(`dashboard.period.${option}`),
          }))}
          value={period}
          onChange={setPeriod}
        />

        {/* ORIGINAL WEEKLY CARD (KEEP INFO, APPLY PURPLE STYLE) */}
        <Card variant="border" style={{ marginBottom: 24, elevation: 2 }}>
          <View style={styles.weeklyHeader}>
            <Trophy size={20} color={theme.primary} />
            <Text variant="subtitle" colorName="textMuted" style={styles.weeklyLabel}>
              {t("dashboard.weeklyLabel")}
            </Text>
          </View>

          <View style={styles.timeRow}>
            <Text style={styles.hoursText}>{weeklyStudyTime.hours}h</Text>
            <Text variant="h2" colorName="textMuted" style={styles.minutesText}>
              {weeklyStudyTime.minutes}m
            </Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressLabels}>
              <Text variant="micro" colorName="textMuted" style={styles.progressLabel}>
                {t("dashboard.goal")} : {weeklyStudyTime.goal}h
              </Text>
              <Text variant="micro" colorName="textMuted" style={styles.progressLabel}>
                {Math.round(progressPercent)}%
              </Text>
            </View>

            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressPercent}%` },
                ]}
              />
            </View>
          </View>
        </Card>

        {/* SUBJECT DISTRIBUTION */}
        <View style={styles.section}>
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

        {/* PERSONAL RECORDS (KEEP ORIGINAL INFO) */}
        <View style={styles.section}>
          <View style={styles.recordGrid}>
            {personalRecords.map((rec, i) => (
              <View key={i} style={styles.recordCard}>
                <rec.icon size={20} color={theme.primary} />
                <Text variant="subtitle" style={styles.recordValue}>
                  {rec.value}
                </Text>
                <Text variant="caption" colorName="textMuted" align="center" style={styles.recordLabel}>
                  {rec.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* HEATMAP — KEEP ORIGINAL, IMPROVE COLORS */}
        <View style={styles.section}>
          <Text variant="h2" style={{ marginBottom: 12 }}>{t("dashboard.activity")}</Text>

          <View style={styles.heatmapGrid}>
            {heatmapData.map((d, i) => {
              return (
                <View
                  key={i}
                  style={[styles.heatCell, { backgroundColor: heatmapPalette[d.intensity] }]}
                />
              );
            })}
          </View>
        </View>

        {/* HISTOGRAM: total study time over time with subject filter */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text variant="h2" style={{ marginBottom: 12 }}>
              {t("dashboard.histogramTitle", "Study time over time")}
            </Text>
          </View>

          <View style={styles.dropdownSection}>
            <Pressable
              style={styles.dropdownTrigger}
              onPress={() => setSubjectMenuOpen((open) => !open)}
            >
              <Text variant="subtitle" style={styles.dropdownValue}>
                {selectedSubject ?? t("dashboard.filterAll", "All subjects")}
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
                      selectedSubject === null && styles.dropdownOptionTextActive,
                    ]}
                  >
                    {t("dashboard.filterAll", "All subjects")}
                  </Text>
                </Pressable>

                {uniqueSubjects.map((subject, index) => (
                  <Pressable
                    key={subject}
                    style={[
                      styles.dropdownOption,
                      { borderLeftColor: subjectPalette[index % subjectPalette.length] },
                    ]}
                    onPress={() => handleSelectSubject(subject)}
                  >
                    <Text
                      variant="subtitle"
                      style={[
                        styles.dropdownOptionText,
                        selectedSubject === subject && styles.dropdownOptionTextActive,
                      ]}
                    >
                      {subject}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={styles.histogram}>
            {aggregatedByDay.totals.map((item, index) => {
              const barHeight =
                (item.minutes / aggregatedByDay.maxMinutes) * HISTOGRAM_BAR_HEIGHT;
              const barColor =
                selectedSubject === null
                  ? subjectPalette[index % subjectPalette.length] ?? theme.primary
                  : subjectPalette[
                      uniqueSubjects.indexOf(selectedSubject) % subjectPalette.length
                    ] ?? theme.primary;
              return (
                <View key={item.day} style={styles.histogramBarWrapper}>
                  <Text variant="caption" style={styles.histogramValue}>
                    {Math.round(item.minutes / 60)}h
                  </Text>
                  <View style={styles.histogramBarBg}>
                    <View
                      style={[
                        styles.histogramBarFill,
                        {
                          height: barHeight,
                          backgroundColor: barColor,
                        },
                      ]}
                    />
                  </View>
                  <Text variant="caption" colorName="textMuted" style={styles.histogramLabel}>
                    {formatDayLabel(item.day)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

    </TabScreen>
  );
}

// ---------------------------------------------------------------------------
// STYLES 
// ---------------------------------------------------------------------------
const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },


    // NOTE: weeklyCard style removed - now using Card component
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

    // Records
    recordGrid: { flexDirection: "row", gap: 10 },
    recordCard: {
      flex: 1,
      backgroundColor: theme.surface,
      padding: 14,
      borderRadius: 16,
      elevation: 3,
      alignItems: "center",
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider ?? theme.border,
    },
    recordValue: { fontWeight: "700" },
    recordLabel: {},

    // Heatmap
    heatmapGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    heatCell: { width: "12%", aspectRatio: 1, borderRadius: 6 },

    // Histogram
    dropdownSection: { gap: 6 },
    dropdownLabel: { fontWeight: "600" },
    dropdownTrigger: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
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
    histogram: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
      marginTop: 14,
    },
    histogramBarWrapper: {
      flex: 1,
      alignItems: "center",
      gap: 6,
    },
    histogramBarBg: {
      height: HISTOGRAM_BAR_HEIGHT,
      width: "100%",
      borderRadius: 10,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      justifyContent: "flex-end",
      overflow: "hidden",
    },
    histogramBarFill: {
      width: "100%",
      borderRadius: 10,
    },
    histogramLabel: {},
    histogramValue: { fontWeight: "600" },
  });
