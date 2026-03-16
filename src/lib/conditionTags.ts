export type ConditionTag = { id: string; name: string; color: string };

export const TAG_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  gray:   { bg: 'bg-gray-100 dark:bg-gray-800',          text: 'text-gray-600 dark:text-gray-300',      dot: 'bg-gray-400'    },
  brown:  { bg: 'bg-stone-100 dark:bg-stone-900/40',     text: 'text-stone-700 dark:text-stone-400',    dot: 'bg-stone-500'   },
  orange: { bg: 'bg-orange-100 dark:bg-orange-950/40',   text: 'text-orange-700 dark:text-orange-400',  dot: 'bg-orange-500'  },
  yellow: { bg: 'bg-yellow-100 dark:bg-yellow-950/40',   text: 'text-yellow-700 dark:text-yellow-400',  dot: 'bg-yellow-500'  },
  green:  { bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400',dot: 'bg-emerald-500'  },
  teal:   { bg: 'bg-teal-100 dark:bg-teal-950/40',       text: 'text-teal-700 dark:text-teal-400',      dot: 'bg-teal-500'    },
  blue:   { bg: 'bg-blue-100 dark:bg-blue-950/40',       text: 'text-blue-700 dark:text-blue-400',      dot: 'bg-blue-500'    },
  purple: { bg: 'bg-purple-100 dark:bg-purple-950/40',   text: 'text-purple-700 dark:text-purple-400',  dot: 'bg-purple-500'  },
  pink:   { bg: 'bg-pink-100 dark:bg-pink-950/40',       text: 'text-pink-700 dark:text-pink-400',      dot: 'bg-pink-500'    },
  red:    { bg: 'bg-red-100 dark:bg-red-950/40',         text: 'text-red-600 dark:text-red-400',        dot: 'bg-red-500'     },
};

export const TAG_COLOR_KEYS = Object.keys(TAG_COLORS);
