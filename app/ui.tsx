import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Check,
  Eye,
  EyeOff,
  Lock,
  Heart,
  Mail,
  Plus,
  Search,
  Star,
} from "lucide-react-native";

import { useTheme } from "@/utils/themeContext";
import Colors from "@/constants/Colors";
import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";

const iconShowcase = [
  { icon: Star, label: "Star" },
  { icon: Heart, label: "Heart" },
  { icon: Calendar, label: "Calendar" },
  { icon: Search, label: "Search" },
  { icon: Check, label: "Check" },
  { icon: AlertCircle, label: "Alert" },
];

export default function UiShowcaseScreen() {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.primaryDark }]}>
        <Text variant="display" style={[styles.headerTitle, { color: theme.onPrimary }]}>
          UI components
        </Text>
        <Text variant="body" align="center" style={[styles.headerSubtitle, { color: theme.onPrimary }]}>
          Preview of shared primitives with variants, states, and typical usage.
        </Text>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Section
          title="Buttons"
          description="Variants, sizes, and common states."
          theme={theme}
          styles={styles}
        >
          <Card style={styles.panel}>
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Button title="Primary" />
              </View>
              <View style={styles.rowItem}>
                <Button title="Secondary" variant="secondary" />
              </View>
              <View style={styles.rowItem}>
                <Button title="Destructive" variant="destructive" />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Button title="Leading icon" iconLeft={Plus} />
              </View>
              <View style={styles.rowItem}>
                <Button title="Trailing icon" iconRight={ArrowRight} />
              </View>
              <View style={styles.rowItem}>
                <Button title="Loading" loading />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Button title="Small" size="sm" />
              </View>
              <View style={styles.rowItem}>
                <Button title="Medium" size="md" />
              </View>
              <View style={styles.rowItem}>
                <Button title="Large" size="lg" />
              </View>
            </View>

            <View style={styles.fullWidthButton}>
              <Button title="Full width example" fullWidth />
            </View>
          </Card>
        </Section>

        <Section
          title="Inputs"
          description="Base field with helper, icons, and error states."
          theme={theme}
          styles={styles}
        >
          <Card style={styles.panel}>
            <View style={styles.stack}>
              <View style={styles.stackItem}>
                <Input
                  label="Default"
                  placeholder="Type something..."
                  helperText="Helper text sits here."
                />
              </View>

              <View style={styles.stackItem}>
                <Input
                  label="With icons"
                  placeholder="Search or type"
                  leftIcon={Search}
                  rightIcon={Check}
                />
              </View>

              <View style={styles.stackItem}>
                <Input
                  label="Error state"
                  placeholder="Email address"
                  error="Please enter a valid email."
                  leftIcon={Mail}
                  rightIcon={AlertCircle}
                />
              </View>
            </View>
          </Card>
        </Section>

        <Section
          title="Cards"
          description="Elevated and flat surfaces for grouping content."
          theme={theme}
          styles={styles}
        >
          <View style={styles.row}>
            <Card style={[styles.cardExample, styles.rowItem]}>
              <Text variant="bodyStrong" style={styles.cardTitle}>
                Elevated card
              </Text>
              <Text variant="body" colorName="textMuted" style={styles.cardBody}>
                Default appearance with drop shadow for emphasis.
              </Text>
            </Card>

            <Card variant="border" style={[styles.cardExample, styles.rowItem]}>
              <Text variant="bodyStrong" style={styles.cardTitle}>
                Flat card
              </Text>
              <Text variant="body" colorName="textMuted" style={styles.cardBody}>
                Subtle border for quieter groupings.
              </Text>
            </Card>
          </View>
        </Section>

        <Section
          title="Icons"
          description="Shared Icon wrapper using lucide icons and theme-aware color."
          theme={theme}
          styles={styles}
        >
          <Card style={styles.panel}>
            <View style={styles.iconGrid}>
              {iconShowcase.map(({ icon, label }) => (
                <View
                  key={label}
                  style={[
                    styles.iconItem,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: theme.divider ?? theme.border,
                    },
                  ]}
                >
                  <Icon as={icon} />
                  <Text variant="micro" colorName="textMuted" style={styles.iconLabel}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
            <View style={[styles.stack, { marginTop: 12 }]}>
              <View style={styles.stackItem}>
                <Input
                  label="Password with toggle"
                  placeholder="••••••••"
                  secureTextEntry
                  leftIcon={Lock}
                  rightIcon={EyeOff}
                />
              </View>
              <View style={styles.stackItem}>
                <Button title="Reveal password" iconLeft={Eye} variant="secondary" />
              </View>
            </View>
          </Card>
        </Section>
      </ScrollView>
    </View>
  );
}

type SectionProps = {
  title: string;
  description?: string;
  theme: typeof Colors.light;
  styles: ReturnType<typeof createStyles>;
  children: React.ReactNode;
};

function Section({ title, description, theme, styles, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text variant="h2">{title}</Text>
      {description ? (
        <Text variant="subtitle" colorName="textMuted" style={styles.sectionDescription}>
          {description}
        </Text>
      ) : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    body: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 36,
      gap: 8,
    },
    header: {
      paddingTop: 60,
      paddingBottom: 28,
      paddingHorizontal: 24,
      alignItems: "center",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider ?? theme.border,
    },
    headerTitle: {
      fontWeight: "800",
    },
    headerSubtitle: {
      marginTop: 6,
    },
    section: {
      marginBottom: 24,
    },
    sectionDescription: {
      marginTop: 4,
    },
    sectionBody: {
      marginTop: 12,
    },
    panel: {
      padding: 16,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider ?? theme.border,
      borderRadius: 18,
      elevation: 2,
      shadowColor: theme.text,
    },
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    rowItem: {
      marginRight: 12,
      marginBottom: 12,
    },
    fullWidthButton: {
      marginTop: 4,
      width: "100%",
    },
    stack: {
      width: "100%",
    },
    stackItem: {
      marginBottom: 14,
    },
    cardExample: {
      flex: 1,
      minWidth: 160,
    },
    cardTitle: {
      marginBottom: 4,
    },
    cardBody: {},
    iconGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    iconItem: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 14,
      marginRight: 12,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
    },
    iconLabel: { marginTop: 6 },
  });

