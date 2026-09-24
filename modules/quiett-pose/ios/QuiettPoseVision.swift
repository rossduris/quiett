import UIKit
import Vision
import CoreVideo
import CoreGraphics

/// Shared Vision helpers for stills + live CMSampleBuffer analysis.
enum QuiettPoseVision {
  /// Mean luminance (0–1) below this → too dark (chip: more light). Softened from 0.20 to 0.13.
  static let brightnessMin: Double = 0.13

  static let jointMapping: [(VNHumanBodyPoseObservation.JointName, String)] = [
    (.nose, "nose"),
    (.neck, "neck"),
    (.leftShoulder, "leftShoulder"),
    (.rightShoulder, "rightShoulder"),
    (.leftElbow, "leftElbow"),
    (.rightElbow, "rightElbow"),
    (.leftWrist, "leftWrist"),
    (.rightWrist, "rightWrist"),
    (.leftHip, "leftHip"),
    (.rightHip, "rightHip"),
    (.root, "root"),
  ]

  @available(iOS 14.0, *)
  static func analyze(cgImage: CGImage, orientation: CGImagePropertyOrientation) -> [String: Any] {
    let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
    return perform(handler: handler, pixelBuffer: nil, cgImage: cgImage)
  }

  @available(iOS 14.0, *)
  static func analyze(pixelBuffer: CVPixelBuffer, orientation: CGImagePropertyOrientation) -> [String: Any] {
    let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: orientation, options: [:])
    return perform(handler: handler, pixelBuffer: pixelBuffer, cgImage: nil)
  }

  @available(iOS 14.0, *)
  private static func perform(
    handler: VNImageRequestHandler,
    pixelBuffer: CVPixelBuffer?,
    cgImage: CGImage?
  ) -> [String: Any] {
    let bodyRequest = VNDetectHumanBodyPoseRequest()
    let faceRequest = VNDetectFaceLandmarksRequest()
    if #available(iOS 15.0, *) {
      faceRequest.revision = VNDetectFaceLandmarksRequestRevision3
    }
    let handRequest = VNDetectHumanHandPoseRequest()
    handRequest.maximumHandCount = 2

    do {
      try handler.perform([bodyRequest, faceRequest])
    } catch {
      return unavailable()
    }
    do {
      try handler.perform([handRequest])
    } catch {
      // leave hand results empty
    }

    var joints: [String: [String: Double]] = [:]
    if let observation = bodyRequest.results?.first {
      for (jointName, key) in jointMapping {
        if let point = try? observation.recognizedPoint(jointName), point.confidence > 0.05 {
          joints[key] = [
            "x": Double(point.location.x),
            "y": Double(point.location.y),
            "confidence": Double(point.confidence),
          ]
        }
      }
    }

    let faces = faceRequest.results ?? []
    let faceCount = faces.count
    var faceYaw: Double? = nil
    var faceRoll: Double? = nil
    var facePitch: Double? = nil
    var bothEyesVisible = false
    var mouthVisible = false
    var faceLooking = false
    var faceBox: CGRect? = nil

    if let face = faces.first {
      faceBox = face.boundingBox
      if let yaw = face.yaw?.doubleValue {
        faceYaw = yaw
      }
      if let roll = face.roll?.doubleValue {
        faceRoll = roll
      }
      if #available(iOS 15.0, *) {
        if let pitch = face.pitch?.doubleValue {
          facePitch = pitch
        }
      }

      let left = face.landmarks?.leftEye
      let right = face.landmarks?.rightEye
      let outer = face.landmarks?.outerLips
      let inner = face.landmarks?.innerLips
      let leftOk = (left?.pointCount ?? 0) >= 5
      let rightOk = (right?.pointCount ?? 0) >= 5
      let outerOk = (outer?.pointCount ?? 0) >= 10
      let innerOk = (inner?.pointCount ?? 0) >= 4
      bothEyesVisible = leftOk && rightOk
      mouthVisible = outerOk && innerOk

      let yawOk = abs(faceYaw ?? 99) <= 0.38
      let pitchOk = facePitch == nil ? true : abs(facePitch!) <= 0.42
      let rollOk = abs(faceRoll ?? 0) <= 0.85
      faceLooking = bothEyesVisible && mouthVisible && yawOk && pitchOk && rollOk
    }

    var handsVisible = false
    var handCount = 0
    let tipJoints: [VNHumanHandPoseObservation.JointName] = [
      .wrist, .thumbTip, .indexTip, .middleTip, .ringTip, .littleTip,
      .thumbIP, .indexDIP, .middleDIP, .thumbMP, .indexPIP, .middlePIP,
    ]
    for hand in handRequest.results ?? [] {
      var hits = 0
      for name in tipJoints {
        if let pt = try? hand.recognizedPoint(name), pt.confidence >= 0.12 {
          hits += 1
        }
      }
      if hits >= 1 {
        handCount += 1
        handsVisible = true
      }
    }
    for key in ["leftWrist", "rightWrist"] {
      if let w = joints[key], let conf = w["confidence"], conf >= 0.12 {
        handsVisible = true
        handCount = max(handCount, 1)
        break
      }
    }

    // Prefer face-region luminance; fall back to center crop of full frame.
    let brightness: Double
    if let pb = pixelBuffer {
      brightness = meanLuminance(pixelBuffer: pb, normalizedBox: faceBox)
    } else if let img = cgImage {
      brightness = meanLuminance(cgImage: img, normalizedBox: faceBox)
    } else {
      brightness = 1.0
    }
    let brightEnough = brightness >= brightnessMin

    var result: [String: Any] = [
      "available": true,
      "faceCount": faceCount,
      "joints": joints,
      "faceLooking": faceLooking,
      "bothEyesVisible": bothEyesVisible,
      "mouthVisible": mouthVisible,
      "handNearFace": handsVisible,
      "handsVisible": handsVisible,
      "handCount": handCount,
      "brightness": brightness,
      "brightEnough": brightEnough,
      "timestamp": Date().timeIntervalSince1970 * 1000,
    ]
    if let faceYaw { result["faceYaw"] = faceYaw }
    if let faceRoll { result["faceRoll"] = faceRoll }
    if let facePitch { result["facePitch"] = facePitch }
    return result
  }

  static func unavailable() -> [String: Any] {
    [
      "available": false,
      "faceCount": 0,
      "joints": [:] as [String: Any],
      "faceLooking": false,
      "bothEyesVisible": false,
      "mouthVisible": false,
      "handNearFace": false,
      "handsVisible": false,
      "handCount": 0,
      "brightness": 0.0,
      "brightEnough": false,
      "timestamp": Date().timeIntervalSince1970 * 1000,
    ]
  }

  /// Vision face box is normalized, origin bottom-left. Sample ~grid of luma values.
  private static func meanLuminance(pixelBuffer: CVPixelBuffer, normalizedBox: CGRect?) -> Double {
    CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }

    let width = CVPixelBufferGetWidth(pixelBuffer)
    let height = CVPixelBufferGetHeight(pixelBuffer)
    guard width > 8, height > 8 else { return 1.0 }

    let box = sampleRect(normalizedBox: normalizedBox, width: width, height: height)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
    guard let base = CVPixelBufferGetBaseAddress(pixelBuffer) else { return 1.0 }
    let format = CVPixelBufferGetPixelFormatType(pixelBuffer)

    var sum = 0.0
    var count = 0
    let stepX = max(1, box.width / 12)
    let stepY = max(1, box.height / 12)

    for y in stride(from: box.minY, to: box.maxY, by: stepY) {
      for x in stride(from: box.minX, to: box.maxX, by: stepX) {
        let ix = Int(x)
        let iy = Int(y)
        guard ix >= 0, iy >= 0, ix < width, iy < height else { continue }
        let luma: Double
        if format == kCVPixelFormatType_32BGRA || format == kCVPixelFormatType_32RGBA {
          let row = base.advanced(by: iy * bytesPerRow)
          let pixel = row.advanced(by: ix * 4).assumingMemoryBound(to: UInt8.self)
          let b = Double(pixel[0])
          let g = Double(pixel[1])
          let r = Double(pixel[2])
          // Rec. 601 luma
          luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
        } else if format == kCVPixelFormatType_420YpCbCr8BiPlanarFullRange
                    || format == kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange {
          // Y plane is plane 0
          guard let yBase = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0) else { continue }
          let yBytes = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0)
          let yPtr = yBase.advanced(by: iy * yBytes + ix).assumingMemoryBound(to: UInt8.self)
          luma = Double(yPtr.pointee) / 255.0
        } else {
          // Unknown format — fail open so we don't brick sits
          return 1.0
        }
        sum += luma
        count += 1
      }
    }
    guard count > 0 else { return 1.0 }
    return sum / Double(count)
  }

  private static func meanLuminance(cgImage: CGImage, normalizedBox: CGRect?) -> Double {
    let width = cgImage.width
    let height = cgImage.height
    guard width > 8, height > 8 else { return 1.0 }
    let box = sampleRect(normalizedBox: normalizedBox, width: width, height: height)

    guard let ctx = CGContext(
      data: nil,
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: width * 4,
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return 1.0 }
    ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
    guard let data = ctx.data else { return 1.0 }
    let ptr = data.bindMemory(to: UInt8.self, capacity: width * height * 4)

    var sum = 0.0
    var count = 0
    let stepX = max(1, box.width / 12)
    let stepY = max(1, box.height / 12)
    for y in stride(from: box.minY, to: box.maxY, by: stepY) {
      for x in stride(from: box.minX, to: box.maxX, by: stepX) {
        let ix = Int(x)
        let iy = Int(y)
        guard ix >= 0, iy >= 0, ix < width, iy < height else { continue }
        // CGContext draws top-left origin; Vision box is bottom-left — sampleRect already converts.
        let i = (iy * width + ix) * 4
        let r = Double(ptr[i])
        let g = Double(ptr[i + 1])
        let b = Double(ptr[i + 2])
        sum += (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
        count += 1
      }
    }
    guard count > 0 else { return 1.0 }
    return sum / Double(count)
  }

  /// Convert Vision-normalized box (origin bottom-left) to pixel rect (origin top-left).
  private static func sampleRect(normalizedBox: CGRect?, width: Int, height: Int) -> CGRect {
    let w = CGFloat(width)
    let h = CGFloat(height)
    if let box = normalizedBox, box.width > 0.02, box.height > 0.02 {
      let pad: CGFloat = 0.08
      var x = (box.origin.x - pad) * w
      var yVision = (box.origin.y - pad) * h
      var bw = (box.width + pad * 2) * w
      var bh = (box.height + pad * 2) * h
      // Vision bottom-left → top-left
      var y = h - yVision - bh
      x = max(0, min(w - 1, x))
      y = max(0, min(h - 1, y))
      bw = max(8, min(w - x, bw))
      bh = max(8, min(h - y, bh))
      return CGRect(x: x, y: y, width: bw, height: bh)
    }
    // No face: center 40% crop (avoids dark edges / screen bezel)
    let bw = w * 0.4
    let bh = h * 0.4
    return CGRect(x: (w - bw) / 2, y: (h - bh) / 2, width: bw, height: bh)
  }

  static func cgImageOrientation(from orientation: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch orientation {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}
