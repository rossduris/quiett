import type { Ionicons } from '@expo/vector-icons';
import type { BadgeId } from '@/lib/storage';

/** Every milestone badge (Milestones screen + the Profile progress count). */
export type Badge = {
  id: BadgeId;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  category: 'streak' | 'milestone' | 'variety';
};

export const ALL_BADGES: Badge[] = [
  {
    id: 'first-unlock',
    icon: 'sunny',
    label: 'First Morning',
    description: 'Unlocked your first morning',
    category: 'milestone',
  },
  {
    id: 'streak-3',
    icon: 'flame',
    label: '3-Day Streak',
    description: 'Completed 3 days in a row',
    category: 'streak',
  },
  {
    id: 'streak-7',
    icon: 'flame',
    label: 'Week Warrior',
    description: 'Completed 7 days in a row',
    category: 'streak',
  },
  {
    id: 'streak-14',
    icon: 'flame',
    label: 'Two Weeks',
    description: 'Completed 14 days in a row',
    category: 'streak',
  },
  {
    id: 'streak-21',
    icon: 'flame',
    label: '21-Day Habit',
    description: 'Completed 21 days in a row',
    category: 'streak',
  },
  {
    id: 'streak-30',
    icon: 'flame',
    label: 'Month Mastery',
    description: 'Completed 30 days in a row',
    category: 'streak',
  },
  {
    id: 'streak-60',
    icon: 'flame',
    label: 'Two Months',
    description: 'Completed 60 days in a row',
    category: 'streak',
  },
  {
    id: 'streak-100',
    icon: 'flame',
    label: 'Century',
    description: 'Completed 100 days in a row',
    category: 'streak',
  },
  {
    id: 'mornings-10',
    icon: 'star',
    label: '10 Mornings',
    description: 'Unlocked 10 total mornings',
    category: 'milestone',
  },
  {
    id: 'mornings-50',
    icon: 'star',
    label: '50 Mornings',
    description: 'Unlocked 50 total mornings',
    category: 'milestone',
  },
  {
    id: 'perfect-week',
    icon: 'checkmark-done',
    label: 'Perfect Week',
    description: 'Completed every scheduled morning in a week (Mon–Sun)',
    category: 'milestone',
  },
  {
    id: 'tried-guided',
    icon: 'mic',
    label: 'Voice Explorer',
    description: 'Tried a guided meditation',
    category: 'variety',
  },
  {
    id: 'tried-ambient',
    icon: 'musical-notes',
    label: 'Soundscape',
    description: 'Tried an ambient track',
    category: 'variety',
  },
  {
    id: 'tried-healing',
    icon: 'pulse',
    label: 'Tones',
    description: 'Tried a track from Tones & music',
    category: 'variety',
  },
];
