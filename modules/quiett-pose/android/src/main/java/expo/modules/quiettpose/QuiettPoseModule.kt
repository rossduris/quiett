package expo.modules.quiettpose

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class QuiettPoseModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("QuiettPose")

    Events("onPoseFrame")

    Function("isAvailable") {
      false
    }

    Function("isLiveCameraAvailable") {
      false
    }

    AsyncFunction("analyzeImage") { _: String ->
      mapOf(
        "available" to false,
        "faceCount" to 0,
        "joints" to emptyMap<String, Any>(),
        "timestamp" to System.currentTimeMillis().toDouble()
      )
    }

    AsyncFunction("analyzeBase64") { _: String ->
      mapOf(
        "available" to false,
        "faceCount" to 0,
        "joints" to emptyMap<String, Any>(),
        "timestamp" to System.currentTimeMillis().toDouble()
      )
    }

    View(QuiettPoseCameraView::class) {
      Events("onPoseFrame", "onCameraReady", "onMountError")

      Prop("isActive") { view: QuiettPoseCameraView, active: Boolean ->
        view.setActive(active)
      }

      Prop("mirror") { view: QuiettPoseCameraView, mirror: Boolean ->
        view.setMirrored(mirror)
      }
    }
  }
}
