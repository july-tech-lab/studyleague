import FocusModule from '@/modules/focus-module';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';

export interface UseStudyModeReturn {
  isEnabled: boolean; // Current focus mode state
  hasPermission: boolean; // Permission granted
  isLoading: boolean;
  canEnable: boolean; // Can enable right now (permission + iOS apps selected)
  enable: () => Promise<boolean>; // Returns success/failure
  disable: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  checkPermission: () => Promise<boolean>;
  checkSelectedApps: () => Promise<boolean>; // iOS only
  presentAppPicker: () => Promise<boolean>; // iOS only
}

export function useStudyMode(): UseStudyModeReturn {
  const [isEnabled, setIsEnabled] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSelectedApps, setHasSelectedApps] = useState(false);

  // Check permission and app selection status
  const checkStatus = useCallback(async () => {
    // On web, focus mode is not available
    if (Platform.OS === 'web') {
      setHasPermission(false);
      setHasSelectedApps(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const permission = await FocusModule.checkPermission();
      setHasPermission(permission);

      if (permission && Platform.OS === 'ios') {
        const selected = FocusModule.getSelectedApps();
        setHasSelectedApps(selected);
      } else if (permission && Platform.OS === 'android') {
        // Android doesn't need app selection
        setHasSelectedApps(true);
      } else {
        setHasSelectedApps(false);
      }
    } catch (error) {
      console.error('Error checking study mode status:', error);
      setHasPermission(false);
      setHasSelectedApps(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check status on mount and when app comes to foreground
  useEffect(() => {
    checkStatus();
    
    // Re-check when app comes to foreground (user might have changed settings)
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkStatus();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkStatus]);

  const checkPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return false;
    }

    try {
      const permission = await FocusModule.checkPermission();
      setHasPermission(permission);
      return permission;
    } catch (error) {
      console.error('Error checking permission:', error);
      setHasPermission(false);
      return false;
    }
  }, []);

  const checkSelectedApps = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'ios') {
      return true; // Android doesn't need app selection
    }
    
    try {
      const selected = FocusModule.getSelectedApps();
      setHasSelectedApps(selected);
      return selected;
    } catch (error) {
      console.error('Error checking selected apps:', error);
      setHasSelectedApps(false);
      return false;
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return false;
    }

    try {
      await FocusModule.requestPermission();
      // Re-check permission after user returns from settings
      const permission = await checkPermission();
      return permission;
    } catch (error) {
      console.error('Error requesting permission:', error);
      return false;
    }
  }, [checkPermission]);

  const presentAppPicker = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web' || Platform.OS !== 'ios') {
      return Platform.OS !== 'web'; // Android doesn't need app selection, web returns false
    }

    try {
      await FocusModule.presentFamilyActivityPicker();
      // Re-check if apps are selected after picker closes
      const selected = await checkSelectedApps();
      return selected;
    } catch (error) {
      console.error('Error presenting app picker:', error);
      return false;
    }
  }, [checkSelectedApps]);

  const enable = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      // On web, focus mode is not available
      return false;
    }

    try {
      // Check permission first
      const permission = await checkPermission();
      if (!permission) {
        return false;
      }

      // On iOS, check if apps are selected
      if (Platform.OS === 'ios') {
        const selected = await checkSelectedApps();
        if (!selected) {
          return false;
        }
      }

      // Enable focus mode
      await FocusModule.setFocusMode(true);
      setIsEnabled(true);
      return true;
    } catch (error: any) {
      console.error('Error enabling study mode:', error);
      setIsEnabled(false);
      
      // Show user-friendly error
      if (error?.message?.includes('No apps selected')) {
        Alert.alert(
          'Apps Required',
          'Please select apps to block before starting a study session.',
          [{ text: 'OK' }]
        );
      } else if (error?.message?.includes('permission not granted')) {
        Alert.alert(
          'Permission Required',
          'Please grant Screen Time permission to use study mode.',
          [{ text: 'OK' }]
        );
      }
      
      return false;
    }
  }, [checkPermission, checkSelectedApps]);

  const disable = useCallback(async () => {
    if (Platform.OS === 'web') {
      setIsEnabled(false);
      return;
    }

    try {
      await FocusModule.setFocusMode(false);
      setIsEnabled(false);
    } catch (error) {
      console.error('Error disabling study mode:', error);
      // Still set state to false even if API call fails
      setIsEnabled(false);
    }
  }, []);

  const canEnable = hasPermission && hasSelectedApps && !isLoading;

  return {
    isEnabled,
    hasPermission,
    isLoading,
    canEnable,
    enable,
    disable,
    requestPermission,
    checkPermission,
    checkSelectedApps,
    presentAppPicker,
  };
}
