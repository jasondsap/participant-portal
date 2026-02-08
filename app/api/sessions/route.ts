import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
    try {
        const session = await requireAuth();
        const participantId = session.participantId;

        if (!participantId) {
            return NextResponse.json(
                { error: "Participant not found" },
                { status: 400 }
            );
        }

        const { searchParams } = new URL(req.url);
        const view = searchParams.get('view') || 'upcoming';

        let sessions;

        if (view === 'upcoming') {
            sessions = await sql`
                SELECT 
                    sp.id,
                    sp.service_type,
                    sp.planned_date,
                    sp.planned_time,
                    sp.planned_duration,
                    sp.setting,
                    sp.status,
                    sp.notes,
                    sp.goal_id,
                    sp.created_at,
                    sp.updated_at,
                    u.first_name as pss_first_name,
                    u.last_name as pss_last_name
                FROM service_plans sp
                LEFT JOIN users u ON sp.user_id = u.id
                WHERE sp.participant_id = ${participantId}
                AND sp.status IN ('planned', 'approved')
                AND sp.planned_date >= CURRENT_DATE
                ORDER BY sp.planned_date ASC, sp.planned_time ASC NULLS LAST
            `;
        } else if (view === 'past') {
            sessions = await sql`
                SELECT 
                    sp.id,
                    sp.service_type,
                    sp.planned_date,
                    sp.planned_time,
                    sp.planned_duration,
                    sp.setting,
                    sp.status,
                    sp.notes,
                    sp.goal_id,
                    sp.actual_duration,
                    sp.completed_at,
                    sp.created_at,
                    sp.updated_at,
                    u.first_name as pss_first_name,
                    u.last_name as pss_last_name
                FROM service_plans sp
                LEFT JOIN users u ON sp.user_id = u.id
                WHERE sp.participant_id = ${participantId}
                AND (
                    sp.status IN ('completed', 'verified')
                    OR (sp.status IN ('planned', 'approved') AND sp.planned_date < CURRENT_DATE)
                )
                ORDER BY sp.planned_date DESC
                LIMIT 50
            `;
        } else {
            sessions = await sql`
                SELECT 
                    sp.id,
                    sp.service_type,
                    sp.planned_date,
                    sp.planned_time,
                    sp.planned_duration,
                    sp.setting,
                    sp.status,
                    sp.notes,
                    sp.goal_id,
                    sp.actual_duration,
                    sp.completed_at,
                    sp.created_at,
                    sp.updated_at,
                    u.first_name as pss_first_name,
                    u.last_name as pss_last_name
                FROM service_plans sp
                LEFT JOIN users u ON sp.user_id = u.id
                WHERE sp.participant_id = ${participantId}
                ORDER BY sp.planned_date DESC
                LIMIT 100
            `;
        }

        const counts = await sql`
            SELECT
                COUNT(*) FILTER (
                    WHERE status IN ('planned', 'approved') AND planned_date >= CURRENT_DATE
                ) as upcoming_count,
                COUNT(*) FILTER (
                    WHERE status IN ('completed', 'verified')
                    OR (status IN ('planned', 'approved') AND planned_date < CURRENT_DATE)
                ) as past_count
            FROM service_plans
            WHERE participant_id = ${participantId}
        `;

        const nextSession = await sql`
            SELECT 
                sp.id,
                sp.service_type,
                sp.planned_date,
                sp.planned_time,
                sp.planned_duration,
                sp.setting,
                sp.status,
                u.first_name as pss_first_name,
                u.last_name as pss_last_name
            FROM service_plans sp
            LEFT JOIN users u ON sp.user_id = u.id
            WHERE sp.participant_id = ${participantId}
            AND sp.status IN ('planned', 'approved')
            AND sp.planned_date >= CURRENT_DATE
            ORDER BY sp.planned_date ASC, sp.planned_time ASC NULLS LAST
            LIMIT 1
        `;

        return NextResponse.json({
            success: true,
            sessions: sessions || [],
            counts: {
                upcoming: Number(counts[0]?.upcoming_count) || 0,
                past: Number(counts[0]?.past_count) || 0,
            },
            nextSession: nextSession?.[0] || null,
        });

    } catch (error) {
        console.error("Error fetching sessions:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch sessions";

        if (message === "Unauthorized") {
            return NextResponse.json({ error: message }, { status: 401 });
        }

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
