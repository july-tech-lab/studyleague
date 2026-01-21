import { Slot } from "expo-router";
import { Screen } from "@/components/layout/Screen";

/**
 * Auth layout provides consistent styling for all authentication screens.
 * 
 * All auth screens share:
 * - Scrollable container with keyboard-safe behavior
 * - Safe area handling (top for notches, bottom for home bar)
 * - paddingHorizontal: 26
 * - paddingTop: 60 (includes safe area when safeTop is enabled)
 * - paddingBottom: 20 (includes safe area)
 * - gap: 12
 * 
 * Individual auth screens should NOT add their own ScrollView - scrolling is handled here.
 */
export default function AuthLayout() {
  return (
    <Screen variant="auth">
      <Slot />
    </Screen>
  );
}
