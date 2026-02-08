// app/api/assessments/[id]/route.ts
// Participant Portal - Single Assessment Detail

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sql } from "@/lib/db";

// GET - Fetch single assessment (only if it belongs to this participant)
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requireAuth();
        const participantId = session.participantId;

        if (!participantId) {
            return NextResponse.json(
                { error: "Participant not found" },
                { status: 400 }
            );
        }

        const assessmentId = params.id;

        // Fetch assessment - only if it belongs to this participant
        const assessments = await sql`
            SELECT 
                id,
                assessment_type,
                total_score,
                domain_scores,
                responses,
                ai_analysis,
                notes,
                assessment_date,
                created_at
            FROM recovery_assessments
            WHERE id = ${assessmentId}::uuid
            AND participant_id = ${participantId}
        `;

        if (!assessments || assessments.length === 0) {
            return NextResponse.json(
                { error: "Assessment not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            assessment: assessments[0],
        });

    } catch (error) {
        console.error("Error fetching assessment:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch assessment";

        if (message === "Unauthorized") {
            return NextResponse.json({ error: message }, { status: 401 });
        }

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
