/**
 * Emoji vocabulary for the participant messaging experience. Mirrors the studio
 * app's lib/messaging/emoji.ts so reactions/emoji match across both sides.
 * The reactions API validates against ALL_EMOJIS.
 */

/** Quick reactions shown when reacting to a message, most-used first. */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/** Picker groups for inline emoji insertion in the composer. */
export const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
    {
        label: 'Smileys',
        emojis: ['😀', '😄', '😁', '😊', '🙂', '😉', '😍', '😘', '😎', '🤗', '🤔', '😅', '😂', '🤣', '😮', '😯', '😢', '😭', '😡', '😴', '🤒', '🥳', '😇', '🙃'],
    },
    {
        label: 'Gestures',
        emojis: ['👍', '👎', '👏', '🙌', '🙏', '👌', '✌️', '🤝', '💪', '👋', '🤞', '✋'],
    },
    {
        label: 'Hearts & celebration',
        emojis: ['❤️', '💕', '💙', '💚', '💛', '🧡', '💜', '💔', '🎉', '🎊', '🎂', '⭐', '✨', '🔥', '💯', '🏆'],
    },
    {
        label: 'Objects',
        emojis: ['📞', '📧', '📅', '📋', '📌', '✅', '❌', '⚠️', '❓', '❗', '💡', '⏰'],
    },
];

/** Flat set of every emoji we accept as a stored reaction. */
export const ALL_EMOJIS = new Set<string>([
    ...QUICK_REACTIONS,
    ...EMOJI_GROUPS.flatMap(g => g.emojis),
]);
