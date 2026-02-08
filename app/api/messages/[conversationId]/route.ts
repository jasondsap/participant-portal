import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getConversationMessages, sendParticipantMessage, sql } from "@/lib/db";

// GET - Fetch messages in a conversation
export async function GET(
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

        const messages = await getConversationMessages(conversationId, participantId);

        // Get PSS user info
        const pssUser = await sql`
            SELECT u.id, u.first_name || ' ' || u.last_name as name, u.avatar_url
            FROM conversation_members cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.conversation_id = ${conversationId}
            AND cm.member_type = 'user'
            LIMIT 1
        `;

        return NextResponse.json({
            messages,
            pss_user: pssUser[0] || null
        });

    } catch (error) {
        console.error("Error fetching messages:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch messages";
        
        if (message === "Unauthorized") {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        if (message === "Not a member of this conversation") {
            return NextResponse.json({ error: message }, { status: 403 });
        }
        
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST - Send a message
export async function POST(
    req: NextRequest,
    { params }: { params: { conversationId: string } }
) {
    try {
        const session = await requireAuth();
        const participantId = (session as any).participantId;
        const conversationId = params.conversationId;
        const body = await req.json();
        const { content } = body;

        if (!participantId) {
            return NextResponse.json(
                { error: "Participant not found" },
                { status: 400 }
            );
        }

        if (!content || !content.trim()) {
            return NextResponse.json(
                { error: "Message content is required" },
                { status: 400 }
            );
        }

        const message = await sendParticipantMessage(
            conversationId, 
            participantId, 
            content.trim()
        );

        // Get the full message with sender info
        const fullMessage = await sql`
            SELECT 
                m.*,
                json_build_object(
                    'id', p.id,
                    'name', COALESCE(p.preferred_name, p.first_name) || ' ' || p.last_name
                ) as sender
            FROM messages m
            JOIN participants p ON m.sender_participant_id = p.id
            WHERE m.id = ${message.id}
        `;

        return NextResponse.json({
            success: true,
            message: fullMessage[0]
        });

    } catch (error) {
        console.error("Error sending message:", error);
        const message = error instanceof Error ? error.message : "Failed to send message";
        
        if (message === "Unauthorized") {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        if (message === "Not a member of this conversation") {
            return NextResponse.json({ error: message }, { status: 403 });
        }
        
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
