import { InteractionManager } from 'react-native';

/**
 * Staggers heavy SVG cover mounts. Mounting ~50-node react-native-svg trees for every visible
 * card in one commit is what made the Library tab hitch on first open; deferred covers show a
 * cheap placeholder, wait for the tab transition to finish, then mount a couple per tick.
 */
const PER_TICK = 2;
const TICK_MS = 34;

type Job = { run: () => void; cancelled: boolean };
const queue: Job[] = [];
let pumping = false;

function pump() {
  if (pumping) return;
  pumping = true;
  InteractionManager.runAfterInteractions(() => {
    const tick = () => {
      let n = 0;
      while (n < PER_TICK && queue.length) {
        const job = queue.shift()!;
        if (job.cancelled) continue;
        job.run();
        n++;
      }
      if (queue.length) setTimeout(tick, TICK_MS);
      else pumping = false;
    };
    tick();
  });
}

/** Queue a mount; returns a cancel function (call on unmount). */
export function scheduleCoverMount(run: () => void): () => void {
  const job: Job = { run, cancelled: false };
  queue.push(job);
  pump();
  return () => {
    job.cancelled = true;
  };
}

/** Covers whose scene model has already been drawn once mount straight away (no placeholder). */
const drawn = new WeakSet<object>();
export function wasCoverDrawn(model: object): boolean {
  return drawn.has(model);
}
export function markCoverDrawn(model: object): void {
  drawn.add(model);
}
