Pod::Spec.new do |s|
  s.name           = 'QuiettPose'
  s.version        = '1.1.0'
  s.summary        = 'On-device Apple Vision live pose + stills for Quiett'
  s.description    = 'Local Expo module: AVCaptureSession live Vision + VNDetectHumanBodyPoseRequest / face rectangles'
  s.license        = 'MIT'
  s.author         = 'Quiett'
  s.homepage       = 'https://github.com/rossduris/quiett'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/rossduris/quiett.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'Vision', 'CoreMedia'
  s.source_files = '**/*.{h,m,mm,swift}'
end
