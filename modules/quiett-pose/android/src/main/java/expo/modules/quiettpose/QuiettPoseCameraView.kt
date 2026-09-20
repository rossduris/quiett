package expo.modules.quiettpose

import android.content.Context
import android.graphics.Color
import android.widget.TextView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/**
 * Android stub — iOS-first. Emits unavailable pose frames so JS can fall back / show chip.
 * Structure mirrors iOS QuiettPoseCameraView for a future CameraX + ML Kit landing.
 */
class QuiettPoseCameraView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onPoseFrame by EventDispatcher()
  private val onCameraReady by EventDispatcher()
  private val onMountError by EventDispatcher()

  private var isActive = true
  private val label = TextView(context).apply {
    text = "Pose camera unavailable on Android (iOS-first)"
    setTextColor(Color.LTGRAY)
    textSize = 14f
    setPadding(32, 32, 32, 32)
  }

  init {
    setBackgroundColor(Color.BLACK)
    addView(label)
    post {
      onMountError(mapOf("message" to "Android live pose not implemented yet"))
      onPoseFrame(
        mapOf(
          "available" to false,
          "faceCount" to 0,
          "joints" to emptyMap<String, Any>(),
          "timestamp" to System.currentTimeMillis().toDouble()
        )
      )
    }
  }

  fun setActive(active: Boolean) {
    isActive = active
  }

  fun setMirrored(@Suppress("UNUSED_PARAMETER") mirror: Boolean) {
    // no-op stub
  }
}
