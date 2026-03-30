import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  transcription?: string;
  avatarUrl?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, transcription, avatarUrl }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); } else { a.play(); }
    setPlaying(!playing);
  }, [playing]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      setCurrentTime(a.currentTime);
      setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
    };
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd = () => { setPlaying(false); setProgress(0); setCurrentTime(0); };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, []);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    a.currentTime = pct * a.duration;
  };

  return (
    <div className="space-y-1.5">
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="flex items-center gap-2.5 min-w-[200px]">
        {/* Play/Pause */}
        <button
          onClick={toggle}
          className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 hover:bg-primary/30 transition-colors"
        >
          {playing
            ? <Pause className="w-3.5 h-3.5 text-primary" />
            : <Play className="w-3.5 h-3.5 text-primary ml-0.5" />
          }
        </button>

        {/* Progress */}
        <div className="flex-1 space-y-0.5">
          <div
            className="h-1 bg-muted rounded-full cursor-pointer relative overflow-hidden"
            onClick={handleSeek}
          >
            <div
              className="absolute inset-y-0 left-0 bg-primary/60 rounded-full transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground/60 tabular-nums">
            <span>{formatTime(currentTime)}</span>
            <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
          </div>
        </div>

        {/* Avatar */}
        {avatarUrl ? (
          <img src={avatarUrl} alt="avatar" className="w-7 h-7 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <span className="text-[10px] text-primary font-medium">🎙️</span>
          </div>
        )}
      </div>

      {transcription && (
        <p className="text-[12px] text-muted-foreground/70 leading-tight italic px-1">
          {transcription}
        </p>
      )}
    </div>
  );
};

export default AudioPlayer;
