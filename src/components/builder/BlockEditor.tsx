import React from 'react';
import { FlowBlock, BlockType, InputFieldType } from '@/types/flow';
import { useFlow } from '@/context/FlowContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Image, Video, Music, File,
  MessageSquare, LayoutList, Clock, ExternalLink,
  Trash2, ChevronUp, ChevronDown, Plus, KeyboardIcon, CreditCard,
} from 'lucide-react';
import { v4 as uuid } from 'uuid';

const typeLabels: Record<BlockType, { label: string; icon: React.ReactNode }> = {
  text: { label: 'Texto', icon: <MessageSquare size={16} /> },
  image: { label: 'Imagem', icon: <Image size={16} /> },
  video: { label: 'Vídeo', icon: <Video size={16} /> },
  audio: { label: 'Áudio', icon: <Music size={16} /> },
  file: { label: 'Arquivo', icon: <File size={16} /> },
  pix: {
    label: 'PIX',
    icon: <CreditCard size={16} />,
  },
  buttons: { label: 'Botões', icon: <LayoutList size={16} /> },
  input: { label: 'Input', icon: <KeyboardIcon size={16} /> },
  delay: { label: 'Delay', icon: <Clock size={16} /> },
  redirect: { label: 'Redirect', icon: <ExternalLink size={16} /> },
};

const BlockEditor: React.FC<{ block: FlowBlock; index: number }> = ({ block, index }) => {
  const { updateBlock, removeBlock, moveBlock, flow } = useFlow();

  const calcTypingDelay = (text: string): number => {
    return Math.min(Math.max((text.length / 80) * 1000, 1000), 6000);
  };

  const renderFields = () => {
    switch (block.type) {
      case 'text':
        return (
          <div className="space-y-2">
            <Textarea
              value={block.content || ''}
              onChange={e => updateBlock(block.id, { content: e.target.value })}
              placeholder="Digite a mensagem... Use {{variavel}} para variáveis"
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground min-h-[80px] resize-none"
            />
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground block">Delay (segundos)</label>
              <Input
                type="number"
                step="0.5"
                min={0}
                value={((block.delayMs ?? 0) / 1000)}
                onChange={e => {
                  const nextSeconds = Number(e.target.value);
                  const nextMs = Number.isFinite(nextSeconds) ? Math.round(nextSeconds * 1000) : 0;
                  updateBlock(block.id, { delayMs: nextMs });
                }}
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
              <div className="text-xs text-muted-foreground">
                <div>Deixe 0 para calcular automaticamente pelo tamanho do texto</div>
                {(block.delayMs ?? 0) === 0 && (
                  <div>
                    Auto: ~{(calcTypingDelay(block.content || '') / 1000).toFixed(1)}s
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      case 'image':
      case 'video':
        return (
          <Input
            value={block.url || ''}
            onChange={e => updateBlock(block.id, { url: e.target.value })}
            placeholder={block.type === 'image' ? 'URL da imagem' : 'URL do vídeo (mp4, YouTube, Drive)'}
            className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
          />
        );
      case 'audio':
        return (
          <div className="space-y-2">
            <Input
              value={block.url || ''}
              onChange={e => updateBlock(block.id, { url: e.target.value })}
              placeholder="URL do áudio (mp3, ogg...)"
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
            <label className="text-xs text-muted-foreground block">Duração do áudio</label>
            <Input
              value={block.duration || ''}
              onChange={e => updateBlock(block.id, { duration: e.target.value })}
              placeholder="0:06"
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={Boolean(block.forwarded)}
                onChange={e => updateBlock(block.id, { forwarded: e.target.checked })}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              Marcar como encaminhada
            </label>
            <Textarea
              value={block.transcription || ''}
              onChange={e => updateBlock(block.id, { transcription: e.target.value })}
              placeholder="Transcrição (opcional)"
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground min-h-[60px] resize-none"
            />
          </div>
        );
      case 'file':
        return (
          <div className="space-y-2">
            <Input
              value={block.url || ''}
              onChange={e => updateBlock(block.id, { url: e.target.value })}
              placeholder="URL do arquivo (PDF, etc)"
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
            <Input
              value={block.fileName || ''}
              onChange={e => updateBlock(block.id, { fileName: e.target.value })}
              placeholder="Nome do arquivo (ex: Proposta.pdf)"
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
            <Input
              value={block.fileSize || ''}
              onChange={e => updateBlock(block.id, { fileSize: e.target.value })}
              placeholder="Tamanho (ex: 2.4 MB)"
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
        );
      case 'pix':
        return (
          <div className="space-y-2">
            <Input
              value={block.pixData?.receiverName || ''}
              onChange={e => updateBlock(block.id, { pixData: { receiverName: e.target.value, pixKey: block.pixData?.pixKey || '' } })}
              placeholder="Nome do recebedor"
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
            <Input
              value={block.pixData?.pixKey || ''}
              onChange={e => updateBlock(block.id, { pixData: { receiverName: block.pixData?.receiverName || '', pixKey: e.target.value } })}
              placeholder="Chave PIX"
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
        );
      case 'buttons':
        return (
          <div className="space-y-2">
            <Input
              value={block.content || ''}
              onChange={e => updateBlock(block.id, { content: e.target.value })}
              placeholder="Mensagem antes dos botões"
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
            {(block.buttons || []).map((btn, bi) => (
              <div key={btn.id} className="space-y-2">
                <div className="flex gap-2 items-center">
                  <Input
                    value={btn.label}
                    onChange={e => {
                      const buttons = [...(block.buttons || [])];
                      buttons[bi] = { ...buttons[bi], label: e.target.value };
                      updateBlock(block.id, { buttons });
                    }}
                    placeholder="Label do botão"
                    className="bg-secondary border-border text-foreground placeholder:text-muted-foreground flex-1"
                  />
                  <Select
                    value={btn.type || 'flow'}
                    onValueChange={val => {
                      const buttons = [...(block.buttons || [])];
                      if (val === 'link') {
                        buttons[bi] = { ...buttons[bi], type: 'link', url: buttons[bi].url || '', target: buttons[bi].target || '_blank' };
                      } else {
                        const { url: _url, target: _target, ...rest } = buttons[bi];
                        buttons[bi] = { ...rest, type: 'flow' };
                      }
                      updateBlock(block.id, { buttons });
                    }}
                  >
                    <SelectTrigger className="w-[150px] bg-secondary border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flow">Continuar fluxo</SelectItem>
                      <SelectItem value="link">Link</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={btn.next || 'none'}
                    onValueChange={val => {
                      const buttons = [...(block.buttons || [])];
                      buttons[bi] = { ...buttons[bi], next: val === 'none' ? '' : val };
                      updateBlock(block.id, { buttons });
                    }}
                  >
                    <SelectTrigger className="w-[140px] bg-secondary border-border text-foreground">
                      <SelectValue placeholder="Ir para..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {flow.blocks.filter(b => b.id !== block.id).map((b, i) => (
                        <SelectItem key={b.id} value={b.id}>
                          #{i + 1} {typeLabels[b.type].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const buttons = (block.buttons || []).filter((_, j) => j !== bi);
                      updateBlock(block.id, { buttons });
                    }}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {(btn.type || 'flow') === 'link' && (
                  <div className="flex gap-2 items-center">
                    <Input
                      value={btn.url || ''}
                      onChange={e => {
                        const buttons = [...(block.buttons || [])];
                        buttons[bi] = { ...buttons[bi], url: e.target.value };
                        updateBlock(block.id, { buttons });
                      }}
                      placeholder="URL (https://...)"
                      className="bg-secondary border-border text-foreground placeholder:text-muted-foreground flex-1"
                    />
                    <Select
                      value={btn.target || '_blank'}
                      onValueChange={val => {
                        const buttons = [...(block.buttons || [])];
                        buttons[bi] = { ...buttons[bi], target: val as '_blank' | '_self' };
                        updateBlock(block.id, { buttons });
                      }}
                    >
                      <SelectTrigger className="w-[140px] bg-secondary border-border text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_self">Mesma aba</SelectItem>
                        <SelectItem value="_blank">Nova aba</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const buttons = [...(block.buttons || []), { id: uuid(), label: '', next: '', type: 'flow' as const }];
                updateBlock(block.id, { buttons });
              }}
              className="text-primary hover:text-primary/80"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar botão
            </Button>
          </div>
        );
      case 'input':
        return (
          <div className="space-y-2">
            <Select
              value={block.inputType || 'texto'}
              onValueChange={val => updateBlock(block.id, { inputType: val as InputFieldType })}
            >
              <SelectTrigger className="bg-secondary border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nome">Nome</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="telefone">Telefone</SelectItem>
                <SelectItem value="texto">Texto genérico</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={block.placeholder || ''}
              onChange={e => updateBlock(block.id, { placeholder: e.target.value })}
              placeholder="Placeholder do campo"
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
            <Input
              value={block.variable || ''}
              onChange={e => updateBlock(block.id, { variable: e.target.value })}
              placeholder="Nome da variável (ex: nome)"
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
        );
      case 'delay':
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.5"
              min={0}
              value={(block.delayMs ?? 1500) / 1000}
              onChange={e => {
                const nextSeconds = Number(e.target.value);
                const nextMs = Number.isFinite(nextSeconds) ? Math.round(nextSeconds * 1000) : 0;
                updateBlock(block.id, { delayMs: nextMs });
              }}
              className="bg-secondary border-border text-foreground w-28"
            />
            <span className="text-muted-foreground text-sm">s</span>
          </div>
        );
      case 'redirect':
        return (
          <Input
            value={block.url || ''}
            onChange={e => updateBlock(block.id, { url: e.target.value })}
            placeholder="URL de redirecionamento"
            className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
          />
        );
      default:
        return null;
    }
  };

  const info = typeLabels[block.type];

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3 transition-shadow hover:shadow-lg hover:shadow-primary/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
            #{index + 1}
          </span>
          <span className="text-primary">{info.icon}</span>
          <span className="text-sm font-medium text-foreground">{info.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => moveBlock(block.id, 'up')} className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <ChevronUp className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => moveBlock(block.id, 'down')} className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <ChevronDown className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => removeBlock(block.id)} className="h-7 w-7 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {renderFields()}
    </div>
  );
};

export default BlockEditor;
