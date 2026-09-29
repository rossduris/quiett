import type { AccessibilityActionEvent, AccessibilityProps } from 'react-native';

/**
 * Screen-reader pattern for a tappable row/card that also has its own small play button.
 * The row stays one accessible element and also offers the preview as a custom action
 * ("Actions available: Preview"). The play button itself is drawn as a sibling on top of
 * the row by `PreviewOverlay`, so VoiceOver can also focus it as its own button.
 */
export function previewA11yActions(
  playing: boolean,
  onPreview: (() => void) | undefined,
): Pick<AccessibilityProps, 'accessibilityActions' | 'onAccessibilityAction'> {
  if (!onPreview) return {};
  return {
    accessibilityActions: [{ name: 'preview', label: playing ? 'Stop preview' : 'Preview' }],
    onAccessibilityAction: (e: AccessibilityActionEvent) => {
      if (e.nativeEvent.actionName === 'preview') onPreview();
    },
  };
}
