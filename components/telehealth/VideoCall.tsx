'use client';

// In-app video call on the Amazon Chime SDK, assembled from AWS's React
// component library. Rendered only in the browser (import with next/dynamic,
// ssr: false) because the SDK touches media devices at load.
//
// Used by the staff call page (/telehealth/[id]) and copied into the
// participant portal. Keep the two copies in sync.

import { useEffect, useRef, useState } from 'react';
import { ThemeProvider } from 'styled-components';
import {
    MeetingProvider,
    darkTheme,
    GlobalStyles,
    useMeetingManager,
    useMeetingStatus,
    useRosterState,
    MeetingStatus,
    VideoTileGrid,
    ControlBar,
    ControlBarButton,
    AudioInputControl,
    VideoInputControl,
    AudioOutputControl,
    ContentShareControl,
    Phone,
    DeviceLabels,
} from 'amazon-chime-sdk-component-library-react';
import { MeetingSessionConfiguration } from 'amazon-chime-sdk-js';

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
    /** Fires once we have left (button, meeting ended remotely, or failure). */
    onLeave: (reason: 'left' | 'ended' | 'failed') => void;
    /** Roster changes: list of external user ids currently in the call (excluding self). */
    onRosterChange?: (externalUserIds: string[]) => void;
}

function CallInner({ meeting, attendee, title, subtitle, leaveLabel = 'Leave', allowContentShare = false, onLeave, onRosterChange }: VideoCallProps) {
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
                <VideoInputControl />
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
            <MeetingProvider>
                <CallInner {...props} />
            </MeetingProvider>
        </ThemeProvider>
    );
}
