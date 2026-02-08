'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { 
    Target, CheckCircle2, Clock, Loader2,
    ChevronDown, ChevronUp, Sparkles, Trophy
} from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';
import { Goal } from '@/types';

export default function GoalsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, router]);

    useEffect(() => {
        if (session?.participantId) {
            fetchGoals();
        }
    }, [session]);

    async function fetchGoals() {
        try {
            const res = await fetch('/api/goals');
            const data = await res.json();
            setGoals(data.goals || []);
        } catch (error) {
            console.error('Error fetching goals:', error);
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

    if (!session) {
        return null;
    }

    const filteredGoals = goals.filter(goal => {
        if (filter === 'active') return goal.status !== 'completed';
        if (filter === 'completed') return goal.status === 'completed';
        return true;
    });

    const activeCount = goals.filter(g => g.status !== 'completed').length;
    const completedCount = goals.filter(g => g.status === 'completed').length;

    return (
        <div className="min-h-screen bg-portal-background pb-20">
            {/* Header */}
            <header className="bg-white border-b border-portal-border px-6 py-4 sticky top-0 z-40 safe-area-top">
                <div className="max-w-lg mx-auto">
                    <h1 className="text-xl font-bold text-portal-text">My Goals</h1>
                    <p className="text-sm text-portal-muted">
                        Track your recovery journey
                    </p>
                </div>
            </header>

            <main className="px-6 py-4">
                <div className="max-w-lg mx-auto">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="card p-4 text-center">
                            <div className="w-10 h-10 bg-portal-secondary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                                <Clock className="w-5 h-5 text-portal-secondary" />
                            </div>
                            <p className="text-2xl font-bold text-portal-text">{activeCount}</p>
                            <p className="text-sm text-portal-muted">In Progress</p>
                        </div>
                        <div className="card p-4 text-center">
                            <div className="w-10 h-10 bg-portal-success/10 rounded-full flex items-center justify-center mx-auto mb-2">
                                <Trophy className="w-5 h-5 text-portal-success" />
                            </div>
                            <p className="text-2xl font-bold text-portal-text">{completedCount}</p>
                            <p className="text-sm text-portal-muted">Completed</p>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-2 mb-4">
                        {(['all', 'active', 'completed'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                                    filter === f
                                        ? 'bg-portal-primary text-white'
                                        : 'bg-white text-portal-muted hover:bg-gray-50 border border-portal-border'
                                }`}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Goals List */}
                    {filteredGoals.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-portal-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Target className="w-8 h-8 text-portal-primary" />
                            </div>
                            <h2 className="text-lg font-semibold text-portal-text mb-2">
                                {filter === 'completed' ? 'No Completed Goals Yet' : 'No Goals Set'}
                            </h2>
                            <p className="text-portal-muted">
                                {filter === 'completed' 
                                    ? 'Keep working on your active goals!'
                                    : 'Your peer support specialist will help you set meaningful goals.'
                                }
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredGoals.map((goal) => (
                                <GoalCard key={goal.id} goal={goal} />
                            ))}
                        </div>
                    )}
                </div>
            </main>

            <BottomNav />
        </div>
    );
}

function GoalCard({ goal }: { goal: Goal }) {
    const [expanded, setExpanded] = useState(false);
    const isCompleted = goal.status === 'completed';
    const progress = goal.progress || 0;

    return (
        <div className={`card overflow-hidden ${isCompleted ? 'bg-portal-success/5' : ''}`}>
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-4 text-left flex items-start gap-3"
            >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isCompleted 
                        ? 'bg-portal-success/10 text-portal-success' 
                        : 'bg-portal-secondary/10 text-portal-secondary'
                }`}>
                    {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                    ) : (
                        <Target className="w-5 h-5" />
                    )}
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`badge ${isCompleted ? 'badge-success' : 'badge-primary'}`}>
                            {goal.goal_area}
                        </span>
                    </div>
                    <h3 className="font-semibold text-portal-text line-clamp-2">
                        {goal.desired_outcome}
                    </h3>
                    
                    {/* Progress Bar */}
                    {!isCompleted && (
                        <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-portal-muted mb-1">
                                <span>Progress</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="progress-bar">
                                <div 
                                    className="progress-bar-fill" 
                                    style={{ width: `${progress}%` }} 
                                />
                            </div>
                        </div>
                    )}
                    
                    {isCompleted && goal.completed_at && (
                        <p className="text-sm text-portal-success mt-1">
                            ✓ Completed {new Date(goal.completed_at).toLocaleDateString()}
                        </p>
                    )}
                </div>
                
                <div className="text-portal-muted">
                    {expanded ? (
                        <ChevronUp className="w-5 h-5" />
                    ) : (
                        <ChevronDown className="w-5 h-5" />
                    )}
                </div>
            </button>

            {/* Expanded Details */}
            {expanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-portal-border pt-4 animate-fade-in">
                    {/* SMART Goal */}
                    {goal.smart_goal && (
                        <div>
                            <h4 className="text-sm font-semibold text-portal-text mb-1 flex items-center gap-1">
                                <Sparkles className="w-4 h-4 text-portal-secondary" />
                                SMART Goal
                            </h4>
                            <p className="text-sm text-portal-muted">{goal.smart_goal}</p>
                        </div>
                    )}

                    {/* Strengths */}
                    {goal.strengths && goal.strengths.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-portal-text mb-2">
                                Your Strengths
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {goal.strengths.map((strength, i) => (
                                    <span 
                                        key={i}
                                        className="px-3 py-1 bg-portal-success/10 text-portal-success text-sm rounded-full"
                                    >
                                        {strength}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Challenges */}
                    {goal.challenges && goal.challenges.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-portal-text mb-2">
                                Challenges to Overcome
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {goal.challenges.map((challenge, i) => (
                                    <span 
                                        key={i}
                                        className="px-3 py-1 bg-portal-warning/10 text-portal-warning text-sm rounded-full"
                                    >
                                        {challenge}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Timeframe */}
                    {goal.timeframe && (
                        <div>
                            <h4 className="text-sm font-semibold text-portal-text mb-1">
                                Target Timeframe
                            </h4>
                            <p className="text-sm text-portal-muted">{goal.timeframe}</p>
                        </div>
                    )}

                    {/* Motivation Level */}
                    {goal.motivation_level && (
                        <div>
                            <h4 className="text-sm font-semibold text-portal-text mb-1">
                                Motivation Level
                            </h4>
                            <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((level) => (
                                    <div
                                        key={level}
                                        className={`w-8 h-2 rounded-full ${
                                            level <= goal.motivation_level!
                                                ? 'bg-portal-secondary'
                                                : 'bg-gray-200'
                                        }`}
                                    />
                                ))}
                                <span className="text-sm text-portal-muted ml-2">
                                    {goal.motivation_level}/5
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Created Date */}
                    <div className="text-xs text-portal-muted pt-2 border-t border-portal-border">
                        Created {new Date(goal.created_at).toLocaleDateString()}
                    </div>
                </div>
            )}
        </div>
    );
}
