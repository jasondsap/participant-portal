import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getParticipantGoals } from "@/lib/db";

// GET - List participant's goals
export async function GET(req: NextRequest) {
    try {
        const session = await requireAuth();
        const participantId = (session as any).participantId;
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') as 'active' | 'completed' | 'all' | null;

        if (!participantId) {
            return NextResponse.json(
                { error: "Participant not found" },
                { status: 400 }
            );
        }

        const goals = await getParticipantGoals(participantId, status || 'all');

        return NextResponse.json({
            goals,
            total: goals.length,
            active: goals.filter((g: any) => g.status !== 'completed').length,
            completed: goals.filter((g: any) => g.status === 'completed').length
        });

    } catch (error) {
        console.error("Error fetching goals:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch goals";
        
        if (message === "Unauthorized") {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
