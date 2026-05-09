import React from 'react';
import { motion } from 'framer-motion';

interface TypingIndicatorProps {
  theme?: string;
  avatarUrl?: string;
}

const TypingIndicator = React.forwardRef<HTMLDivElement, TypingIndicatorProps>(({ theme, avatarUrl }, ref) => {
  const showAvatar = theme === 'instagram';

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="flex justify-start px-1 w-full"
      style={showAvatar ? { display: 'flex', alignItems: 'flex-end', gap: '8px', justifyContent: 'flex-start' } : undefined}
    >
      {showAvatar && (
        <div style={{ flexShrink: 0, marginBottom: '2px' }}>
          {avatarUrl ? (
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
          )}
        </div>
      )}

      <div className={`bg-[var(--bubble-received)] shadow-sm px-3 py-2.5 ${theme === 'instagram' ? '' : 'rounded-lg rounded-tl-sm'}`} style={theme === 'instagram' ? { borderRadius: '18px' } : undefined}>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full typing-dot" style={{ background: theme === 'instagram' ? 'rgba(255,255,255,0.4)' : 'var(--theme-primary)' }} />
          <div className="w-2 h-2 rounded-full typing-dot" style={{ background: theme === 'instagram' ? 'rgba(255,255,255,0.4)' : 'var(--theme-primary)' }} />
          <div className="w-2 h-2 rounded-full typing-dot" style={{ background: theme === 'instagram' ? 'rgba(255,255,255,0.4)' : 'var(--theme-primary)' }} />
        </div>
      </div>
    </motion.div>
  );
});
TypingIndicator.displayName = 'TypingIndicator';

export default TypingIndicator;
