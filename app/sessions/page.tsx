// app/sessions/page.tsx
// Participant Portal - My Sessions
// Shows upcoming and past sessions from service_plans

'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Calendar, Clock, User, Users,
    Building2, Loader2, ChevronRight, Target,
    CalendarCheck, History, AlertCircle, MapPin
} from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';

interface Session {
    id: string;
    service_type: 'individual' | 'group';
    planned_date: string;
    planned_time?: string | null;
    planned_duration: number;
    setting: string;
    status: string;
    notes?: string;
    goal_id?: string;
    goal_title?: string;
    actual_duration?: number;
    completed_at?: string;
    pss_first_name?: string;
    pss_last_name?: string;
    created_at: string;
}

type ViewTab = 'upcoming' | 'past';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSessionDate(dateStr: string): string {
    const dateOnly = dateStr.split('T')[0];
    const date = new Date(dateOnly + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const sessionDate = new Date(date);
    sessionDate.setHours(0, 0, 0, 0);

    if (sessionDate.getTime() === today.getTime()) return 'Today';
    if (sessionDate.getTime() === tomorrow.getTime()) return 'Tomorrow';

    // Within this week
    const daysUntil = Math.ceil((sessionDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil > 0 && daysUntil <= 6) {
        return date.toLocaleDateString('en-US', { weekday: 'long' });
    }

    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}

function formatTime(timeStr: string | null | undefined): string | null {
    if (!timeStr) return null;
    try {
        // Handle HH:MM:SS or HH:MM format
        const [hours, minutes] = timeStr.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours % 12 || 12;
        return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch {
        return null;
    }
}

function getSettingLabel(setting: string): string {
    const labels: Record<string, string> = {
        outpatient: 'Outpatient',
        inpatient: 'Inpatient',
        telehealth: 'Telehealth',
        community: 'Community',
        home: 'Home Visit',
        office: 'Office',
    };
    return labels[setting] || setting.charAt(0).toUpperCase() + setting.slice(1);
}

function isToday(dateStr: string): boolean {
    const date = new Date(dateStr.split('T')[0] + 'T00:00:00');
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

function isTomorrow(dateStr: string): boolean {
    const date = new Date(dateStr.split('T')[0] + 'T00:00:00');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.toDateString() === tomorrow.toDateString();
}

function isOverdue(session: Session): boolean {
    const date = new Date(session.planned_date.split('T')[0] + 'T23:59:59');
    return date < new Date() && !['completed', 'verified'].includes(session.status);
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function SessionStatusBadge({ status, isOverdue }: { status: string; isOverdue?: boolean }) {
    if (isOverdue) {
        return (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                Pending
            </span>
        );
    }

    const config: Record<string, { bg: string; text: string; label: string }> = {
        planned: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Scheduled' },
        approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Confirmed' },
        completed: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Completed' },
        verified: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Completed' },
    };

    const { bg, text, label } = config[status] || config.planned;
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
            {label}
        </span>
    );
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({ session, isNext }: { session: Session; isNext?: boolean }) {
    const pssName = session.pss_first_name
        ? `${session.pss_first_name} ${session.pss_last_name || ''}`.trim()
        : null;
    const formattedDate = formatSessionDate(session.planned_date);
    const formattedTime = formatTime(session.planned_time);
    const overdue = isOverdue(session);
    const isSoon = isToday(session.planned_date) || isTomorrow(session.planned_date);

    return (
        <div className={`card p-4 transition-all ${
            isNext ? 'ring-2 ring-portal-primary/30 bg-portal-primary/[0.02]' : ''
        } ${overdue ? 'border-l-4 border-l-amber-400' : ''}`}>
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isSoon && !overdue
                            ? 'bg-portal-primary/10 text-portal-primary'
                            : overdue
                                ? 'bg-amber-50 text-amber-600'
                                : 'bg-gray-100 text-gray-500'
                    }`}>
                        {session.service_type === 'group'
                            ? <Users className="w-5 h-5" />
                            : <User className="w-5 h-5" />
                        }
                    </div>
                    <div>
                        <h3 className="font-semibold text-portal-text capitalize text-sm">
                            {session.service_type === 'group' ? 'Group Session' : 'Individual Session'}
                        </h3>
                        {pssName && (
                            <p className="text-xs text-portal-muted">with {pssName}</p>
                        )}
                    </div>
                </div>
                <SessionStatusBadge status={session.status} isOverdue={overdue} />
            </div>

            {/* Date / Time / Duration / Setting row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-portal-muted mb-2">
                <span className="flex items-center gap-1.5">
                    <Calendar className={`w-3.5 h-3.5 ${isSoon && !overdue ? 'text-portal-primary' : ''}`} />
                    <span className={isSoon && !overdue ? 'font-medium text-portal-primary' : ''}>
                        {formattedDate}
                    </span>
                </span>

                {formattedTime ? (
                    <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {formattedTime}
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 text-portal-muted/60">
                        <Clock className="w-3.5 h-3.5" />
                        Time TBD
                    </span>
                )}

                <span className="flex items-center gap-1.5">
                    <span className="text-xs">⏱</span>
                    {session.actual_duration || session.planned_duration} min
                </span>

                <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {getSettingLabel(session.setting)}
                </span>
            </div>

            {/* Goal link */}
            {session.goal_title && (
                <div className="flex items-center gap-1.5 text-xs text-portal-primary mt-1.5">
                    <Target className="w-3 h-3" />
                    <span className="truncate">{session.goal_title}</span>
                </div>
            )}

            {/* Completed info for past sessions */}
            {session.completed_at && (
                <p className="text-xs text-portal-muted mt-2">
                    Completed {new Date(session.completed_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                    })}
                </p>
            )}

            {isNext && (
                <div className="mt-3 pt-2.5 border-t border-portal-border">
                    <p className="text-xs text-portal-primary font-medium">
                        ✨ Your next session
                        {!formattedTime && ' — check with your PSS for the exact time'}
                    </p>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SessionsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [counts, setCounts] = useState({ upcoming: 0, past: 0 });
    const [activeTab, setActiveTab] = useState<ViewTab>('upcoming');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/');
    }, [status, router]);

    useEffect(() => {
        if (session?.participantId) fetchSessions(activeTab);
    }, [session, activeTab]);

    async function fetchSessions(view: ViewTab) {
        setLoading(true);
        try {
            const res = await fetch(`/api/sessions?view=${view}`);
            const data = await res.json();
            if (data.success) {
                setSessions(data.sessions || []);
                setCounts(data.counts || { upcoming: 0, past: 0 });
            }
        } catch (error) {
            console.error('Error fetching sessions:', error);
        } finally {
            setLoading(false);
        }
    }

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-portal-background">
                <Loader2 className="w-8 h-8 animate-spin text-portal-primary" />
            </div>
        );
    }

    if (!session) return null;

    return (
        <div className="min-h-screen bg-portal-background pb-24">
            {/* Header */}
            <header className="bg-white border-b border-portal-border px-6 pt-12 pb-0 safe-area-top">
                <div className="max-w-lg mx-auto">
                    <div className="flex items-center gap-3 mb-3">
                        <button onClick={() => router.push('/dashboard')} className="p-1.5 -ml-1.5 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-portal-text" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-portal-text">My Sessions</h1>
                            <p className="text-xs text-portal-muted">Sessions scheduled by your PSS</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1">
                        <button
                            onClick={() => setActiveTab('upcoming')}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg ${
                                activeTab === 'upcoming'
                                    ? 'text-portal-primary border-b-2 border-portal-primary bg-portal-primary/5'
                                    : 'text-portal-muted hover:text-portal-text'
                            }`}
                        >
                            <CalendarCheck className="w-4 h-4" />
                            Upcoming
                            {counts.upcoming > 0 && (
                                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                                    activeTab === 'upcoming'
                                        ? 'bg-portal-primary/10 text-portal-primary'
                                        : 'bg-gray-100 text-gray-500'
                                }`}>
                                    {counts.upcoming}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('past')}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg ${
                                activeTab === 'past'
                                    ? 'text-portal-primary border-b-2 border-portal-primary bg-portal-primary/5'
                                    : 'text-portal-muted hover:text-portal-text'
                            }`}
                        >
                            <History className="w-4 h-4" />
                            Past
                            {counts.past > 0 && (
                                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                                    activeTab === 'past'
                                        ? 'bg-portal-primary/10 text-portal-primary'
                                        : 'bg-gray-100 text-gray-500'
                                }`}>
                                    {counts.past}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="px-6 py-6">
                <div className="max-w-lg mx-auto space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-portal-primary" />
                        </div>
                    ) : sessions.length === 0 ? (
                        /* Empty States */
                        <div className="card p-8 text-center">
                            {activeTab === 'upcoming' ? (
                                <>
                                    <div className="w-14 h-14 bg-portal-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <CalendarCheck className="w-7 h-7 text-portal-primary/50" />
                                    </div>
                                    <h3 className="font-semibold text-portal-text mb-1">No Upcoming Sessions</h3>
                                    <p className="text-sm text-portal-muted">
                                        When your peer support specialist schedules a session with you, it will appear here.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <History className="w-7 h-7 text-gray-400" />
                                    </div>
                                    <h3 className="font-semibold text-portal-text mb-1">No Past Sessions</h3>
                                    <p className="text-sm text-portal-muted">
                                        Completed sessions will show up here so you can look back on your journey.
                                    </p>
                                </>
                            )}
                        </div>
                    ) : (
                        /* Session List */
                        sessions.map((s, i) => (
                            <SessionCard
                                key={s.id}
                                session={s}
                                isNext={activeTab === 'upcoming' && i === 0}
                            />
                        ))
                    )}

                    {/* Info card for upcoming */}
                    {activeTab === 'upcoming' && sessions.length > 0 && (
                        <div className="bg-gradient-to-br from-portal-primary/5 to-portal-secondary/5 rounded-xl p-4 border border-portal-primary/10">
                            <p className="text-xs text-portal-muted text-center">
                                Need to reschedule? Reach out to your peer support specialist through{' '}
                                <Link href="/messages" className="text-portal-primary hover:underline">
                                    Messages
                                </Link>.
                            </p>
                        </div>
                    )}
                </div>
            </main>

            <BottomNav />
        </div>
    );
}
