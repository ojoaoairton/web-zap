export type BlockType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'buttons' | 'input' | 'delay' | 'redirect' | 'pix';

export type FlowTheme = 'auto' | 'dark' | 'light' | 'instagram' | 'messenger';

export type IntegrationType = 'utmify' | 'meta' | 'gtm' | 'tiktok';

export interface FlowIntegration {
  id: string;
  type: IntegrationType;
  value: string;
}

export type ScriptPosition = 'head' | 'body' | 'footer';

export interface CustomScript {
  id: string;
  position: ScriptPosition;
  code: string;
}

export interface ButtonOption {
  id: string;
  label: string;
  next: string;
  type?: 'flow' | 'link';
  trackEvent?: string;
  url?: string;
  target?: '_blank' | '_self';
}

export type InputFieldType = 'nome' | 'email' | 'telefone' | 'texto';

export interface PixData {
  receiverName: string;
  pixKey: string;
}

export interface FlowBlock {
  id: string;
  type: BlockType;
  content?: string;
  url?: string;
  buttons?: ButtonOption[];
  pixData?: PixData;
  duration?: string;
  forwarded?: boolean;
  inputType?: InputFieldType;
  placeholder?: string;
  variable?: string;
  delayMs?: number;
  next?: string;
  trackEvent?: string;
  /** Audio transcription text (optional) */
  transcription?: string;
  /** File display name */
  fileName?: string;
  /** File size label */
  fileSize?: string;
}

export interface Flow {
  id: string;
  name: string;
  blocks: FlowBlock[];
  theme: FlowTheme;
  integrations: FlowIntegration[];
  customScripts: CustomScript[];
  pixelId?: string;
  webhookUrl?: string;
  webhookEnabled?: boolean;
  avatarUrl?: string;
  contactName?: string;
  /** Custom scripts to inject */
  headScripts?: string;
  bodyScripts?: string;
  abTest?: {
    enabled: boolean;
    variantBSlug: string;
    splitPercentage: number;
  };
}

export interface ChatMessage {
  id: string;
  type: 'bot' | 'user';
  content: string;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'file' | 'buttons' | 'pix' | 'recording' | 'typing';
  buttons?: ButtonOption[];
  pixData?: PixData;
  transcription?: string;
  duration?: string;
  forwarded?: boolean;
  fileName?: string;
  fileSize?: string;
  timestamp?: number;
}
