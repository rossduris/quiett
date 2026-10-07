import { useEffect, useState } from 'react';

/**
 * False on the first paint, true from the next frame on (once `ready`). Used to skip entering
 * animations for content that's there on first load and only animate later changes.
 * State-based (not a ref read during render) so the React Compiler can optimise callers.
 */
export function useAfterFirstPaint(ready = true): boolean {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!ready || done) return;
    const id = requestAnimationFrame(() => setDone(true));
    return () => cancelAnimationFrame(id);
  }, [ready, done]);
  return done;
}
