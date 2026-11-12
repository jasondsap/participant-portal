// app/api/assessments/route.ts
// Participant Portal - Assessment API
// GET: List participant's assessments
// POST: Submit a new BARC-10 self-assessment

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sql, query } from "@/lib/db";

// Base URL of the staff app, where tokenized invitation links are completed
// (e.g. https://app.peersupportstudio.com). Unset → pending invites are listed
// without a link and the portal hides the card.
function inviteBaseUrl(): string | null {
    const base = process.env.STUDIO_URL || process.env.NEXT_PUBLIC_STUDIO_URL || null;
    return base ? base.replace(/\/+$/, '') : null;
}

// GET - List participant's assessments (BARC-10, MIRC-28, Workforce Readiness
// Index) plus any open invitation links the staff app has sent them.
export async function GET(req: NextRequest) {
    try {
        const session = await requireAuth();
        const participantId = session.participantId;
        const organizationId = session.organizationId;

        if (!participantId) {
            return NextResponse.json(
                { error: "Participant not found" },
                { status: 400 }
            );
        }

        const { searchParams } = new URL(req.url);
        const assessmentType = searchParams.get('type'); // 'barc10', 'mirc28', or null for all

        let assessments;

        if (assessmentType) {
            assessments = await sql`
                SELECT 
                    id,
                    assessment_type,
                    total_score,
                    domain_scores,
                    ai_analysis,
                    notes,
                    assessment_date,
                    created_at
                FROM recovery_assessments
                WHERE participant_id = ${participantId}
                AND assessment_type = ${assessmentType}
                ORDER BY created_at DESC
            `;
        } else {
            assessments = await sql`
                SELECT 
                    id,
                    assessment_type,
                    total_score,
                    domain_scores,
                    ai_analysis,
                    notes,
                    assessment_date,
                    created_at
                FROM recovery_assessments
                WHERE participant_id = ${participantId}
                ORDER BY created_at DESC
            `;
        }

        // Open invitations (sent by staff, not yet completed or expired). The
        // participant completes them on the staff app's public /assessment/[token]
        // page, which scores server-side; the result lands in the same table.
        let pending_invites: Array<{ id: string; assessment_type: string; expires_at: string; url: string | null }> = [];
        if (!assessmentType) {
            const base = inviteBaseUrl();
            const invites = (await sql`
                SELECT id, token, assessment_type, expires_at
                FROM assessment_invitations
                WHERE participant_id = ${participantId}
                  AND organization_id = ${organizationId}
                  AND status IN ('sent', 'opened')
                  AND expires_at > NOW()
                ORDER BY created_at DESC
            `) as any[];
            pending_invites = invites.map((i: any) => ({
                id: i.id,
                assessment_type: i.assessment_type,
                expires_at: i.expires_at,
                url: base ? `${base}/assessment/${i.token}` : null,
            }));
        }

        return NextResponse.json({
            success: true,
            assessments: assessments || [],
            total: assessments?.length || 0,
            pending_invites,
        });

    } catch (error) {
        console.error("Error fetching assessments:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch assessments";

        if (message === "Unauthorized") {
            return NextResponse.json({ error: message }, { status: 401 });
        }

        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST - Submit a new BARC-10 self-assessment
export async function POST(req: NextRequest) {
    try {
        const session = await requireAuth();
        const participantId = session.participantId;
        const organizationId = session.organizationId;

        if (!participantId || !organizationId) {
            return NextResponse.json(
                { error: "Participant or organization not found" },
                { status: 400 }
            );
        }

        const body = await req.json();
        const { responses, total_score, domain_scores } = body;

        if (!responses || total_score === undefined || !domain_scores) {
            return NextResponse.json(
                { error: "Missing required fields: responses, total_score, domain_scores" },
                { status: 400 }
            );
        }

        // Look up participant's primary PSS to set as user_id
        // This ensures the assessment shows up in the PSS's Studio view
        const participant = await sql`
            SELECT primary_pss_id FROM participants WHERE id = ${participantId}
        `;

        const pssUserId = participant?.[0]?.primary_pss_id || null;

        if (!pssUserId) {
            return NextResponse.json(
                { error: "No assigned peer support specialist found" },
                { status: 400 }
            );
        }

        // Get participant name for the record
        const participantInfo = await sql`
            SELECT 
                COALESCE(preferred_name, first_name) || ' ' || last_name as full_name
            FROM participants WHERE id = ${participantId}
        `;
        const participantName = participantInfo?.[0]?.full_name || 'Self-Assessment';

        // Insert into the SAME recovery_assessments table used by Studio
        const result = await sql`
            INSERT INTO recovery_assessments (
                user_id,
                organization_id,
                participant_id,
                participant_name,
                assessment_type,
                total_score,
                domain_scores,
                responses,
                assessment_date,
                notes
            ) VALUES (
                ${pssUserId},
                ${organizationId},
                ${participantId},
                ${participantName},
                'barc10',
                ${total_score},
                ${JSON.stringify(domain_scores)},
                ${JSON.stringify(responses)},
                CURRENT_DATE,
                'Submitted via participant portal'
            )
            RETURNING *
        `;

        if (!result || result.length === 0) {
            return NextResponse.json(
                { error: "Failed to save assessment" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            assessment: result[0],
            assessmentId: result[0].id,
        });

    } catch (error) {
        console.error("Error submitting assessment:", error);
        const message = error instanceof Error ? error.message : "Failed to submit assessment";

        if (message === "Unauthorized") {
            return NextResponse.json({ error: message }, { status: 401 });
        }

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
