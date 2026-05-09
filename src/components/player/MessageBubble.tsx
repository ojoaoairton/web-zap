import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatMessage, ButtonOption } from '@/types/flow';
import { motion } from 'framer-motion';
import { FileText, Download, Copy, Check, Reply, ExternalLink, Mic, Play, Pause } from 'lucide-react';

interface MessageBubbleProps {
  msg: ChatMessage;
  buttonsActive: boolean;
  onButtonClick: (btn: ButtonOption) => void;
  userReplied?: boolean;
  theme?: string;
  isLastInGroup?: boolean;
  avatarUrl?: string;
  position?: 'single' | 'first' | 'middle' | 'last';
}

/** Detect if a video URL is YouTube or Google Drive embed */
const getVideoEmbed = (url: string): { type: 'iframe' | 'native'; src: string } => {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return { type: 'iframe', src: `https://www.youtube.com/embed/${ytMatch[1]}` };
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) return { type: 'iframe', src: `https://drive.google.com/file/d/${driveMatch[1]}/preview` };
  if (url.includes('/embed') || url.includes('/preview') || url.includes('iframe'))
    return { type: 'iframe', src: url };
  return { type: 'native', src: url };
};

function parseWhatsAppMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*[^*]+\*|_[^_]+_|~[^~]+~|`{3}[^`]+`{3})/g);
  return parts.map((part, i) => {
    if (part.startsWith('*') && part.endsWith('*')) return <strong key={i}>{part.slice(1, -1)}</strong>;
    if (part.startsWith('_') && part.endsWith('_')) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('~') && part.endsWith('~')) return <del key={i}>{part.slice(1, -1)}</del>;
    if (part.startsWith('```') && part.endsWith('```')) {
      return <code key={i} style={{ fontFamily: 'monospace', fontSize: '13px' }}>{part.slice(3, -3)}</code>;
    }
    return part;
  });
}

const MessageBubble = React.forwardRef<HTMLDivElement, MessageBubbleProps>(({ msg, buttonsActive, onButtonClick, userReplied, theme, isLastInGroup, avatarUrl, position }, ref) => {
  const isInstagram = theme === 'instagram';
  const isUser = msg.type === 'user';
  const showTail = theme !== 'instagram' && theme !== 'messenger';
  const igSentRadius = '18px';

  const getBorderRadius = () => {
    if (theme !== 'instagram' || msg.type !== 'bot') return '18px';
    switch(position) {
      case 'first': return '18px 18px 18px 4px';
      case 'middle': return '4px 18px 18px 4px';
      case 'last': return '4px 18px 18px 18px';
      default: return '18px';
    }
  };
  const igReceivedRadius = getBorderRadius();
  const showAvatar = theme === 'instagram' && msg.type === 'bot';
  const showAvatarImage = showAvatar && (position === 'single' || position === 'last');

  const renderAvatar = () => {
    if (!showAvatar) return null;
    return (
      <div style={{ flexShrink: 0, marginBottom: '2px', width: '28px' }}>
        {showAvatarImage && (
          avatarUrl ? (
            <img
              src={avatarUrl}
              alt="avatar"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                objectFit: 'cover'
              }}
            />
          ) : (
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: 'white'
            }}>
              🤖
            </div>
          )
        )}
      </div>
    );
  };
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState('0:00');

  const waveform = useMemo(() => {
    if (msg.messageType !== 'audio') return [];
    const str = msg.content || '';
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    let seed = h >>> 0;
    const next = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 4294967296;
    };
    return Array.from({ length: 35 }, () => Math.floor(4 + next() * (20 - 4)));
  }, [msg.messageType, msg.content]);

  const formatElapsed = useCallback((seconds: number) => {
    const total = Math.max(0, Math.floor(seconds));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, []);

  const TickIcon = () => userReplied ? (
    <svg width="18" height="11" viewBox="0 0 18 11" fill="none">
      <path d="M1 5.5L5 9.5L13 1.5" stroke="#53BDEB"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 5.5L9 9.5L17 1.5" stroke="#53BDEB"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ) : null;

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (msg.messageType !== 'audio') return;
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => setIsPlaying(false);
    el.addEventListener('ended', onEnded);
    return () => el.removeEventListener('ended', onEnded);
  }, [msg.messageType]);

  const togglePlay = useCallback(async () => {
    if (msg.messageType !== 'audio') return;
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      try {
        await el.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }, [msg.messageType]);

  const copyPixKey = useCallback(async () => {
    if (msg.messageType !== 'pix') return;
    const text = msg.pixData?.pixKey || '';
    if (!text) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        el.style.top = '0';
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 2000);
    }
  }, [msg.messageType, msg.pixData?.pixKey]);

  if (msg.messageType === 'buttons' && msg.buttons) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex justify-start"
        style={showAvatar ? { display: 'flex', alignItems: 'flex-end', gap: '8px', justifyContent: 'flex-start' } : undefined}
      >
        {renderAvatar()}
        <div
          className={`max-w-[80%] bg-[var(--bubble-received)] text-[var(--text-primary)] shadow-sm relative overflow-visible ${isInstagram ? '' : 'rounded-lg rounded-tl-sm'}`}
          style={isInstagram ? { borderRadius: igReceivedRadius } : undefined}
        >
          {showTail && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: '0px',
                left: '-8px',
                width: '0',
                height: '0',
                borderTop: '8px solid var(--bubble-received)',
                borderLeft: '8px solid transparent',
              }}
            />
          )}
          {position === 'last' && theme === 'instagram' && msg.type === 'bot' && (
            <div style={{
              position: 'absolute', left: '-6px', bottom: '8px', width: 0, height: 0,
              borderTop: '6px solid transparent', borderBottom: '0px solid transparent', borderRight: '6px solid var(--bubble-received)'
            }}/>
          )}
          <div className={`overflow-hidden ${isInstagram ? '' : 'rounded-lg rounded-tl-sm'}`} style={isInstagram ? { borderRadius: igReceivedRadius } : undefined}>
            <div className="px-3 py-2 text-[14.5px] leading-[19px]">
              {msg.content && (
                <>
                  <p className="whitespace-pre-wrap break-words py-0.5">
                    {parseWhatsAppMarkdown(msg.content)}
                  </p>
                  <div className="flex justify-end">
                    <span className="text-[11px] text-muted-foreground/50 mt-1 leading-none inline-flex items-center gap-1">
                      {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {isUser && <TickIcon />}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
              {msg.buttons.map((btn, idx) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => buttonsActive && onButtonClick(btn)}
                  disabled={!buttonsActive}
                  className={`w-full px-3 py-2 bg-transparent text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-75 ${
                    isInstagram ? 'text-[#3EA6FF]' : 'text-[#25D366]'
                  } ${
                    idx === 0 ? '' : 'border-t'
                  }`}
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <span className="w-full flex items-center justify-center gap-2">
                    <span className="shrink-0">
                      {(btn.type || 'flow') === 'link' ? <ExternalLink size={14} /> : <Reply size={14} />}
                    </span>
                    <span className="text-center">{btn.label}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (msg.messageType === 'recording') {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex justify-start"
        style={showAvatar ? { display: 'flex', alignItems: 'flex-end', gap: '8px', justifyContent: 'flex-start' } : undefined}
      >
        {renderAvatar()}
        <div
          className={`max-w-[80%] bg-[var(--bubble-received)] shadow-sm px-3 py-2 relative overflow-visible ${isInstagram ? '' : 'rounded-lg rounded-tl-sm'}`}
          style={isInstagram ? { borderRadius: igReceivedRadius } : undefined}
        >
          {showTail && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: '0px',
                left: '-8px',
                width: '0',
                height: '0',
                borderTop: '8px solid var(--bubble-received)',
                borderLeft: '8px solid transparent',
              }}
            />
          )}
          {position === 'last' && theme === 'instagram' && msg.type === 'bot' && (
            <div style={{
              position: 'absolute', left: '-6px', bottom: '8px', width: 0, height: 0,
              borderTop: '6px solid transparent', borderBottom: '0px solid transparent', borderRight: '6px solid var(--bubble-received)'
            }}/>
          )}
          <div className="flex items-center gap-2 text-[#25D366] text-sm font-medium">
            <Mic size={14} />
            <span>{msg.content}</span>
          </div>
        </div>
      </motion.div>
    );
  }

  if (msg.messageType === 'pix' && msg.pixData) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex justify-start"
        style={showAvatar ? { display: 'flex', alignItems: 'flex-end', gap: '8px', justifyContent: 'flex-start' } : undefined}
      >
        {renderAvatar()}
        <div
          className={`max-w-[80%] bg-[var(--bubble-received)] text-[var(--text-primary)] overflow-visible relative ${isInstagram ? '' : 'rounded-lg rounded-tl-sm'}`}
          style={isInstagram ? { borderRadius: igReceivedRadius } : undefined}
        >
          {showTail && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: '0px',
                left: '-8px',
                width: '0',
                height: '0',
                borderTop: '8px solid var(--bubble-received)',
                borderLeft: '8px solid transparent',
              }}
            />
          )}
          {position === 'last' && theme === 'instagram' && msg.type === 'bot' && (
            <div style={{
              position: 'absolute', left: '-6px', bottom: '8px', width: 0, height: 0,
              borderTop: '6px solid transparent', borderBottom: '0px solid transparent', borderRight: '6px solid var(--bubble-received)'
            }}/>
          )}
          <div className={`overflow-hidden ${isInstagram ? '' : 'rounded-lg rounded-tl-sm'}`} style={isInstagram ? { borderRadius: igReceivedRadius } : undefined}>
            <div className="px-3 py-2">
            <div className="flex items-start gap-2">
              <div style={{ backgroundColor: 'var(--pix-icon-bg)', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <img src="/pix-logo.png" alt="Pix" width="25" height="25" style={{ filter: 'brightness(0) saturate(100%) invert(52%) sepia(85%) saturate(400%) hue-rotate(120deg) brightness(90%)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight truncate">{msg.pixData.receiverName}</p>
                <p className="text-sm font-mono leading-tight mt-1 break-all" style={{ color: 'var(--text-secondary)' }}>{msg.pixData.pixKey}</p>
                <div className="flex justify-end">
                  <span className="text-[11px] text-muted-foreground/50 mt-1 leading-none inline-flex items-center gap-1">
                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {isUser && <TickIcon />}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={copyPixKey}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-transparent text-[#0da47d] border-t text-sm font-semibold"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <span className="shrink-0">{copied ? <Check size={14} /> : <Copy size={14} />}</span>
            <span>{copied ? 'Copiado!' : 'Copiar chave Pix'}</span>
          </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full`}
      style={showAvatar ? { display: 'flex', alignItems: 'flex-end', gap: '8px', justifyContent: 'flex-start' } : undefined}
    >
      {renderAvatar()}

      <div
        className={`max-w-[80%] px-3 py-2 text-[14.5px] leading-[19px] shadow-sm relative ${
          isInstagram
            ? (isUser
                ? 'bg-[var(--bubble-sent)] text-white mb-0'
                : 'bg-[var(--bubble-received)] text-[var(--text-primary)] mb-0')
            : (isUser
                ? 'bg-[var(--bubble-sent)] text-[var(--text-primary)] rounded-lg rounded-tr-sm'
                : 'bg-[var(--bubble-received)] text-[var(--text-primary)] rounded-lg rounded-tl-sm')
        }`}
        style={{
          ...(msg.messageType === 'audio' ? { minWidth: '280px', overflow: 'visible' } : { overflow: 'visible' }),
          ...(isInstagram ? { borderRadius: isUser ? igSentRadius : igReceivedRadius } : {}),
          ...(isInstagram && isUser ? { background: 'linear-gradient(180deg, #8D2EF2 0%, #5B55F5 100%)', color: '#ffffff' } : {}),
        }}
      >
        {showTail && (
          <div
            aria-hidden
            style={
              isUser
                ? {
                    position: 'absolute',
                    top: '0px',
                    right: '-8px',
                    width: '0',
                    height: '0',
                    borderTop: '8px solid var(--bubble-sent)',
                    borderRight: '8px solid transparent',
                  }
                : {
                    position: 'absolute',
                    top: '0px',
                    left: '-8px',
                    width: '0',
                    height: '0',
                    borderTop: '8px solid var(--bubble-received)',
                    borderLeft: '8px solid transparent',
                  }
            }
          />
        )}
        {position === 'last' && theme === 'instagram' && msg.type === 'bot' && (
          <div style={{
            position: 'absolute', left: '-6px', bottom: '8px', width: 0, height: 0,
            borderTop: '6px solid transparent', borderBottom: '0px solid transparent', borderRight: '6px solid var(--bubble-received)'
          }}/>
        )}
        {msg.messageType === 'text' && (
          <p className="whitespace-pre-wrap break-words py-0.5">
            {parseWhatsAppMarkdown(msg.content || '')}
          </p>
        )}

        {msg.messageType === 'image' && msg.content && (
          <img
            src={msg.content}
            alt="imagem"
            className="rounded-lg max-w-full"
            loading="lazy"
          />
        )}

        {msg.messageType === 'video' && msg.content && (() => {
          const v = getVideoEmbed(msg.content);
          return v.type === 'iframe' ? (
            <div className="aspect-video rounded-lg overflow-hidden max-w-[280px]">
              <iframe src={v.src} className="w-full h-full" allowFullScreen loading="lazy" />
            </div>
          ) : (
            <video
              src={v.src}
              controls
              className="rounded-lg max-w-full max-w-[280px]"
              preload="metadata"
            />
          );
        })()}

        {msg.messageType === 'audio' && msg.content && (
          <div className="space-y-1.5">
            {msg.forwarded && (
              <div className="flex items-center gap-1" style={{ color: 'var(--text-secondary)', fontSize: '12px', fontStyle: 'italic' }}>
                <span aria-hidden>↪</span>
                <span>Encaminhada</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="w-[42px] h-[42px] rounded-full bg-[#F97316] flex items-center justify-center shrink-0" style={{ alignSelf: 'center' }}>
                <Mic size={18} className="text-white" />
              </div>
              <button
                type="button"
                onClick={togglePlay}
                className="shrink-0"
                style={{ color: 'var(--text-secondary)', alignSelf: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {isPlaying ? <Pause size={16} className="block" /> : <Play size={16} className="block" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center">
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1.5px',
                    }}
                  >
                  {waveform.map((h, i) => {
                    const totalBars = waveform.length || 1;
                    const cutoff = Math.floor(progress * totalBars);
                    const played = i < cutoff;
                    return (
                      <div
                        key={i}
                        className="w-[2px] rounded-[2px]"
                        style={{
                          height: `${h}px`,
                          backgroundColor: played ? 'var(--audio-wave-played)' : 'var(--audio-wave-unplayed)',
                        }}
                      />
                    );
                  })}
                  <div
                    style={{
                      position: 'absolute',
                      left: `calc(${Math.max(0, Math.min(1, progress)) * 100}% - 5px)`,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: '#53BDEB',
                      transition: 'left 0.1s linear',
                    }}
                  />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {elapsed}
                  </span>
                  {!isInstagram && (
                    <span className="text-[11px] text-muted-foreground/50 leading-none inline-flex items-center gap-1">
                      {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {isUser && <TickIcon />}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <audio
              ref={audioRef}
              src={msg.content}
              preload="metadata"
              onTimeUpdate={(e) => {
                const audio = e.currentTarget;
                if (!audio.duration) return;
                const next = audio.currentTime / audio.duration;
                setProgress(Number.isFinite(next) ? next : 0);
                setElapsed(formatElapsed(audio.currentTime));
              }}
              onEnded={() => {
                setIsPlaying(false);
                setProgress(0);
                setElapsed('0:00');
              }}
            />
          </div>
        )}

        {msg.messageType === 'file' && (
          <div className="flex items-center gap-3 py-1.5 min-w-[180px]">
            <div className="w-9 h-9 rounded-lg bg-destructive/15 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{msg.fileName || 'Arquivo'}</p>
              {msg.fileSize && (
                <p className="text-[11px] text-muted-foreground/60">{msg.fileSize}</p>
              )}
            </div>
            <a
              href={msg.content}
              target="_blank"
              rel="noopener noreferrer"
              className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0 hover:bg-primary/25 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
            </a>
          </div>
        )}

        {!isInstagram && msg.messageType !== 'audio' && (
          <span className="text-[11px] text-muted-foreground/50 float-right ml-2 mt-1 leading-none inline-flex items-center gap-1">
            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            {isUser && <TickIcon />}
          </span>
        )}
      </div>

      {isInstagram && isLastInGroup && !isUser && (
        <div style={{ position: 'absolute', bottom: '-18px', left: '0', display: 'flex', width: '100%', justifyContent: 'flex-end', paddingRight: '8px' }}>
          <span className="text-[11px] text-[#737373]">
            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
    </motion.div>
  );
});
MessageBubble.displayName = 'MessageBubble';

export default React.memo(MessageBubble, (prev, next) => {
  return (
    prev.msg === next.msg &&
    prev.buttonsActive === next.buttonsActive &&
    prev.userReplied === next.userReplied &&
    prev.theme === next.theme &&
    prev.position === next.position
  );
});
