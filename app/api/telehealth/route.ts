// Participant side of telehealth video (Amazon Chime SDK).
//
// GET  ?service_plan_id= → whether the peer specialist has started the session
// POST { action: 'join', service_plan_id } → attendee join info (only while the meeting is live)
// POST { action: 'left', service_plan_id } → records that the participant left
//
// The participant can only touch their own service plans, and only when the
// organization has the `telehealth` feature. The meeting itself is created by
// staff from the main app; the portal never creates meetings.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { sql } from '@/lib/db';
import {
    ChimeSDKMeetingsClient, GetMeetingCommand, CreateAttendeeCommand,
} from '@aws-sdk/client-chime-sdk-meetings';

export const runtime = 'nodejs';

function chime() {
    return new ChimeSDKMeetingsClient({
        region: process.env.CHIME_CONTROL_REGION || 'us-east-1',
        credentials: {
            accessKeyId: (process.env.APP_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID)!,
            secretAccessKey: (process.env.APP_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY)!,
        },
    });
}

async function loadOwnPlan(planId: string, participantId: string) {
    const rows = await sql`
        SELECT sp.id, sp.organization_id, sp.participant_id, sp.setting, sp.status, sp.planned_date, sp.planned_time, sp.planned_duration,
               sp.video_meeting_id, sp.video_started_at, sp.video_ended_at,
               u.first_name AS pss_first_name, u.last_name AS pss_last_name,
               (o.settings->'features'->'add') ? 'telehealth' AS telehealth_enabled
        FROM service_plans sp
        LEFT JOIN users u ON u.id = sp.user_id
        JOIN organizations o ON o.id = sp.organization_id
        WHERE sp.id = ${planId}::uuid AND sp.participant_id = ${participantId}::uuid
    `;
    return (rows as any[])[0] || null;
}

async function meetingIsLive(meetingId: string | null): Promise<any | null> {
    if (!meetingId) return null;
    try {
        const r = await chime().send(new GetMeetingCommand({ MeetingId: meetingId }));
        return r.Meeting || null;
    } catch (err: any) {
        if (err?.name === 'NotFoundException') return null;
        throw err;
    }
}

async function recordEvent(plan: any, type: 'participant.joined' | 'participant.left', attendeeId?: string | null) {
    try {
        await sql`
            INSERT INTO telehealth_events (organization_id, service_plan_id, event_type, actor, participant_id, meeting_id, attendee_id, payload)
            VALUES (${plan.organization_id}::uuid, ${plan.id}::uuid, ${type}, 'participant', ${plan.participant_id}::uuid, ${plan.video_meeting_id || null}, ${attendeeId || null}, '{"reported_by":"portal"}'::jsonb)
        `;
    } catch (e) { console.error('telehealth_events insert failed', e); }
}

export async function GET(req: NextRequest) {
    try {
        const session = await requireAuth();
        const planId = req.nextUrl.searchParams.get('service_plan_id');
        if (!planId) return NextResponse.json({ error: 'service_plan_id required' }, { status: 400 });
        const plan = await loadOwnPlan(planId, session.participantId);
        if (!plan) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        if (!plan.telehealth_enabled) return NextResponse.json({ error: 'Video sessions are not enabled for your program' }, { status: 403 });

        const live = plan.video_meeting_id && !plan.video_ended_at ? await meetingIsLive(plan.video_meeting_id) : null;
        return NextResponse.json({
            success: true,
            plan: {
                id: plan.id, setting: plan.setting, status: plan.status,
                planned_date: plan.planned_date, planned_time: plan.planned_time, planned_duration: plan.planned_duration,
                pss_name: [plan.pss_first_name, plan.pss_last_name].filter(Boolean).join(' ') || null,
                ended: !!plan.video_ended_at,
            },
            meetingActive: !!live,
        });
    } catch (error: any) {
        if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        console.error('portal telehealth GET error:', error);
        return NextResponse.json({ error: 'Could not load the session' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await requireAuth();
        const body = await req.json();
        const planId = body?.service_plan_id;
        if (!planId) return NextResponse.json({ error: 'service_plan_id required' }, { status: 400 });
        const plan = await loadOwnPlan(planId, session.participantId);
        if (!plan) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        if (!plan.telehealth_enabled) return NextResponse.json({ error: 'Video sessions are not enabled for your program' }, { status: 403 });

        if (body.action === 'join') {
            if (plan.setting !== 'telehealth') return NextResponse.json({ error: 'This session is not a video session' }, { status: 400 });
            const live = plan.video_meeting_id && !plan.video_ended_at ? await meetingIsLive(plan.video_meeting_id) : null;
            if (!live) return NextResponse.json({ error: 'Your peer specialist has not started the session yet' }, { status: 409 });
            const r = await chime().send(new CreateAttendeeCommand({
                MeetingId: plan.video_meeting_id,
                ExternalUserId: `participant:${plan.participant_id}`.slice(0, 64),
            }));
            if (!r.Attendee?.AttendeeId) return NextResponse.json({ error: 'Could not join the session' }, { status: 502 });
            await recordEvent(plan, 'participant.joined', r.Attendee.AttendeeId);
            return NextResponse.json({ success: true, meeting: live, attendee: r.Attendee });
        }

        if (body.action === 'left') {
            await recordEvent(plan, 'participant.left', typeof body.attendee_id === 'string' ? body.attendee_id.slice(0, 100) : null);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error: any) {
        if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        console.error('portal telehealth POST error:', error);
        return NextResponse.json({ error: 'Could not join the session' }, { status: 500 });
    }
}
