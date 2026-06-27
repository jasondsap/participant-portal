/**
 * Reaction grouping for the participant thread. "mine" is keyed off the current
 * reactor id (the participant's id). Mirrors the studio app's grouping shape.
 */

export interface ReactionRow {
    message_id: string;
    emoji: string;
    reactor_id: string;   // user_id OR participant_id of the reactor
    reactor_name: string;
}

export interface ReactionGroup {
    emoji: string;
    count: number;
    mine: boolean;
    users: string[];
}

export function groupReactions(
    rows: ReactionRow[],
    currentReactorId: string
): Record<string, ReactionGroup[]> {
    const byMessage: Record<string, Map<string, ReactionGroup>> = {};
    for (const r of rows) {
        const msg = (byMessage[r.message_id] ||= new Map());
        const g = msg.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false, users: [] };
        g.count++;
        g.users.push(r.reactor_name);
        if (r.reactor_id === currentReactorId) g.mine = true;
        msg.set(r.emoji, g);
    }
    const out: Record<string, ReactionGroup[]> = {};
    for (const [messageId, groups] of Object.entries(byMessage)) {
        out[messageId] = Array.from(groups.values()).sort((a, b) => b.count - a.count);
    }
    return out;
}
