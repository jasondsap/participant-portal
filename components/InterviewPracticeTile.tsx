'use client';

// Dashboard tile for interview practice. It asks the server whether the
// participant's organization offers it and renders nothing when it does not,
// so organizations without the feature see no change on the home screen.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessagesSquare } from 'lucide-react';

export function InterviewPracticeTile() {
    const [state, setState] = useState<{ enabled: boolean; finished: number; best: number | null } | null>(null);

    useEffect(() => {
        let off = false;
        fetch('/api/interview-practice').then(r => (r.ok ? r.json() : null)).then(d => {
            if (off || !d?.enabled) return;
            const done = (d.practices || []).filter((p: any) => p.status === 'completed');
            const scores = done.map((p: any) => p.overall).filter((n: any) => typeof n === 'number');
            setState({ enabled: true, finished: done.length, best: scores.length ? Math.max(...scores) : null });
        }).catch(() => { /* the tile simply does not show */ });
        return () => { off = true; };
    }, []);

    if (!state?.enabled) return null;
    return (
        <Link href="/interview-practice" className="col-span-2">
            <div className="card-hover p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-portal-secondary/10 rounded-xl flex items-center justify-center text-portal-secondary flex-shrink-0">
                    <MessagesSquare className="w-6 h-6" aria-hidden="true" />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-portal-text">Interview practice</h3>
                    <p className="text-sm text-portal-muted">
                        {state.finished ? `${state.finished} finished${state.best !== null ? `, best score ${state.best}` : ''}` : 'Practice a job interview out loud and get feedback'}
                    </p>
                </div>
            </div>
        </Link>
    );
}
