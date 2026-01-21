package expo.modules.focusmodule

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FocusModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FocusModule")

    Function("checkPermission") {
      val notificationManager = appContext.reactContext?.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      return@Function notificationManager?.isNotificationPolicyAccessGranted ?: false
    }

    Function("requestPermission") {
      val context = appContext.reactContext ?: return@Function
      val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
      intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
      context.startActivity(intent)
    }

    Function("setFocusMode") { enabled: Boolean ->
      val notificationManager = appContext.reactContext?.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      if (notificationManager != null) {
        val filter = if (enabled) {
          NotificationManager.INTERRUPTION_FILTER_PRIORITY
        } else {
          NotificationManager.INTERRUPTION_FILTER_ALL
        }
        notificationManager.setInterruptionFilter(filter)
      }
    }
  }
}
