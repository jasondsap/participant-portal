// app/interview-practice/page.tsx
// Participant Portal - Interview practice
// Start a spoken practice interview and look back at earlier ones. The practice
// itself opens in the staff app's practice page (no second sign-in: the link
// is the key), which also shows the written feedback when it ends.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ChevronRight, Headphones, Loader2, Mic, MessagesSquare } from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';

interface Practice { id: string; status: string; job_title: string | null; company: string | null; overall: number | null; created_at: string; completed_at: string | null; url: string | null }

const fmtDay = (v: string | null) => (v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const STATUS: Record<string, string> = { invited: 'Ready to start', started: 'Not finished', abandoned: 'Ended early', completed: 'Finished' };

export default function InterviewPracticePage() {
    const { status } = useSession();
    const router = useRouter();
    const [enabled, setEnabled] = useState<boolean | null>(null);
    const [practices, setPractices] = useState<Practice[]>([]);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/interview-practice');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not load interview practice');
            setEnabled(!!data.enabled); setPractices(data.practices || []);
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not load interview practice'); setEnabled(false); }
    }, []);

    useEffect(() => { if (status === 'unauthenticated') router.push('/auth/signin'); }, [status, router]);
    useEffect(() => { if (status === 'authenticated') load(); }, [status, load]);
    // Coming back from the practice tab: show the new result.
    useEffect(() => {
        const onFocus = () => { if (status === 'authenticated') load(); };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [status, load]);

    const start = async () => {
        setStarting(true); setError(null);
        // Open the tab inside the tap itself so the browser does not block it, then point it at the practice.
        const tab = window.open('about:blank', '_blank');
        try {
            const res = await fetch('/api/interview-practice', { method: 'POST' });
            const data = await res.json();
            if (!res.ok || !data.url) throw new Error(data.error || 'Could not start the practice');
            if (tab) tab.location.href = data.url; else window.location.href = data.url;
        } catch (e) { tab?.close(); setError(e instanceof Error ? e.message : 'Could not start the practice'); }
        finally { setStarting(false); }
    };

    if (status === 'loading' || enabled === null) {
        return <div className="min-h-screen flex items-center justify-center bg-portal-background"><Loader2 className="w-8 h-8 animate-spin text-portal-primary" aria-label="Loading" /></div>;
    }

    const open = practices.find(p => p.status !== 'completed' && p.url);
    const finished = practices.filter(p => p.status === 'completed');

    return (
        <div className="min-h-screen bg-portal-background pb-20 lg:pb-10">
            <header className="bg-white border-b border-portal-border px-6 py-4 sticky top-0 z-40 safe-area-top">
                <div className="portal-col flex items-center gap-3">
                    <Link href="/dashboard" aria-label="Back to home" className="p-2 -ml-2 rounded-lg text-portal-muted hover:text-portal-text"><ArrowLeft className="w-5 h-5" aria-hidden="true" /></Link>
                    <div>
                        <h1 className="text-xl font-bold text-portal-text">Interview practice</h1>
                        <p className="text-sm text-portal-muted">Practice out loud, then read your feedback</p>
                    </div>
                </div>
            </header>

            <main className="px-6 py-4">
                <div className="portal-col space-y-4">
                    {error && <p role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</p>}

                    {!enabled ? (
                        <div className="card p-6 text-center">
                            <MessagesSquare className="w-10 h-10 text-portal-muted mx-auto mb-3" aria-hidden="true" />
                            <h2 className="font-semibold text-portal-text">Interview practice is not available</h2>
                            <p className="text-sm text-portal-muted mt-1">Ask your coordinator if this is something they offer.</p>
                        </div>
                    ) : (
                        <>
                            <div className="card p-5 space-y-4">
                                <p className="text-portal-text">You talk out loud with a practice interviewer for about 15 minutes. When you finish, you get written feedback on your answers right away. Your coordinator can see it too.</p>
                                <ul className="space-y-2 text-sm text-portal-text">
                                    <li className="flex items-start gap-2"><Mic className="w-4 h-4 mt-0.5 flex-shrink-0 text-portal-primary" aria-hidden="true" /> You need a phone, tablet or computer with a microphone.</li>
                                    <li className="flex items-start gap-2"><Headphones className="w-4 h-4 mt-0.5 flex-shrink-0 text-portal-primary" aria-hidden="true" /> Pick a spot where you can speak freely. Headphones help.</li>
                                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-portal-primary" aria-hidden="true" /> The interviewer is an AI voice. The sound is not recorded; only the words are kept.</li>
                                </ul>
                                <button type="button" onClick={start} disabled={starting} className="w-full sm:w-auto px-6 py-3 rounded-lg bg-portal-primary text-white font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                                    {starting ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Mic className="w-5 h-5" aria-hidden="true" />}
                                    {open ? 'Continue your practice' : 'Start a practice'}
                                </button>
                                <p className="text-xs text-portal-muted">It opens in a new tab. Come back here afterwards to see it in your list.</p>
                            </div>

                            <div>
                                <h2 className="text-sm font-semibold text-portal-text mb-2">Your practices</h2>
                                {finished.length === 0 ? <p className="text-sm text-portal-muted">None finished yet.</p> : (
                                    <ul className="space-y-2">{finished.map(p => (
                                        <li key={p.id}>
                                            <a href={p.url || undefined} target="_blank" rel="noopener noreferrer" className="card-hover p-4 flex items-center gap-3">
                                                <div className="w-12 h-12 bg-portal-primary/10 rounded-xl flex items-center justify-center text-portal-primary font-bold flex-shrink-0">{p.overall ?? '–'}</div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-portal-text truncate">{p.job_title ? `${p.job_title}${p.company ? ` at ${p.company}` : ''}` : 'General interview'}</p>
                                                    <p className="text-sm text-portal-muted">{fmtDay(p.completed_at || p.created_at)} · {p.overall !== null ? `${p.overall} out of 100` : STATUS[p.status] || p.status}</p>
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-portal-muted flex-shrink-0" aria-hidden="true" />
                                                <span className="sr-only">Read the feedback (opens in a new tab)</span>
                                            </a>
                                        </li>
                                    ))}</ul>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </main>

            <BottomNav />
        </div>
    );
}
