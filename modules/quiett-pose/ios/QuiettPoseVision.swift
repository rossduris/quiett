import UIKit
import Vision
import CoreVideo
import CoreGraphics
import QuartzCore
import simd

/// Shared Vision helpers for stills + live CMSampleBuffer analysis.
enum QuiettPoseVision {
  /// Mean luminance (0–1). Ordinary indoor light stays above this.
  /// Only a covered lens or a near-black frame with no one in it fails. Match JS BRIGHTNESS_MIN.
  static let brightnessMin: Double = 0.04

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
  static func analyze(
    pixelBuffer: CVPixelBuffer,
    orientation: CGImagePropertyOrientation,
    mode: QuiettDetectorMode = .legacy,
    tracker: QuiettPoseMotionTracker? = nil,
    imageSize: CGSize = .zero
  ) -> [String: Any] {
    let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: orientation, options: [:])
    return perform(handler: handler, pixelBuffer: pixelBuffer, cgImage: nil, mode: mode, tracker: tracker, imageSize: imageSize)
  }

  @available(iOS 14.0, *)
  private static func perform(
    handler: VNImageRequestHandler,
    pixelBuffer: CVPixelBuffer?,
    cgImage: CGImage?,
    mode: QuiettDetectorMode = .legacy,
    tracker: QuiettPoseMotionTracker? = nil,
    imageSize: CGSize = .zero
  ) -> [String: Any] {
    let started = CACurrentMediaTime()
    let faceRequest = VNDetectFaceLandmarksRequest()
    if #available(iOS 15.0, *) {
      faceRequest.revision = VNDetectFaceLandmarksRequestRevision3
    }

    var bodyRequest: VNDetectHumanBodyPoseRequest? = nil
    var modeUsed = mode
    var fallbackReason: String? = nil
    var obs3D: AnyObject? = nil
    var faceDone = false

    if mode == .body3d {
      if #available(iOS 17.0, *) {
        let req3D = VNDetectHumanBodyPose3DRequest()
        do {
          try handler.perform([req3D, faceRequest])
          faceDone = true
          if let first = req3D.results?.first {
            obs3D = first
          } else {
            fallbackReason = "no 3D body"
          }
        } catch {
          fallbackReason = "3D error: \(error.localizedDescription)"
        }
      } else {
        fallbackReason = "3D needs iOS 17"
      }
      if obs3D == nil { modeUsed = .body2d }
    }

    if obs3D == nil {
      let req = VNDetectHumanBodyPoseRequest()
      bodyRequest = req
      do {
        try handler.perform(faceDone ? [req] : [req, faceRequest])
      } catch {
        return unavailable()
      }
    }

    var handRequest: VNDetectHumanHandPoseRequest? = nil
    if mode == .legacy {
      let hr = VNDetectHumanHandPoseRequest()
      hr.maximumHandCount = 2
      handRequest = hr
      do {
        try handler.perform([hr])
      } catch {
        // leave hand results empty
      }
    }

    var size = imageSize
    if size == .zero, let cgImage {
      size = CGSize(width: cgImage.width, height: cgImage.height)
    }

    var joints: [String: [String: Double]] = [:]
    var jointsPx: [String: CGPoint] = [:]
    var jointsDetected: [String] = []
    if let observation = bodyRequest?.results?.first {
      for (jointName, key) in jointMapping {
        if let point = try? observation.recognizedPoint(jointName), point.confidence > 0.05 {
          joints[key] = [
            "x": Double(point.location.x),
            "y": Double(point.location.y),
            "confidence": Double(point.confidence),
          ]
          if point.confidence >= QuiettPoseThresholds.minJointConfidence {
            jointsDetected.append(key)
            jointsPx[key] = CGPoint(x: point.location.x * size.width, y: point.location.y * size.height)
          }
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
    for hand in handRequest?.results ?? [] {
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

    // Body-pose posture checks (common result shape).
    var detector: [String: Any]? = nil
    if mode != .legacy {
      let now = CACurrentMediaTime()
      var checks = QuiettPoseBody.commonChecks(
        brightness: brightness, brightEnough: brightEnough, faceLooking: faceLooking, faceCount: faceCount
      )
      var personFound = false
      var extra: [String: Any] = [:]
      var detected = jointsDetected
      var handled3D = false
      if #available(iOS 17.0, *), let o = obs3D as? VNHumanBodyPose3DObservation {
        let r = QuiettPoseBody.checks3D(observation: o, imageSize: size, tracker: tracker, now: now)
        checks += r.checks
        personFound = r.personFound
        extra = r.extra
        detected = r.jointsDetected
        joints = r.imageJoints
        handled3D = true
      }
      if !handled3D {
        if jointsPx["nose"] == nil, let fb = faceBox {
          jointsPx["faceCenter"] = CGPoint(x: fb.midX * size.width, y: fb.midY * size.height)
        }
        let r = QuiettPoseBody.checks2D(joints: jointsPx, tracker: tracker, now: now)
        checks += r.checks
        personFound = r.personFound
        extra = r.extra
      }
      detector = QuiettPoseBody.summarize(
        requested: mode, used: modeUsed, fallbackReason: fallbackReason, checks: checks,
        personFound: personFound, jointsDetected: detected, extra: extra
      )
    }

    let processingMs = (CACurrentMediaTime() - started) * 1000
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
      "detectorMode": modeUsed.rawValue,
      "processingMs": processingMs,
      "imageWidth": Double(size.width),
      "imageHeight": Double(size.height),
    ]
    if var detector {
      detector["processingMs"] = processingMs
      result["detector"] = detector
    }
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

// MARK: - Body pose detectors (2D / 3D)
// Kept in this file so no `pod install` is needed to pick up a new source file.

/// Which pose detector the live camera runs. Selected from JS via the `detectorMode` prop.
enum QuiettDetectorMode: String {
  /// Original gates: face looking + landmark stillness (checks in JS). Hands are not a gate.
  case legacy
  /// 2D body pose (VNDetectHumanBodyPoseRequest) posture checks.
  case body2d
  /// 3D body pose (VNDetectHumanBodyPose3DRequest, iOS 17+), falls back to body2d.
  case body3d

  /// Vision throttle per mode (battery): legacy ~9 fps, 2D ~12 fps, 3D ~5 fps (heavier model).
  var minInterval: CFTimeInterval {
    switch self {
    case .legacy: return 1.0 / 9.0
    case .body2d: return 1.0 / 12.0
    case .body3d: return 1.0 / 5.0
    }
  }
}

/// Posture thresholds. Mirrored (read-only) in the JS debug readout via each check's `limit`.
enum QuiettPoseThresholds {
  /// Joints below this Vision confidence are ignored by the checks (still drawn faintly by the overlay).
  static let minJointConfidence: Float = 0.3

  // 2D (image space, scale-free: ratios of shoulder width)
  /// |shoulder roll| in degrees. Natural asymmetry + Vision jitter is ~3–6°; a clear lean is 15°+.
  static let shoulderRollMaxDeg: Double = 12
  /// |nose.x − shoulder-mid.x| / shoulder width. Head tilt/turn stays under ~0.2; leaning out of line ~0.4+.
  static let headOffsetMax: Double = 0.3
  /// (nose.y − shoulder-mid.y) / shoulder width. Upright head sits ~0.5–0.9 above; a dropped head < 0.2.
  static let headAboveMin: Double = 0.2
  /// Neck→hip-mid line from image vertical, degrees (lateral lean only — 2D can't see forward slump).
  static let torsoMaxDeg2D: Double = 15
  /// Wrist must sit at least this many shoulder widths below the shoulder line (≈ below the chest).
  static let wristBelowShoulderMin: Double = 0.6
  /// With hips visible: wrist no higher than this many shoulder widths above the hip line (≈ lap / thighs).
  static let wristAboveHipMax: Double = 0.6
  /// Wrist closer than this (shoulder widths) to the nose counts as a hand at the face / holding a phone up.
  static let wristNearFaceMax: Double = 0.9
  /// Median nose/shoulder std-dev over the window, in shoulder widths.
  /// Vision jitter on a still person is ~0.02–0.04. 0.28 lets a small settle pass.
  /// Wrists and elbows are not in this metric.
  static let stillnessMax: Double = 0.28
  static let stillnessWindow: CFTimeInterval = 1.0

  // 3D (metres / degrees, gravity-ish up = skeleton model +Y)
  /// Real torso angle from vertical (root → centre shoulder). Includes forward slump; relaxed recline ≤ ~15°.
  static let torsoMaxDeg3D: Double = 20
  /// Shoulder line tilt out of the horizontal plane.
  static let shoulderRollMaxDeg3D: Double = 10
  /// Horizontal distance of centre-head from centre-shoulder, metres (forward-head posture is ~5–8 cm).
  static let headOffsetMax3D: Double = 0.1
  /// Wrist height above the root (hip centre), metres. Hands on thighs / lap ≈ 0.05–0.25.
  static let wristAboveRootMax3D: Double = 0.35
  /// Wrist to centre-head distance below this = hand at face.
  static let wristNearHeadMin3D: Double = 0.35
}

/// One posture check in the common result shape.
struct QuiettCheck {
  let name: String
  let value: Double?
  let limit: Double
  let pass: Bool
  let available: Bool
  let weight: Double
  let unit: String
  var note: String? = nil
  /// "max" = value must be ≤ limit, "min" = value must be ≥ limit, "bool" = pass flag only.
  var kind: String = "max"

  var soft: Double {
    guard available else { return 0 }
    guard let v = value, kind != "bool" else { return pass ? 1 : 0 }
    if kind == "min" {
      if v >= limit { return 1 }
      return max(0, 0.7 * (v / max(limit, 0.0001)))
    }
    if v <= limit { return 1 - 0.3 * (v / max(limit, 0.0001)) }
    return max(0, 0.7 * (1 - (v - limit) / max(limit, 0.0001)))
  }

  var dict: [String: Any] {
    var d: [String: Any] = [
      "name": name,
      "limit": limit,
      "pass": pass,
      "available": available,
      "unit": unit,
      "kind": kind,
    ]
    if let value, value.isFinite { d["value"] = value }
    if let note { d["note"] = note }
    return d
  }
}

/// Per-camera-view joint history for stillness (touched only on the Vision queue).
final class QuiettPoseMotionTracker {
  private var history: [String: [(t: CFTimeInterval, p: CGPoint)]] = [:]

  func reset() {
    history.removeAll()
  }

  /// Median positional std-dev (pixels / `scale`) across joints with ≥ 4 samples in the window.
  func push(points: [String: CGPoint], at t: CFTimeInterval, scale: CGFloat) -> Double? {
    for (k, p) in points {
      history[k, default: []].append((t, p))
    }
    for k in Array(history.keys) {
      let kept = history[k]!.filter { t - $0.t <= QuiettPoseThresholds.stillnessWindow }
      history[k] = kept.isEmpty ? nil : kept
    }
    guard scale > 1 else { return nil }
    var stds: [Double] = []
    for (_, arr) in history where arr.count >= 4 {
      let n = Double(arr.count)
      let mx = arr.reduce(0.0) { $0 + Double($1.p.x) } / n
      let my = arr.reduce(0.0) { $0 + Double($1.p.y) } / n
      let v = arr.reduce(0.0) { acc, s in
        acc + pow(Double(s.p.x) - mx, 2) + pow(Double(s.p.y) - my, 2)
      } / n
      stds.append(sqrt(v) / Double(scale))
    }
    guard !stds.isEmpty else { return nil }
    stds.sort()
    return stds[stds.count / 2]
  }
}

enum QuiettPoseBody {
  typealias T = QuiettPoseThresholds

  static let stillnessJoints = [
    "nose", "leftShoulder", "rightShoulder",
  ]

  static func deg(_ r: Double) -> Double { r * 180 / .pi }

  /// Lighting + facing checks shared by every mode (existing gates).
  static func commonChecks(brightness: Double, brightEnough: Bool, faceLooking: Bool, faceCount: Int) -> [QuiettCheck] {
    [
      QuiettCheck(name: "lighting", value: brightness, limit: QuiettPoseVision.brightnessMin, pass: brightEnough,
                  available: true, weight: 1, unit: "luma", kind: "min"),
      QuiettCheck(name: "facing", value: faceLooking ? 1 : 0, limit: 1, pass: faceLooking,
                  available: true, weight: 1.5, unit: "", note: faceCount == 0 ? "no face" : nil, kind: "bool"),
    ]
  }

  /// 2D posture checks on pixel-space joints (origin bottom-left, y up).
  static func checks2D(
    joints j: [String: CGPoint],
    tracker: QuiettPoseMotionTracker?,
    now: CFTimeInterval
  ) -> (checks: [QuiettCheck], personFound: Bool, extra: [String: Any]) {
    guard let ls = j["leftShoulder"], let rs = j["rightShoulder"] else {
      return ([], false, ["reason": "shoulders not found"])
    }
    var checks: [QuiettCheck] = []
    var extra: [String: Any] = [:]
    let mid = CGPoint(x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2)
    let sw = max(1, hypot(ls.x - rs.x, ls.y - rs.y))
    extra["shoulderWidthPx"] = Double(sw)

    // Shoulders level (roll of the shoulder line).
    let roll = deg(atan2(Double(abs(ls.y - rs.y)), Double(max(abs(ls.x - rs.x), 0.0001))))
    checks.append(QuiettCheck(name: "shoulderLevel", value: roll, limit: T.shoulderRollMaxDeg,
                              pass: roll <= T.shoulderRollMaxDeg, available: true, weight: 1, unit: "deg"))

    // Head centred over the shoulders (and not dropped).
    let head = j["nose"] ?? j["faceCenter"]
    if let head {
      let off = Double(abs(head.x - mid.x) / sw)
      let above = Double((head.y - mid.y) / sw)
      extra["headAbove"] = above
      let ok = off <= T.headOffsetMax && above >= T.headAboveMin
      checks.append(QuiettCheck(name: "headCentered", value: off, limit: T.headOffsetMax, pass: ok,
                                available: true, weight: 1, unit: "×sw",
                                note: above < T.headAboveMin ? "head low" : (j["nose"] == nil ? "face box" : nil)))
    } else {
      checks.append(QuiettCheck(name: "headCentered", value: nil, limit: T.headOffsetMax, pass: false,
                                available: false, weight: 1, unit: "×sw", note: "no nose"))
    }

    // Torso upright: neck (shoulder mid) → hip mid near image vertical. Hips often out of frame.
    var hip: CGPoint? = nil
    if let lh = j["leftHip"], let rh = j["rightHip"] {
      hip = CGPoint(x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2)
    } else if let root = j["root"] {
      hip = root
    }
    if let hip, mid.y > hip.y {
      let a = deg(atan2(Double(abs(mid.x - hip.x)), Double(mid.y - hip.y)))
      checks.append(QuiettCheck(name: "torsoUpright", value: a, limit: T.torsoMaxDeg2D,
                                pass: a <= T.torsoMaxDeg2D, available: true, weight: 1, unit: "deg"))
    } else {
      checks.append(QuiettCheck(name: "torsoUpright", value: nil, limit: T.torsoMaxDeg2D, pass: true,
                                available: false, weight: 1, unit: "deg",
                                note: hip == nil ? "hips out of frame" : "hips above shoulders"))
    }

    // Hands, wrists, and elbows are not a gate. A cup or a shift must not fail.
    checks.append(QuiettCheck(name: "handsLow", value: nil, limit: T.wristBelowShoulderMin, pass: true,
                              available: false, weight: 0, unit: "×sw below",
                              note: "not gated", kind: "bool"))

    // Stillness from joint movement across frames.
    var pts: [String: CGPoint] = [:]
    for k in stillnessJoints { if let p = j[k] { pts[k] = p } }
    let still = tracker?.push(points: pts, at: now, scale: sw)
    checks.append(QuiettCheck(name: "stillness", value: still, limit: T.stillnessMax,
                              pass: still.map { $0 <= T.stillnessMax } ?? true,
                              available: still != nil, weight: 1.5, unit: "×sw", note: still == nil ? "warming up" : nil))
    return (checks, true, extra)
  }

  static func summarize(
    requested: QuiettDetectorMode,
    used: QuiettDetectorMode,
    fallbackReason: String?,
    checks: [QuiettCheck],
    personFound: Bool,
    jointsDetected: [String],
    extra: [String: Any]
  ) -> [String: Any] {
    let avail = checks.filter { $0.available }
    let wSum = avail.reduce(0.0) { $0 + $1.weight }
    var score = wSum > 0 ? 100 * avail.reduce(0.0) { $0 + $1.weight * $1.soft } / wSum : 0
    if !personFound { score = min(score, 20) }
    let pass = personFound && checks.allSatisfy { !$0.available || $0.pass }
    var checkDict: [String: Any] = [:]
    for c in checks { checkDict[c.name] = c.dict }
    var d: [String: Any] = [
      "mode": requested.rawValue,
      "modeUsed": used.rawValue,
      "pass": pass,
      "score": Int(score.rounded()),
      "personFound": personFound,
      "checks": checkDict,
      "checkOrder": checks.map { $0.name },
      "jointsDetected": jointsDetected,
      "jointCount": jointsDetected.count,
      "extra": extra,
    ]
    if let fallbackReason { d["fallback"] = fallbackReason }
    return d
  }

  // MARK: 3D

  static let joint3DMapping: [(String, String)] = [
    ("root", "root"), ("leftHip", "leftHip"), ("rightHip", "rightHip"), ("spine", "spine"),
    ("centerShoulder", "neck"), ("centerHead", "head"), ("topHead", "topHead"),
    ("leftShoulder", "leftShoulder"), ("rightShoulder", "rightShoulder"),
    ("leftElbow", "leftElbow"), ("rightElbow", "rightElbow"),
    ("leftWrist", "leftWrist"), ("rightWrist", "rightWrist"),
    ("leftKnee", "leftKnee"), ("rightKnee", "rightKnee"),
    ("leftAnkle", "leftAnkle"), ("rightAnkle", "rightAnkle"),
  ]

  @available(iOS 17.0, *)
  static func jointName3D(_ key: String) -> VNHumanBodyPose3DObservation.JointName? {
    switch key {
    case "root": return .root
    case "leftHip": return .leftHip
    case "rightHip": return .rightHip
    case "spine": return .spine
    case "centerShoulder": return .centerShoulder
    case "centerHead": return .centerHead
    case "topHead": return .topHead
    case "leftShoulder": return .leftShoulder
    case "rightShoulder": return .rightShoulder
    case "leftElbow": return .leftElbow
    case "rightElbow": return .rightElbow
    case "leftWrist": return .leftWrist
    case "rightWrist": return .rightWrist
    case "leftKnee": return .leftKnee
    case "rightKnee": return .rightKnee
    case "leftAnkle": return .leftAnkle
    case "rightAnkle": return .rightAnkle
    default: return nil
    }
  }

  /// 3D posture checks. Returns normalized image joints (for the overlay) keyed like the 2D joints.
  @available(iOS 17.0, *)
  static func checks3D(
    observation obs: VNHumanBodyPose3DObservation,
    imageSize: CGSize,
    tracker: QuiettPoseMotionTracker?,
    now: CFTimeInterval
  ) -> (checks: [QuiettCheck], personFound: Bool, jointsDetected: [String], imageJoints: [String: [String: Double]], extra: [String: Any]) {
    var pos: [String: simd_float3] = [:]
    var imgPx: [String: CGPoint] = [:]
    var imageJoints: [String: [String: Double]] = [:]
    var detected: [String] = []
    for (key, outKey) in joint3DMapping {
      guard let name = jointName3D(key) else { continue }
      if let p = try? obs.recognizedPoint(name) {
        let c = p.position.columns.3
        pos[key] = simd_float3(c.x, c.y, c.z)
        detected.append(outKey)
      }
      if let ip = try? obs.pointInImage(name) {
        imageJoints[outKey] = ["x": Double(ip.x), "y": Double(ip.y), "confidence": 1]
        imgPx[outKey] = CGPoint(x: ip.x * imageSize.width, y: ip.y * imageSize.height)
      }
    }
    guard let root = pos["root"], let cs = pos["centerShoulder"],
          let ls = pos["leftShoulder"], let rs = pos["rightShoulder"] else {
      return ([], false, detected, imageJoints, ["reason": "3D torso not found"])
    }

    let up = simd_float3(0, 1, 0)
    var checks: [QuiettCheck] = []
    var extra: [String: Any] = ["bodyHeightM": Double(obs.bodyHeight), "upAxis": "model+Y"]

    // Arm joints in metres, relative to the body root, for the JS arm-stillness tracker
    // (wrist / elbow travel relative to the shoulders over a short window).
    var arm3D: [String: [Double]] = [:]
    for k in ["centerShoulder", "leftShoulder", "rightShoulder", "leftElbow", "rightElbow", "leftWrist", "rightWrist"] {
      if let p = pos[k] {
        let d = p - root
        arm3D[k] = [Double(d.x), Double(d.y), Double(d.z)]
      }
    }
    extra["arm3D"] = arm3D

    // Camera-relative up (diagnostic only until verified on device).
    let cm = obs.cameraOriginMatrix
    let camUp = simd_float3(cm.columns.1.x, cm.columns.1.y, cm.columns.1.z)

    let torso = cs - root
    if simd_length(torso) > 0.05 {
      let t = simd_normalize(torso)
      let a = deg(Double(acos(max(-1, min(1, simd_dot(t, up))))))
      if simd_length(camUp) > 0.5 {
        let ac = deg(Double(acos(max(-1, min(1, simd_dot(t, simd_normalize(camUp)))))))
        extra["torsoAngleCameraDeg"] = min(ac, 180 - ac)
      }
      checks.append(QuiettCheck(name: "torsoUpright", value: a, limit: T.torsoMaxDeg3D,
                                pass: a <= T.torsoMaxDeg3D, available: true, weight: 1, unit: "deg"))
    }

    let sd = ls - rs
    if simd_length(sd) > 0.05 {
      let roll = deg(Double(asin(min(1, abs(simd_dot(simd_normalize(sd), up))))))
      extra["shoulderWidthM"] = Double(simd_length(sd))
      checks.append(QuiettCheck(name: "shoulderLevel", value: roll, limit: T.shoulderRollMaxDeg3D,
                                pass: roll <= T.shoulderRollMaxDeg3D, available: true, weight: 1, unit: "deg"))
    }

    let head = pos["centerHead"] ?? pos["topHead"]
    if let head {
      let h = head - cs
      let vertical = simd_dot(h, up)
      let horiz = Double(simd_length(h - vertical * up))
      let ok = horiz <= T.headOffsetMax3D && vertical > 0.05
      checks.append(QuiettCheck(name: "headCentered", value: horiz, limit: T.headOffsetMax3D, pass: ok,
                                available: true, weight: 1, unit: "m", note: vertical <= 0.05 ? "head low" : nil))
    } else {
      checks.append(QuiettCheck(name: "headCentered", value: nil, limit: T.headOffsetMax3D, pass: false,
                                available: false, weight: 1, unit: "m", note: "no head"))
    }

    // Hands, wrists, and elbows are not a gate.
    checks.append(QuiettCheck(name: "handsLow", value: nil, limit: T.wristAboveRootMax3D, pass: true,
                              available: false, weight: 0, unit: "m above hips",
                              note: "not gated", kind: "bool"))

    // Stillness: image-space joints (root-relative 3D would hide whole-body sway).
    if let l2 = imgPx["leftShoulder"], let r2 = imgPx["rightShoulder"] {
      let sw = max(1, hypot(l2.x - r2.x, l2.y - r2.y))
      var pts: [String: CGPoint] = [:]
      for k in ["head", "leftShoulder", "rightShoulder"] {
        if let p = imgPx[k] { pts[k] = p }
      }
      let still = tracker?.push(points: pts, at: now, scale: sw)
      checks.append(QuiettCheck(name: "stillness", value: still, limit: T.stillnessMax,
                                pass: still.map { $0 <= T.stillnessMax } ?? true,
                                available: still != nil, weight: 1.5, unit: "×sw", note: still == nil ? "warming up" : nil))
    }
    return (checks, true, detected, imageJoints, extra)
  }
}
