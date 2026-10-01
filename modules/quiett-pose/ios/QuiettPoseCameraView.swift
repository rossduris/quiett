import AVFoundation
import ExpoModulesCore
import UIKit
import Vision

public class QuiettPoseCameraView: ExpoView, AVCaptureVideoDataOutputSampleBufferDelegate {
  let onPoseFrame = EventDispatcher()
  let onCameraReady = EventDispatcher()
  let onMountError = EventDispatcher()

  private let session = AVCaptureSession()
  private let sessionQueue = DispatchQueue(label: "quiett.pose.camera")
  private let visionQueue = DispatchQueue(label: "quiett.pose.vision")
  private var previewLayer: AVCaptureVideoPreviewLayer?
  private var videoOutput: AVCaptureVideoDataOutput?
  private var isActive = true
  private var mirrored = true
  private var sessionConfigured = false
  private var lastVisionTime: CFTimeInterval = 0
  private var visionBusy = false
  /// Detector mode (legacy / body2d / body3d). Read + written on the Vision queue.
  private var detectorMode: QuiettDetectorMode = .legacy
  /// Joint history for body-mode stillness (Vision queue only).
  private let motionTracker = QuiettPoseMotionTracker()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .black
    clipsToBounds = true

    let preview = AVCaptureVideoPreviewLayer(session: session)
    preview.videoGravity = .resizeAspectFill
    layer.insertSublayer(preview, at: 0)
    previewLayer = preview

    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleAppBackground),
      name: UIApplication.didEnterBackgroundNotification,
      object: nil
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleAppForeground),
      name: UIApplication.willEnterForegroundNotification,
      object: nil
    )

    sessionQueue.async { [weak self] in
      self?.configureSession()
    }
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
    sessionQueue.async { [session] in
      if session.isRunning {
        session.stopRunning()
      }
    }
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    previewLayer?.frame = bounds
    applyMirror()
  }

  func setActive(_ active: Bool) {
    isActive = active
    sessionQueue.async { [weak self] in
      guard let self else { return }
      if active {
        self.startSessionIfNeeded()
      } else if self.session.isRunning {
        self.session.stopRunning()
      }
    }
  }

  func setDetectorMode(_ value: String) {
    let mode = QuiettDetectorMode(rawValue: value) ?? .legacy
    visionQueue.async { [weak self] in
      guard let self, self.detectorMode != mode else { return }
      self.detectorMode = mode
      self.motionTracker.reset()
    }
  }

  func setMirrored(_ value: Bool) {
    mirrored = value
    DispatchQueue.main.async { [weak self] in
      self?.applyMirror()
    }
  }

  private func applyMirror() {
    guard let previewLayer else { return }
    previewLayer.connection?.automaticallyAdjustsVideoMirroring = false
    if previewLayer.connection?.isVideoMirroringSupported == true {
      previewLayer.connection?.isVideoMirrored = mirrored
    }
  }

  private func configureSession() {
    guard !sessionConfigured else {
      startSessionIfNeeded()
      return
    }

    session.beginConfiguration()
    session.sessionPreset = .medium

    guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front) else {
      session.commitConfiguration()
      DispatchQueue.main.async { [weak self] in
        self?.onMountError(["message": "Front camera unavailable"])
      }
      return
    }

    do {
      let input = try AVCaptureDeviceInput(device: device)
      if session.canAddInput(input) {
        session.addInput(input)
      } else {
        throw NSError(
          domain: "QuiettPose",
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Cannot add camera input"]
        )
      }
    } catch {
      session.commitConfiguration()
      DispatchQueue.main.async { [weak self] in
        self?.onMountError(["message": error.localizedDescription])
      }
      return
    }

    let output = AVCaptureVideoDataOutput()
    output.alwaysDiscardsLateVideoFrames = true
    output.videoSettings = [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
    ]
    output.setSampleBufferDelegate(self, queue: visionQueue)
    if session.canAddOutput(output) {
      session.addOutput(output)
      videoOutput = output
      if let connection = output.connection(with: .video) {
        connection.automaticallyAdjustsVideoMirroring = false
        if connection.isVideoMirroringSupported {
          connection.isVideoMirrored = true
        }
        if connection.isVideoOrientationSupported {
          connection.videoOrientation = .portrait
        }
      }
    }

    session.commitConfiguration()
    sessionConfigured = true
    startSessionIfNeeded()
  }

  private func startSessionIfNeeded() {
    guard isActive, sessionConfigured, !session.isRunning else { return }
    session.startRunning()
    DispatchQueue.main.async { [weak self] in
      self?.applyMirror()
      self?.onCameraReady([:])
    }
  }

  @objc private func handleAppBackground() {
    sessionQueue.async { [weak self] in
      if self?.session.isRunning == true {
        self?.session.stopRunning()
      }
    }
  }

  @objc private func handleAppForeground() {
    sessionQueue.async { [weak self] in
      self?.startSessionIfNeeded()
    }
  }

  public func captureOutput(
    _ output: AVCaptureOutput,
    didOutput sampleBuffer: CMSampleBuffer,
    from connection: AVCaptureConnection
  ) {
    guard isActive else { return }
    if #available(iOS 14.0, *) {
      let mode = detectorMode
      let now = CACurrentMediaTime()
      guard now - lastVisionTime >= mode.minInterval, !visionBusy else { return }
      lastVisionTime = now
      visionBusy = true

      defer { visionBusy = false }

      guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

      let bw = CGFloat(CVPixelBufferGetWidth(pixelBuffer))
      let bh = CGFloat(CVPixelBufferGetHeight(pixelBuffer))
      // Legacy: unchanged (front camera + portrait + mirrored connection → leftMirrored).
      // Body modes: the data-output connection is set to portrait + mirrored, so when the buffer
      // already arrives portrait (w < h) it is upright → `.up`; a landscape buffer still needs
      // `.leftMirrored`. Body joints are orientation-sensitive, faces much less so.
      let orientation: CGImagePropertyOrientation
      if mode == .legacy {
        orientation = .leftMirrored
      } else {
        orientation = bw < bh ? .up : .leftMirrored
      }
      let rotated = orientation == .leftMirrored
      let imageSize = rotated ? CGSize(width: bh, height: bw) : CGSize(width: bw, height: bh)
      var result = QuiettPoseVision.analyze(
        pixelBuffer: pixelBuffer,
        orientation: orientation,
        mode: mode,
        tracker: mode == .legacy ? nil : motionTracker,
        imageSize: imageSize
      )
      let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
      result["timestamp"] = CMTimeGetSeconds(pts) * 1000
      result["orientation"] = rotated ? "leftMirrored" : "up"
      result["bufferWidth"] = Double(bw)
      result["bufferHeight"] = Double(bh)
      result["targetFps"] = Int((1.0 / mode.minInterval).rounded())

      DispatchQueue.main.async { [weak self] in
        self?.onPoseFrame(result)
      }
    }
  }
}
