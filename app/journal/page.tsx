// app/journal/page.tsx
// Participant Portal - My Journal
// Private journaling with mood tracking and optional PSS sharing

'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    BookHeart,
    Plus,
    Loader2,
    Send,
    X,
    Eye,
    EyeOff,
    Pencil,
    Trash2,
    ChevronDown,
    ChevronUp,
    Calendar,
    Lock,
    Share2,
    MoreVertical,
    Check,
    AlertCircle,
} from 'lucide-react';

// ─── Mood Options ─────────────────────────────────────────────────────────────

const moods = [
    { value: 'great', emoji: '😊', label: 'Great', color: '#22C55E' },
    { value: 'good', emoji: '🙂', label: 'Good', color: '#3B82F6' },
    { value: 'okay', emoji: '😐', label: 'Okay', color: '#A855F7' },
    { value: 'down', emoji: '😔', label: 'Down', color: '#6B7280' },
    { value: 'frustrated', emoji: '😤', label: 'Frustrated', color: '#EF4444' },
    { value: 'anxious', emoji: '😰', label: 'Anxious', color: '#F59E0B' },
    { value: 'grateful', emoji: '🙏', label: 'Grateful', color: '#EC4899' },
    { value: 'strong', emoji: '💪', label: 'Strong', color: '#10B981' },
];

function getMood(value: string | null) {
    return moods.find(m => m.value === value) || null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface JournalEntry {
    id: string;
    entry_text: string;
    mood: string | null;
    shared_with_pss: boolean;
    created_at: string;
    updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Today at ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Yesterday at ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'long' }) + ' at ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    }
}

function formatFullDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
}

// ─── Entry Card ───────────────────────────────────────────────────────────────

function EntryCard({
    entry,
    onUpdate,
    onDelete,
}: {
    entry: JournalEntry;
    onUpdate: () => void;
    onDelete: (id: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(entry.entry_text);
    const [editMood, setEditMood] = useState(entry.mood);
    const [isSaving, setIsSaving] = useState(false);
    const [isTogglingShare, setIsTogglingShare] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const mood = getMood(entry.mood);
    const isLong = entry.entry_text.length > 200;
    const displayText = isLong && !expanded && !isEditing
        ? entry.entry_text.substring(0, 200) + '...'
        : entry.entry_text;

    // Close menu on click outside
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        }
        if (showMenu) document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [showMenu]);

    const handleToggleShare = async () => {
        setIsTogglingShare(true);
        try {
            const res = await fetch('/api/journal', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: entry.id, shared_with_pss: !entry.shared_with_pss }),
            });
            if ((await res.json()).error) throw new Error('Failed');
            onUpdate();
        } catch (e) {
            console.error(e);
        } finally {
            setIsTogglingShare(false);
            setShowMenu(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editText.trim()) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/journal', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: entry.id, entry_text: editText.trim(), mood: editMood }),
            });
            if ((await res.json()).error) throw new Error('Failed');
            setIsEditing(false);
            onUpdate();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            const res = await fetch(`/api/journal?id=${entry.id}`, {
                method: 'DELETE',
                headers: {},
            });
            if ((await res.json()).error) throw new Error('Failed');
            onDelete(entry.id);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <div className="flex items-center gap-3">
                    {mood && (
                        <span className="text-2xl" title={mood.label}>{mood.emoji}</span>
                    )}
                    <div>
                        <p className="text-sm font-medium text-gray-900">{formatDate(entry.created_at)}</p>
                        {mood && <p className="text-xs text-gray-500">Feeling {mood.label.toLowerCase()}</p>}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Share indicator */}
                    <span
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${entry.shared_with_pss
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                        title={entry.shared_with_pss ? 'Shared with your peer support specialist' : 'Private — only you can see this'}
                    >
                        {entry.shared_with_pss ? (
                            <><Eye className="w-3 h-3" />Shared</>
                        ) : (
                            <><Lock className="w-3 h-3" />Private</>
                        )}
                    </span>

                    {/* Menu */}
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-10">
                                <button
                                    onClick={() => { setIsEditing(true); setShowMenu(false); }}
                                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                    <Pencil className="w-4 h-4" />Edit Entry
                                </button>
                                <button
                                    onClick={handleToggleShare}
                                    disabled={isTogglingShare}
                                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                    {entry.shared_with_pss ? (
                                        <><EyeOff className="w-4 h-4" />Make Private</>
                                    ) : (
                                        <><Share2 className="w-4 h-4" />Share with PSS</>
                                    )}
                                </button>
                                <div className="border-t border-gray-100 my-1" />
                                <button
                                    onClick={() => { setShowDeleteConfirm(true); setShowMenu(false); }}
                                    className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />Delete
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="px-5 pb-4">
                {isEditing ? (
                    <div className="space-y-3">
                        <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={4}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none text-sm"
                            autoFocus
                        />
                        {/* Mood edit */}
                        <div className="flex flex-wrap gap-1.5">
                            {moods.map((m) => (
                                <button
                                    key={m.value}
                                    onClick={() => setEditMood(editMood === m.value ? null : m.value)}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border-2 ${editMood === m.value
                                            ? 'bg-gray-100'
                                            : 'border-transparent bg-gray-50 hover:bg-gray-100'
                                        }`}
                                    style={editMood === m.value ? { borderColor: m.color } : {}}
                                >
                                    <span>{m.emoji}</span>
                                    <span className="text-gray-700">{m.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => { setIsEditing(false); setEditText(entry.entry_text); setEditMood(entry.mood); }} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                                Cancel
                            </button>
                            <button onClick={handleSaveEdit} disabled={isSaving || !editText.trim()} className="px-4 py-1.5 text-sm bg-teal-600 text-white rounded-lg disabled:opacity-50 hover:bg-teal-700">
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{displayText}</p>
                        {isLong && !expanded && (
                            <button onClick={() => setExpanded(true)} className="mt-2 text-xs text-teal-600 hover:text-teal-700 font-medium">
                                Read more
                            </button>
                        )}
                        {isLong && expanded && (
                            <button onClick={() => setExpanded(false)} className="mt-2 text-xs text-teal-600 hover:text-teal-700 font-medium">
                                Show less
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* Delete confirmation */}
            {showDeleteConfirm && (
                <div className="px-5 pb-4">
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-sm text-red-800 mb-3">Delete this journal entry? This can't be undone.</p>
                        <div className="flex gap-2">
                            <button onClick={handleDelete} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600">Delete</button>
                            <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── New Entry Composer ───────────────────────────────────────────────────────

function NewEntryComposer({
    onCreated,
    onCancel,
}: {
    onCreated: () => void;
    onCancel: () => void;
}) {
    const [text, setText] = useState('');
    const [mood, setMood] = useState<string | null>(null);
    const [shareWithPss, setShareWithPss] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    const handleSave = async () => {
        if (!text.trim()) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/journal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entry_text: text.trim(),
                    mood,
                    shared_with_pss: shareWithPss,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            onCreated();
        } catch (e) {
            console.error('Error saving journal entry:', e);
            alert('Failed to save. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <BookHeart className="w-6 h-6 text-white" />
                        <h3 className="text-lg font-bold text-white">New Journal Entry</h3>
                    </div>
                    <button onClick={onCancel} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>
                <p className="text-white/80 text-sm mt-1">Write what's on your mind. This is your space.</p>
            </div>

            <div className="p-5 space-y-4">
                {/* Mood selector */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">How are you feeling?</label>
                    <div className="flex flex-wrap gap-2">
                        {moods.map((m) => (
                            <button
                                key={m.value}
                                onClick={() => setMood(mood === m.value ? null : m.value)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border-2 ${mood === m.value
                                        ? 'border-current bg-opacity-10 scale-105'
                                        : 'border-transparent bg-gray-50 hover:bg-gray-100'
                                    }`}
                                style={mood === m.value ? { color: m.color, borderColor: m.color, backgroundColor: `${m.color}15` } : {}}
                            >
                                <span className="text-lg">{m.emoji}</span>
                                <span>{m.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Text area */}
                <div>
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="What's on your mind today? Write as much or as little as you'd like..."
                        rows={6}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none text-base placeholder:text-gray-400"
                    />
                    <p className="text-xs text-gray-400 mt-1">{text.trim().length} characters</p>
                </div>

                {/* Share toggle */}
                <div className={`p-4 rounded-xl border-2 transition-all ${shareWithPss ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                    <button
                        onClick={() => setShareWithPss(!shareWithPss)}
                        className="w-full flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            {shareWithPss ? (
                                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <Eye className="w-5 h-5 text-blue-600" />
                                </div>
                            ) : (
                                <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center">
                                    <Lock className="w-5 h-5 text-gray-500" />
                                </div>
                            )}
                            <div className="text-left">
                                <p className="text-sm font-medium text-gray-900">
                                    {shareWithPss ? 'Sharing with your support specialist' : 'Keeping this private'}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {shareWithPss
                                        ? 'Your PSS will be notified you shared a journal entry'
                                        : 'Only you can see this entry. You can share it later.'
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Toggle switch */}
                        <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${shareWithPss ? 'bg-blue-500' : 'bg-gray-300'}`}>
                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${shareWithPss ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                    </button>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                    <button onClick={onCancel} className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!text.trim() || isSaving}
                        className="px-6 py-2.5 flex items-center gap-2 bg-amber-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-amber-600 transition-colors shadow-sm"
                    >
                        {isSaving ? (
                            <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
                        ) : (
                            <><Check className="w-4 h-4" />Save Entry</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function JournalPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showComposer, setShowComposer] = useState(false);
    const [filter, setFilter] = useState<'all' | 'shared' | 'private'>('all');

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/');
    }, [status, router]);

    useEffect(() => {
        if (session?.participantId) fetchEntries();
    }, [session]);

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/journal');
            const data = await res.json();
            setEntries(data.entries || []);
        } catch (e) {
            console.error('Error fetching journal:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreated = () => {
        setShowComposer(false);
        fetchEntries();
    };

    const handleDelete = (id: string) => {
        setEntries(prev => prev.filter(e => e.id !== id));
    };

    const filteredEntries = entries.filter(e => {
        if (filter === 'shared') return e.shared_with_pss;
        if (filter === 'private') return !e.shared_with_pss;
        return true;
    });

    // Group entries by date
    const groupedEntries: { label: string; entries: JournalEntry[] }[] = [];
    let currentGroup = '';
    filteredEntries.forEach(entry => {
        const date = new Date(entry.created_at);
        const label = formatFullDate(entry.created_at);
        if (label !== currentGroup) {
            currentGroup = label;
            groupedEntries.push({ label, entries: [entry] });
        } else {
            groupedEntries[groupedEntries.length - 1].entries.push(entry);
        }
    });

    const sharedCount = entries.filter(e => e.shared_with_pss).length;
    const privateCount = entries.filter(e => !e.shared_with_pss).length;

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F8FAFB]">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
        );
    }

    if (!session) return null;

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-2xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg">
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div className="flex items-center gap-2">
                                <BookHeart className="w-5 h-5 text-amber-500" />
                                <h1 className="text-lg font-bold text-gray-900">My Journal</h1>
                            </div>
                        </div>
                        {!showComposer && (
                            <button
                                onClick={() => setShowComposer(true)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors shadow-sm"
                            >
                                <Plus className="w-4 h-4" />New Entry
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
                {/* Composer */}
                {showComposer && (
                    <NewEntryComposer
                        onCreated={handleCreated}
                        onCancel={() => setShowComposer(false)}
                    />
                )}

                {/* Stats & Filter */}
                {!loading && entries.length > 0 && (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</p>
                        <div className="flex bg-gray-100 rounded-lg p-0.5">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                All ({entries.length})
                            </button>
                            <button
                                onClick={() => setFilter('private')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${filter === 'private' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Lock className="w-3 h-3" />Private ({privateCount})
                            </button>
                            <button
                                onClick={() => setFilter('shared')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${filter === 'shared' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Eye className="w-3 h-3" />Shared ({sharedCount})
                            </button>
                        </div>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
                    </div>
                )}

                {/* Empty State */}
                {!loading && entries.length === 0 && !showComposer && (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                            <BookHeart className="w-10 h-10 text-amber-400" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Your Journal</h2>
                        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                            A private space to write about your day, track your feelings, and reflect on your journey. You choose what to share.
                        </p>
                        <button
                            onClick={() => setShowComposer(true)}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors shadow-sm"
                        >
                            <Plus className="w-5 h-5" />Write Your First Entry
                        </button>

                        <div className="mt-8 grid grid-cols-3 gap-3 max-w-sm mx-auto">
                            <div className="p-3 bg-white rounded-xl border border-gray-200 text-center">
                                <Lock className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                                <p className="text-xs text-gray-600 font-medium">Private by default</p>
                            </div>
                            <div className="p-3 bg-white rounded-xl border border-gray-200 text-center">
                                <Share2 className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                                <p className="text-xs text-gray-600 font-medium">Share if you want</p>
                            </div>
                            <div className="p-3 bg-white rounded-xl border border-gray-200 text-center">
                                <span className="text-lg block mb-0.5">😊</span>
                                <p className="text-xs text-gray-600 font-medium">Track your mood</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty filter state */}
                {!loading && entries.length > 0 && filteredEntries.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-gray-500">No {filter} entries yet</p>
                    </div>
                )}

                {/* Entries grouped by date */}
                {groupedEntries.map((group) => (
                    <div key={group.label}>
                        <div className="flex items-center gap-3 mb-3">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{group.label}</span>
                            <div className="flex-1 h-px bg-gray-200" />
                        </div>
                        <div className="space-y-3">
                            {group.entries.map((entry) => (
                                <EntryCard
                                    key={entry.id}
                                    entry={entry}
                                    onUpdate={fetchEntries}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    </div>
                ))}

                {/* Privacy note */}
                {!loading && entries.length > 0 && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 mt-8">
                        <div className="flex items-start gap-3">
                            <Lock className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div>
                                <p className="text-xs text-gray-600">
                                    <strong>Your privacy matters.</strong> Journal entries are private by default. Only entries you explicitly share are visible to your peer support specialist. You can change sharing at any time.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}