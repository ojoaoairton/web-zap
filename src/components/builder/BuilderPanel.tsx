import React, { useEffect, useRef, useState } from 'react';
import LZString from 'lz-string';
import { createDefaultFlow, STORAGE_KEY, useFlow } from '@/context/FlowContext';
import BlockEditor from './BlockEditor';
import SettingsPanel from './SettingsPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BlockType } from '@/types/flow';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Plus, Download, Image, Video, Music, File,
  MessageSquare, LayoutList, Clock, ExternalLink,
  Settings,
  KeyboardIcon,
  Save,
  FilePlus,
  Upload,
  Check,
  Link,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const blockOptions: { type: BlockType; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: 'Texto', icon: <MessageSquare size={16} /> },
  { type: 'image', label: 'Imagem', icon: <Image size={16} /> },
  { type: 'video', label: 'Vídeo', icon: <Video size={16} /> },
  { type: 'audio', label: 'Áudio', icon: <Music size={16} /> },
  { type: 'file', label: 'Arquivo', icon: <File size={16} /> },
  {
    type: 'pix',
    label: 'PIX',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="16" height="16">
        <g fill="#32BCAD">
          <path d="M209.6 81.6c25.6-25.6 67.2-25.6 92.8 0l48 48h-36.8c-16 0-31.2 6.4-42.4 17.6l-49.6 49.6-49.6-49.6c-11.2-11.2-26.4-17.6-42.4-17.6H116l93.6-48z" />
          <path d="M81.6 209.6L48 256l33.6 46.4h47.2c16 0 31.2-6.4 42.4-17.6l49.6-49.6-49.6-49.6c-11.2-11.2-26.4-17.6-42.4-17.6H81.6z" />
          <path d="M302.4 430.4c-25.6 25.6-67.2 25.6-92.8 0L116 382.4h36.8c16 0 31.2-6.4 42.4-17.6l49.6-49.6 49.6 49.6c11.2 11.2 26.4 17.6 42.4 17.6H396l-93.6 48z" />
          <path d="M430.4 209.6h-47.2c-16 0-31.2 6.4-42.4 17.6L291.2 276.8l49.6 49.6c11.2 11.2 26.4 17.6 42.4 17.6H430.4L464 256l-33.6-46.4z" />
        </g>
      </svg>
    ),
  },
  { type: 'buttons', label: 'Botões', icon: <LayoutList size={16} /> },
  { type: 'input', label: 'Input', icon: <KeyboardIcon size={16} /> },
  { type: 'delay', label: 'Delay', icon: <Clock size={16} /> },
  { type: 'redirect', label: 'Redirect', icon: <ExternalLink size={16} /> },
];

const BuilderPanel: React.FC = () => {
  const { flow, setFlow, addBlock } = useFlow();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [importedFeedback, setImportedFeedback] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const savedTimerRef = useRef<number | null>(null);
  const importedTimerRef = useRef<number | null>(null);
  const linkCopiedTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
      if (importedTimerRef.current) window.clearTimeout(importedTimerRef.current);
      if (linkCopiedTimerRef.current) window.clearTimeout(linkCopiedTimerRef.current);
    };
  }, []);

  const exportJSON = () => {
    const json = JSON.stringify(flow, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${flow.name || 'flow'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveFlow = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flow));
    setSaved(true);
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(() => setSaved(false), 2000);
  };

  const newFlow = () => {
    const ok = window.confirm('Criar um novo fluxo? Isso vai apagar o fluxo atual salvo no navegador.');
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    setFlow(() => createDefaultFlow());
  };

  const getFlowSlug = () => {
    const slug = flow.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return slug || 'default';
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const onImportFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const isValid =
          parsed &&
          typeof parsed === 'object' &&
          typeof parsed.id === 'string' &&
          typeof parsed.name === 'string' &&
          Array.isArray(parsed.blocks);
        if (!isValid) {
          alert('Arquivo JSON inválido');
          return;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        setFlow(() => parsed);
        setImportedFeedback(true);
        if (importedTimerRef.current) window.clearTimeout(importedTimerRef.current);
        importedTimerRef.current = window.setTimeout(() => setImportedFeedback(false), 2000);
      } catch {
        alert('Arquivo JSON inválido');
      }
    };
    reader.onerror = () => {
      alert('Arquivo JSON inválido');
    };
    reader.readAsText(file);
  };

  async function copyToClipboard(text: string) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      document.body.removeChild(textarea);
      return false;
    }
  }

  const copyPublicLink = async () => {
    const json = JSON.stringify(flow);
    const compressed = LZString.compressToEncodedURIComponent(json);
    const slug = flow.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const url = window.location.origin + '/p/' + slug + '?flow=' + compressed;

    const success = await copyToClipboard(url);
    if (success) {
      setLinkCopied(true);
      if (linkCopiedTimerRef.current) window.clearTimeout(linkCopiedTimerRef.current);
      linkCopiedTimerRef.current = window.setTimeout(() => setLinkCopied(false), 2000);
    } else {
      window.prompt('Copie o link manualmente:', url);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* Header */}
      <div className="border-b border-border p-4 space-y-3">
        <div className="flex items-center justify-end gap-1 overflow-x-auto overflow-y-visible whitespace-nowrap relative z-50">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={newFlow} className="text-muted-foreground hover:text-foreground shrink-0">
                <FilePlus className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Novo fluxo</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={saveFlow} className="text-muted-foreground hover:text-foreground shrink-0">
                {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{saved ? 'Salvo!' : 'Salvar'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={triggerImport}
                title="Importar fluxo"
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <Upload className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{importedFeedback ? 'Fluxo importado!' : 'Importar'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open('/p/' + getFlowSlug(), '_blank')}
                title="Ver página pública"
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Ver página pública</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={copyPublicLink}
                title="Copiar link público"
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <Link className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{linkCopied ? 'Link copiado!' : 'Copiar link público'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettingsOpen(true)}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Configurações</TooltipContent>
          </Tooltip>

          <Button variant="ghost" size="sm" onClick={exportJSON} className="text-muted-foreground hover:text-foreground shrink-0">
            <Download className="w-4 h-4 mr-1.5" /> JSON
          </Button>
        </div>
        <input ref={fileInputRef} type="file" accept=".json,application/json" hidden onChange={onImportFileChange} />
        <Input
          value={flow.name}
          onChange={e => setFlow(prev => ({ ...prev, name: e.target.value }))}
          className="bg-secondary border-border text-foreground font-medium"
          placeholder="Nome do fluxo"
        />
      </div>

      {/* Blocks list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
        {flow.blocks.map((block, i) => (
          <BlockEditor key={block.id} block={block} index={i} />
        ))}

        {flow.blocks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <MessageSquare className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">Nenhum bloco ainda</p>
            <p className="text-xs">Adicione o primeiro bloco abaixo</p>
          </div>
        )}
      </div>

      {/* Add block */}
      <div className="border-t border-border p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> Adicionar bloco
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-48">
            {blockOptions.map(opt => (
              <DropdownMenuItem key={opt.type} onClick={() => addBlock(opt.type)}>
                <span className="text-primary mr-2">{opt.icon}</span>
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${settingsOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setSettingsOpen(false)}
      />
      <div
        className={`absolute inset-y-0 left-0 z-50 transition-transform duration-200 ${settingsOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <SettingsPanel
          flow={flow}
          onClose={() => setSettingsOpen(false)}
          onSave={(next) => setFlow(prev => ({ ...prev, ...next }))}
        />
      </div>
    </div>
  );
};

export default BuilderPanel;
