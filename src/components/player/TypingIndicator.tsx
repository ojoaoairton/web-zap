import React from 'react';
import { motion } from 'framer-motion';

const TypingIndicator = React.forwardRef<HTMLDivElement>((_, ref) => (
  <motion.div
    ref={ref}
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -5 }}
    className="flex justify-start px-1"
  >
    <div className="bg-[var(--bubble-received)] rounded-lg rounded-tl-sm px-3 py-2.5 shadow-sm">
      <div className="flex gap-1">
        <div className="w-2 h-2 rounded-full typing-dot" style={{ background: 'var(--theme-primary)' }} />
        <div className="w-2 h-2 rounded-full typing-dot" style={{ background: 'var(--theme-primary)' }} />
        <div className="w-2 h-2 rounded-full typing-dot" style={{ background: 'var(--theme-primary)' }} />
      </div>
    </div>
  </motion.div>
));
TypingIndicator.displayName = 'TypingIndicator';

export default TypingIndicator;
