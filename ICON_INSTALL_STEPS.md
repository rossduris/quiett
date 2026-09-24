# Sunrise Clock Icon Installation Steps

## Issue
The PNG file `/workspace/quiett-icon/sunrise-clock-1024.png` is not accessible on the filesystem despite being uploaded. This requires manual installation.

## Source Image
- **File**: sunrise-clock-1024.png (re-attached by user)
- **Spec**: 1024×1024 RGB PNG
- **Design**: Soft peach→rose gradient clock at ~8:00 position
- **Usage**: No letterboxing, use as-is (resample only for different sizes)

## Installation Steps

### 1. Archive Current Icon Set
```bash
mkdir -p assets/brand-archive/icons-20260924-pre-sunrise-clock/
cp assets/images/icon.png assets/brand-archive/icons-20260924-pre-sunrise-clock/
cp assets/images/adaptive-icon.png assets/brand-archive/icons-20260924-pre-sunrise-clock/
cp assets/images/favicon.png assets/brand-archive/icons-20260924-pre-sunrise-clock/
cp assets/images/splash.png assets/brand-archive/icons-20260924-pre-sunrise-clock/
```

### 2. Install Main Icon
```bash
# Main icon (used by iOS and expo config)
cp quiett-icon/sunrise-clock-1024.png assets/images/icon.png
```

### 3. Create Android Adaptive Icon
Android adaptive icons require a foreground and background layer. For this solid gradient icon:
```bash
# Use the full gradient as foreground, white background
cp quiett-icon/sunrise-clock-1024.png assets/images/adaptive-icon.png
```

### 4. Create Favicon (web)
```bash
# Favicon is typically 48×48 or 192×192
# Resample from 1024 to 192 (web)
# Use ImageMagick or similar:
convert quiett-icon/sunrise-clock-1024.png -resize 192x192 assets/images/favicon.png
```

### 5. Create Splash Screen
Expo splash screens typically use the icon centered on a solid background. Options:
- **Option A**: Use the icon as-is (1024×1024) on a background matching the gradient's lightest color (#FFF8F4 or similar)
- **Option B**: Keep existing splash design if it already matches the app theme

```bash
# If using icon directly:
cp quiett-icon/sunrise-clock-1024.png assets/images/splash.png
```

### 6. Keep Brand Source Copy
```bash
mkdir -p assets/brand/png/
cp quiett-icon/sunrise-clock-1024.png assets/brand/png/sunrise-clock-icon-1024.png
```

### 7. Expo Config Check
Verify `app.json` or `app.config.js` references:
```json
{
  "expo": {
    "icon": "./assets/images/icon.png",
    "splash": {
      "image": "./assets/images/splash.png"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#FFF8F4"
      }
    },
    "web": {
      "favicon": "./assets/images/favicon.png"
    }
  }
}
```

### 8. Native Rebuild Note
After installation, native binaries need rebuilding:
```bash
# Clear Expo cache and rebuild
npx expo prebuild --clean
# Or for EAS build:
eas build --platform ios --profile development
```

## Manual Steps Required
1. Download/save the re-attached sunrise-clock icon from the conversation
2. Run the above shell commands to install it to all required paths
3. Commit and push:
   ```bash
   git add assets/
   git commit -m "Install sunrise-clock icon across all platforms"
   git push origin cursor/weekday-selection-7db6
   ```
4. Note in PR that native rebuild is required to see the new icon in built apps

## Files Modified
- `assets/images/icon.png` (main icon)
- `assets/images/adaptive-icon.png` (Android)
- `assets/images/favicon.png` (web)
- `assets/images/splash.png` (splash screen, if updated)
- `assets/brand/png/sunrise-clock-icon-1024.png` (source copy)
- Archived prior icons under `assets/brand-archive/icons-20260924-pre-sunrise-clock/`
