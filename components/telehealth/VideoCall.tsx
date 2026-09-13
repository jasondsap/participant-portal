'use client';

// In-app video call on the Amazon Chime SDK, assembled from AWS's React
// component library. Rendered only in the browser (import with next/dynamic,
// ssr: false) because the SDK touches media devices at load.
//
// Used by the staff call page (/telehealth/[id]), the public guest join page
// (/join/[token]) and copied into the participant portal. Keep the copies in sync.
//
// Backgrounds: the camera menu offers background blur; the Backdrop button
// swaps the background for an image built from the organization's brand
// (colors + logo). Both run in the browser via the Chime SDK's WASM video
// processors, so video never leaves the device without the effect applied.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ThemeProvider } from 'styled-components';
import {
    MeetingProvider,
    BackgroundBlurProvider,
    BackgroundReplacementProvider,
    darkTheme,
    GlobalStyles,
    useMeetingManager,
    useMeetingStatus,
    useRosterState,
    useVideoInputs,
    useLocalVideo,
    useBackgroundReplacement,
    MeetingStatus,
    VideoTileGrid,
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

export interface Backdrop {
    orgName: string;
    primaryColor: string;
    accentColor: string;
    logoUrl?: string | null;
}

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
    /** Organization brand for the Backdrop button; omit to hide the button. */
    backdrop?: Backdrop | null;
    /** Fires once we have left (button, meeting ended remotely, or failure). */
    onLeave: (reason: 'left' | 'ended' | 'failed') => void;
    /** Roster changes: list of external user ids currently in the call (excluding self). */
    onRosterChange?: (externalUserIds: string[]) => void;
}

// ── Brand backdrop image (1280×720 JPEG) ────────────────────────────────────
// Gradient in the org's colors, the logo on a soft card in the middle, the org
// name beneath. If the logo can't be drawn (no CORS on its host) we fall back
// to the name alone rather than fail.
async function buildBackdropBlob(b: Backdrop): Promise<Blob | null> {
    if (typeof document === 'undefined') return null;
    const W = 1280, H = 720;
    const draw = (logo: HTMLImageElement | null): Promise<Blob | null> => new Promise(resolve => {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const ctx = c.getContext('2d'); if (!ctx) return resolve(null);
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, b.primaryColor); g.addColorStop(1, b.accentColor);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // Soft vignette so faces read against the color.
        const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.9);
        v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
        let textY = H / 2 + 20;
        if (logo) {
            const maxW = W * 0.34, maxH = H * 0.28;
            const s = Math.min(maxW / logo.width, maxH / logo.height, 1);
            const lw = logo.width * s, lh = logo.height * s;
            const pad = 28, cw = lw + pad * 2, ch = lh + pad * 2, cx = (W - cw) / 2, cy = H * 0.24;
            ctx.fillStyle = 'rgba(255,255,255,0.94)';
            ctx.beginPath(); (ctx as any).roundRect ? (ctx as any).roundRect(cx, cy, cw, ch, 24) : ctx.rect(cx, cy, cw, ch); ctx.fill();
            ctx.drawImage(logo, cx + pad, cy + pad, lw, lh);
            textY = cy + ch + 56;
        }
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = `600 ${logo ? 40 : 64}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(b.orgName, W / 2, textY);
        try { c.toBlob(bl => resolve(bl), 'image/jpeg', 0.9); } catch { resolve(null); }
    });
    if (b.logoUrl) {
        const logo = await new Promise<HTMLImageElement | null>(res => {
            const img = new Image(); img.crossOrigin = 'anonymous';
            img.onload = () => res(img); img.onerror = () => res(null);
            img.src = b.logoUrl as string;
        });
        if (logo) {
            const withLogo = await draw(logo);
            if (withLogo) return withLogo;
        }
    }
    return draw(null);
}

// ── Backdrop toggle ─────────────────────────────────────────────────────────
function BackdropControl({ enabled }: { enabled: boolean }) {
    const meetingManager = useMeetingManager();
    const { selectedDevice } = useVideoInputs();
    const { isVideoEnabled, toggleVideo } = useLocalVideo();
    const { isBackgroundReplacementSupported, createBackgroundReplacementDevice } = useBackgroundReplacement();
    const [on, setOn] = useState(false);
    const [busy, setBusy] = useState(false);

    const toggle = useCallback(async () => {
        if (busy) return;
        setBusy(true);
        try {
            const current: any = selectedDevice;
            if (!on) {
                // Start from the raw camera (unwrap blur if it is on), then wrap with replacement.
                const raw = current && isVideoTransformDevice(current) ? await current.intrinsicDevice() : current;
                const device = await createBackgroundReplacementDevice(raw);
                await meetingManager.startVideoInputDevice(device);
                if (!isVideoEnabled) await toggleVideo();
                setOn(true);
            } else {
                const raw = current && isVideoTransformDevice(current) ? await current.intrinsicDevice() : current;
                if (current && isVideoTransformDevice(current)) await current.stop();
                if (raw) await meetingManager.startVideoInputDevice(raw);
                setOn(false);
            }
        } catch (e) {
            console.error('backdrop toggle failed', e);
        } finally {
            setBusy(false);
        }
    }, [busy, on, selectedDevice, createBackgroundReplacementDevice, meetingManager, isVideoEnabled, toggleVideo]);

    if (!enabled || isBackgroundReplacementSupported === false) return null;
    return (
        <ControlBarButton
            icon={<BackdropIcon />}
            onClick={toggle}
            label={on ? 'Backdrop on' : 'Backdrop'}
            isSelected={on}
        />
    );
}

function BackdropIcon() {
    return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="M21 16l-5-5-8 8" />
        </svg>
    );
}

function CallInner({ meeting, attendee, title, subtitle, leaveLabel = 'Leave', allowContentShare = false, backdrop, onLeave, onRosterChange }: VideoCallProps) {
    const meetingManager = useMeetingManager();
    const status = useMeetingStatus();
    const { roster } = useRosterState();
    const [joined, setJoined] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const leftRef = useRef(false);
    const myAttendeeId = String((attendee as any).AttendeeId || '');

    // Join on mount, leave on unmount.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const config = new MeetingSessionConfiguration(meeting as any, attendee as any);
                await meetingManager.join(config, { deviceLabels: DeviceLabels.AudioAndVideo });
                await meetingManager.start();
                if (!cancelled) setJoined(true);
            } catch (e: any) {
                console.error('video join failed', e);
                if (!cancelled) { setError(e?.message || 'Could not join the video session'); leftRef.current = true; onLeave('failed'); }
            }
        })();
        return () => {
            cancelled = true;
            meetingManager.leave().catch(() => {});
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Session timer.
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
                {error ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>{error}</div>
                ) : (
                    <VideoTileGrid layout="standard" noRemoteVideoView={
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.7, fontSize: 14, padding: 24, textAlign: 'center' }}>
                            {joined ? 'You are in the session. Waiting for the other person to join.' : 'Connecting to the session…'}
                        </div>
                    } />
                )}
            </div>

            <ControlBar layout="bottom" showLabels>
                <AudioInputControl />
                {/* Camera control whose menu includes "Enable background blur". */}
                <VideoInputBackgroundBlurControl />
                {/* Only mounted when a BackgroundReplacementProvider is above us (backdrop image built). */}
                {backdrop && <BackdropControl enabled />}
                <AudioOutputControl />
                {allowContentShare && <ContentShareControl />}
                <ControlBarButton icon={<Phone />} onClick={leave} label={leaveLabel} />
            </ControlBar>
        </div>
    );
}

export default function VideoCall(props: VideoCallProps) {
    // Build the brand backdrop once, before the providers mount, so the
    // replacement processor starts with the right image.
    const [blob, setBlob] = useState<Blob | null | undefined>(props.backdrop ? undefined : null);
    useEffect(() => {
        let cancelled = false;
        if (!props.backdrop) { setBlob(null); return; }
        buildBackdropBlob(props.backdrop).then(b => { if (!cancelled) setBlob(b); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.backdrop?.orgName, props.backdrop?.primaryColor, props.backdrop?.accentColor, props.backdrop?.logoUrl]);

    if (blob === undefined) {
        return <div style={{ height: '100dvh', background: '#0b0f14', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, opacity: 0.8 }}>Preparing your session…</div>;
    }

    const inner = (
        <MeetingProvider>
            <CallInner {...props} backdrop={blob ? props.backdrop : null} />
        </MeetingProvider>
    );

    return (
        <ThemeProvider theme={darkTheme}>
            <GlobalStyles />
            <BackgroundBlurProvider>
                {blob ? (
                    <BackgroundReplacementProvider options={{ imageBlob: blob }}>{inner}</BackgroundReplacementProvider>
                ) : inner}
            </BackgroundBlurProvider>
        </ThemeProvider>
    );
}
