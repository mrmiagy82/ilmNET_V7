import { useCallback, useEffect, useRef, useState } from 'react';
// Discovery step D5: the real playback position of this item is remembered on this device only, and a
// real remembered position is restored. The module is the single place that touches storage.
import { getActivityEntry, recordPlayback, resumePointFor } from '@/lib/localActivity';

type Props = {
  src: string | null;
  title: string;
  embedFallback?: string | null;
  provider?: string;
  sourceUrl?: string;
  /**
   * Identity of the content this player belongs to. Passed only for a real audio item: without it the
   * player behaves exactly as it did before D5 (no reading, no writing, no restore), which is what keeps
   * a lecture, a book or a document from ever being treated as audio progress.
   */
  activity?: { id: string; slug: string } | null;
};

/** Seconds of playback between two writes to the device-local store (throttle, not a data limit). */
const SAVE_EVERY_SECONDS = 10;

const BAR_COUNT = 24;
const IDLE_BARS = [14, 26, 38, 22, 44, 30, 52, 36, 24, 42, 18, 32, 46, 26, 16, 34, 22, 40, 28, 18, 30, 44, 20, 36];

function formatTime(sec: number) {
  if (!isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function PlayIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
      <rect x="7" y="6" width="4" height="12" rx="1.2" />
      <rect x="13" y="6" width="4" height="12" rx="1.2" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
      <path d="M8 5.6c0-.9 1-1.5 1.8-1l8.1 5.1a1.2 1.2 0 0 1 0 2L9.8 17c-.8.5-1.8-.1-1.8-1V5.6Z" />
    </svg>
  );
}

/**
 * ilmNet audio player — neumorphic styling, Web Audio API AnalyserNode waveform
 * that moves with the real audio signal during playback.
 */
export default function AudioPlayer({ src, title, embedFallback, provider, sourceUrl, activity }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSignalRef = useRef<number>(0);
  const savedAtRef = useRef<number>(-Infinity);
  const restoredRef = useRef<boolean>(false);

  const [playing, setPlaying] = useState(false);
  const [live, setLive] = useState(false); // true while the analyser is actually receiving signal
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [levels, setLevels] = useState<number[]>(IDLE_BARS);

  // The position this device remembered for *this* item, once it has really been applied to the element.
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);
  const activityId = activity?.id ?? null;
  const activitySlug = activity?.slug ?? null;

  /**
   * Writes the real position to the device-local store. Called while playing (throttled), and forced on
   * pause, on `ended` and on unmount, so a visitor who closes the tab keeps their place.
   * It refuses to store anything the element cannot stand behind: a paused, unloaded or streamed-unknown
   * file (no duration yet) leaves the store untouched instead of recording a guess.
   */
  const savePosition = useCallback(
    (force = false) => {
      const a = audioRef.current;
      if (!a || !activityId || !activitySlug) return;
      const duration = a.duration;
      const position = a.currentTime;
      if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return;
      if (!force && Math.abs(position - savedAtRef.current) < SAVE_EVERY_SECONDS) return;
      savedAtRef.current = position;
      recordPlayback({ id: activityId, slug: activitySlug, positionSec: position, durationSec: duration });
    },
    [activityId, activitySlug],
  );
  const saveRef = useRef(savePosition);
  saveRef.current = savePosition;

  /**
   * Restores a remembered position once the element knows the file's real duration. `resumePointFor`
   * decides: only this content's own entry, only a position well inside the real duration. Anything else
   * (a tick into the file, the last seconds, an entry from another item) is not resumed and not shown.
   */
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !src || !activityId) return;
    restoredRef.current = false;
    const apply = () => {
      if (restoredRef.current) return; // a late metadata event must not pull a listener back mid-listen
      const point = resumePointFor(getActivityEntry(activityId), activityId);
      if (!point) return;
      if (!Number.isFinite(a.duration) || a.duration <= 0) return;
      if (point.positionSec >= a.duration) return;
      restoredRef.current = true;
      a.currentTime = point.positionSec;
      savedAtRef.current = point.positionSec;
      setCurrent(point.positionSec);
      setProgress((point.positionSec / a.duration) * 100);
      setResumedFrom(point.positionSec);
    };
    if (a.readyState >= 1) apply();
    a.addEventListener('loadedmetadata', apply);
    a.addEventListener('durationchange', apply);
    return () => {
      a.removeEventListener('loadedmetadata', apply);
      a.removeEventListener('durationchange', apply);
    };
  }, [src, activityId]);

  // Last write on the way out, so leaving the page mid-listen is not a lost position.
  useEffect(() => () => saveRef.current(true), []);

  // ── progress / duration events ──
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      setCurrent(a.currentTime);
      setDuration(a.duration || 0);
      setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
      saveRef.current(); // throttled inside
    };
    const onLoaded = () => setDuration(a.duration || 0);
    const onEnded = () => {
      setPlaying(false);
      setLive(false);
      saveRef.current(true); // the end of the file is a real position too; resume refuses it
    };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onLoaded);
    a.addEventListener('durationchange', onLoaded);
    a.addEventListener('ended', onEnded);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onLoaded);
      a.removeEventListener('durationchange', onLoaded);
      a.removeEventListener('ended', onEnded);
    };
  }, [src]);

  /**
   * Create the AudioContext + MediaElementSource + AnalyserNode exactly once per audio element.
   * (A MediaElementSourceNode can only be created once per media element, so we never rebuild it.)
   * Must be triggered from a user gesture so the context is allowed to run.
   */
  const ensureAnalyser = useCallback(() => {
    const a = audioRef.current;
    if (!a) return null;
    if (analyserRef.current) return analyserRef.current;
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      const ctx: AudioContext = ctxRef.current ?? new Ctx();
      ctxRef.current = ctx;
      const source = sourceRef.current ?? ctx.createMediaElementSource(a);
      sourceRef.current = source;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64; // 32 bins → 24 bars
      analyser.smoothingTimeConstant = 0.78;
      analyser.minDecibels = -85;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      return analyser;
    } catch (e) {
      console.warn('[AudioPlayer] Web Audio analyser unavailable — waveform stays static.', e);
      return null;
    }
  }, []);

  // ── realtime waveform loop ──
  useEffect(() => {
    if (!playing || !src) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setLevels(IDLE_BARS);
      setLive(false);
      return;
    }

    ensureAnalyser();
    const ctx = ctxRef.current;
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});

    const tick = () => {
      const an = analyserRef.current;
      const data = dataRef.current;
      if (an && data) {
        (an as any).getByteFrequencyData(data);
        const step = data.length / BAR_COUNT;
        const next: number[] = [];
        let peak = 0;
        for (let i = 0; i < BAR_COUNT; i++) {
          const start = Math.floor(i * step);
          const end = Math.max(start + 1, Math.floor((i + 1) * step));
          let sum = 0;
          for (let j = start; j < end && j < data.length; j++) {
            sum += data[j];
            if (data[j] > peak) peak = data[j];
          }
          const avg = sum / (end - start); // 0–255
          next.push(Math.round(10 + (avg / 255) * 46)); // 10–56 px
        }
        setLevels(next);
        // "live" only when we really receive signal from the audio
        if (peak > 4) {
          lastSignalRef.current = Date.now();
          setLive(true);
        } else if (Date.now() - lastSignalRef.current > 1200) {
          setLive(false);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, src, ensureAnalyser]);

  // ── play / pause ──
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.play().catch(() => setPlaying(false));
    else a.pause();
  }, [playing]);

  // ── cleanup ──
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try {
        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
        ctxRef.current?.close();
      } catch {}
      ctxRef.current = null;
      analyserRef.current = null;
      dataRef.current = null;
      sourceRef.current = null;
    };
  }, []);

  const toggle = () => {
    // Warm up the analyser on the user gesture so playback starts with a live waveform
    ensureAnalyser();
    const ctx = ctxRef.current;
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    setPlaying((p) => !p);
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const newTime = (v / 100) * a.duration;
    a.currentTime = newTime;
    setProgress(v);
    setCurrent(newTime);
  };

  if (!src) {
    if (embedFallback) {
      return (
        <div className="bg-sand neu-inset rounded-[24px] overflow-hidden p-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-[18px] bg-black">
            <iframe
              src={embedFallback}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-3">
            <span className="text-ink-muted text-[0.72rem] font-medium">
              {provider === 'archive' ? 'Archive.org audio — embed fallback' : 'Embed player'}
            </span>
            {sourceUrl && (
              <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-ink-soft hover:text-rose text-[0.78rem] font-semibold">
                Open original ↗
              </a>
            )}
          </div>
          <p className="text-ink-muted px-2 pb-2 text-[0.72rem]">Direct streaming unavailable — showing the embedded player.</p>
        </div>
      );
    }
    return (
      <div className="bg-sand neu-inset rounded-[24px] p-8 text-center">
        <p className="text-ink-muted text-[0.9rem]">No audio source available.</p>
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-rose mt-3 inline-block font-semibold break-all">
            {sourceUrl}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="bg-cream neu-raised rounded-[28px] p-6 sm:p-8">
      <div className="flex items-center gap-4">
        <div className="bg-sand neu-inset-sm grid h-12 w-12 shrink-0 place-items-center rounded-2xl">
          <span className="text-olive-deep text-[0.72rem] font-extrabold tracking-[0.12em] uppercase">Audio</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-ink-muted text-[0.68rem] font-semibold tracking-[0.18em] uppercase">Now playing</p>
          <p className="font-display text-ink truncate text-[1.05rem] font-bold tracking-tight">{title}</p>
        </div>
        <span
          className={`hidden shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-[0.7rem] font-medium sm:flex ${live ? 'bg-rose/12 text-rose' : 'bg-sand text-ink-soft'}`}
          title={live ? 'Waveform follows the real audio signal' : 'Waveform starts as soon as the audio plays'}
          data-testid="waveform-status"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-rose animate-pulse' : 'bg-ink-muted/40'}`} />
          {live ? 'Live waveform' : 'Waveform'}
        </span>
        <span className="bg-sand text-ink-soft hidden rounded-full px-3 py-1.5 text-[0.7rem] font-medium sm:block">
          {provider === 'archive' ? 'Archive.org' : provider}
        </span>
      </div>

      {/* Waveform — heights come from the AnalyserNode while playing */}
      <div className="mt-7 flex h-16 items-end gap-[3px]" data-testid="waveform" aria-hidden="true">
        {levels.map((h, i) => {
          const isActive = (i / levels.length) * 100 < progress;
          return (
            <span
              key={i}
              data-testid="waveform-bar"
              style={{ height: `${h}px` }}
              className={`flex-1 rounded-full ${isActive ? 'bg-rose/85' : 'bg-olive/30'} ${playing ? 'transition-[height] duration-75 ease-out' : 'transition-colors duration-200'}`}
            />
          );
        })}
      </div>

      {/* Controls */}
      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={toggle}
          className="bg-sand neu-raised-sm text-rose grid h-14 w-14 shrink-0 place-items-center rounded-full transition-transform hover:scale-[1.04] active:scale-95"
          aria-label={playing ? 'Pause' : 'Play'}
          data-testid="audio-toggle"
        >
          <PlayIcon playing={playing} />
        </button>

        <div className="w-full">
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={onSeek}
            className="bg-sand neu-inset-sm h-2.5 w-full appearance-none rounded-full accent-rose"
            style={{ accentColor: '#cc3a63' }}
            aria-label="Seek"
          />
          <div className="text-ink-muted mt-2 flex justify-between text-[0.72rem] font-medium">
            <span>{formatTime(current)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* CORS-enabled element so the Web Audio API can read the real signal */}
      <audio ref={audioRef} src={src} crossOrigin="anonymous" preload="metadata" className="hidden" data-testid="audio-element" />

      <p className="text-ink-muted mt-4 text-[0.7rem]">
        Direct stream {provider === 'archive' ? 'via Archive.org' : ''} — the waveform moves in realtime with the audio signal (Web Audio API).
      </p>

      {resumedFrom !== null && (
        <p className="text-ink-muted mt-2 text-[0.7rem]" role="status" data-testid="resume-note">
          Resumed at {formatTime(resumedFrom)} — your last position for this audio on this device. It is stored in this browser only.
        </p>
      )}
    </div>
  );
}
