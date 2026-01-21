import { NativeModule, requireNativeModule } from 'expo-modules-core';

declare class FocusModule extends NativeModule {
  checkPermission(): Promise<boolean>;
  requestPermission(): Promise<void>;
  presentFamilyActivityPicker(): Promise<void>;
  setFocusMode(enabled: boolean): Promise<void>;
  getSelectedApps(): boolean;
}

export default requireNativeModule<FocusModule>('FocusModule');
