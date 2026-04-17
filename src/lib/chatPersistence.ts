import { ChatMessage } from '@/types/flow';

const STORAGE_KEY = 'flowchat_session';

export interface ChatSession {
  flowId: string;
  currentBlockId?: string;
  nextBlockId?: string;
  messages: ChatMessage[];
  variables: Record<string, string>;
  timestamp: number;
  completed: boolean;
}

export function saveSession(session: ChatSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // storage full or unavailable
  }
}

export function loadSession(flowId: string): ChatSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session: ChatSession = JSON.parse(raw);
    // Only restore if same flow and not older than 24h
    if (session.flowId !== flowId) return null;
    if (Date.now() - session.timestamp > 24 * 60 * 60 * 1000) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
