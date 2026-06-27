import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { toggleParticipantReaction } from "@/lib/db";
import { ALL_EMOJIS } from "@/lib/emoji";

// POST - Toggle the participant's emoji reaction on a message.
//   Body: { message_id, emoji }
export async function POST(
    req: NextRequest,
    { params }: { params: { conversationId: string } }
) {
    try {
        const session = await requireAuth();
        const participantId = (session as any).participantId;
        const conversationId = params.conversationId;

        if (!participantId) {
            return NextResponse.json({ error: "Participant not found" }, { status: 400 });
        }

        const { message_id, emoji } = await req.json();
        if (!message_id || !emoji) {
            return NextResponse.json({ error: "message_id and emoji are required" }, { status: 400 });
        }
        if (!ALL_EMOJIS.has(emoji)) {
            return NextResponse.json({ error: "Unsupported emoji" }, { status: 400 });
        }

        const reactions = await toggleParticipantReaction(
            conversationId,
            participantId,
            message_id,
            emoji
        );

        return NextResponse.json({ success: true, reactions });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to react";
        if (message === "Unauthorized") {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        if (message === "Not a member of this conversation") {
            return NextResponse.json({ error: message }, { status: 403 });
        }
        console.error("Error toggling reaction:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
