import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { FlowContext } from '@/context/FlowContext';
import { ChatMessage, Flow, FlowBlock, ButtonOption } from '@/types/flow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, RotateCcw, Bot, Smile, Play, ArrowLeft, Phone, Video, PlusCircle, Camera, Mic, Image, MessageCircle, Plus, Search } from 'lucide-react';
import { unlockAudio, playMessageSound } from '@/lib/messageSound';
import { v4 as uuid } from 'uuid';
import { AnimatePresence } from 'framer-motion';
import seloVerificado from '@/assets/selo_verificado.png';
import { PATTERN_BASE64 } from '@/assets/pattern';
import { normalizeInput } from '@/lib/textNormalize';
import { initPixel, trackEvent } from '@/lib/metaPixel';
import { captureUtmParams } from '@/lib/utm';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { trackPresence } from '@/lib/presence';
import { buildWebhookPayload, sendWebhook } from '@/lib/webhook';
import { saveSession, loadSession, clearSession, ChatSession } from '@/lib/chatPersistence';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import ExitModal from './ExitModal';

declare global {
  interface Window {
    onCheckoutClick?: (data: {
      url: string;
      label: string;
      fbp: string | null;
      fbc: string | null;
      pageUrl: string;
    }) => void;
  }
}

interface ChatPlayerProps {
  isPreview?: boolean;
  flow?: Flow;
}

const emptyFlow: Flow = {
  id: '',
  name: '',
  theme: 'auto',
  blocks: [],
  integrations: [],
  customScripts: [],
};

const getMessagePosition = (messages: ChatMessage[], index: number) => {
  const current = messages[index];
  const prev = messages[index - 1];
  const next = messages[index + 1];
  
  if (current.type !== 'bot') return 'single';
  
  const prevIsBot = prev?.type === 'bot';
  const nextIsBot = next?.type === 'bot';
  
  if (!prevIsBot && !nextIsBot) return 'single';
  if (!prevIsBot && nextIsBot) return 'first';
  if (prevIsBot && nextIsBot) return 'middle';
  if (prevIsBot && !nextIsBot) return 'last';
  return 'single';
};

const formatSeparator = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return `HOJE, ${date.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}`;
  if (days === 1) return `ONTEM, ${date.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}`;
  
  const weekdays = ['DOM.','SEG.','TER.','QUA.','QUI.','SEX.','SÁB.'];
  if (days < 7) return `${weekdays[date.getDay()]}, ${date.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}`;
  
  return date.toLocaleDateString('pt-BR', {
    day:'2-digit', month:'short'
  }).toUpperCase() + `, ${date.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}`;
};

const ChatPlayer: React.FC<ChatPlayerProps> = ({ isPreview, flow: flowProp }) => {
  const ctx = useContext(FlowContext);
  const hasFlow = Boolean(flowProp ?? ctx?.flow);
  const flow = flowProp ?? ctx?.flow ?? emptyFlow;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [inputEnabled, setInputEnabled] = useState(false);
  const [currentInputBlock, setCurrentInputBlock] = useState<FlowBlock | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [buttonsBlockId, setButtonsBlockId] = useState<string | null>(null);
  const [buttonsMessageId, setButtonsMessageId] = useState<string | null>(null);
  const [userReplied, setUserReplied] = useState(false);
  const [chatStarted, setChatStarted] = useState(() => !isPreview);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSavedChat, setHasSavedChat] = useState(false);
  const savedSessionRef = useRef<ChatSession | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);
  const varsRef = useRef<Record<string, string>>({});
  const flowStarted = useRef(false);
  const currentBlockIdRef = useRef<string | undefined>(undefined);
  const buttonsClickLockedRef = useRef(false);
  const sessionIdRef = useRef(uuid());

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  const replaceVars = useCallback((text: string) => {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => varsRef.current[key] || `{{${key}}}`);
  }, []);

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id'>) => {
    const newMsg = { ...msg, id: uuid(), timestamp: Date.now() };
    setMessages(prev => {
      const next = [...prev, newMsg];
      messagesRef.current = next;
      return next;
    });
    // Instagram DM não tem som de notificação
    if (msg.type === 'bot' && msg.messageType !== 'recording') {
      playMessageSound(flow.theme);
    }
    return newMsg;
  }, [flow.theme]);

  const normalizeRestoredMessages = useCallback((msgs: ChatMessage[]) => {
    const out: ChatMessage[] = [];
    for (let i = 0; i < msgs.length; i++) {
      const cur = msgs[i];
      const next = msgs[i + 1];
      if (
        cur?.type === 'bot' &&
        cur.messageType === 'text' &&
        next?.type === 'bot' &&
        next.messageType === 'buttons' &&
        (!next.content || !next.content.trim())
      ) {
        out.push({ ...next, content: cur.content });
        i++;
        continue;
      }
      out.push(cur);
    }
    return out;
  }, []);

  // Sync messagesRef when messages change externally (e.g., handleContinue)
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Persist session whenever messages or variables change
  useEffect(() => {
    if (messages.length === 0) return;
    
    let nextBlockId: string | undefined;
    const currentBlock = flow.blocks.find(b => b.id === currentBlockIdRef.current);
    if (currentBlock) {
      if (currentBlock.type === 'input' || currentBlock.type === 'buttons' || currentBlock.type === 'pix') {
        nextBlockId = currentBlock.id;
      } else {
        nextBlockId = currentBlock.next;
      }
    }

    const session: ChatSession = {
      flowId: flow.id,
      currentBlockId: currentBlockIdRef.current,
      nextBlockId: nextBlockId,
      messages,
      variables: varsRef.current,
      timestamp: Date.now(),
      completed: !isRunning,
    };
    saveSession(session);
  }, [messages, flow.id, isRunning, flow.blocks]);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  function calcTypingDelay(text: string): number {
    return Math.min(Math.max((text.length / 80) * 1000, 1000), 6000);
  }

  const processBlock = useCallback(async (block: FlowBlock): Promise<string | undefined> => {
    if (abortRef.current) return undefined;
    currentBlockIdRef.current = block.id;

    switch (block.type) {
      case 'text': {
        const content = replaceVars(block.content || '');
        const delayMs = block.delayMs && block.delayMs > 0 ? block.delayMs : calcTypingDelay(content);
        setIsTyping(true);
        scrollToBottom();
        await sleep(delayMs);
        if (abortRef.current) return undefined;
        setIsTyping(false);
        addMessage({ type: 'bot', content, messageType: 'text' });
        scrollToBottom();
        await sleep(300);
        return block.next;
      }
      case 'image': {
        setIsTyping(true);
        scrollToBottom();
        await sleep(1500);
        if (abortRef.current) return undefined;
        setIsTyping(false);
        addMessage({ type: 'bot', content: block.url || '', messageType: 'image' });
        scrollToBottom();
        await sleep(400);
        return block.next;
      }
      case 'video': {
        setIsTyping(true);
        scrollToBottom();
        await sleep(1500);
        if (abortRef.current) return undefined;
        setIsTyping(false);
        addMessage({ type: 'bot', content: block.url || '', messageType: 'video' });
        scrollToBottom();
        await sleep(400);
        return block.next;
      }
      case 'audio': {
        if (!block.forwarded) {
          const recordingMsg = addMessage({ type: 'bot', content: 'Gravando áudio...', messageType: 'recording' });
          scrollToBottom();
          await sleep(2000);
          if (abortRef.current) return undefined;
          setMessages(prev => prev.filter(m => m.id !== recordingMsg.id));
        }
        addMessage({
          type: 'bot',
          content: block.url || '',
          messageType: 'audio',
          transcription: block.transcription,
          duration: block.duration,
          forwarded: block.forwarded,
        });
        scrollToBottom();
        await sleep(400);
        return block.next;
      }
      case 'file': {
        setIsTyping(true);
        scrollToBottom();
        await sleep(1500);
        if (abortRef.current) return undefined;
        setIsTyping(false);
        addMessage({
          type: 'bot',
          content: block.url || '',
          messageType: 'file',
          fileName: block.fileName || 'Arquivo',
          fileSize: block.fileSize,
        });
        scrollToBottom();
        await sleep(400);
        return block.next;
      }
      case 'delay': {
        setIsTyping(true);
        scrollToBottom();
        await sleep(block.delayMs || 1500);
        if (abortRef.current) return undefined;
        setIsTyping(false);
        return block.next;
      }
      case 'input': {
        if (block.content) {
          const content = replaceVars(block.content);
          const isDuplicate = messagesRef.current.some(m => m.type === 'bot' && m.messageType === 'text' && m.content === content);
          if (!isDuplicate) {
            const delayMs = block.delayMs && block.delayMs > 0 ? block.delayMs : calcTypingDelay(content);
            setIsTyping(true);
            scrollToBottom();
            await sleep(delayMs);
            if (abortRef.current) return undefined;
            setIsTyping(false);
            addMessage({ type: 'bot', content, messageType: 'text' });
            scrollToBottom();
            await sleep(300);
          }
        }
        return new Promise((resolve) => {
          setCurrentInputBlock(block);
          setInputEnabled(true);
          setInputValue('');
          setIsSubmitting(false);
          scrollToBottom();
          setTimeout(() => inputRef.current?.focus(), 150);

          const handler: EventListener = (event) => {
            window.removeEventListener('chat-input-submit', handler);
            resolve((event as CustomEvent<{ value: string; next?: string }>).detail.next);
          };
          window.addEventListener('chat-input-submit', handler);
        });
      }
      case 'buttons': {
        const content = replaceVars(block.content || '');
        const isDuplicateMsg = content && messagesRef.current.some(m => m.type === 'bot' && m.messageType === 'buttons' && m.content === content);
        
        if (!isDuplicateMsg) {
          const delayMs = block.delayMs && block.delayMs > 0
            ? block.delayMs
            : content
              ? calcTypingDelay(content)
              : 1500;
          setIsTyping(true);
          scrollToBottom();
          await sleep(delayMs);
          if (abortRef.current) return undefined;
          setIsTyping(false);
        }
        
        return new Promise((resolve) => {
          buttonsClickLockedRef.current = false;
          setButtonsBlockId(block.id);
          if (!isDuplicateMsg) {
            const buttonsMsg = addMessage({ type: 'bot', content, messageType: 'buttons', buttons: block.buttons });
            setButtonsMessageId(buttonsMsg.id);
            scrollToBottom();
          } else {
            // Se já tem duplicado, só atualiza state das buttons pra reativá-las
            const existingBtnMsg = [...messagesRef.current].reverse().find(m => m.type === 'bot' && m.messageType === 'buttons' && m.content === content);
            if (existingBtnMsg) setButtonsMessageId(existingBtnMsg.id);
          }

          const handler: EventListener = (event) => {
            window.removeEventListener('chat-button-click', handler);
            setButtonsBlockId(null);
            setButtonsMessageId(null);
            resolve((event as CustomEvent<{ next: string }>).detail.next);
          };
          window.addEventListener('chat-button-click', handler);
        });
      }
      case 'pix': {
        const isDuplicatePix = messagesRef.current.some(m => m.type === 'bot' && m.messageType === 'pix' && m.pixData?.pixKey === block.pixData?.pixKey);
        
        if (!isDuplicatePix) {
          setIsTyping(true);
          scrollToBottom();
          await sleep(1500);
          if (abortRef.current) return undefined;
          setIsTyping(false);
          addMessage({
            type: 'bot',
            content: '',
            messageType: 'pix',
            pixData: block.pixData,
          });
          scrollToBottom();
          await sleep(300);
        }
        return block.next;
      }
      case 'redirect': {
        addMessage({ type: 'bot', content: `🔗 Redirecionando para ${block.url}...`, messageType: 'text' });
        scrollToBottom();
        await sleep(1500);
        if (block.url) window.open(block.url, '_blank');
        return block.next;
      }
      default:
        return block.next;
    }
  }, [addMessage, replaceVars, scrollToBottom]);

  const runFlow = useCallback(async (startFromBlockId?: string) => {
    if (flow.blocks.length === 0) return;
    abortRef.current = false;
    setIsRunning(true);

    if (!startFromBlockId) {
      setMessages([]);
      setVariables({});
      varsRef.current = {};
      setUserReplied(false);
    }

    setInputEnabled(false);
    setButtonsBlockId(null);
    setCurrentInputBlock(null);
    setIsSubmitting(false);

    const metaIntegration = flow.integrations?.find(i => i.type === 'meta' && i.value.trim());
    if (metaIntegration?.value) initPixel(metaIntegration.value);
    else if (flow.pixelId) initPixel(flow.pixelId);
    captureUtmParams();

    let currentId: string | undefined = startFromBlockId || flow.blocks[0].id;

    while (currentId && !abortRef.current) {
      const block = flow.blocks.find(b => b.id === currentId);
      if (!block) break;
      currentId = await processBlock(block);
    }

    if (flow.webhookUrl && flow.webhookEnabled !== false && !abortRef.current) {
      const { getUtmParams } = await import('@/lib/utm');
      const payload = buildWebhookPayload(varsRef.current, getUtmParams());
      sendWebhook(flow.webhookUrl, payload);
    }

    if (!currentId && !abortRef.current && flow.blocks.length > 0 && !isPreview) {
      trackAnalyticsEvent(flow.id, flow.name, { type: 'reached_cta', timestamp: new Date().toISOString(), sessionId: sessionIdRef.current });
      clearSession();
    }

    setIsRunning(false);
    setIsTyping(false);
  }, [flow, processBlock, isPreview]);

  const startChat = useCallback(() => {
    setChatStarted(true);
  }, []);

  // Start or restore session only after user hits Play
  useEffect(() => {
    if (!chatStarted) return;
    if (flowStarted.current) return;
    if (flow.blocks.length === 0) return;
    flowStarted.current = true;
    
    if (!isPreview) {
      trackAnalyticsEvent(flow.id, flow.name, { type: 'view', timestamp: new Date().toISOString(), sessionId: sessionIdRef.current });
    }

    const saved = loadSession(flow.id);
    if (saved && !saved.completed && saved.currentBlockId && saved.messages?.length > 0) {
      savedSessionRef.current = saved;
      setHasSavedChat(true);
      return;
    }

    const timer = setTimeout(() => runFlow(), 800);
    return () => clearTimeout(timer);
  }, [chatStarted, runFlow, flow.id, flow.blocks.length, normalizeRestoredMessages, isPreview]);

  // Track Realtime Presence
  useEffect(() => {
    if (!isPreview && flow.id) {
      const cleanup = trackPresence(flow.id);
      return cleanup;
    }
  }, [isPreview, flow.id]);

  const handleInputSubmit = useCallback(() => {
    if (!inputValue.trim() || !currentInputBlock || isSubmitting) return;

    setIsSubmitting(true);
    setInputEnabled(false);

    const normalized = normalizeInput(inputValue.trim(), currentInputBlock.inputType);

    if (currentInputBlock.variable) {
      varsRef.current[currentInputBlock.variable] = normalized;
      setVariables(prev => ({ ...prev, [currentInputBlock.variable!]: normalized }));
    }

    setUserReplied(true);
    addMessage({ type: 'user', content: normalized, messageType: 'text' });
    scrollToBottom();

    trackEvent('Lead', { variable: currentInputBlock.variable, value: normalized });
    if (!isPreview) {
      trackAnalyticsEvent(flow.id, flow.name, { type: 'input_submit', timestamp: new Date().toISOString(), sessionId: sessionIdRef.current });
    }

    const next = currentInputBlock.next;
    setCurrentInputBlock(null);
    setInputValue('');

    window.dispatchEvent(new CustomEvent('chat-input-submit', { detail: { value: normalized, next } }));
  }, [inputValue, currentInputBlock, isSubmitting, addMessage, scrollToBottom]);

  const handleButtonClick = useCallback(async (btn: ButtonOption) => {
    if (!buttonsBlockId) return;
    if (buttonsClickLockedRef.current) return;
    buttonsClickLockedRef.current = true;
    console.log('Botão clicado:', btn.label, 'next:', btn.next);
    setUserReplied(true);
    setButtonsBlockId(null);
    setButtonsMessageId(null);

    addMessage({ type: 'user', content: btn.label, messageType: 'text' });
    scrollToBottom();

    if (btn.type === 'link' && btn.url) {
      const currentParams = new URLSearchParams(window.location.search);
      const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'sck', 'src'];
      const targetUrl = new URL(btn.url);
      utmParams.forEach(param => {
        const value = currentParams.get(param);
        if (value) targetUrl.searchParams.set(param, value);
      });

      if (typeof window !== 'undefined' && typeof window.onCheckoutClick === 'function') {
        window.onCheckoutClick({
          url: targetUrl.toString(),
          label: btn.label,
          fbp: document.cookie.match(/_fbp=([^;]+)/)?.[1] || null,
          fbc: document.cookie.match(/_fbc=([^;]+)/)?.[1] || null,
          pageUrl: window.location.href
        });
      }

      await new Promise(resolve => setTimeout(resolve, 300));
      window.open(targetUrl.toString(), btn.target || '_blank');
    }

    if (btn.trackEvent) {
      trackEvent(btn.trackEvent, { label: btn.label });
    }
    if (!isPreview) {
      trackAnalyticsEvent(flow.id, flow.name, { type: 'button_click', label: btn.label, timestamp: new Date().toISOString(), sessionId: sessionIdRef.current });
    }

    if (btn.type !== 'link') {
      await new Promise<void>(r => setTimeout(r, 1500));
    }
    const parentNext = flow.blocks.find(b => b.id === buttonsBlockId)?.next;
    const next = btn.next || parentNext || '';
    window.dispatchEvent(new CustomEvent('chat-button-click', { detail: { next } }));
  }, [buttonsBlockId, addMessage, flow.blocks, scrollToBottom]);

  const handleContinue = useCallback(() => {
    const saved = savedSessionRef.current;
    if (!saved) return;
    setMessages(normalizeRestoredMessages(saved.messages));
    varsRef.current = saved.variables;
    setVariables(saved.variables);
    setHasSavedChat(false);
    savedSessionRef.current = null;
    
    // Só retomar se o currentBlockId salvo ainda tem 
    // próximo bloco a processar — não reprocessar o atual
    const nextBlockId = saved.nextBlockId; // bloco APÓS o atual
    if (nextBlockId) {
      setTimeout(() => runFlow(nextBlockId), 500);
    }
  }, [normalizeRestoredMessages, runFlow]);

  const handleRestart = useCallback(() => {
    clearSession();
    savedSessionRef.current = null;
    setHasSavedChat(false);
    setMessages([]);
    setVariables({});
    varsRef.current = {};
    setTimeout(() => runFlow(), 800);
  }, [runFlow]);

  const reset = useCallback(() => {
    abortRef.current = true;
    flowStarted.current = false;
    clearSession();
    setMessages([]);
    setVariables({});
    varsRef.current = {};
    setInputEnabled(false);
    setButtonsBlockId(null);
    setButtonsMessageId(null);
    setIsTyping(false);
    setIsRunning(false);
    setCurrentInputBlock(null);
    setIsSubmitting(false);
    setUserReplied(false);
    setInputValue('');
    setHasSavedChat(false);
    savedSessionRef.current = null;
    setChatStarted(!isPreview);
  }, [isPreview]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  const dataTheme = flow.theme === 'auto' ? undefined : flow.theme;
  const isMessagingTheme = flow.theme === 'instagram' || flow.theme === 'messenger';

  if (!hasFlow) return null;

  return (
    <div
      className="chat-theme h-full w-full flex flex-col overflow-hidden"
      data-theme={dataTheme}
      style={{
        backgroundImage: isMessagingTheme
          ? 'none'
          : `linear-gradient(var(--bg-overlay, rgba(11,20,26,0.85)), var(--bg-overlay, rgba(11,20,26,0.85))), url("${PATTERN_BASE64}")`,
        backgroundColor: isMessagingTheme ? 'var(--bg-overlay)' : undefined,
        backgroundRepeat: isMessagingTheme ? undefined : 'repeat',
        backgroundSize: isMessagingTheme ? undefined : '400px auto',
        backgroundPosition: isMessagingTheme ? undefined : 'top left',
        color: 'var(--text-primary)',
      }}
      onClick={() => unlockAudio(flow.theme)}
    >
        {/* Header */}
      <div className={`sticky top-0 z-[60] bg-[var(--header-bg)] border-b px-4 py-2.5 flex items-center justify-between shrink-0 ${isMessagingTheme ? 'border-[var(--color-border)]' : 'border-border/50'}`}>
        <div className="flex items-center gap-3">
          {isMessagingTheme && (
            <ArrowLeft className="w-6 h-6 text-[var(--text-primary)] shrink-0" />
          )}
          {flow.avatarUrl ? (
            isMessagingTheme ? (
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: '2px solid transparent',
                  backgroundImage: flow.theme === 'instagram'
                    ? 'linear-gradient(white,white), linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)'
                    : 'none',
                  backgroundOrigin: 'border-box',
                  backgroundClip: flow.theme === 'instagram' 
                    ? 'padding-box, border-box' 
                    : 'border-box',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <img src={flow.avatarUrl} alt="avatar" style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: flow.theme === 'instagram' ? '2px solid var(--header-bg)' : 'none',
                }} />
              </div>
            ) : (
              <img src={flow.avatarUrl} alt="avatar" className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/10 shrink-0" />
            )
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-primary/10 shrink-0">
              <Bot className="w-5 h-5 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h3 className={`text-sm leading-tight text-[var(--text-primary)] truncate ${isMessagingTheme ? 'font-bold' : 'font-semibold'}`}>{flow.contactName || flow.name}</h3>
              <img src={seloVerificado} alt="Verificado" className="w-[14px] h-[14px] shrink-0" />
            </div>
            <p className={`text-[12px] leading-tight mt-0.5 truncate ${isMessagingTheme ? 'font-medium' : ''}`} style={{ color: flow.theme === 'instagram' && isTyping ? '#8D2EF2' : (isMessagingTheme ? 'var(--text-secondary)' : 'var(--theme-primary)') }}>
              {isTyping ? 'digitando...' : isRunning ? (isMessagingTheme ? 'Online agora' : 'online') : (isMessagingTheme ? 'Online agora' : 'offline')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5 ml-2">
          {isMessagingTheme ? (
            <>
              <PlusCircle className="w-[26px] h-[26px] text-[var(--text-primary)] shrink-0 stroke-[1.5]" />
              <Phone className="w-[26px] h-[26px] text-[var(--text-primary)] shrink-0 stroke-[1.5]" />
              <Video className="w-[26px] h-[26px] text-[var(--text-primary)] shrink-0 stroke-[1.5]" />
            </>
          ) : (
            isPreview === true && (
              <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground hover:text-foreground h-8 px-2.5">
                <RotateCcw className="w-4 h-4" />
              </Button>
            )
          )}
        </div>
      </div>

      {(!isPreview || chatStarted) ? (
        <>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin bg-transparent px-3 py-3 space-y-2">
            {/* Business account banner or Profile Intro */}
            {flow.theme === 'instagram' ? (
              <>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '24px 16px 16px',
                  gap: '8px'
                }}>
                  {/* Foto circular */}
                  {flow.avatarUrl ? (
                    <img src={flow.avatarUrl} style={{
                      width: '72px', height: '72px',
                      borderRadius: '50%', objectFit: 'cover'
                    }}/>
                  ) : (
                    <div style={{
                      width: '72px', height: '72px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '28px'
                    }}>🤖</div>
                  )}

                  {/* Nome */}
                  <span style={{
                    color: '#F1F1F3', fontSize: '16px',
                    fontWeight: 600, textAlign: 'center'
                  }}>
                    {flow.contactName || flow.name}
                  </span>

                  {/* Saiba mais */}
                  <span style={{
                    color: '#3EA6FF', fontSize: '12px',
                    cursor: 'pointer', textAlign: 'center'
                  }}>
                    Saiba mais sobre as conversas comerciais
                  </span>
                </div>
                
                {/* Separador de Data */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  margin: '8px 0'
                }}>
                  <span style={{
                    fontSize: '12px',
                    color: '#8E93A1',
                    fontWeight: 500,
                    letterSpacing: '0.3px'
                  }}>
                    {formatSeparator(messages.length > 0 && messages[0].timestamp ? new Date(messages[0].timestamp) : new Date())}
                  </span>
                </div>

                {/* Texto do Anúncio */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  padding: '0 24px'
                }}>
                  <span style={{
                    fontSize: '11px',
                    color: '#8E93A1',
                    textAlign: 'center',
                    lineHeight: '1.4'
                  }}>
                    Você abriu esta conversa por meio de um anúncio.{' '}
                    <span style={{ color: '#3EA6FF', cursor: 'pointer' }}>
                      Ver anúncio
                    </span>
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-center mb-2">
                <span
                  className="text-[11px] text-muted-foreground/70 bg-transparent rounded-md shadow-sm"
                  style={{
                    backgroundColor: 'var(--commercial-bg)',
                    borderRadius: '8px',
                    padding: '4px 12px',
                    backdropFilter: 'blur(4px)',
                    display: 'inline-block',
                  }}
                >
                  Esta é uma conta comercial. <span className="text-primary/80">Toque para saber mais</span>
                </span>
              </div>
            )}
            <AnimatePresence mode="popLayout">
              {messages.map((msg, index) => {
                const prevMsg = messages[index - 1];
                const nextMsg = messages[index + 1];
                const isLastInGroup = !nextMsg || nextMsg.type !== msg.type;
                
                let showSeparator = false;
                if (flow.theme === 'instagram' && msg.timestamp) {
                  if (!prevMsg) {
                    showSeparator = false;
                  } else if (prevMsg.timestamp) {
                    const diff = msg.timestamp - prevMsg.timestamp;
                    const msgDate = new Date(msg.timestamp);
                    const prevDate = new Date(prevMsg.timestamp);
                    if (diff > 1000 * 60 * 60 || msgDate.getDate() !== prevDate.getDate() || msgDate.getMonth() !== prevDate.getMonth()) {
                      showSeparator = true;
                    }
                  }
                }


                const position = flow.theme === 'instagram' ? getMessagePosition(messages, index) : undefined;

                return (
                  <React.Fragment key={msg.id}>
                    {showSeparator && msg.timestamp && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        margin: '12px 0',
                      }}>
                        <span style={{
                          fontSize: '12px',
                          color: '#8E93A1',
                          fontWeight: 500,
                          letterSpacing: '0.3px',
                        }}>
                          {formatSeparator(new Date(msg.timestamp))}
                        </span>
                      </div>
                    )}
                    <div style={{ marginTop: (flow.theme === 'instagram' && (position === 'middle' || position === 'last') && !showSeparator) ? '2px' : undefined }}>
                      <MessageBubble
                        msg={msg}
                        buttonsActive={buttonsBlockId !== null}
                        onButtonClick={handleButtonClick}
                        userReplied={userReplied}
                        theme={flow.theme}
                        isLastInGroup={isLastInGroup}
                        avatarUrl={flow.avatarUrl}
                        position={position}
                      />
                    </div>
                  </React.Fragment>
                );
              })}
              {isTyping && <TypingIndicator key="typing" theme={flow.theme} avatarUrl={flow.avatarUrl} />}
            </AnimatePresence>
          </div>

          {/* Input bar */}
          <div
            className={`border-t px-2 py-2 shrink-0 ${isMessagingTheme ? '' : 'bg-[var(--header-bg)] border-border/50'}`}
            style={isMessagingTheme ? { background: 'var(--header-bg)', borderColor: 'var(--input-border, var(--color-border))' } : undefined}
          >
            <form
              onSubmit={e => { e.preventDefault(); handleInputSubmit(); }}
              className={`flex items-center ${flow.theme === 'instagram' ? '' : 'gap-2'}`}
            >
              {flow.theme === 'instagram' ? (
                <div style={{
                  borderRadius: '28px',
                  background: 'rgba(24,26,34,0.88)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  padding: '6px 8px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  width: '100%'
                }}>
                  {inputEnabled ? (
                    <div className="w-[36px] h-[36px] flex items-center justify-center shrink-0">
                      <Search size={18} color="#F3F3F5" />
                    </div>
                  ) : (
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: 'linear-gradient(180deg, #8D2EF2 0%, #6F47F7 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <Camera size={18} color="#F4F4F7" />
                    </div>
                  )}

                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    disabled={!inputEnabled || isSubmitting}
                    placeholder={
                      inputEnabled
                        ? (currentInputBlock?.placeholder || 'Mensagem...')
                        : 'Aguardando...'
                    }
                    className="flex-1 bg-transparent border-0 shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-9 text-sm text-[#F5F5F7] disabled:opacity-30 px-0 placeholder:text-[#A9A9B2]"
                    style={{ caretColor: '#8A47FF', fontSize: flow.theme === 'instagram' ? '16px' : undefined }}
                  />

                  {inputEnabled ? (
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: 'linear-gradient(180deg, #7A4CFA 0%, #6F47F7 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      cursor: 'pointer'
                    }} onClick={handleInputSubmit}>
                      <Send size={16} color="#F5F5F7" />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: '8px', flexShrink: 0, overflow: 'visible' }}>
                      <Mic size={22} color="#F3F3F5" style={{ flexShrink: 0, minWidth: '22px' }} />
                      <Image size={22} color="#F3F3F5" style={{ flexShrink: 0, minWidth: '22px' }} />
                      <MessageCircle size={22} color="#F3F3F5" style={{ flexShrink: 0, minWidth: '22px' }} />
                      <Plus size={22} color="#F3F3F5" style={{ flexShrink: 0, minWidth: '22px' }} />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div
                    className={`flex-1 flex items-center rounded-full px-4 py-1 ${isMessagingTheme ? '' : 'bg-[var(--input-bg)]'}`}
                    style={isMessagingTheme ? { background: 'var(--input-bg)', border: '1px solid var(--input-border, #363636)' } : undefined}
                  >
                    {isMessagingTheme ? (
                      <div className="w-8 h-8 rounded-full bg-transparent flex items-center justify-center shrink-0 mr-2">
                        <Camera className="w-[22px] h-[22px] text-[#8D2EF2]" />
                      </div>
                    ) : (
                      <Smile className="w-5 h-5 text-muted-foreground/40 shrink-0 mr-2" />
                    )}
                    <Input
                      ref={inputRef}
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      disabled={!inputEnabled || isSubmitting}
                      placeholder={
                        inputEnabled
                          ? (currentInputBlock?.placeholder || (isMessagingTheme ? 'Mensagem...' : 'Digite sua resposta...'))
                          : (isMessagingTheme ? 'Mensagem...' : 'Aguardando...')
                      }
                      className={`flex-1 bg-transparent border-0 shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-9 text-sm text-[var(--text-primary)] disabled:opacity-30 px-0 ${isMessagingTheme ? 'placeholder:text-[#737373]' : 'placeholder:text-muted-foreground/50'}`}
                    />
                  </div>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!inputEnabled || !inputValue.trim() || isSubmitting}
                    className={`disabled:opacity-30 shrink-0 rounded-full w-10 h-10 transition-shadow hover:shadow-md ${isMessagingTheme ? 'text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </>
              )}
            </form>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flex: 1, padding: '0 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', width: '100%' }} onClick={startChat} className="cursor-pointer">
            {flow.avatarUrl ? (
              <img
                src={flow.avatarUrl}
                alt="avatar"
                style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ position: 'relative', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--theme-primary)', opacity: 0.15 }} />
                <Bot size={36} style={{ color: 'var(--theme-primary)', position: 'relative', zIndex: 1 }} />
              </div>
            )}

            <span style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600 }}>
              {flow.contactName || flow.name}
            </span>

                <Button type="button" onClick={startChat} className="rounded-full w-14 h-14 p-0 text-white hover:opacity-90" style={{ background: 'var(--theme-primary)' }}>
                  <Play className="w-5 h-5" />
                </Button>

                <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Toque para iniciar
                </span>
          </div>
        </div>
      )}

      {/* Saved chat resume pop-up */}
      {hasSavedChat && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 100
        }}>
          <div style={{
            background: 'var(--bubble-received)',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '300px',
            textAlign: 'center',
            display: 'flex', flexDirection: 'column', gap: '12px'
          }}>
            <span style={{ fontSize: '32px' }}>👋</span>
            <p style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>
              Você já esteve aqui antes!
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              Deseja continuar de onde parou?
            </p>
            <button onClick={handleContinue} style={{
              background: 'var(--theme-primary-gradient)', color: 'white',
              border: 'none', borderRadius: '50px',
              padding: '12px 24px', fontSize: '14px',
              fontWeight: 600, cursor: 'pointer'
            }}>
              ▶ Continuar de onde parou
            </button>
            <button onClick={handleRestart} style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '50px',
              padding: '10px 24px', fontSize: '13px',
              cursor: 'pointer'
            }}>
              ↺ Começar do início
            </button>
          </div>
        </div>
      )}

      {/* Exit intent modal */}
      <ExitModal />
    </div>
  );
};

export default ChatPlayer;
