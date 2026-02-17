import { NativeModule, Platform, requireNativeModule } from 'expo-modules-core';

declare class FocusModule extends NativeModule {
  checkPermission(): Promise<boolean>;
  requestPermission(): Promise<void>;
  presentFamilyActivityPicker(): Promise<void>;
  setFocusMode(enabled: boolean): Promise<void>;
  getSelectedApps(): boolean;
}

// Web fallback - focus mode is not available on web
const webFallback: FocusModule = {
  checkPermission: async () => false,
  requestPermission: async () => {},
  presentFamilyActivityPicker: async () => {},
  setFocusMode: async (_enabled: boolean) => {},
  getSelectedApps: () => false,
} as FocusModule;

// Only require native module on iOS/Android
const FocusModuleInstance: FocusModule = Platform.OS === 'web' 
  ? webFallback
  : (requireNativeModule<FocusModule>('FocusModule') as FocusModule);

export default FocusModuleInstance;
