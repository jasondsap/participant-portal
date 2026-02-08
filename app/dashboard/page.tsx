// app/dashboard/page.tsx
// Participant Portal - Dashboard with Messages, Goals, Assessments, AND Sessions
// Adds: Next session banner, Sessions quick action card

'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
    MessageCircle, Target, Loader2, Bell, CheckCircle2,
    Clock, ArrowRight, ClipboardCheck, TrendingUp,
    Calendar, User, MapPin, BookHeart
} from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';

interface NextSessionInfo {
    id: string;
    service_type: string;
    planned_date: string;
    planned_time?: string | null;
    planned_duration: number;
    setting: string;
    status: string;
    pss_first_name?: string;
    pss_last_name?: string;
}

interface DashboardStats {
    unreadMessages: number;
    activeGoals: number;
    completedGoals: number;
    pssName?: string;
    totalAssessments: number;
    latestAssessmentScore?: number;
    latestAssessmentType?: string;
    latestAssessmentDate?: string;
    upcomingSessions: number;
    nextSession: NextSessionInfo | null;
    journalEntries: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSessionDate(dateStr: string): string {
    const date = new Date(dateStr.split('T')[0] + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const sessionDate = new Date(date);
    sessionDate.setHours(0, 0, 0, 0);

    if (sessionDate.getTime() === today.getTime()) return 'Today';
    if (sessionDate.getTime() === tomorrow.getTime()) return 'Tomorrow';

    const daysUntil = Math.ceil((sessionDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil > 0 && daysUntil <= 6) {
        return date.toLocaleDateString('en-US', { weekday: 'long' });
    }

    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(timeStr: string | null | undefined): string | null {
    if (!timeStr) return null;
    try {
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
        outpatient: 'Outpatient', inpatient: 'Inpatient',
        telehealth: 'Telehealth', community: 'Community',
        home: 'Home Visit', office: 'Office',
    };
    return labels[setting] || setting.charAt(0).toUpperCase() + setting.slice(1);
}

function isSessionSoon(dateStr: string): boolean {
    const date = new Date(dateStr.split('T')[0] + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoDaysOut = new Date(today);
    twoDaysOut.setDate(twoDaysOut.getDate() + 2);
    return date <= twoDaysOut;
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/');
    }, [status, router]);

    useEffect(() => {
        if (session?.participantId) fetchStats();
    }, [session]);

    async function fetchStats() {
        try {
            // Fetch all stats in parallel
            const [messagesRes, goalsRes, assessRes, sessionsRes, journalRes] = await Promise.all([
                fetch('/api/messages').catch(() => null),
                fetch('/api/goals').catch(() => null),
                fetch('/api/assessments').catch(() => null),
                fetch('/api/sessions?view=upcoming').catch(() => null),
                fetch('/api/journal?count_only=true').catch(() => null),
            ]);

            const messagesData = messagesRes ? await messagesRes.json().catch(() => ({})) : {};
            const goalsData = goalsRes ? await goalsRes.json().catch(() => ({})) : {};
            const assessData = assessRes ? await assessRes.json().catch(() => ({})) : {};
            const sessionsData = sessionsRes ? await sessionsRes.json().catch(() => ({})) : {};
            const journalData = journalRes ? await journalRes.json().catch(() => ({})) : {};

            // Assessment stats
            let assessmentStats = { total: 0, latestScore: undefined as number | undefined, latestType: undefined as string | undefined, latestDate: undefined as string | undefined };
            if (assessData.success && assessData.assessments?.length > 0) {
                const latest = assessData.assessments[0];
                const maxScore = latest.assessment_type === 'mirc28' ? 140 : 60;
                assessmentStats = {
                    total: assessData.total,
                    latestScore: Math.round((latest.total_score / maxScore) * 100),
                    latestType: latest.assessment_type,
                    latestDate: latest.created_at,
                };
            }

            setStats({
                unreadMessages: messagesData.conversations?.reduce(
                    (sum: number, c: any) => sum + (c.unread_count || 0), 0
                ) || 0,
                activeGoals: goalsData.goals?.filter((g: any) => g.status !== 'completed').length || 0,
                completedGoals: goalsData.goals?.filter((g: any) => g.status === 'completed').length || 0,
                pssName: (session as any)?.participant?.pssName,
                totalAssessments: assessmentStats.total,
                latestAssessmentScore: assessmentStats.latestScore,
                latestAssessmentType: assessmentStats.latestType,
                latestAssessmentDate: assessmentStats.latestDate,
                upcomingSessions: sessionsData.counts?.upcoming || 0,
                nextSession: sessionsData.nextSession || null,
                journalEntries: journalData.count || 0,
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    }

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-portal-background">
                <Loader2 className="w-8 h-8 animate-spin text-portal-primary" />
            </div>
        );
    }

    if (!session) return null;

    const participantName = (session as any)?.participant?.preferredName || 
                           (session as any)?.participant?.firstName ||
                           'there';

    const nextSession = stats?.nextSession;
    const nextSessionSoon = nextSession ? isSessionSoon(nextSession.planned_date) : false;

    return (
        <div className="min-h-screen bg-portal-background pb-20">
            {/* Header */}
            <header className="bg-portal-primary text-white px-6 pt-12 pb-8 safe-area-top">
                <div className="max-w-lg mx-auto">
                    <p className="text-white/70 text-sm mb-1">Welcome back,</p>
                    <h1 className="text-2xl font-bold">{participantName}</h1>
                    {stats?.pssName && (
                        <p className="text-sm text-white/80 mt-2">
                            Your PSS: {stats.pssName}
                        </p>
                    )}
                </div>
            </header>

            <main className="px-6 -mt-4">
                <div className="max-w-lg mx-auto space-y-4">

                    {/* ─── Next Session Banner ─────────────────────────────────── */}
                    {nextSession && (
                        <Link href="/sessions" className="block">
                            <div className={`rounded-xl p-4 flex items-center justify-between animate-slide-up ${
                                nextSessionSoon
                                    ? 'bg-portal-primary text-white'
                                    : 'bg-white border border-portal-primary/20 text-portal-text'
                            }`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                        nextSessionSoon ? 'bg-white/20' : 'bg-portal-primary/10'
                                    }`}>
                                        <Calendar className={`w-5 h-5 ${nextSessionSoon ? 'text-white' : 'text-portal-primary'}`} />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">
                                            {nextSessionSoon ? '📅 Session Coming Up' : 'Next Session'}
                                        </p>
                                        <p className={`text-sm ${nextSessionSoon ? 'text-white/80' : 'text-portal-muted'}`}>
                                            {formatSessionDate(nextSession.planned_date)}
                                            {formatTime(nextSession.planned_time)
                                                ? ` at ${formatTime(nextSession.planned_time)}`
                                                : ''
                                            }
                                            {' · '}
                                            {nextSession.planned_duration} min
                                            {nextSession.pss_first_name
                                                ? ` · with ${nextSession.pss_first_name}`
                                                : ''
                                            }
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight className={`w-5 h-5 flex-shrink-0 ${nextSessionSoon ? 'text-white/70' : 'text-portal-muted'}`} />
                            </div>
                        </Link>
                    )}

                    {/* ─── Unread Messages Alert ───────────────────────────────── */}
                    {stats?.unreadMessages && stats.unreadMessages > 0 && (
                        <Link href="/messages" className="block">
                            <div className="bg-portal-secondary text-white rounded-xl p-4 flex items-center justify-between animate-slide-up">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                        <Bell className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-medium">New Messages</p>
                                        <p className="text-sm text-white/80">
                                            You have {stats.unreadMessages} unread message{stats.unreadMessages !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight className="w-5 h-5" />
                            </div>
                        </Link>
                    )}

                    {/* ─── Quick Action Cards ──────────────────────────────────── */}
                    <div className="grid grid-cols-2 gap-4">
                        <QuickActionCard
                            href="/messages"
                            icon={<MessageCircle className="w-6 h-6" />}
                            title="Messages"
                            subtitle={stats?.unreadMessages ? `${stats.unreadMessages} unread` : 'Chat with your PSS'}
                            badge={stats?.unreadMessages}
                        />
                        <QuickActionCard
                            href="/goals"
                            icon={<Target className="w-6 h-6" />}
                            title="My Goals"
                            subtitle={`${stats?.activeGoals || 0} active`}
                        />
                        <QuickActionCard
                            href="/sessions"
                            icon={<Calendar className="w-6 h-6" />}
                            title="Sessions"
                            subtitle={stats?.upcomingSessions
                                ? `${stats.upcomingSessions} upcoming`
                                : 'View schedule'
                            }
                        />
                        <QuickActionCard
                            href="/assessments"
                            icon={<ClipboardCheck className="w-6 h-6" />}
                            title="Assessments"
                            subtitle={stats?.latestAssessmentScore 
                                ? `Latest: ${stats.latestAssessmentScore}%`
                                : 'Recovery Capital'
                            }
                        />
                        <Link href="/journal" className="col-span-2">
                            <div className="card-hover p-4 flex items-center gap-4">
                                <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 flex-shrink-0">
                                    <BookHeart className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-portal-text">My Journal</h3>
                                    <p className="text-sm text-portal-muted">
                                        {stats?.journalEntries 
                                            ? `${stats.journalEntries} ${stats.journalEntries === 1 ? 'entry' : 'entries'}`
                                            : 'Write about your day, track your mood'
                                        }
                                    </p>
                                </div>
                                <ArrowRight className="w-5 h-5 text-portal-muted flex-shrink-0" />
                            </div>
                        </Link>
                    </div>

                    {/* ─── Goal Progress ────────────────────────────────────────── */}
                    <div className="card p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-portal-text">Goal Progress</h2>
                            <Link href="/goals" className="text-sm text-portal-primary hover:underline">
                                View all
                            </Link>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-portal-secondary/10 rounded-full flex items-center justify-center">
                                    <Clock className="w-4 h-4 text-portal-secondary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-portal-text">{stats?.activeGoals || 0}</p>
                                    <p className="text-xs text-portal-muted">In Progress</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-portal-success/10 rounded-full flex items-center justify-center">
                                    <CheckCircle2 className="w-4 h-4 text-portal-success" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-portal-text">{stats?.completedGoals || 0}</p>
                                    <p className="text-xs text-portal-muted">Completed</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─── Recovery Capital Quick Glance ────────────────────────── */}
                    {stats?.latestAssessmentScore && (
                        <Link href="/assessments" className="block">
                            <div className="card card-hover p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h2 className="font-semibold text-portal-text flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-portal-primary" />
                                        Recovery Capital
                                    </h2>
                                    <span className="text-sm text-portal-primary">View details →</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{
                                                    width: `${stats.latestAssessmentScore}%`,
                                                    backgroundColor: stats.latestAssessmentScore >= 78 ? '#10B981' :
                                                        stats.latestAssessmentScore >= 58 ? '#F59E0B' :
                                                        stats.latestAssessmentScore >= 42 ? '#F97316' : '#EF4444'
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <span className="text-lg font-bold text-portal-text">{stats.latestAssessmentScore}%</span>
                                </div>
                                <p className="text-xs text-portal-muted mt-1.5">
                                    Last assessed: {stats.latestAssessmentDate 
                                        ? new Date(stats.latestAssessmentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                        : 'N/A'
                                    }
                                </p>
                            </div>
                        </Link>
                    )}

                    {/* ─── Motivational Quote ──────────────────────────────────── */}
                    <div className="bg-gradient-to-br from-portal-primary/5 to-portal-secondary/5 rounded-xl p-6 border border-portal-primary/10">
                        <p className="text-portal-text italic text-center">
                            "Recovery is not a race. You don't have to feel guilty if it takes you longer than you thought it would."
                        </p>
                        <p className="text-portal-muted text-sm text-center mt-2">— Unknown</p>
                    </div>

                    {/* ─── Crisis Help ──────────────────────────────────────────── */}
                    <div className="card p-4">
                        <h3 className="font-semibold text-portal-text mb-2">Need Help?</h3>
                        <p className="text-sm text-portal-muted mb-3">
                            If you're experiencing a crisis, please reach out:
                        </p>
                        <div className="space-y-2 text-sm">
                            <a href="tel:988" className="flex items-center gap-2 text-portal-primary hover:underline">
                                📞 988 - Suicide & Crisis Lifeline
                            </a>
                            <a href="tel:911" className="flex items-center gap-2 text-portal-error hover:underline">
                                🚨 911 - Emergency Services
                            </a>
                        </div>
                    </div>
                </div>
            </main>

            <BottomNav />
        </div>
    );
}

// ─── Quick Action Card ────────────────────────────────────────────────────────

function QuickActionCard({ 
    href, icon, title, subtitle, badge 
}: { 
    href: string; icon: React.ReactNode; title: string; subtitle: string; badge?: number;
}) {
    return (
        <Link href={href}>
            <div className="card-hover p-4 h-full relative">
                {badge && badge > 0 && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-portal-error text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {badge > 9 ? '9+' : badge}
                    </div>
                )}
                <div className="w-12 h-12 bg-portal-primary/10 rounded-xl flex items-center justify-center text-portal-primary mb-3">
                    {icon}
                </div>
                <h3 className="font-semibold text-portal-text">{title}</h3>
                <p className="text-sm text-portal-muted">{subtitle}</p>
            </div>
        </Link>
    );
}
