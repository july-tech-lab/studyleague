import { TabScreen } from "@/components/layout/TabScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import Colors from "@/constants/Colors";
import typography from "@/constants/typography";
import { useTheme, useThemePreference } from "@/utils/themeContext";
import { getReadableTextColor } from "@/utils/color";
import { AlertCircle, Check, Mail, Search, X } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/Themed";

const ColorSwatch = ({ 
  name, 
  color, 
  description,
  themeColors
}: { 
  name: string; 
  color: string; 
  description?: string;
  themeColors: typeof Colors.light;
}) => {
  // Use centralized color utility for consistent contrast calculation
  const textColor = getReadableTextColor(color);

  return (
    <View style={[styles.swatchContainer, { backgroundColor: themeColors.surface }]}>
      <View style={[styles.colorBox, { backgroundColor: color, borderColor: themeColors.divider }]}>
        <Text style={[styles.colorHex, { color: textColor }]}>{color}</Text>
      </View>
      <View style={styles.colorInfo}>
        <Text style={[styles.colorName, { color: themeColors.text }]}>{name}</Text>
        {description && <Text style={[styles.colorDescription, { color: themeColors.textMuted }]}>{description}</Text>}
      </View>
    </View>
  );
};

const ColorSection = ({ 
  title, 
  colors,
  themeColors
}: { 
  title: string; 
  colors: { name: string; value: string; description?: string }[];
  themeColors: typeof Colors.light;
}) => {
  return (
    <View style={styles.section}>
      <Text variant="h2" style={{ marginBottom: 12 }}>{title}</Text>
      {colors.map((color) => (
        <ColorSwatch
          key={color.name}
          name={color.name}
          color={color.value}
          description={color.description}
          themeColors={themeColors}
        />
      ))}
    </View>
  );
};

const TypographySwatch = ({
  name,
  style,
  themeColors
}: {
  name: string;
  style: { fontSize: number; lineHeight: number; fontWeight: string };
  themeColors: typeof Colors.light;
}) => {
  return (
    <View style={[styles.swatchContainer, { backgroundColor: themeColors.surface }]}>
      <View style={styles.typographyInfo}>
        <Text 
          style={[
            { 
              fontSize: style.fontSize, 
              lineHeight: style.lineHeight, 
              fontWeight: style.fontWeight as any,
              color: themeColors.text 
            }
          ]}
        >
          {name}
        </Text>
        <Text style={[styles.typographyDetails, { color: themeColors.textMuted }]}>
          {style.fontSize}px / {style.lineHeight}px / {style.fontWeight}
        </Text>
      </View>
    </View>
  );
};

const TypographySection = ({
  title,
  typographyStyles,
  themeColors
}: {
  title: string;
  typographyStyles: Record<string, { fontSize: number; lineHeight: number; fontWeight: string }>;
  themeColors: typeof Colors.light;
}) => {
  return (
    <View style={styles.section}>
      <Text variant="h2" style={{ marginBottom: 12 }}>{title}</Text>
      {Object.entries(typographyStyles).map(([name, style]) => (
        <TypographySwatch
          key={name}
          name={name}
          style={style}
          themeColors={themeColors}
        />
      ))}
    </View>
  );
};

export default function ColorPalette() {
  const { colorScheme } = useThemePreference();
  const colors = useTheme();

  const colorGroups = [
    {
      title: "Text Colors",
      colors: [
        { name: "text", value: colors.text, description: "Main text color" },
        { name: "textMuted", value: colors.textMuted, description: "Muted/secondary text" },
        { name: "onPrimary", value: colors.onPrimary, description: "Text on primary color" },
        { name: "onSurface", value: colors.onSurface, description: "Text on surface" },
      ],
    },
    {
      title: "Background & Surface",
      colors: [
        { name: "background", value: colors.background, description: "Main background" },
        { name: "surface", value: colors.surface, description: "Card/surface background" },
        { name: "surfaceElevated", value: colors.surfaceElevated, description: "Elevated surface" },
        { name: "secondary", value: colors.secondary, description: "Secondary background" },
      ],
    },
    {
      title: "Primary Colors",
      colors: [
        { name: "primary", value: colors.primary, description: "Main primary color" },
        { name: "primaryDark", value: colors.primaryDark, description: "Dark primary variant" },
        { name: "primaryLight", value: colors.primaryLight, description: "Light primary variant" },
        { name: "primaryTint", value: colors.primaryTint, description: "Tint color" },
      ],
    },
    {
      title: "Secondary Colors",
      colors: [
        { name: "secondary", value: colors.secondary, description: "Main secondary color" },
        { name: "secondaryDark", value: colors.secondaryDark, description: "Dark secondary variant" },
        { name: "secondaryLight", value: colors.secondaryLight, description: "Light secondary variant" },
        { name: "secondaryTint", value: colors.secondaryTint, description: "Secondary tint (with opacity)" },
      ],
    },
    {
      title: "Status Colors",
      colors: [
        { name: "success", value: colors.success, description: "Success state" },
        { name: "warning", value: colors.warning, description: "Warning state" },
        { name: "danger", value: colors.danger, description: "Danger/error state" },
        { name: "successTint", value: colors.successTint, description: "Success tint (with opacity)" },
        { name: "warningTint", value: colors.warningTint, description: "Warning tint (with opacity)" },
        { name: "dangerTint", value: colors.dangerTint, description: "Danger tint (with opacity)" },
      ],
    },
    {
      title: "UI Elements",
      colors: [
        { name: "divider", value: colors.divider, description: "Divider lines" },
        { name: "border", value: colors.border, description: "Border color" },
        { name: "tabIconDefault", value: colors.tabIconDefault, description: "Default tab icon" },
        { name: "tabIconSelected", value: colors.tabIconSelected, description: "Selected tab icon" },
        { name: "shadow", value: colors.shadow, description: "Shadow color" },
      ],
    },
    {
      title: "Subject Palette",
      colors: colors.subjectPalette.map((color: string, index: number) => ({
        name: `subjectPalette[${index}]`,
        value: color,
        description: `Subject color ${index + 1}`,
      })),
    },
  ];

  return (
    <TabScreen title="Color Palette">
        <View style={[styles.headerCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.themeLabel, { color: colors.text }]}>
            Current Theme: <Text style={styles.themeValue}>{colorScheme}</Text>
          </Text>
          <Text style={[styles.infoText, { color: colors.textMuted }]}>
            This page displays all colors from your theme. Modify colors in{" "}
            <Text style={styles.codeText}>constants/Colors.ts</Text> to see changes here.
          </Text>
        </View>

        {colorGroups.map((group) => (
          <ColorSection key={group.title} title={group.title} colors={group.colors} themeColors={colors} />
        ))}

        {/* Typography Section */}
        <TypographySection
          title="Typography Sizes"
          typographyStyles={typography}
          themeColors={colors}
        />

        {/* Components Showcase Section */}
        <View style={styles.section}>
          <Text variant="h2" style={{ marginBottom: 12 }}>Component Showcase</Text>
          <Text style={[styles.componentDescription, { color: colors.textMuted }]}>
            Examples of UI components using the color palette
          </Text>

          {/* Buttons */}
          <View style={styles.componentSubsection}>
            <Text style={[styles.subsectionTitle, { color: colors.text }]}>Buttons</Text>
            <View style={styles.buttonRow}>
              <Button title="Primary" variant="primary" size="md" style={styles.buttonExample} />
              <Button title="Secondary" variant="secondary" size="md" style={styles.buttonExample} />
              <Button title="Destructive" variant="destructive" size="md" style={styles.buttonExample} />
            </View>
            <View style={styles.buttonRow}>
              <Button title="Small" variant="primary" size="sm" style={styles.buttonExample} />
              <Button title="Medium" variant="primary" size="md" style={styles.buttonExample} />
              <Button title="Large" variant="primary" size="lg" style={styles.buttonExample} />
            </View>
            <View style={styles.buttonRow}>
              <Button 
                title="With Icon" 
                variant="primary" 
                iconLeft={Check}
                style={styles.buttonExample} 
              />
              <Button 
                title="Loading" 
                variant="primary" 
                loading={true}
                style={styles.buttonExample} 
              />
              <Button 
                title="Disabled" 
                variant="primary" 
                disabled={true}
                style={styles.buttonExample} 
              />
            </View>
            <Button 
              title="Full Width Button" 
              variant="primary" 
              fullWidth
              style={styles.fullWidthButton} 
            />
          </View>

          {/* Cards */}
          <View style={styles.componentSubsection}>
            <Text style={[styles.subsectionTitle, { color: colors.text }]}>Cards</Text>
            <Card variant="elevated" style={styles.cardExample}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Elevated Card</Text>
              <Text style={[styles.cardText, { color: colors.textMuted }]}>
                This card has elevation and shadow for depth.
              </Text>
            </Card>
            <Card variant="border" style={styles.cardExample}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Flat Card</Text>
              <Text style={[styles.cardText, { color: colors.textMuted }]}>
                This card has a flat appearance with a border.
              </Text>
            </Card>
          </View>

          {/* Inputs */}
          <View style={styles.componentSubsection}>
            <Text style={[styles.subsectionTitle, { color: colors.text }]}>Inputs</Text>
            <View style={styles.inputExample}>
              <Input 
                label="Default Input"
                placeholder="Enter text here..."
              />
            </View>
            <View style={styles.inputExample}>
              <Input 
                label="Input with Left Icon"
                placeholder="Search..."
                leftIcon={Search}
              />
            </View>
            <View style={styles.inputExample}>
              <Input 
                label="Input with Right Icon"
                placeholder="Email address"
                rightIcon={Mail}
              />
            </View>
            <View style={styles.inputExample}>
              <Input 
                label="Input with Helper Text"
                placeholder="Enter value"
                helperText="This is helpful information"
              />
            </View>
            <View style={styles.inputExample}>
              <Input 
                label="Input with Error"
                placeholder="Enter value"
                error="This field is required"
              />
            </View>
          </View>

          {/* Icons */}
          <View style={styles.componentSubsection}>
            <Text style={[styles.subsectionTitle, { color: colors.text }]}>Icons</Text>
            <View style={styles.iconRow}>
              <View style={styles.iconContainer}>
                <Icon as={Check} size={24} />
                <Text style={[styles.iconLabel, { color: colors.textMuted }]}>Check</Text>
              </View>
              <View style={styles.iconContainer}>
                <Icon as={X} size={24} />
                <Text style={[styles.iconLabel, { color: colors.textMuted }]}>X</Text>
              </View>
              <View style={styles.iconContainer}>
                <Icon as={Search} size={24} />
                <Text style={[styles.iconLabel, { color: colors.textMuted }]}>Search</Text>
              </View>
              <View style={styles.iconContainer}>
                <Icon as={Mail} size={24} />
                <Text style={[styles.iconLabel, { color: colors.textMuted }]}>Mail</Text>
              </View>
              <View style={styles.iconContainer}>
                <Icon as={AlertCircle} size={24} color={colors.danger} />
                <Text style={[styles.iconLabel, { color: colors.textMuted }]}>Alert</Text>
              </View>
            </View>
          </View>
        </View>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  themeLabel: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  themeValue: {
    textTransform: "capitalize",
    fontWeight: "700",
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  codeText: {
    fontFamily: "monospace",
    fontWeight: "600",
  },
  section: {
    marginBottom: 32,
  },
  swatchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderRadius: 8,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  colorBox: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  colorHex: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  colorInfo: {
    flex: 1,
  },
  colorName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  colorDescription: {
    fontSize: 12,
  },
  typographyInfo: {
    flex: 1,
  },
  typographyDetails: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: "monospace",
  },
  componentDescription: {
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  componentSubsection: {
    marginBottom: 32,
  },
  subsectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  buttonExample: {
    flex: 1,
    minWidth: 100,
  },
  fullWidthButton: {
    marginTop: 8,
  },
  cardExample: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 20,
  },
  inputExample: {
    marginBottom: 16,
  },
  iconRow: {
    flexDirection: "row",
    gap: 16,
    flexWrap: "wrap",
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },
  iconLabel: {
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
});
