'use client';

// Participant video session. Waits for the peer specialist to start, then
// joins the call in the browser. No app to install; works on a phone.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, Video, Loader2, CheckCircle2, Clock } from 'lucide-react';

const VideoCall = dynamic(() => import('@/components/telehealth/VideoCall'), { ssr: false, loading: () => <div className="min-h-screen flex items-center justify-center bg-black text-white"><Loader2 className="w-6 h-6 animate-spin" /></div> });

interface Info {
    plan: { id: string; setting: string; status: string; planned_date: string; planned_time: string | null; planned_duration: number; pss_name: string | null; ended: boolean };
    meetingActive: boolean;
}

const fmtTime = (t?: string | null) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
const fmtDate = (d: string) => new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

export default function ParticipantTelehealthPage() {
    const params = useParams();
    const router = useRouter();
    const { status: authStatus } = useSession();
    const planId = String(params.id);

    const [info, setInfo] = useState<Info | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [phase, setPhase] = useState<'waiting' | 'joining' | 'incall' | 'done'>('waiting');
    const [join, setJoin] = useState<{ meeting: Record<string, unknown>; attendee: Record<string, unknown> } | null>(null);
    const attendeeId = useRef<string | null>(null);

    const load = useCallback(async () => {
        try {
            const r = await fetch(`/api/telehealth?service_plan_id=${planId}`);
            const d = await r.json();
            if (!r.ok) { setError(d.error || 'Could not load this session'); return; }
            setInfo(d);
        } catch { setError('Could not load this session'); }
    }, [planId]);

    useEffect(() => {
        if (authStatus === 'unauthenticated') router.push('/auth/signin');
        if (authStatus === 'authenticated') load();
    }, [authStatus, load, router]);

    // While waiting, check every 10 seconds whether the specialist has started.
    useEffect(() => {
        if (phase !== 'waiting' || !info || info.meetingActive) return;
        const t = setInterval(load, 10_000);
        return () => clearInterval(t);
    }, [phase, info, load]);

    const joinNow = async () => {
        setPhase('joining'); setError(null);
        try {
            const r = await fetch('/api/telehealth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'join', service_plan_id: planId }) });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Could not join');
            attendeeId.current = String((d.attendee as any)?.AttendeeId || '');
            setJoin({ meeting: d.meeting, attendee: d.attendee });
            setPhase('incall');
        } catch (e: any) { setError(e.message); setPhase('waiting'); load(); }
    };

    const onLeave = useCallback(() => {
        fetch('/api/telehealth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'left', service_plan_id: planId, attendee_id: attendeeId.current }) }).catch(() => {});
        setPhase('done');
    }, [planId]);

    if (phase === 'incall' && join && info) {
        return (
            <VideoCall
                meeting={join.meeting}
                attendee={join.attendee}
                title={info.plan.pss_name ? `Session with ${info.plan.pss_name}` : 'Your session'}
                subtitle={`${fmtDate(info.plan.planned_date)}${info.plan.planned_time ? ` · ${fmtTime(info.plan.planned_time)}` : ''}`}
                leaveLabel="Leave"
                onLeave={onLeave}
            />
        );
    }

    return (
        <div className="min-h-screen bg-portal-bg">
            <header className="bg-white border-b border-portal-border">
                <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
                    <Link href="/sessions" className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-portal-muted" /></Link>
                    <div className="w-9 h-9 rounded-xl bg-portal-primary/10 flex items-center justify-center"><Video className="w-5 h-5 text-portal-primary" /></div>
                    <h1 className="font-semibold text-portal-text">Video session</h1>
                </div>
            </header>

            <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
                {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                {!info && !error && <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-portal-primary" /></div>}

                {info && phase !== 'done' && (
                    <div className="card p-5 space-y-4">
                        <div>
                            <p className="font-semibold text-portal-text">{info.plan.pss_name ? `Session with ${info.plan.pss_name}` : 'Your session'}</p>
                            <p className="text-sm text-portal-muted">{fmtDate(info.plan.planned_date)}{info.plan.planned_time ? ` at ${fmtTime(info.plan.planned_time)}` : ''} · {info.plan.planned_duration} min</p>
                        </div>

                        {info.plan.ended ? (
                            <p className="text-sm text-portal-muted">This session has ended.</p>
                        ) : info.meetingActive ? (
                            <button onClick={joinNow} disabled={phase === 'joining'} className="w-full py-3.5 rounded-xl bg-portal-primary text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                                {phase === 'joining' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Video className="w-5 h-5" />}
                                Join session
                            </button>
                        ) : (
                            <div className="rounded-xl bg-portal-primary/5 border border-portal-primary/20 p-4 text-sm text-portal-text flex items-start gap-3">
                                <Clock className="w-5 h-5 text-portal-primary mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-medium">Waiting for {info.plan.pss_name || 'your peer specialist'} to start.</p>
                                    <p className="text-portal-muted mt-1">Keep this page open. The Join button appears here as soon as the session starts.</p>
                                </div>
                            </div>
                        )}

                        <ul className="text-xs text-portal-muted space-y-1">
                            <li>Find a private spot and, if you can, use headphones.</li>
                            <li>Your browser will ask for camera and microphone permission. Choose Allow.</li>
                            <li>Sessions are not recorded.</li>
                        </ul>
                    </div>
                )}

                {phase === 'done' && (
                    <div className="card p-6 space-y-4 text-center">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                        <p className="font-semibold text-portal-text">You left the session</p>
                        <p className="text-sm text-portal-muted">If that was a mistake, you can rejoin while your specialist is still in the session.</p>
                        <div className="flex flex-col gap-2">
                            <button onClick={() => { setPhase('waiting'); load(); }} className="w-full py-3 rounded-xl border border-portal-border text-portal-text font-medium">Rejoin</button>
                            <Link href="/sessions" className="w-full py-3 rounded-xl bg-portal-primary text-white font-semibold">Back to My Sessions</Link>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
