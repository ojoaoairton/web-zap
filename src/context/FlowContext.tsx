import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Flow, FlowBlock } from '@/types/flow';
import { v4 as uuid } from 'uuid';

interface FlowContextType {
  flow: Flow;
  setFlow: React.Dispatch<React.SetStateAction<Flow>>;
  addBlock: (type: FlowBlock['type']) => void;
  updateBlock: (id: string, updates: Partial<FlowBlock>) => void;
  removeBlock: (id: string) => void;
  moveBlock: (id: string, direction: 'up' | 'down') => void;
}

export const STORAGE_KEY = 'zaperflux_flow';

export const createDefaultFlow = (): Flow => ({
  id: crypto.randomUUID(),
  name: 'Meu Fluxo',
  theme: 'auto',
  contactName: '',
  avatarUrl: '',
  webhookUrl: '',
  webhookEnabled: false,
  pixelId: '',
  integrations: [],
  customScripts: [],
  blocks: [],
});

const defaultFlow: Flow = createDefaultFlow();

export const FlowContext = createContext<FlowContextType | null>(null);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const useFlow = () => {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error('useFlow must be inside FlowProvider');
  return ctx;
};

export const FlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [flow, setFlow] = useState<Flow>(() => {
    try {
      const savedFlow = localStorage.getItem(STORAGE_KEY);
      if (!savedFlow) return defaultFlow;
      return JSON.parse(savedFlow) as Flow;
    } catch {
      return defaultFlow;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...flow, slug: slugify(flow.name) }));
    } catch {
      return;
    }
  }, [flow]);

  const addBlock = useCallback((type: FlowBlock['type']) => {
    const newBlock: FlowBlock = { id: uuid(), type };
    switch (type) {
      case 'text': newBlock.content = ''; break;
      case 'image': newBlock.url = ''; break;
      case 'video': newBlock.url = ''; break;
      case 'audio': newBlock.url = ''; newBlock.transcription = ''; newBlock.duration = ''; newBlock.forwarded = false; break;
      case 'file': newBlock.url = ''; newBlock.fileName = ''; newBlock.fileSize = ''; break;
      case 'buttons': newBlock.content = ''; newBlock.buttons = []; break;
      case 'pix': newBlock.pixData = { receiverName: '', pixKey: '' }; break;
      case 'input': newBlock.inputType = 'texto'; newBlock.placeholder = ''; newBlock.variable = ''; break;
      case 'delay': newBlock.delayMs = 1500; break;
      case 'redirect': newBlock.url = ''; break;
    }
    setFlow(prev => {
      const blocks = [...prev.blocks];
      // wire previous block's next
      if (blocks.length > 0 && blocks[blocks.length - 1].type !== 'buttons') {
        blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], next: newBlock.id };
      }
      return { ...prev, blocks: [...blocks, newBlock] };
    });
  }, []);

  const updateBlock = useCallback((id: string, updates: Partial<FlowBlock>) => {
    setFlow(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => b.id === id ? { ...b, ...updates } : b),
    }));
  }, []);

  const removeBlock = useCallback((id: string) => {
    setFlow(prev => {
      const blocks = prev.blocks.filter(b => b.id !== id);

      const rewiredBlocks = blocks.map((block, i) => {
        if (block.type !== 'buttons' && i < blocks.length - 1) {
          const next = blocks[i + 1].id;
          if (block.next === next) return block;
          return { ...block, next };
        }
        return block;
      });

      return { ...prev, blocks: rewiredBlocks };
    });
  }, []);

  const moveBlock = useCallback((id: string, direction: 'up' | 'down') => {
    setFlow(prev => {
      const blocks = [...prev.blocks];
      const idx = blocks.findIndex(b => b.id === id);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= blocks.length) return prev;
      [blocks[idx], blocks[swapIdx]] = [blocks[swapIdx], blocks[idx]];

      const rewiredBlocks = blocks.map((block, i) => {
        if (block.type !== 'buttons') {
          const next = i < blocks.length - 1 ? blocks[i + 1].id : undefined;
          if (block.next === next) return block;
          return { ...block, next };
        }
        return block;
      });

      return { ...prev, blocks: rewiredBlocks };
    });
  }, []);

  return (
    <FlowContext.Provider value={{ flow, setFlow, addBlock, updateBlock, removeBlock, moveBlock }}>
      {children}
    </FlowContext.Provider>
  );
};
