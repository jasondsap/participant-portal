// app/api/interview-practice/route.ts
// Participant Portal - Interview practice
// GET:  whether interview practice is on for this participant's organization,
//       and their practices so far (each with a link back into the practice).
// POST: start a practice. Creates the link here; the practice itself runs in
//       the staff app (Peer Support Studio) at /interview/<token>, which also
//       builds the interview from the participant's resume, enforces who may
//       use it and the daily limit, and writes the feedback to their record.
//
// The portal shares the database with the staff app. It only writes the
// interview_sessions row (source 'portal'); every rule about who may practice
// is checked again by the staff app when the link is opened.

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAuth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

// Always per-request: it reads the signed-in participant.
export const dynamic = 'force-dynamic';

const LINK_DAYS = 14;

// Base URL of the staff app (e.g. https://app.peersupportstudio.com). Unset → the feature is hidden.
function studioUrl(): string | null {
    const base = process.env.STUDIO_URL || process.env.NEXT_PUBLIC_STUDIO_URL || null;
    return base ? base.replace(/\/+$/, '') : null;
}

// Interview practice is in no plan bundle: an organization has it only when it is added explicitly.
async function enabledFor(organizationId: string): Promise<boolean> {
    const org = await queryOne<{ add: unknown; remove: unknown }>(
        `SELECT settings->'features'->'add' AS add, settings->'features'->'remove' AS remove FROM organizations WHERE id = $1::uuid`, [organizationId]);
    const has = (v: unknown) => Array.isArray(v) && v.includes('interview-practice');
    return !!org && has(org.add) && !has(org.remove);
}

interface Row { id: string; token: string; status: string; job_title: string | null; company: string | null; overall: number | null; created_at: string; completed_at: string | null; expires_at: string; expired: boolean }

async function practices(participantId: string, organizationId: string): Promise<Row[]> {
    return query<Row>(
        `SELECT id, token, status, job_title, company, (scorecard->>'overall')::int AS overall, created_at, completed_at, expires_at, (expires_at <= NOW()) AS expired
         FROM interview_sessions
         WHERE participant_id = $1::uuid AND organization_id = $2::uuid AND status <> 'cancelled'
         ORDER BY created_at DESC LIMIT 20`, [participantId, organizationId]);
}

const view = (rows: Row[], base: string) => rows.map(r => ({
    id: r.id, status: r.status, job_title: r.job_title, company: r.company, overall: r.overall, created_at: r.created_at, completed_at: r.completed_at,
    // Finished practices stay readable; unfinished ones only while the link is still good.
    url: r.status === 'completed' || !r.expired ? `${base}/interview/${r.token}` : null,
}));

function fail(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : fallback;
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    console.error(fallback, error);
    return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET() {
    try {
        const session = await requireAuth();
        const base = studioUrl();
        if (!base || !(await enabledFor(session.organizationId))) return NextResponse.json({ enabled: false, practices: [] });
        return NextResponse.json({ enabled: true, practices: view(await practices(session.participantId, session.organizationId), base) });
    } catch (error) { return fail(error, "Failed to load interview practice"); }
}

export async function POST() {
    try {
        const session = await requireAuth();
        const base = studioUrl();
        if (!base || !(await enabledFor(session.organizationId))) return NextResponse.json({ error: "Interview practice is not available" }, { status: 403 });

        // Pick up an unfinished practice instead of piling up new links.
        const open = (await practices(session.participantId, session.organizationId)).find(r => (r.status === 'invited' || r.status === 'started' || r.status === 'abandoned') && !r.expired);
        if (open) return NextResponse.json({ url: `${base}/interview/${open.token}`, resumed: true });

        const token = randomBytes(32).toString('base64url');
        // The plan is left empty on purpose: the staff app builds it from the resume when the link is first opened.
        await query(
            `INSERT INTO interview_sessions (organization_id, participant_id, source, token, delivery_method, plan, expires_at)
             VALUES ($1::uuid, $2::uuid, 'portal', $3, 'link', '{}'::jsonb, NOW() + ($4 || ' days')::interval)`,
            [session.organizationId, session.participantId, token, String(LINK_DAYS)]);
        return NextResponse.json({ url: `${base}/interview/${token}`, resumed: false });
    } catch (error) { return fail(error, "Could not start the practice"); }
}
