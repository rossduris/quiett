import { useCallback, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { PlayButton } from '@/components/PlayButton';

type PlayButtonProps = ComponentProps<typeof PlayButton>;

type Props = {
  /**
   * Draws the row / card. Put `slot` exactly where the play button used to sit: it's an empty
   * placeholder of the same size, so the layout doesn't change.
   */
  renderRow: (slot: ReactNode) => ReactNode;
  /** The preview button (omit to render the row alone, e.g. locked tracks). */
  button?: PlayButtonProps | null;
  /** Layout style for the wrapper (only needed if the row relied on its parent, e.g. flex). */
  style?: StyleProp<ViewStyle>;
};

/**
 * VoiceOver merges an accessible row/card into one element, so a play button nested inside it
 * can't be focused. This keeps an invisible slot where the button sits in the row and draws the
 * real PlayButton as a sibling on top of it, so the preview is its own VoiceOver button while
 * the row keeps its label and actions. Looks and taps the same as before.
 */
export function PreviewOverlay({ renderRow, button, style }: Props) {
  const hostRef = useRef<View>(null);
  const slotRef = useRef<View>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const measure = useCallback(() => {
    const slot = slotRef.current;
    const host = hostRef.current;
    if (!slot || !host) return;
    slot.measureLayout(
      host,
      (x, y) => setPos((p) => (p && p.x === x && p.y === y ? p : { x, y })),
      () => {},
    );
  }, []);

  const slot = button ? (
    <View
      ref={slotRef}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      onLayout={measure}
      style={[
        button.style,
        {
          width: button.size,
          height: button.size,
          backgroundColor: 'transparent',
          borderWidth: 0,
          shadowOpacity: 0,
          elevation: 0,
        },
      ]}
    />
  ) : null;

  return (
    <View ref={hostRef} style={style} onLayout={button ? measure : undefined}>
      {renderRow(slot)}
      {button && pos ? (
        <PlayButton
          {...button}
          style={[
            button.style,
            {
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              right: undefined,
              bottom: undefined,
              margin: 0,
              marginHorizontal: 0,
              marginVertical: 0,
              marginLeft: 0,
              marginRight: 0,
              marginTop: 0,
              marginBottom: 0,
            },
          ]}
        />
      ) : null}
    </View>
  );
}
