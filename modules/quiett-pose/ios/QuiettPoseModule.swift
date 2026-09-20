import ExpoModulesCore
import UIKit
import Vision

public class QuiettPoseModule: Module {
  public func definition() -> ModuleDefinition {
    Name("QuiettPose")

    Events("onPoseFrame")

    Function("isAvailable") { () -> Bool in
      if #available(iOS 14.0, *) {
        return true
      }
      return false
    }

    Function("isLiveCameraAvailable") { () -> Bool in
      #if targetEnvironment(simulator)
      return false
      #else
      if #available(iOS 14.0, *) {
        return true
      }
      return false
      #endif
    }

    AsyncFunction("analyzeImage") { (uri: String) -> [String: Any] in
      if #available(iOS 14.0, *) {
        return try QuiettPoseModule.analyze(uri: uri)
      }
      return QuiettPoseVision.unavailable()
    }

    AsyncFunction("analyzeBase64") { (base64: String) -> [String: Any] in
      if #available(iOS 14.0, *) {
        return try QuiettPoseModule.analyzeBase64(base64)
      }
      return QuiettPoseVision.unavailable()
    }

    View(QuiettPoseCameraView.self) {
      Events("onPoseFrame", "onCameraReady", "onMountError")

      Prop("isActive") { (view: QuiettPoseCameraView, value: Bool) in
        view.setActive(value)
      }

      Prop("mirror") { (view: QuiettPoseCameraView, value: Bool) in
        view.setMirrored(value)
      }
    }
  }

  @available(iOS 14.0, *)
  private static func analyze(uri: String) throws -> [String: Any] {
    let url: URL
    if uri.hasPrefix("file://") {
      url = URL(string: uri) ?? URL(fileURLWithPath: uri)
    } else {
      url = URL(fileURLWithPath: uri)
    }

    guard let image = UIImage(contentsOfFile: url.path),
          let cgImage = image.cgImage else {
      return QuiettPoseVision.unavailable()
    }

    let orientation = QuiettPoseVision.cgImageOrientation(from: image.imageOrientation)
    return QuiettPoseVision.analyze(cgImage: cgImage, orientation: orientation)
  }

  @available(iOS 14.0, *)
  private static func analyzeBase64(_ base64: String) throws -> [String: Any] {
    let cleaned = base64
      .replacingOccurrences(of: "data:image/jpeg;base64,", with: "")
      .replacingOccurrences(of: "data:image/png;base64,", with: "")
    guard let data = Data(base64Encoded: cleaned),
          let image = UIImage(data: data),
          let cgImage = image.cgImage else {
      return QuiettPoseVision.unavailable()
    }
    let orientation = QuiettPoseVision.cgImageOrientation(from: image.imageOrientation)
    return QuiettPoseVision.analyze(cgImage: cgImage, orientation: orientation)
  }
}
