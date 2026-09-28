import type { AccessibilityActionEvent, AccessibilityProps } from 'react-native';

/**
 * Screen-reader pattern for a tappable row/card that also has its own small play button.
 * The row stays one accessible element (VoiceOver can't reach a button nested inside it),
 * so the preview is exposed as a custom action ("Actions available: Preview") and the
 * visual play button is hidden from assistive tech with `previewButtonA11yHidden`.
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

/** Spread on the visual play button inside a row that uses `previewA11yActions`. */
export const previewButtonA11yHidden = {
  accessible: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants' as const,
};
