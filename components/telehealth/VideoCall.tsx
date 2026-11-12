'use client';

// In-app video call on the Amazon Chime SDK, assembled from AWS's React
// component library. Rendered only in the browser (import with next/dynamic,
// ssr: false) because the SDK touches media devices at load.
//
// Used by the staff call page (/telehealth/[id]), the public guest join page
// (/join/[token]) and copied into the participant portal. Keep the copies in sync.
//
// Flow: mount → Chime join (permission prompt, device discovery) → LOBBY
// (camera preview, mic level, speaker test, device pickers, background,
// display name, readiness banner) → "Join call" → Chime start → in-call.
//
// Background blur runs in the browser via the Chime SDK's WASM video processor,
// so video never leaves the device without the effect applied. Never call
// .stop() on a transform device here: it destroys the processor the provider
// shares, and blur can then not be turned on again.
//
// Display names travel as Chime data messages (topic pss.name, 5-minute
// lifetime so late joiners receive them). They never touch our server.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ThemeProvider } from 'styled-components';
import {
    MeetingProvider,
    BackgroundBlurProvider,
    darkTheme,
    GlobalStyles,
    useMeetingManager,
    useMeetingStatus,
    useRosterState,
    useAudioVideo,
    useAudioInputs,
    useAudioOutputs,
    useVideoInputs,
    useLocalVideo,
    useBackgroundBlur,
    MeetingStatus,
    VideoTileGrid,
    PreviewVideo,
    MicSelection,
    CameraSelection,
    SpeakerSelection,
    ControlBar,
    ControlBarButton,
    AudioInputControl,
    VideoInputBackgroundBlurControl,
    AudioOutputControl,
    ContentShareControl,
    Phone,
    DeviceLabels,
} from 'amazon-chime-sdk-component-library-react';
import { MeetingSessionConfiguration, isVideoTransformDevice } from 'amazon-chime-sdk-js';
import { Mic, MicOff, Video, VideoOff, Volume2, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export interface VideoCallProps {
    /** Chime Meeting object from CreateMeeting. */
    meeting: Record<string, unknown>;
    /** Chime Attendee object from CreateAttendee (this user). */
    attendee: Record<string, unknown>;
    title: string;
    subtitle?: string;
    /** Label on the red hang-up button. */
    leaveLabel?: string;
    /** Allow screen sharing (staff yes, participant no). */
    allowContentShare?: boolean;
    /** Name shown to the other person on the video tile; editable in the lobby. */
    defaultDisplayName?: string | null;
    /** Fires once we have left (button, meeting ended remotely, or failure). */
    onLeave: (reason: 'left' | 'ended' | 'failed') => void;
    /** Fires when the user backs out of the lobby without joining. Omit to hide the button. */
    onCancel?: () => void;
    /** Roster changes: list of external user ids currently in the call (excluding self). */
    onRosterChange?: (externalUserIds: string[]) => void;
}

// ── Display names over data messages ────────────────────────────────────────
const NAME_TOPIC = 'pss.name';
const NAME_LIFETIME_MS = 300_000; // max Chime allows; late joiners still get it
const NAME_WAIT_MS = 3000;
const MAX_NAME = 40;
const knownNames = new Map<string, string>();
const nameWaiters = new Map<string, Array<(n: string) => void>>();

function rememberName(attendeeId: string, name: string) {
    const clean = name.trim().slice(0, MAX_NAME);
    if (!clean) return;
    knownNames.set(attendeeId, clean);
    const w = nameWaiters.get(attendeeId);
    if (w) { nameWaiters.delete(attendeeId); w.forEach(fn => fn(clean)); }
}

function fallbackName(externalUserId?: string | null) {
    const id = externalUserId || '';
    if (id.startsWith('staff:')) return 'Peer specialist';
    if (id.startsWith('participant:') || id.startsWith('guest:')) return 'Participant';
    return 'Guest';
}

function resolveName(attendeeId: string, externalUserId?: string): Promise<string> {
    const known = knownNames.get(attendeeId);
    if (known) return Promise.resolve(known);
    return new Promise(resolve => {
        const t = setTimeout(() => {
            const list = nameWaiters.get(attendeeId);
            if (list) nameWaiters.set(attendeeId, list.filter(fn => fn !== done));
            resolve(knownNames.get(attendeeId) || fallbackName(externalUserId));
        }, NAME_WAIT_MS);
        const done = (n: string) => { clearTimeout(t); resolve(n); };
        nameWaiters.set(attendeeId, [...(nameWaiters.get(attendeeId) || []), done]);
    });
}

// ── Background mode (none / blur) ───────────────────────────────────────────
type BgMode = 'none' | 'blur';

function useBackground() {
    const meetingManager = useMeetingManager();
    const { selectedDevice } = useVideoInputs();
    const { isBackgroundBlurSupported, createBackgroundBlurDevice } = useBackgroundBlur();
    const [mode, setMode] = useState<BgMode>('none');
    const [busy, setBusy] = useState(false);

    const blurAvailable = isBackgroundBlurSupported !== false;

    /** Build the input device for a mode from the raw camera and select it. */
    const apply = useCallback(async (next: BgMode, startVideo = true) => {
        if (busy) return;
        setBusy(true);
        try {
            const current: any = selectedDevice;
            const raw = current && isVideoTransformDevice(current) ? await current.intrinsicDevice() : current;
            if (startVideo && raw) {
                const device = next === 'blur' && blurAvailable ? await createBackgroundBlurDevice(raw) : raw;
                await meetingManager.startVideoInputDevice(device);
            }
            setMode(next);
        } catch (e) {
            console.error('background change failed', e);
        } finally {
            setBusy(false);
        }
    }, [busy, selectedDevice, blurAvailable, createBackgroundBlurDevice, meetingManager]);

    return { mode, setMode, apply, busy, blurAvailable };
}

// ── Lobby helpers ───────────────────────────────────────────────────────────

/** Live microphone level from the mic Chime already holds (no second capture, so iOS stays happy). */
function MicLevel({ deviceKey, muted, onHeard }: { deviceKey: string | null; muted: boolean; onHeard: () => void }) {
    const audioVideo = useAudioVideo();
    const [bars, setBars] = useState(0);
    const heardRef = useRef(false);
    const BARS = 14;

    useEffect(() => {
        if (!audioVideo) return;
        let raf = 0;
        let last = -1;
        let analyser: any = null;
        // The input device is (re)started asynchronously by the selection; retry briefly until it exists.
        let attempts = 0;
        const arm = () => {
            try { analyser = audioVideo.createAnalyserNodeForAudioInput(); } catch { analyser = null; }
            if (!analyser) {
                if (attempts++ < 20) { raf = window.setTimeout(arm, 250) as unknown as number; }
                return;
            }
            analyser.fftSize = 512;
            const buf = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
                analyser.getByteTimeDomainData(buf);
                let sum = 0;
                for (let i = 0; i < buf.length; i++) { const d = (buf[i] - 128) / 128; sum += d * d; }
                const rms = Math.sqrt(sum / buf.length);
                const n = Math.min(BARS, Math.round(rms * 5 * BARS));
                if (n !== last) { last = n; setBars(n); }
                if (n >= 2 && !heardRef.current) { heardRef.current = true; onHeard(); }
                raf = requestAnimationFrame(tick);
            };
            tick();
        };
        const t = window.setTimeout(arm, 300);
        return () => {
            clearTimeout(t);
            clearTimeout(raf);
            cancelAnimationFrame(raf);
            try { analyser?.removeOriginalInputs?.(); analyser?.disconnect?.(); } catch { /* best effort */ }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioVideo, deviceKey]);

    return (
        <div aria-label="Microphone level" style={{ display: 'flex', gap: 3, alignItems: 'center', height: 16 }}>
            {Array.from({ length: BARS }).map((_, i) => (
                <span key={i} style={{ width: 6, height: 6 + i * 0.6, borderRadius: 2, background: !muted && i < bars ? (i < BARS * 0.75 ? '#34d399' : '#fbbf24') : 'rgba(255,255,255,0.14)', transition: 'background 80ms' }} />
            ))}
        </div>
    );
}

/** Three rising notes through the chosen speaker. */
async function playTestTone(sinkId: string | null) {
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    const gain = ctx.createGain(); gain.gain.value = 0.2; gain.connect(dest);
    [523.25, 659.25, 783.99].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(gain);
        const t0 = ctx.currentTime + i * 0.2;
        o.start(t0); o.stop(t0 + 0.4);
    });
    const el = new Audio();
    el.srcObject = dest.stream;
    if (sinkId && typeof (el as any).setSinkId === 'function') { try { await (el as any).setSinkId(sinkId); } catch { /* keep default output */ } }
    await el.play();
    await new Promise(r => setTimeout(r, 1300));
    el.pause(); (el as any).srcObject = null;
    ctx.close().catch(() => {});
}

const deviceIdOf = (d: any): string | null => (typeof d === 'string' ? d : d && typeof d.deviceId === 'string' ? d.deviceId : null);

interface LobbyChoices { displayName: string; micOn: boolean; cameraOn: boolean; bgMode: BgMode }

function Lobby({ title, subtitle, defaultDisplayName, onJoin, onCancel, bg }: {
    title: string; subtitle?: string; defaultDisplayName?: string | null;
    onJoin: (c: LobbyChoices) => void; onCancel?: () => void; bg: ReturnType<typeof useBackground>;
}) {
    const { devices: mics, selectedDevice: mic } = useAudioInputs();
    const { devices: speakers, selectedDevice: speaker } = useAudioOutputs();
    const { devices: cameras, selectedDevice: camera } = useVideoInputs();
    const [displayName, setDisplayName] = useState((defaultDisplayName || '').slice(0, MAX_NAME));
    const [micOn, setMicOn] = useState(true);
    const [cameraOn, setCameraOn] = useState(true);
    const [heard, setHeard] = useState(false);
    const [testing, setTesting] = useState(false);
    const [showDevices, setShowDevices] = useState(false);

    const meetingManager = useMeetingManager();
    const [rechecking, setRechecking] = useState(false);
    const hasMic = mics.length > 0;
    const hasCamera = cameras.length > 0;

    // Ask the SDK to list devices again (re-runs the permission trigger and
    // re-initializes the device providers). Used by "Check again" and once
    // automatically if nothing was found right after the lobby opened.
    const recheck = useCallback(async () => {
        setRechecking(true);
        try { meetingManager.invokeDeviceProvider(DeviceLabels.AudioAndVideo); } catch (e) { console.error('device recheck failed', e); }
        await new Promise(r => setTimeout(r, 1200));
        setRechecking(false);
    }, [meetingManager]);
    const autoRechecked = useRef(false);
    useEffect(() => {
        if (hasMic || hasCamera || autoRechecked.current) return;
        autoRechecked.current = true;
        const t = setTimeout(() => { void recheck(); }, 1500);
        return () => clearTimeout(t);
    }, [hasMic, hasCamera, recheck]);
    // Chrome/Safari hand back devices with empty labels until permission is granted.
    const permissionMissing = (mics.length > 0 && mics.every(d => !d.label)) || (cameras.length > 0 && cameras.every(d => !d.label));
    const cameraLive = cameraOn && hasCamera && !!camera;

    const ready = hasMic && !permissionMissing;
    let banner: { tone: 'ok' | 'warn'; text: string };
    if (permissionMissing) banner = { tone: 'warn', text: 'Your browser has not allowed the camera or microphone yet. Choose Allow in the browser prompt, or check the lock icon in the address bar.' };
    else if (!hasMic) banner = { tone: 'warn', text: 'No microphone found. Plug in a headset or use your phone, then choose Check again.' };
    else if (!hasCamera) banner = { tone: 'warn', text: 'No camera found. You can still join with audio only.' };
    else if (!micOn) banner = { tone: 'ok', text: 'You are set. You will join muted; unmute from the call controls.' };
    else if (heard) banner = { tone: 'ok', text: 'You are ready for your video call. We can hear you.' };
    else banner = { tone: 'ok', text: 'Camera and microphone are ready. Say something to check your mic.' };

    const testSpeaker = async () => {
        setTesting(true);
        try { await playTestTone(deviceIdOf(speaker)); } catch (e) { console.error('speaker test failed', e); }
        setTesting(false);
    };

    const iconBtn = (active: boolean, danger: boolean): React.CSSProperties => ({
        width: 46, height: 46, borderRadius: 999, border: '1px solid rgba(255,255,255,0.14)', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        background: danger ? '#dc2626' : active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
    });
    const chip = (on: boolean, disabled = false): React.CSSProperties => ({
        padding: '7px 12px', borderRadius: 999, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
        border: `1px solid ${on ? '#60a5fa' : 'rgba(255,255,255,0.16)'}`, background: on ? 'rgba(96,165,250,0.18)' : 'rgba(255,255,255,0.05)', color: '#fff',
    });

    return (
        <div className="pss-lobby" style={{ minHeight: '100dvh', background: '#0b0f14', color: '#fff', display: 'flex', flexDirection: 'column' }}>
            <style>{`
                .pss-lobby-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
                @media (min-width: 820px) { .pss-lobby-grid { grid-template-columns: minmax(0, 3fr) minmax(280px, 2fr); align-items: start; } }
                .pss-lobby select { width: 100%; }
                .pss-lobby label { color: rgba(255,255,255,0.7); font-size: 12px; }
                .pss-lobby-preview { width: 100%; height: 100% !important; }
                .pss-lobby-preview video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
            `}</style>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Get ready for your call{subtitle ? ` · ${subtitle}` : ''}</div>
            </div>

            <div style={{ flex: 1, width: '100%', maxWidth: 1040, margin: '0 auto', padding: '20px 16px 28px', boxSizing: 'border-box' }}>
                <div className="pss-lobby-grid">
                    {/* Preview + toggles */}
                    <div>
                        <div style={{ position: 'relative', aspectRatio: '16 / 9', maxWidth: '100%', borderRadius: 16, overflow: 'hidden', background: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {cameraLive ? (
                                <div style={{ position: 'absolute', inset: 0 }}>
                                    <PreviewVideo className="pss-lobby-preview" />
                                </div>
                            ) : (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: 0.75, fontSize: 14 }}>
                                    <VideoOff size={34} />
                                    {hasCamera ? 'Camera is off' : 'No camera found'}
                                </div>
                            )}
                            {displayName && (
                                <div style={{ position: 'absolute', left: 12, bottom: 12, padding: '4px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.55)', fontSize: 13 }}>{displayName}</div>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 14 }}>
                            <button type="button" onClick={() => setMicOn(m => !m)} disabled={!hasMic} title={micOn ? 'Mute microphone' : 'Unmute microphone'} style={iconBtn(micOn, !micOn)}>
                                {micOn ? <Mic size={20} /> : <MicOff size={20} />}
                            </button>
                            <button type="button" onClick={() => setCameraOn(c => !c)} disabled={!hasCamera} title={cameraOn ? 'Turn camera off' : 'Turn camera on'} style={iconBtn(cameraOn, !cameraOn)}>
                                {cameraOn ? <Video size={20} /> : <VideoOff size={20} />}
                            </button>
                            <button type="button" onClick={testSpeaker} disabled={testing} style={{ ...chip(false), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                {testing ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />} Test speaker
                            </button>
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, opacity: 0.85 }}>
                                <span>Mic</span>
                                {hasMic && <MicLevel deviceKey={deviceIdOf(mic)} muted={!micOn} onHeard={() => setHeard(true)} />}
                            </div>
                        </div>

                        <div style={{ marginTop: 14 }}>
                            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Background</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                <button type="button" style={chip(bg.mode === 'none')} disabled={bg.busy} onClick={() => bg.apply('none', cameraLive)}>None</button>
                                {bg.blurAvailable && <button type="button" style={chip(bg.mode === 'blur')} disabled={bg.busy} onClick={() => bg.apply('blur', cameraLive)}>Blur</button>}
                                {bg.busy && <Loader2 size={16} className="animate-spin" style={{ alignSelf: 'center', opacity: 0.7 }} />}
                            </div>
                        </div>
                    </div>

                    {/* Settings column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, border: `1px solid ${banner.tone === 'ok' ? 'rgba(52,211,153,0.5)' : 'rgba(251,191,36,0.6)'}`, background: banner.tone === 'ok' ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.12)', fontSize: 13, lineHeight: 1.4 }}>
                            {banner.tone === 'ok' ? <CheckCircle2 size={18} color="#34d399" style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertTriangle size={18} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />}
                            <span>{banner.text}</span>
                        </div>
                        {(!hasMic || !hasCamera || permissionMissing) && (
                            <button type="button" onClick={() => { void recheck(); }} disabled={rechecking} style={{ ...chip(false, rechecking), alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                {rechecking ? <Loader2 size={14} className="animate-spin" /> : null} Check camera and microphone again
                            </button>
                        )}

                        <div>
                            <label htmlFor="pss-display-name" style={{ display: 'block', marginBottom: 6 }}>Display name <span style={{ opacity: 0.6 }}>(what the other person sees)</span></label>
                            <input
                                id="pss-display-name"
                                value={displayName}
                                onChange={e => setDisplayName(e.target.value.slice(0, MAX_NAME))}
                                placeholder="Your first name"
                                autoComplete="off"
                                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 15 }}
                            />
                        </div>

                        <button type="button" onClick={() => setShowDevices(s => !s)} style={{ ...chip(showDevices), alignSelf: 'flex-start' }}>
                            {showDevices ? 'Hide device settings' : 'Microphone, camera and speaker settings'}
                        </button>
                        {showDevices && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
                                <MicSelection label="Microphone" />
                                <CameraSelection label="Camera" />
                                {speakers.length > 0 && <SpeakerSelection label="Speaker" />}
                            </div>
                        )}

                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
                            <li>Find a private spot and, if you can, use headphones.</li>
                            <li>Nothing is recorded.</li>
                        </ul>

                        <button
                            type="button"
                            onClick={() => onJoin({ displayName: displayName.trim(), micOn: micOn && hasMic, cameraOn: cameraLive, bgMode: bg.mode })}
                            disabled={!ready || bg.busy}
                            style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: 'none', cursor: ready ? 'pointer' : 'not-allowed', opacity: ready ? 1 : 0.5, background: '#16a34a', color: '#fff', fontWeight: 600, fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                        >
                            <Video size={18} /> Join call
                        </button>
                        {onCancel && (
                            <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 13, padding: 6 }}>Not now</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── The call ────────────────────────────────────────────────────────────────
function CallInner({ meeting, attendee, title, subtitle, leaveLabel = 'Leave', allowContentShare = false, defaultDisplayName, onLeave, onCancel, onRosterChange }: VideoCallProps) {
    const meetingManager = useMeetingManager();
    const audioVideo = useAudioVideo();
    const status = useMeetingStatus();
    const { roster } = useRosterState();
    const { selectedDevice: videoDevice } = useVideoInputs();
    const { setIsVideoEnabled } = useLocalVideo();
    const bg = useBackground();
    const [stage, setStage] = useState<'preparing' | 'lobby' | 'connecting' | 'incall'>('preparing');
    // After a few seconds of "preparing", the browser is almost certainly waiting on its permission bubble.
    const [slowPrep, setSlowPrep] = useState(false);
    useEffect(() => {
        if (stage !== 'preparing') return;
        const t = setTimeout(() => setSlowPrep(true), 4000);
        return () => clearTimeout(t);
    }, [stage]);
    const [error, setError] = useState<string | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const leftRef = useRef(false);
    const choicesRef = useRef<LobbyChoices | null>(null);
    const myAttendeeId = String((attendee as any).AttendeeId || '');

    // Names for the roster: from data messages, else a role label.
    useEffect(() => {
        meetingManager.getAttendee = async (id, ext) => {
            if (id === myAttendeeId) return { name: choicesRef.current?.displayName || 'Me' };
            return { name: await resolveName(id, ext) };
        };
        return () => { meetingManager.getAttendee = undefined; };
    }, [meetingManager, myAttendeeId]);

    // Join (permission prompt + device discovery) on mount, leave on unmount.
    // join and leave are serialized through one promise chain: React Strict Mode
    // (dev) mounts twice, and an unserialized join/leave/join left the device
    // providers bound to the torn-down session (empty mic and camera lists).
    const chainRef = useRef<Promise<void>>(Promise.resolve());
    useEffect(() => {
        let cancelled = false;
        chainRef.current = chainRef.current.then(async () => {
            if (cancelled) return;
            try {
                const config = new MeetingSessionConfiguration(meeting as any, attendee as any);
                await meetingManager.join(config, { deviceLabels: DeviceLabels.AudioAndVideo });
                if (cancelled) { await meetingManager.leave().catch(() => {}); return; }
                setStage('lobby');
            } catch (e: any) {
                console.error('video join failed', e);
                if (!cancelled) { setError(e?.message || 'Could not join the video session'); leftRef.current = true; onLeave('failed'); }
            }
        });
        return () => {
            cancelled = true;
            chainRef.current = chainRef.current.then(() => meetingManager.leave().catch(() => {}));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Learn other people's names.
    useEffect(() => {
        if (!audioVideo) return;
        const cb = (msg: any) => { try { rememberName(String(msg.senderAttendeeId), msg.text()); } catch { /* ignore */ } };
        audioVideo.realtimeSubscribeToReceiveDataMessage(NAME_TOPIC, cb);
        return () => { try { audioVideo.realtimeUnsubscribeFromReceiveDataMessage(NAME_TOPIC); } catch { /* gone */ } };
    }, [audioVideo]);

    // Lobby → connect with the chosen settings.
    const joinCall = useCallback((c: LobbyChoices) => { choicesRef.current = c; setStage('connecting'); }, []);
    useEffect(() => {
        if (stage !== 'connecting') return;
        let cancelled = false;
        (async () => {
            const c = choicesRef.current!;
            try {
                await meetingManager.start();
                if (cancelled) return;
                if (!c.micOn) audioVideo?.realtimeMuteLocalAudio();
                if (c.cameraOn && videoDevice) {
                    // The preview stopped the camera on unmount; start it again (with the
                    // chosen background) for the call.
                    await bg.apply(c.bgMode);
                    audioVideo?.startLocalVideoTile();
                    setIsVideoEnabled(true);
                }
                if (!cancelled) setStage('incall');
            } catch (e: any) {
                console.error('video start failed', e);
                if (!cancelled) { setError(e?.message || 'Could not connect to the video session'); leftRef.current = true; onLeave('failed'); }
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stage]);

    // Once connected, tell everyone (including late joiners) our name.
    useEffect(() => {
        if (status !== MeetingStatus.Succeeded || !audioVideo) return;
        const name = choicesRef.current?.displayName || (defaultDisplayName || '').trim();
        if (!name) return;
        try { audioVideo.realtimeSendDataMessage(NAME_TOPIC, name.slice(0, MAX_NAME), NAME_LIFETIME_MS); } catch (e) { console.error('name broadcast failed', e); }
    }, [status, audioVideo, defaultDisplayName]);

    // Session timer.
    const joined = stage === 'incall';
    useEffect(() => {
        if (!joined) return;
        const t = setInterval(() => setElapsed(s => s + 1), 1000);
        return () => clearInterval(t);
    }, [joined]);

    // Meeting ended remotely (the other side ended it, or Chime expired it).
    useEffect(() => {
        if (leftRef.current) return;
        if (status === MeetingStatus.Ended || status === MeetingStatus.TerminalFailure || status === MeetingStatus.Failed) {
            leftRef.current = true;
            onLeave(status === MeetingStatus.Ended ? 'ended' : 'failed');
        }
    }, [status, onLeave]);

    // Report who else is here.
    const rosterKey = Object.keys(roster).sort().join('|');
    useEffect(() => {
        if (!onRosterChange) return;
        const others = Object.values(roster)
            .filter((a: any) => a.chimeAttendeeId !== myAttendeeId)
            .map((a: any) => String(a.externalUserId || ''));
        onRosterChange(others);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rosterKey]);

    const leave = async () => {
        if (leftRef.current) return;
        leftRef.current = true;
        try { await meetingManager.leave(); } catch { /* already gone */ }
        onLeave('left');
    };

    if (error) {
        return <div style={{ height: '100dvh', background: '#0b0f14', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>{error}</div>;
    }
    if (stage === 'preparing') {
        return (
            <div style={{ height: '100dvh', background: '#0b0f14', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, textAlign: 'center' }}>
                <Loader2 size={22} className="animate-spin" />
                <div style={{ fontSize: 14, opacity: 0.85 }}>Setting up your camera and microphone…</div>
                <div style={{ fontSize: 12, opacity: 0.6 }}>If your browser asks, choose Allow.</div>
                {slowPrep && (
                    <div style={{ marginTop: 10, maxWidth: 420, padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(251,191,36,0.6)', background: 'rgba(251,191,36,0.12)', fontSize: 13, lineHeight: 1.45 }}>
                        Your browser is asking for camera and microphone permission. Look for the prompt near the address bar (a camera icon) and choose <strong>Allow</strong>. If you dismissed it, click the lock or camera icon in the address bar to allow, then reload this page.
                    </div>
                )}
            </div>
        );
    }
    if (stage === 'lobby') {
        return <Lobby title={title} subtitle={subtitle} defaultDisplayName={defaultDisplayName} onJoin={joinCall} onCancel={onCancel} bg={bg} />;
    }

    const others = Object.values(roster).filter((a: any) => a.chimeAttendeeId !== myAttendeeId).length;
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0b0f14', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
                    {subtitle && <div style={{ fontSize: 12, opacity: 0.7 }}>{subtitle}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, opacity: 0.85 }}>
                    <span>{joined ? `${mm}:${ss}` : 'Connecting…'}</span>
                    <span>{others === 0 ? 'Waiting for the other person' : `${others + 1} in session`}</span>
                </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                <VideoTileGrid layout="standard" noRemoteVideoView={
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.7, fontSize: 14, padding: 24, textAlign: 'center' }}>
                        {joined ? 'You are in the session. Waiting for the other person to join.' : 'Connecting to the session…'}
                    </div>
                } />
            </div>

            <ControlBar layout="bottom" showLabels>
                <AudioInputControl />
                {/* Camera control whose menu includes "Enable background blur". */}
                <VideoInputBackgroundBlurControl />
                <AudioOutputControl />
                {allowContentShare && <ContentShareControl />}
                <ControlBarButton icon={<Phone />} onClick={leave} label={leaveLabel} />
            </ControlBar>
        </div>
    );
}

export default function VideoCall(props: VideoCallProps) {
    return (
        <ThemeProvider theme={darkTheme}>
            <GlobalStyles />
            <BackgroundBlurProvider>
                <MeetingProvider>
                    <CallInner {...props} />
                </MeetingProvider>
            </BackgroundBlurProvider>
        </ThemeProvider>
    );
}
