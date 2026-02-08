// app/assessments/take/page.tsx
// Participant Portal - BARC-10 Self-Assessment
// Mobile-friendly question flow that writes to the shared recovery_assessments table

'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
    ArrowLeft, ArrowRight, CheckCircle2, Loader2,
    Users, Home, Brain, Heart, Sparkles, RotateCcw,
    ChevronRight
} from 'lucide-react';

// ─── BARC-10 Questions (identical to Studio) ──────────────────────────────────
const BARC10_QUESTIONS = [
    { id: 1, text: "There are more important things to me in life than using substances.", domain: "human", shortLabel: "Purpose & Meaning" },
    { id: 2, text: "In general I am happy with my life.", domain: "human", shortLabel: "Life Satisfaction" },
    { id: 3, text: "I have enough energy to complete the tasks I set myself.", domain: "human", shortLabel: "Energy & Vitality" },
    { id: 4, text: "I am proud of the community I live in and feel part of it.", domain: "social", shortLabel: "Community Connection" },
    { id: 5, text: "I get lots of support from friends.", domain: "social", shortLabel: "Friend Support" },
    { id: 6, text: "I regard my life as challenging and fulfilling without the need for using drugs or alcohol.", domain: "human", shortLabel: "Fulfillment in Recovery" },
    { id: 7, text: "My living space has helped to drive my recovery journey.", domain: "physical", shortLabel: "Supportive Environment" },
    { id: 8, text: "I take full responsibility for my actions.", domain: "human", shortLabel: "Personal Responsibility" },
    { id: 9, text: "I am happy dealing with a range of professional people.", domain: "cultural", shortLabel: "Professional Engagement" },
    { id: 10, text: "I am making good progress on my recovery journey.", domain: "cultural", shortLabel: "Recovery Progress" }
];

const RESPONSE_OPTIONS = [
    { value: 1, label: "Strongly Disagree", emoji: "😔" },
    { value: 2, label: "Disagree", emoji: "🙁" },
    { value: 3, label: "Somewhat Disagree", emoji: "😐" },
    { value: 4, label: "Somewhat Agree", emoji: "🙂" },
    { value: 5, label: "Agree", emoji: "😊" },
    { value: 6, label: "Strongly Agree", emoji: "😄" },
];

const DOMAIN_INFO: Record<string, { name: string; icon: any; color: string; description: string }> = {
    social: { name: "Social Capital", icon: Users, color: "#8B5CF6", description: "Support from friends, family & community" },
    physical: { name: "Physical Capital", icon: Home, color: "#F59E0B", description: "Housing, environment & resources" },
    human: { name: "Human Capital", icon: Brain, color: "#3B82F6", description: "Skills, health, purpose & personal strengths" },
    cultural: { name: "Cultural Capital", icon: Heart, color: "#EC4899", description: "Values, engagement & recovery community" },
};

interface Answers { [key: string]: number; }
interface Scores {
    total: number;
    maxScore: number;
    percentage: number;
    domains: { social: number; physical: number; human: number; cultural: number };
}

type ViewState = 'intro' | 'questions' | 'submitting' | 'results';

export default function TakeAssessmentPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [view, setView] = useState<ViewState>('intro');
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<Answers>({});
    const [scores, setScores] = useState<Scores | null>(null);
    const [savedId, setSavedId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, router]);

    // ─── Score Calculation (matches Studio exactly) ───────────────────────────
    const calculateScores = (answers: Answers): Scores => {
        const domainScores = { social: 0, physical: 0, human: 0, cultural: 0 };
        let totalScore = 0;

        BARC10_QUESTIONS.forEach(q => {
            const val = answers[`q${q.id}`] || 0;
            totalScore += val;
            domainScores[q.domain as keyof typeof domainScores] += val;
        });

        return {
            total: totalScore,
            maxScore: 60,
            percentage: Math.round((totalScore / 60) * 100),
            domains: domainScores,
        };
    };

    // ─── Handlers ─────────────────────────────────────────────────────────────
    const handleAnswer = (questionId: number, value: number) => {
        setAnswers(prev => ({ ...prev, [`q${questionId}`]: value }));

        // Auto-advance after a brief delay
        setTimeout(() => {
            if (currentQuestion < BARC10_QUESTIONS.length - 1) {
                setCurrentQuestion(prev => prev + 1);
            }
        }, 300);
    };

    const handleSubmit = async () => {
        setView('submitting');
        setError(null);

        const calculatedScores = calculateScores(answers);
        setScores(calculatedScores);

        try {
            const res = await fetch('/api/assessments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    responses: answers,
                    total_score: calculatedScores.total,
                    domain_scores: calculatedScores.domains,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to save assessment');
            }

            setSavedId(data.assessmentId);
            setView('results');
        } catch (e) {
            console.error('Submit error:', e);
            setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
            setView('questions');
            setCurrentQuestion(BARC10_QUESTIONS.length - 1);
        }
    };

    const getScoreLevel = (percentage: number) => {
        if (percentage >= 78) return { level: 'Strong Foundation', description: 'You have excellent recovery resources supporting your journey.', color: '#10B981' };
        if (percentage >= 58) return { level: 'Building Momentum', description: 'Great progress! You\'re actively developing recovery resources.', color: '#F59E0B' };
        if (percentage >= 42) return { level: 'Growing Roots', description: 'You\'re building important recovery resources. Keep going!', color: '#F97316' };
        return { level: 'Early Foundation', description: 'Every journey starts somewhere. You\'re taking an important step.', color: '#EF4444' };
    };

    const progress = (Object.keys(answers).length / BARC10_QUESTIONS.length) * 100;
    const currentQ = BARC10_QUESTIONS[currentQuestion];
    const canGoBack = currentQuestion > 0;
    const canGoForward = answers[`q${currentQ?.id}`] !== undefined && currentQuestion < BARC10_QUESTIONS.length - 1;
    const allAnswered = Object.keys(answers).length === BARC10_QUESTIONS.length;

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-portal-background">
                <Loader2 className="w-8 h-8 animate-spin text-portal-primary" />
            </div>
        );
    }

    if (!session) return null;

    // ─── INTRO VIEW ───────────────────────────────────────────────────────────
    if (view === 'intro') {
        return (
            <div className="min-h-screen bg-portal-background">
                <header className="bg-white border-b border-portal-border px-6 pt-12 pb-4 safe-area-top">
                    <div className="max-w-lg mx-auto flex items-center gap-3">
                        <button onClick={() => router.push('/assessments')} className="p-1.5 -ml-1.5 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-portal-text" />
                        </button>
                        <h1 className="text-xl font-bold text-portal-text">BARC-10 Check-In</h1>
                    </div>
                </header>

                <main className="px-6 py-8">
                    <div className="max-w-lg mx-auto space-y-6">
                        <div className="card p-6 text-center">
                            <div className="w-16 h-16 bg-portal-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Sparkles className="w-8 h-8 text-portal-primary" />
                            </div>
                            <h2 className="text-xl font-bold text-portal-text mb-2">Recovery Capital Check-In</h2>
                            <p className="text-portal-muted mb-6">
                                This quick assessment measures the resources and strengths 
                                supporting your recovery. It takes about 2-3 minutes.
                            </p>

                            <div className="bg-portal-background rounded-xl p-4 mb-6 text-left space-y-3">
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-portal-primary flex-shrink-0" />
                                    <span className="text-sm text-portal-text">10 simple questions about your life right now</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-portal-primary flex-shrink-0" />
                                    <span className="text-sm text-portal-text">No right or wrong answers — be honest</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-portal-primary flex-shrink-0" />
                                    <span className="text-sm text-portal-text">Results shared with your peer support specialist</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-portal-primary flex-shrink-0" />
                                    <span className="text-sm text-portal-text">Helps track your progress over time</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setView('questions')}
                                className="w-full btn-primary py-4 text-lg"
                            >
                                Begin Check-In
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // ─── SUBMITTING VIEW ──────────────────────────────────────────────────────
    if (view === 'submitting') {
        return (
            <div className="min-h-screen bg-portal-background flex items-center justify-center">
                <div className="text-center px-6">
                    <Loader2 className="w-12 h-12 animate-spin text-portal-primary mx-auto mb-4" />
                    <p className="text-lg font-medium text-portal-text">Saving your responses...</p>
                    <p className="text-sm text-portal-muted mt-1">This will just take a moment</p>
                </div>
            </div>
        );
    }

    // ─── RESULTS VIEW ─────────────────────────────────────────────────────────
    if (view === 'results' && scores) {
        const scoreLevel = getScoreLevel(scores.percentage);

        return (
            <div className="min-h-screen bg-portal-background">
                <header className="bg-white border-b border-portal-border px-6 pt-12 pb-4 safe-area-top">
                    <div className="max-w-lg mx-auto">
                        <h1 className="text-xl font-bold text-portal-text">Your Results</h1>
                    </div>
                </header>

                <main className="px-6 py-6">
                    <div className="max-w-lg mx-auto space-y-5">
                        {/* Score Card */}
                        <div className="card p-6 text-center">
                            <div className="mb-4">
                                <div className="relative w-28 h-28 mx-auto mb-3">
                                    <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
                                        <circle cx="56" cy="56" r="48" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                                        <circle
                                            cx="56" cy="56" r="48"
                                            fill="none"
                                            stroke={scoreLevel.color}
                                            strokeWidth="8"
                                            strokeLinecap="round"
                                            strokeDasharray={`${(scores.percentage / 100) * 301.6} 301.6`}
                                            className="transition-all duration-1000"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-3xl font-bold text-portal-text">{scores.percentage}%</span>
                                    </div>
                                </div>
                                <h2 className="text-xl font-bold text-portal-text">{scoreLevel.level}</h2>
                                <p className="text-sm text-portal-muted mt-1">{scoreLevel.description}</p>
                                <p className="text-xs text-portal-muted mt-2">
                                    Score: {scores.total} / {scores.maxScore}
                                </p>
                            </div>
                        </div>

                        {/* Domain Breakdown */}
                        <div className="card p-5">
                            <h3 className="font-semibold text-portal-text mb-4">Your Recovery Capital</h3>
                            <div className="space-y-4">
                                {Object.entries(DOMAIN_INFO).map(([key, domain]) => {
                                    const domainScore = scores.domains[key as keyof typeof scores.domains];
                                    const maxForDomain = BARC10_QUESTIONS.filter(q => q.domain === key).length * 6;
                                    const domainPct = Math.round((domainScore / maxForDomain) * 100);
                                    const Icon = domain.icon;

                                    return (
                                        <div key={key}>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <div
                                                    className="w-7 h-7 rounded-md flex items-center justify-center"
                                                    style={{ backgroundColor: `${domain.color}15` }}
                                                >
                                                    <Icon className="w-3.5 h-3.5" style={{ color: domain.color }} />
                                                </div>
                                                <span className="text-sm font-medium text-portal-text flex-1">{domain.name}</span>
                                                <span className="text-sm font-semibold" style={{ color: domain.color }}>{domainPct}%</span>
                                            </div>
                                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden ml-9">
                                                <div
                                                    className="h-full rounded-full transition-all duration-700"
                                                    style={{
                                                        width: `${domainPct}%`,
                                                        backgroundColor: domain.color,
                                                    }}
                                                />
                                            </div>
                                            <p className="text-xs text-portal-muted mt-1 ml-9">{domain.description}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Encouragement */}
                        <div className="bg-gradient-to-br from-portal-primary/5 to-portal-secondary/5 rounded-xl p-5 border border-portal-primary/10">
                            <p className="text-sm text-portal-text text-center">
                                ✨ Your peer support specialist has been notified and can review 
                                these results with you at your next session.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="space-y-3">
                            {savedId && (
                                <button
                                    onClick={() => router.push(`/assessments/${savedId}`)}
                                    className="w-full card card-hover p-4 flex items-center justify-between"
                                >
                                    <span className="font-medium text-portal-text">View Full Details</span>
                                    <ChevronRight className="w-5 h-5 text-portal-muted" />
                                </button>
                            )}
                            <button
                                onClick={() => router.push('/assessments')}
                                className="w-full card card-hover p-4 flex items-center justify-between"
                            >
                                <span className="font-medium text-portal-text">All My Assessments</span>
                                <ChevronRight className="w-5 h-5 text-portal-muted" />
                            </button>
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="w-full text-center text-sm text-portal-muted py-2 hover:text-portal-text"
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // ─── QUESTION VIEW ────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-portal-background flex flex-col">
            {/* Header with progress */}
            <header className="bg-white border-b border-portal-border px-6 pt-12 pb-3 safe-area-top">
                <div className="max-w-lg mx-auto">
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={() => {
                                if (currentQuestion === 0) {
                                    if (confirm('Leave the assessment? Your answers will not be saved.')) {
                                        router.push('/assessments');
                                    }
                                } else {
                                    setCurrentQuestion(prev => prev - 1);
                                }
                            }}
                            className="p-1.5 -ml-1.5 hover:bg-gray-100 rounded-lg"
                        >
                            <ArrowLeft className="w-5 h-5 text-portal-text" />
                        </button>
                        <span className="text-sm font-medium text-portal-muted">
                            {currentQuestion + 1} of {BARC10_QUESTIONS.length}
                        </span>
                        <div className="w-8" /> {/* Spacer for centering */}
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-portal-primary rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </header>

            {/* Error message */}
            {error && (
                <div className="px-6 pt-4">
                    <div className="max-w-lg mx-auto bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                        {error}
                    </div>
                </div>
            )}

            {/* Question */}
            <main className="flex-1 flex flex-col px-6 py-6">
                <div className="max-w-lg mx-auto flex-1 flex flex-col w-full">
                    {/* Domain tag */}
                    <div className="mb-4">
                        <span
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                            style={{
                                backgroundColor: `${DOMAIN_INFO[currentQ.domain].color}15`,
                                color: DOMAIN_INFO[currentQ.domain].color,
                            }}
                        >
                            {currentQ.shortLabel}
                        </span>
                    </div>

                    {/* Question text */}
                    <h2 className="text-xl font-semibold text-portal-text mb-6 leading-relaxed">
                        {currentQ.text}
                    </h2>

                    {/* Response options */}
                    <div className="space-y-2.5 flex-1">
                        {RESPONSE_OPTIONS.map((option) => {
                            const isSelected = answers[`q${currentQ.id}`] === option.value;
                            return (
                                <button
                                    key={option.value}
                                    onClick={() => handleAnswer(currentQ.id, option.value)}
                                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                                        isSelected
                                            ? 'border-portal-primary bg-portal-primary/5 shadow-sm'
                                            : 'border-gray-200 hover:border-gray-300 active:border-portal-primary/50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                            isSelected
                                                ? 'border-portal-primary bg-portal-primary'
                                                : 'border-gray-300'
                                        }`}>
                                            {isSelected && (
                                                <div className="w-2 h-2 bg-white rounded-full" />
                                            )}
                                        </div>
                                        <span className={`font-medium ${isSelected ? 'text-portal-text' : 'text-gray-600'}`}>
                                            {option.label}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Navigation */}
                    <div className="pt-6 pb-4 safe-area-bottom">
                        {allAnswered && currentQuestion === BARC10_QUESTIONS.length - 1 ? (
                            <button
                                onClick={handleSubmit}
                                className="w-full btn-primary py-4 text-lg"
                            >
                                Submit Check-In
                                <CheckCircle2 className="w-5 h-5" />
                            </button>
                        ) : canGoForward ? (
                            <button
                                onClick={() => setCurrentQuestion(prev => prev + 1)}
                                className="w-full btn-primary py-4"
                            >
                                Next Question
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        ) : null}
                    </div>
                </div>
            </main>
        </div>
    );
}
