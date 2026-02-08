import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getParticipantConversations } from "@/lib/db";

// GET - List participant's conversations
export async function GET(req: NextRequest) {
    try {
        const session = await requireAuth();
        const participantId = (session as any).participantId;

        if (!participantId) {
            return NextResponse.json(
                { error: "Participant not found" },
                { status: 400 }
            );
        }

        const conversations = await getParticipantConversations(participantId);

        return NextResponse.json({
            conversations,
            total: conversations.length
        });

    } catch (error) {
        console.error("Error fetching conversations:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch conversations";
        
        if (message === "Unauthorized") {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
