// app/assessments/[id]/page.tsx
// Participant Portal - Assessment Detail View
// Participant-friendly view of a completed assessment with domain breakdown and AI insights

'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
    ArrowLeft, Loader2, Users, Home, Brain, Heart,
    Sparkles, Target, TrendingUp, ChevronDown, ChevronUp,
    Calendar, Award
} from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';

// ─── Configuration ────────────────────────────────────────────────────────────

const DOMAIN_INFO: Record<string, { name: string; icon: any; color: string; description: string }> = {
    social: { name: "Social Capital", icon: Users, color: "#8B5CF6", description: "Support from friends, family & community" },
    physical: { name: "Physical Capital", icon: Home, color: "#F59E0B", description: "Housing, environment & tangible resources" },
    human: { name: "Human Capital", icon: Brain, color: "#3B82F6", description: "Skills, health, purpose & personal strengths" },
    cultural: { name: "Cultural Capital", icon: Heart, color: "#EC4899", description: "Values, engagement & recovery community" },
    // Legacy keys from older BARC-10 data
    personal: { name: "Personal Capital", icon: Brain, color: "#3B82F6", description: "Personal strengths & skills" },
    community: { name: "Community Capital", icon: Heart, color: "#EC4899", description: "Community connections & engagement" },
};

const BARC10_QUESTIONS: Record<number, { text: string; domain: string; shortLabel: string }> = {
    1: { text: "There are more important things to me in life than using substances.", domain: "human", shortLabel: "Purpose & Meaning" },
    2: { text: "In general I am happy with my life.", domain: "human", shortLabel: "Life Satisfaction" },
    3: { text: "I have enough energy to complete the tasks I set myself.", domain: "human", shortLabel: "Energy & Vitality" },
    4: { text: "I am proud of the community I live in and feel part of it.", domain: "social", shortLabel: "Community Connection" },
    5: { text: "I get lots of support from friends.", domain: "social", shortLabel: "Friend Support" },
    6: { text: "I regard my life as challenging and fulfilling without the need for using drugs or alcohol.", domain: "human", shortLabel: "Fulfillment in Recovery" },
    7: { text: "My living space has helped to drive my recovery journey.", domain: "physical", shortLabel: "Supportive Environment" },
    8: { text: "I take full responsibility for my actions.", domain: "human", shortLabel: "Personal Responsibility" },
    9: { text: "I am happy dealing with a range of professional people.", domain: "cultural", shortLabel: "Professional Engagement" },
    10: { text: "I am making good progress on my recovery journey.", domain: "cultural", shortLabel: "Recovery Progress" },
};

const RESPONSE_LABELS: Record<number, string> = {
    1: "Strongly Disagree",
    2: "Disagree",
    3: "Somewhat Disagree",
    4: "Somewhat Agree",
    5: "Agree",
    6: "Strongly Agree",
};

interface Assessment {
    id: string;
    assessment_type: string;
    total_score: number;
    domain_scores: any;
    responses: any;
    ai_analysis?: any;
    notes?: string;
    assessment_date: string;
    created_at: string;
}

export default function AssessmentDetailPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const assessmentId = params.id as string;

    const [assessment, setAssessment] = useState<Assessment | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'responses' | 'insights'>('overview');
    const [expandedDomains, setExpandedDomains] = useState<string[]>([]);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, router]);

    useEffect(() => {
        if (session?.participantId && assessmentId) {
            fetchAssessment();
        }
    }, [session, assessmentId]);

    async function fetchAssessment() {
        try {
            const res = await fetch(`/api/assessments/${assessmentId}`);
            const data = await res.json();
            if (data.success) {
                setAssessment(data.assessment);
            } else {
                console.error('Assessment not found');
            }
        } catch (error) {
            console.error('Error fetching assessment:', error);
        } finally {
            setLoading(false);
        }
    }

    const toggleDomain = (domain: string) => {
        setExpandedDomains(prev =>
            prev.includes(domain) ? prev.filter(d => d !== domain) : [...prev, domain]
        );
    };

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-portal-background">
                <Loader2 className="w-8 h-8 animate-spin text-portal-primary" />
            </div>
        );
    }

    if (!session || !assessment) {
        return (
            <div className="min-h-screen bg-portal-background flex items-center justify-center px-6">
                <div className="text-center">
                    <p className="text-portal-muted mb-4">Assessment not found</p>
                    <button onClick={() => router.push('/assessments')} className="btn-primary px-5 py-2.5">
                        Back to Assessments
                    </button>
                </div>
            </div>
        );
    }

    const maxScore = assessment.assessment_type === 'mirc28' ? 140 : 60;
    const percentage = Math.round((assessment.total_score / maxScore) * 100);
    const isBarc = assessment.assessment_type === 'barc10';
    const analysis = assessment.ai_analysis;

    const getInterpretation = (pct: number) => {
        if (pct >= 78) return { level: 'Strong Foundation', description: 'Excellent recovery capital supporting sustained recovery.', color: '#10B981', bg: 'bg-emerald-50', textColor: 'text-emerald-700' };
        if (pct >= 58) return { level: 'Building Momentum', description: 'Good progress with opportunities for continued growth.', color: '#F59E0B', bg: 'bg-amber-50', textColor: 'text-amber-700' };
        if (pct >= 42) return { level: 'Growing Roots', description: 'Developing recovery resources in key areas.', color: '#F97316', bg: 'bg-orange-50', textColor: 'text-orange-700' };
        return { level: 'Early Foundation', description: 'Beginning to build essential recovery supports.', color: '#EF4444', bg: 'bg-rose-50', textColor: 'text-rose-700' };
    };

    const interp = getInterpretation(percentage);

    // Determine which tabs to show
    const tabs: { key: 'overview' | 'responses' | 'insights'; label: string }[] = [
        { key: 'overview', label: 'Overview' },
        { key: 'responses', label: 'My Answers' },
    ];
    if (analysis) {
        tabs.push({ key: 'insights', label: 'Insights' });
    }

    return (
        <div className="min-h-screen bg-portal-background pb-24">
            {/* Header */}
            <header className="bg-white border-b border-portal-border px-6 pt-12 pb-0 safe-area-top">
                <div className="max-w-lg mx-auto">
                    <div className="flex items-center gap-3 mb-3">
                        <button onClick={() => router.push('/assessments')} className="p-1.5 -ml-1.5 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-portal-text" />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-portal-text">
                                {isBarc ? 'BARC-10' : 'MIRC-28'} Results
                            </h1>
                            <p className="text-xs text-portal-muted">
                                {new Date(assessment.created_at).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg ${
                                    activeTab === tab.key
                                        ? 'text-portal-primary border-b-2 border-portal-primary bg-portal-primary/5'
                                        : 'text-portal-muted hover:text-portal-text'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="px-6 py-6">
                <div className="max-w-lg mx-auto space-y-5">

                    {/* ─── OVERVIEW TAB ─────────────────────────────────────────── */}
                    {activeTab === 'overview' && (
                        <>
                            {/* Score Card */}
                            <div className="card p-6 text-center">
                                <div className="relative w-28 h-28 mx-auto mb-4">
                                    <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
                                        <circle cx="56" cy="56" r="48" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                                        <circle
                                            cx="56" cy="56" r="48"
                                            fill="none"
                                            stroke={interp.color}
                                            strokeWidth="8"
                                            strokeLinecap="round"
                                            strokeDasharray={`${(percentage / 100) * 301.6} 301.6`}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-3xl font-bold text-portal-text">{percentage}%</span>
                                    </div>
                                </div>

                                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${interp.bg} ${interp.textColor}`}>
                                    {interp.level}
                                </span>
                                <p className="text-sm text-portal-muted mt-2">{interp.description}</p>
                                <p className="text-xs text-portal-muted mt-1">
                                    Score: {assessment.total_score} / {maxScore}
                                </p>
                            </div>

                            {/* Domain Breakdown */}
                            <div className="card p-5">
                                <h3 className="font-semibold text-portal-text mb-4 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-portal-primary" />
                                    Domain Breakdown
                                </h3>
                                <div className="space-y-4">
                                    {Object.entries(assessment.domain_scores || {}).map(([key, value]: [string, any]) => {
                                        const config = DOMAIN_INFO[key];
                                        if (!config) return null;
                                        const Icon = config.icon;

                                        // Handle both formats
                                        let displayPct: number;
                                        let displayLabel: string;

                                        if (typeof value === 'object' && value?.percentage !== undefined) {
                                            // MIRC-28 format: {raw, max, percentage}
                                            displayPct = value.percentage;
                                            displayLabel = `${value.raw}/${value.max} (${value.percentage}%)`;
                                        } else if (typeof value === 'number') {
                                            // BARC-10 format: raw score
                                            const questionsInDomain = isBarc
                                                ? Object.values(BARC10_QUESTIONS).filter(q => q.domain === key).length
                                                : 7; // MIRC has 7 per domain
                                            const maxForDomain = questionsInDomain * (isBarc ? 6 : 4);
                                            displayPct = Math.round((value / maxForDomain) * 100);
                                            displayLabel = `${value}/${maxForDomain} (${displayPct}%)`;
                                        } else {
                                            displayPct = 0;
                                            displayLabel = 'N/A';
                                        }

                                        return (
                                            <div key={key}>
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <div
                                                        className="w-7 h-7 rounded-md flex items-center justify-center"
                                                        style={{ backgroundColor: `${config.color}15` }}
                                                    >
                                                        <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                                                    </div>
                                                    <span className="text-sm font-medium text-portal-text flex-1">{config.name}</span>
                                                    <span className="text-sm font-semibold" style={{ color: config.color }}>
                                                        {displayPct}%
                                                    </span>
                                                </div>
                                                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden ml-9">
                                                    <div
                                                        className="h-full rounded-full"
                                                        style={{
                                                            width: `${Math.min(displayPct, 100)}%`,
                                                            backgroundColor: config.color,
                                                        }}
                                                    />
                                                </div>
                                                <p className="text-xs text-portal-muted mt-1 ml-9">{config.description}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* AI Summary (if available) */}
                            {analysis?.overallSummary && (
                                <div className="card p-5">
                                    <h3 className="font-semibold text-portal-text mb-3 flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-portal-primary" />
                                        Summary
                                    </h3>
                                    <p className="text-sm text-portal-muted leading-relaxed">
                                        {analysis.overallSummary}
                                    </p>
                                </div>
                            )}

                            {/* Encouragement */}
                            {analysis?.encouragement && (
                                <div className="bg-gradient-to-br from-portal-primary/5 to-portal-secondary/5 rounded-xl p-5 border border-portal-primary/10">
                                    <p className="text-sm text-portal-text text-center italic">
                                        "{analysis.encouragement}"
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    {/* ─── RESPONSES TAB ────────────────────────────────────────── */}
                    {activeTab === 'responses' && (
                        <>
                            {isBarc ? (
                                // BARC-10: Show each question with response
                                <div className="space-y-3">
                                    {Object.entries(assessment.responses || {}).map(([key, value]) => {
                                        const qNum = parseInt(key.replace('q', ''));
                                        const question = BARC10_QUESTIONS[qNum];
                                        if (!question) return null;
                                        const numValue = Number(value);
                                        const config = DOMAIN_INFO[question.domain];

                                        return (
                                            <div key={key} className="card p-4">
                                                <div className="flex items-start gap-3">
                                                    <span className="text-xs font-bold text-portal-muted bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                        {qNum}
                                                    </span>
                                                    <div className="flex-1">
                                                        <p className="text-sm text-portal-text mb-2">{question.text}</p>
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full"
                                                                    style={{
                                                                        width: `${(numValue / 6) * 100}%`,
                                                                        backgroundColor: numValue >= 4 ? '#10B981' : numValue >= 3 ? '#F59E0B' : '#EF4444',
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className={`text-xs font-medium min-w-[80px] text-right ${
                                                                numValue >= 4 ? 'text-emerald-600' : numValue >= 3 ? 'text-amber-600' : 'text-rose-600'
                                                            }`}>
                                                                {RESPONSE_LABELS[numValue] || numValue}
                                                            </span>
                                                        </div>
                                                        <span
                                                            className="inline-block text-xs mt-1.5 px-2 py-0.5 rounded-full"
                                                            style={{ backgroundColor: `${config?.color}10`, color: config?.color }}
                                                        >
                                                            {question.shortLabel}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                // MIRC-28: Group by domain (expandable)
                                <div className="space-y-3">
                                    {['social', 'physical', 'human', 'cultural'].map(domainKey => {
                                        const config = DOMAIN_INFO[domainKey];
                                        const Icon = config.icon;
                                        const isExpanded = expandedDomains.includes(domainKey);

                                        // Get questions for this domain (MIRC q-numbers)
                                        const domainQs = Object.entries(assessment.responses || {})
                                            .filter(([key]) => {
                                                const num = parseInt(key.replace('q', ''));
                                                if (domainKey === 'social') return num >= 1 && num <= 7;
                                                if (domainKey === 'physical') return num >= 8 && num <= 14;
                                                if (domainKey === 'human') return num >= 15 && num <= 21;
                                                if (domainKey === 'cultural') return num >= 22 && num <= 28;
                                                return false;
                                            })
                                            .sort(([a], [b]) => parseInt(a.replace('q', '')) - parseInt(b.replace('q', '')));

                                        return (
                                            <div key={domainKey} className="card overflow-hidden">
                                                <button
                                                    onClick={() => toggleDomain(domainKey)}
                                                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                                                            style={{ backgroundColor: `${config.color}15` }}
                                                        >
                                                            <Icon className="w-4 h-4" style={{ color: config.color }} />
                                                        </div>
                                                        <div className="text-left">
                                                            <span className="font-medium text-sm text-portal-text">{config.name}</span>
                                                            <span className="text-xs text-portal-muted ml-2">({domainQs.length} questions)</span>
                                                        </div>
                                                    </div>
                                                    {isExpanded ? <ChevronUp className="w-5 h-5 text-portal-muted" /> : <ChevronDown className="w-5 h-5 text-portal-muted" />}
                                                </button>
                                                {isExpanded && (
                                                    <div className="border-t border-portal-border divide-y divide-portal-border">
                                                        {domainQs.map(([key, val]) => {
                                                            const numVal = Number(val);
                                                            return (
                                                                <div key={key} className="p-4 flex items-center justify-between">
                                                                    <span className="text-sm text-portal-muted">{key.toUpperCase()}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                                            <div
                                                                                className="h-full rounded-full"
                                                                                style={{
                                                                                    width: `${(numVal / 4) * 100}%`,
                                                                                    backgroundColor: numVal >= 3 ? '#10B981' : numVal >= 2 ? '#F59E0B' : '#EF4444'
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-sm font-medium text-portal-text w-4 text-right">{numVal}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {/* ─── INSIGHTS TAB ──────────────────────────────────────────── */}
                    {activeTab === 'insights' && analysis && (
                        <>
                            {/* Strengths */}
                            {analysis.strengthsHighlight && (
                                <div className="card p-5">
                                    <h3 className="font-semibold text-portal-text mb-3 flex items-center gap-2">
                                        <Award className="w-4 h-4 text-emerald-500" />
                                        {analysis.strengthsHighlight.title || 'Your Strengths'}
                                    </h3>
                                    <div className="space-y-2.5">
                                        {analysis.strengthsHighlight.items?.map((item: string, i: number) => (
                                            <div key={i} className="flex items-start gap-2.5">
                                                <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                                                <p className="text-sm text-portal-muted">{item}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Growth Opportunities */}
                            {analysis.growthOpportunities && (
                                <div className="card p-5">
                                    <h3 className="font-semibold text-portal-text mb-3 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-amber-500" />
                                        {analysis.growthOpportunities.title || 'Growth Opportunities'}
                                    </h3>
                                    <div className="space-y-2.5">
                                        {analysis.growthOpportunities.items?.map((item: string, i: number) => (
                                            <div key={i} className="flex items-start gap-2.5">
                                                <span className="text-amber-500 mt-0.5 flex-shrink-0">→</span>
                                                <p className="text-sm text-portal-muted">{item}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Weekly Challenge */}
                            {analysis.weeklyChallenge && (
                                <div className="bg-gradient-to-r from-portal-primary to-portal-secondary rounded-xl p-5 text-white">
                                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                                        <Target className="w-4 h-4" />
                                        {analysis.weeklyChallenge.title || 'This Week\'s Challenge'}
                                    </h3>
                                    <p className="text-sm text-white/90">{analysis.weeklyChallenge.description}</p>
                                </div>
                            )}

                            {/* Suggested Goals */}
                            {analysis.recommendedGoals && analysis.recommendedGoals.length > 0 && (
                                <div className="card p-5">
                                    <h3 className="font-semibold text-portal-text mb-3 flex items-center gap-2">
                                        <Target className="w-4 h-4 text-portal-primary" />
                                        Suggested Goals
                                    </h3>
                                    <div className="space-y-4">
                                        {analysis.recommendedGoals.map((goal: any, index: number) => (
                                            <div key={index} className="border border-portal-border rounded-xl p-4">
                                                <div className="flex items-start gap-3 mb-2">
                                                    <div className="w-7 h-7 rounded-full bg-portal-primary/10 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-sm font-bold text-portal-primary">{index + 1}</span>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-medium text-sm text-portal-text">{goal.title || goal.goal}</h4>
                                                        <span className="text-xs text-portal-primary uppercase">{goal.domain}</span>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-portal-muted ml-10">{goal.description || goal.rationale}</p>
                                                {goal.actionSteps && (
                                                    <div className="ml-10 mt-2 bg-portal-background rounded-lg p-3">
                                                        <p className="text-xs font-medium text-portal-muted mb-1.5">Steps to try:</p>
                                                        {goal.actionSteps.map((step: string, i: number) => (
                                                            <p key={i} className="text-xs text-portal-muted flex items-start gap-1.5 mb-1">
                                                                <span className="text-portal-primary mt-0.5">·</span>
                                                                {step}
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Encouragement */}
                            {analysis.encouragement && (
                                <div className="bg-gradient-to-br from-portal-primary/5 to-portal-secondary/5 rounded-xl p-5 border border-portal-primary/10">
                                    <p className="text-sm text-portal-text text-center italic">
                                        "{analysis.encouragement}"
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            <BottomNav />
        </div>
    );
}
