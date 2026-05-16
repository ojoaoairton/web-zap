import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LZString from 'lz-string';
import { createDefaultFlow, STORAGE_KEY, useFlow } from '@/context/FlowContext';
import BlockEditor from './BlockEditor';
import SettingsPanel from './SettingsPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BlockType, FlowBlock } from '@/types/flow';
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
  ArrowLeft,
  CreditCard,
  Copy,
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
    icon: <CreditCard size={16} />,
  },
  { type: 'copy', label: 'Copiar Texto', icon: <Copy size={16} /> },
  { type: 'buttons', label: 'Botões', icon: <LayoutList size={16} /> },
  { type: 'input', label: 'Input', icon: <KeyboardIcon size={16} /> },
  { type: 'delay', label: 'Delay', icon: <Clock size={16} /> },
  { type: 'redirect', label: 'Redirect', icon: <ExternalLink size={16} /> },
];

const createDefaultBlock = (type: BlockType): FlowBlock => {
  const newBlock: any = { id: crypto.randomUUID(), type };
  switch (type) {
    case 'text': newBlock.content = ''; break;
    case 'image': newBlock.url = ''; break;
    case 'video': newBlock.url = ''; break;
    case 'audio': newBlock.url = ''; newBlock.transcription = ''; newBlock.duration = ''; newBlock.forwarded = false; break;
    case 'file': newBlock.url = ''; newBlock.fileName = ''; newBlock.fileSize = ''; break;
    case 'buttons': newBlock.content = ''; newBlock.buttons = []; break;
    case 'pix': newBlock.pixData = { receiverName: '', pixKey: '' }; break;
    case 'copy': newBlock.copyData = { text: '' }; break;
    case 'input': newBlock.inputType = 'texto'; newBlock.placeholder = ''; newBlock.variable = ''; break;
    case 'delay': newBlock.delayMs = 1500; break;
    case 'redirect': newBlock.url = ''; break;
  }
  return newBlock;
};

const InsertZone = ({ onInsert }: { onInsert: (type: BlockType) => void }) => {
  const [hovered, setHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.insert-zone')) {
        setShowMenu(false);
        setHovered(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <div
      className="insert-zone"
      style={{
        height: '28px',
        paddingTop: '4px',
        paddingBottom: '4px',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        cursor: 'pointer',
        borderTop: '1px dashed rgba(255,255,255,0.05)',
        width: '100%',
        flexShrink: 0
      }}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button')) {
          setShowMenu(true);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { 
        if (!showMenu) setHovered(false); 
      }}
    >
      {hovered && (
        <>
          <div style={{
            position: 'absolute', left: 0, right: 0,
            height: '1px',
            background: 'rgba(37,211,102,0.4)'
          }}/>
          
          <button
            onClick={() => setShowMenu(true)}
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '24px', height: '24px',
              borderRadius: '50%',
              background: '#25D366',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10
            }}
          >
            <Plus size={14} color="white" />
          </button>
          
          {showMenu && (
            <div className="absolute left-1/2 -translate-x-1/2 top-[28px] bg-popover border border-border rounded-lg p-1 z-50 grid grid-cols-2 gap-0.5 min-w-[200px] shadow-xl">
              {blockOptions.map(item => (
                <button
                  key={item.type}
                  onClick={() => {
                    onInsert(item.type);
                    setShowMenu(false);
                    setHovered(false);
                  }}
                  className="px-2 py-1.5 bg-transparent border-none rounded-md cursor-pointer text-xs text-popover-foreground flex items-center gap-1.5 text-left hover:bg-muted transition-colors"
                >
                  <span className="text-primary opacity-80">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const BuilderPanel: React.FC = () => {
  const navigate = useNavigate();
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

  const handleInsertAt = (blockType: BlockType, atIndex: number) => {
    const newBlock = createDefaultBlock(blockType);
    
    const newBlocks = [...flow.blocks];
    newBlocks.splice(atIndex, 0, newBlock);
    
    // Recalcular os next de todos os blocos
    const relinked = newBlocks.map((b, i) => {
      if (b.type === 'buttons') return b; // botões têm next próprio
      return { ...b, next: newBlocks[i + 1]?.id || undefined };
    });
    
    setFlow({ ...flow, blocks: relinked });
  };

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
    const slug = flow.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const url = window.location.origin + '/p/' + slug;

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
        <div className="flex items-center justify-between gap-1 overflow-x-auto overflow-y-visible whitespace-nowrap relative z-50">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground shrink-0 gap-1.5 -ml-2 mr-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
          <div className="flex items-center gap-1">
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
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 flex flex-col gap-0">
        {flow.blocks.map((block, index) => (
          <React.Fragment key={`block-editor-${flow.blocks.length}-${block.id}`}>
            {/* Zona de inserção ANTES do primeiro bloco */}
            {index === 0 && (
              <InsertZone 
                onInsert={(type) => handleInsertAt(type, 0)}
              />
            )}
            
            {/* Bloco normal */}
            <BlockEditor block={block} index={index} />
            
            {/* Zona de inserção APÓS cada bloco */}
            <InsertZone 
              onInsert={(type) => handleInsertAt(type, index + 1)}
            />
          </React.Fragment>
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
