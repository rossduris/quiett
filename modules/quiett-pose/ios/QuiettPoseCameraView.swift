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
  /// ~9 fps Vision throttle (target 8–10).
  private let visionMinInterval: CFTimeInterval = 1.0 / 9.0
  private var visionBusy = false

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
      let now = CACurrentMediaTime()
      guard now - lastVisionTime >= visionMinInterval, !visionBusy else { return }
      lastVisionTime = now
      visionBusy = true

      defer { visionBusy = false }

      guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

      // Front camera + portrait + mirrored connection → leftMirrored for Vision coords.
      let orientation: CGImagePropertyOrientation = .leftMirrored
      var result = QuiettPoseVision.analyze(pixelBuffer: pixelBuffer, orientation: orientation)
      let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
      result["timestamp"] = CMTimeGetSeconds(pts) * 1000

      DispatchQueue.main.async { [weak self] in
        self?.onPoseFrame(result)
      }
    }
  }
}
