// app/assessments/page.tsx
// Participant Portal - Assessment Hub
// Shows past assessments, trends, and option to take new BARC-10

'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, TrendingUp, ClipboardCheck, ChevronRight,
    Loader2, Users, Home, Brain, Heart, Calendar,
    Plus, BarChart3, Sparkles
} from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';

// Domain display configuration
const DOMAIN_CONFIG: Record<string, { name: string; shortName: string; color: string; bgColor: string; description: string }> = {
    social: {
        name: "Social Capital",
        shortName: "Social",
        color: "#8B5CF6",
        bgColor: "bg-violet-50",
        description: "Support from friends, family & community"
    },
    physical: {
        name: "Physical Capital",
        shortName: "Physical",
        color: "#F59E0B",
        bgColor: "bg-amber-50",
        description: "Housing, environment & tangible resources"
    },
    human: {
        name: "Human Capital",
        shortName: "Human",
        color: "#3B82F6",
        bgColor: "bg-blue-50",
        description: "Skills, health, purpose & personal strengths"
    },
    cultural: {
        name: "Cultural Capital",
        shortName: "Cultural",
        color: "#EC4899",
        bgColor: "bg-pink-50",
        description: "Values, engagement & recovery community"
    },
    // Legacy domain mappings from older BARC-10 data
    personal: {
        name: "Personal Capital",
        shortName: "Personal",
        color: "#3B82F6",
        bgColor: "bg-blue-50",
        description: "Personal strengths & skills"
    },
    community: {
        name: "Community Capital",
        shortName: "Community",
        color: "#EC4899",
        bgColor: "bg-pink-50",
        description: "Community connections & engagement"
    },
};

interface Assessment {
    id: string;
    assessment_type: string;
    total_score: number;
    domain_scores: any;
    ai_analysis?: any;
    notes?: string;
    assessment_date: string;
    created_at: string;
}

export default function AssessmentsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [assessments, setAssessments] = useState<Assessment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, router]);

    useEffect(() => {
        if (session?.participantId) {
            fetchAssessments();
        }
    }, [session]);

    async function fetchAssessments() {
        try {
            const res = await fetch('/api/assessments');
            const data = await res.json();
            if (data.success) {
                setAssessments(data.assessments || []);
            }
        } catch (error) {
            console.error('Error fetching assessments:', error);
        } finally {
            setLoading(false);
        }
    }

    const getMaxScore = (type: string) => type === 'mirc28' ? 140 : 60;
    const getPercentage = (score: number, type: string) => Math.round((score / getMaxScore(type)) * 100);

    const getInterpretation = (pct: number) => {
        if (pct >= 78) return { level: 'Strong Foundation', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
        if (pct >= 58) return { level: 'Building Momentum', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
        if (pct >= 42) return { level: 'Growing Roots', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' };
        return { level: 'Early Foundation', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' };
    };

    const getTypeLabel = (type: string) => type === 'mirc28' ? 'MIRC-28 (Comprehensive)' : 'BARC-10 (Quick Check)';

    // Get the most recent assessment for the summary card
    const latestAssessment = assessments[0];
    const latestPercentage = latestAssessment ? getPercentage(latestAssessment.total_score, latestAssessment.assessment_type) : 0;
    const latestInterpretation = latestAssessment ? getInterpretation(latestPercentage) : null;

    // Calculate trend (compare latest to second-latest of same type)
    const getTrend = () => {
        if (assessments.length < 2) return null;
        const latest = assessments[0];
        const previous = assessments.find((a, i) => i > 0 && a.assessment_type === latest.assessment_type);
        if (!previous) return null;
        const latestPct = getPercentage(latest.total_score, latest.assessment_type);
        const prevPct = getPercentage(previous.total_score, previous.assessment_type);
        const diff = latestPct - prevPct;
        return { diff, direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same' };
    };
    const trend = getTrend();

    if (status === 'loading' || loading) {
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
            <header className="bg-white border-b border-portal-border px-6 pt-12 pb-4 safe-area-top">
                <div className="max-w-lg mx-auto">
                    <div className="flex items-center gap-3 mb-1">
                        <button onClick={() => router.push('/dashboard')} className="p-1.5 -ml-1.5 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-portal-text" />
                        </button>
                        <h1 className="text-xl font-bold text-portal-text">My Assessments</h1>
                    </div>
                    <p className="text-sm text-portal-muted ml-8">Track your recovery capital over time</p>
                </div>
            </header>

            <main className="px-6 py-6">
                <div className="max-w-lg mx-auto space-y-5">

                    {/* Latest Score Summary */}
                    {latestAssessment && latestInterpretation && (
                        <div className={`rounded-2xl p-5 border ${latestInterpretation.bg} ${latestInterpretation.border}`}>
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <p className="text-sm text-portal-muted mb-1">Latest Score</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-bold text-portal-text">
                                            {latestPercentage}%
                                        </span>
                                        {trend && trend.direction !== 'same' && (
                                            <span className={`text-sm font-medium ${
                                                trend.direction === 'up' ? 'text-emerald-600' : 'text-rose-600'
                                            }`}>
                                                {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.diff)}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${latestInterpretation.bg} ${latestInterpretation.color} border ${latestInterpretation.border}`}>
                                    {latestInterpretation.level}
                                </span>
                            </div>

                            {/* Domain bars for latest */}
                            <div className="space-y-2.5 mt-4">
                                {Object.entries(latestAssessment.domain_scores || {}).map(([key, value]: [string, any]) => {
                                    const config = DOMAIN_CONFIG[key];
                                    if (!config) return null;
                                    
                                    // Handle both formats: raw number or {raw, max, percentage} object
                                    const pct = typeof value === 'object' && value?.percentage
                                        ? value.percentage
                                        : typeof value === 'number'
                                            ? Math.round((value / (latestAssessment.assessment_type === 'mirc28' ? 28 : 
                                                key === 'human' ? 30 : key === 'social' ? 12 : key === 'physical' ? 6 : 12)) * 100)
                                            : 0;

                                    return (
                                        <div key={key}>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="font-medium text-portal-text">{config.shortName}</span>
                                                <span className="text-portal-muted">
                                                    {typeof value === 'object' && value?.percentage ? `${value.percentage}%` : value}
                                                </span>
                                            </div>
                                            <div className="h-2 bg-white/80 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-500"
                                                    style={{
                                                        width: `${Math.min(pct, 100)}%`,
                                                        backgroundColor: config.color,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <p className="text-xs text-portal-muted mt-3">
                                {getTypeLabel(latestAssessment.assessment_type)} · {new Date(latestAssessment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                        </div>
                    )}

                    {/* Take BARC-10 Card */}
                    <Link href="/assessments/take">
                        <div className="card p-5 border-2 border-dashed border-portal-primary/30 hover:border-portal-primary/60 hover:bg-portal-primary/5 transition-all cursor-pointer">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-portal-primary/10 flex items-center justify-center flex-shrink-0">
                                    <Plus className="w-6 h-6 text-portal-primary" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-portal-text">Take BARC-10 Check-In</h3>
                                    <p className="text-sm text-portal-muted">Quick 10-question recovery capital check · 2-3 min</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-portal-muted flex-shrink-0" />
                            </div>
                        </div>
                    </Link>

                    {/* Assessment History */}
                    <div>
                        <h2 className="font-semibold text-portal-text mb-3 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-portal-muted" />
                            Assessment History
                        </h2>

                        {assessments.length === 0 ? (
                            <div className="card p-8 text-center">
                                <ClipboardCheck className="w-12 h-12 text-portal-muted/40 mx-auto mb-3" />
                                <h3 className="font-semibold text-portal-text mb-1">No Assessments Yet</h3>
                                <p className="text-sm text-portal-muted mb-4">
                                    Take your first BARC-10 to start tracking your recovery capital.
                                </p>
                                <Link
                                    href="/assessments/take"
                                    className="inline-flex items-center gap-2 btn-primary px-5 py-2.5"
                                >
                                    <Plus className="w-4 h-4" />
                                    Take First Assessment
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {assessments.map((assessment) => {
                                    const pct = getPercentage(assessment.total_score, assessment.assessment_type);
                                    const interp = getInterpretation(pct);
                                    const isBarc = assessment.assessment_type === 'barc10';

                                    return (
                                        <Link key={assessment.id} href={`/assessments/${assessment.id}`}>
                                            <div className="card card-hover p-4">
                                                <div className="flex items-center gap-4">
                                                    {/* Score circle */}
                                                    <div className="relative w-14 h-14 flex-shrink-0">
                                                        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                                                            <circle
                                                                cx="28" cy="28" r="24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="4"
                                                                className="text-gray-100"
                                                            />
                                                            <circle
                                                                cx="28" cy="28" r="24"
                                                                fill="none"
                                                                stroke={pct >= 78 ? '#10B981' : pct >= 58 ? '#F59E0B' : pct >= 42 ? '#F97316' : '#EF4444'}
                                                                strokeWidth="4"
                                                                strokeLinecap="round"
                                                                strokeDasharray={`${(pct / 100) * 150.8} 150.8`}
                                                            />
                                                        </svg>
                                                        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-portal-text">
                                                            {pct}%
                                                        </span>
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="font-semibold text-portal-text text-sm">
                                                                {isBarc ? 'BARC-10' : 'MIRC-28'}
                                                            </span>
                                                            <span className={`text-xs px-2 py-0.5 rounded-full ${interp.bg} ${interp.color}`}>
                                                                {interp.level}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-portal-muted">
                                                            {new Date(assessment.created_at).toLocaleDateString('en-US', {
                                                                weekday: 'short',
                                                                month: 'short',
                                                                day: 'numeric',
                                                                year: 'numeric'
                                                            })}
                                                        </p>
                                                        <p className="text-xs text-portal-muted mt-0.5">
                                                            Score: {assessment.total_score}/{getMaxScore(assessment.assessment_type)}
                                                        </p>
                                                    </div>

                                                    <ChevronRight className="w-5 h-5 text-portal-muted flex-shrink-0" />
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* What is Recovery Capital? */}
                    <div className="card p-5">
                        <h3 className="font-semibold text-portal-text mb-3 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-portal-primary" />
                            What is Recovery Capital?
                        </h3>
                        <p className="text-sm text-portal-muted mb-4">
                            Recovery capital is the collection of resources — internal and external — that 
                            support your recovery journey. It's measured across four key areas:
                        </p>
                        <div className="space-y-3">
                            {[
                                { key: 'social', icon: Users, label: 'Social Capital', desc: 'Support from friends, family, and your community' },
                                { key: 'physical', icon: Home, label: 'Physical Capital', desc: 'Stable housing, finances, and daily necessities' },
                                { key: 'human', icon: Brain, label: 'Human Capital', desc: 'Your skills, health, sense of purpose, and resilience' },
                                { key: 'cultural', icon: Heart, label: 'Cultural Capital', desc: 'Values, beliefs, and connection to recovery community' },
                            ].map(({ key, icon: Icon, label, desc }) => (
                                <div key={key} className="flex items-start gap-3">
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                        style={{ backgroundColor: `${DOMAIN_CONFIG[key].color}15` }}
                                    >
                                        <Icon className="w-4 h-4" style={{ color: DOMAIN_CONFIG[key].color }} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-portal-text">{label}</p>
                                        <p className="text-xs text-portal-muted">{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            <BottomNav />
        </div>
    );
}
