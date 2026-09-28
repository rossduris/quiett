import type { Ionicons } from '@expo/vector-icons';

/** "What do you want from your mornings?" (onboarding). Feeds the first wake-up intention. */
export type MorningGoalId = 'calm' | 'phone' | 'ontime' | 'me';

export type MorningGoal = {
  id: MorningGoalId;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Saved as the wake-up intention when the user doesn't have one yet. */
  intention: string;
  /** Line under the commitment headline. */
  promise: string;
};

export const MORNING_GOALS: readonly MorningGoal[] = [
  {
    id: 'calm',
    icon: 'leaf-outline',
    label: 'A calmer start',
    intention: 'Start the day calm',
    promise: 'Two calm minutes first, then a gentler day.',
  },
  {
    id: 'phone',
    icon: 'phone-portrait-outline',
    label: 'Less phone first thing',
    intention: 'Day first, phone later',
    promise: 'Your first minutes go to you, not the feed.',
  },
  {
    id: 'ontime',
    icon: 'alarm-outline',
    label: 'Up on time, no snooze',
    intention: 'Up on time, no snooze',
    promise: 'No snooze button. Just up, still, and on your way.',
  },
  {
    id: 'me',
    icon: 'sunny-outline',
    label: 'A moment for myself',
    intention: 'A quiet moment for me',
    promise: 'Two minutes that are only yours.',
  },
];

export function morningGoalById(id: string | null | undefined): MorningGoal | null {
  return MORNING_GOALS.find((g) => g.id === id) ?? null;
}

/** Copy for the onboarding "Quiett ends the snooze habit" chart step. The chart is illustrative. */
export const SNOOZE_CHART_COPY = {
  title: 'Quiett ends the snooze habit',
  cardTitle: 'Time lost to snoozing',
  startLabel: 'Day 1',
  endLabel: 'Day 30',
  regularLabel: 'Regular alarm',
  quiettLabel: 'With Quiett',
  caption: 'When the alarm only stops once you’re up and still, snoozing fades out.',
  footnote: 'Illustration, not measured data.',
  /**
   * TODO(real-stat): replace with a real, sourced figure once we have Quiett data
   * (e.g. median snoozes per week in month 1 vs. month 2 across opted-in users).
   * Keep null until then — never ship an invented number here.
   */
  stat: null as string | null,
} as const;
