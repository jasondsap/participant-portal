import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { markConversationRead } from "@/lib/db";

// POST - Mark conversation as read
export async function POST(
    req: NextRequest,
    { params }: { params: { conversationId: string } }
) {
    try {
        const session = await requireAuth();
        const participantId = (session as any).participantId;
        const conversationId = params.conversationId;

        if (!participantId) {
            return NextResponse.json(
                { error: "Participant not found" },
                { status: 400 }
            );
        }

        await markConversationRead(conversationId, participantId);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Error marking as read:", error);
        const message = error instanceof Error ? error.message : "Failed to mark as read";
        
        if (message === "Unauthorized") {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
