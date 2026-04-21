import React, { useEffect, useMemo, useState } from 'react';
import { Flow, FlowIntegration, FlowTheme, IntegrationType, CustomScript, ScriptPosition } from '@/types/flow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { v4 as uuid } from 'uuid';

type Props = {
  flow: Flow;
  onClose: () => void;
  onSave: (next: Partial<Flow>) => void;
};

const integrationLabels: Record<IntegrationType, { label: string; placeholder: string }> = {
  utmify: { label: 'UTMify', placeholder: 'Pixel ID' },
  meta: { label: 'Meta Pixel', placeholder: 'Pixel ID' },
  gtm: { label: 'Google Tag Manager', placeholder: 'GTM-XXXX' },
  tiktok: { label: 'TikTok Pixel', placeholder: 'Pixel ID' },
};

const scriptPositionLabels: Record<ScriptPosition, string> = {
  head: 'Head',
  body: 'Body',
  footer: 'Footer',
};

const SettingsPanel: React.FC<Props> = ({ flow, onClose, onSave }) => {
  const initialIntegrations = useMemo<FlowIntegration[]>(() => {
    if (Array.isArray(flow.integrations) && flow.integrations.length > 0) return flow.integrations;
    if (flow.pixelId?.trim()) return [{ id: uuid(), type: 'meta', value: flow.pixelId }];
    return [];
  }, [flow.integrations, flow.pixelId]);

  const initialScripts = useMemo<CustomScript[]>(() => {
    if (Array.isArray(flow.customScripts) && flow.customScripts.length > 0) return flow.customScripts;
    const scripts: CustomScript[] = [];
    if (flow.headScripts?.trim()) scripts.push({ id: uuid(), position: 'head', code: flow.headScripts });
    if (flow.bodyScripts?.trim()) scripts.push({ id: uuid(), position: 'body', code: flow.bodyScripts });
    return scripts;
  }, [flow.customScripts, flow.headScripts, flow.bodyScripts]);

  const [appearanceOpen, setAppearanceOpen] = useState(true);
  const [trackingOpen, setTrackingOpen] = useState(true);
  const [scriptsOpen, setScriptsOpen] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);

  const [theme, setTheme] = useState<FlowTheme>(flow.theme || 'auto');
  const [contactName, setContactName] = useState(flow.contactName || '');
  const [avatarUrl, setAvatarUrl] = useState(flow.avatarUrl || '');
  const [integrations, setIntegrations] = useState<FlowIntegration[]>(initialIntegrations);
  const [customScripts, setCustomScripts] = useState<CustomScript[]>(initialScripts);
  const [webhookUrl, setWebhookUrl] = useState(flow.webhookUrl || '');
  const [webhookEnabled, setWebhookEnabled] = useState(Boolean(flow.webhookEnabled ?? flow.webhookUrl));

  const [addIntegrationOpen, setAddIntegrationOpen] = useState(false);
  const [addIntegrationType, setAddIntegrationType] = useState<IntegrationType | ''>('');

  useEffect(() => {
    setTheme(flow.theme || 'auto');
    setContactName(flow.contactName || '');
    setAvatarUrl(flow.avatarUrl || '');
    setIntegrations(initialIntegrations);
    setCustomScripts(initialScripts);
    setWebhookUrl(flow.webhookUrl || '');
    setWebhookEnabled(Boolean(flow.webhookEnabled ?? flow.webhookUrl));
  }, [flow, initialIntegrations, initialScripts]);

  const save = () => {
    const nextIntegrations = integrations.map(i => ({ ...i, value: i.value ?? '' }));
    const nextScripts = customScripts.map(s => ({ ...s, code: s.code ?? '' }));

    const meta = nextIntegrations.find(i => i.type === 'meta' && i.value.trim());
    const nextHeadScripts = nextScripts.filter(s => s.position === 'head').map(s => s.code).join('\n');
    const nextBodyScripts = nextScripts.filter(s => s.position === 'body').map(s => s.code).join('\n');

    onSave({
      theme,
      contactName: contactName || undefined,
      avatarUrl: avatarUrl || undefined,
      integrations: nextIntegrations,
      customScripts: nextScripts,
      webhookUrl: webhookUrl || undefined,
      webhookEnabled,
      pixelId: meta?.value || '',
      headScripts: nextHeadScripts || '',
      bodyScripts: nextBodyScripts || '',
    });
    onClose();
  };

  const integrationsCount = integrations.length;
  const scriptsCount = customScripts.length;

  return (
    <div className="h-full flex flex-col bg-card border-r border-border w-[320px]">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="text-sm font-semibold text-foreground">Configurações</div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
        <Collapsible open={appearanceOpen} onOpenChange={setAppearanceOpen}>
          <CollapsibleTrigger className="w-full flex items-center justify-between text-left">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {appearanceOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Aparência
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tema</label>
              <Select value={theme} onValueChange={(val) => setTheme(val as FlowTheme)}>
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (sistema)</SelectItem>
                  <SelectItem value="dark">Dark (WhatsApp)</SelectItem>
                  <SelectItem value="light">Light (WhatsApp)</SelectItem>
                  <SelectItem value="instagram">Instagram DM</SelectItem>
                  <SelectItem value="messenger" disabled>Messenger (em breve)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome do contato</label>
              <Input
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                placeholder="Ex: Atendimento"
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Avatar URL</label>
              <Input
                value={avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={trackingOpen} onOpenChange={setTrackingOpen}>
          <CollapsibleTrigger className="w-full flex items-center justify-between text-left">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {trackingOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Pixels e Rastreamento
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-foreground">{integrationsCount}</span>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            {integrations.length === 0 ? (
              <div className="text-xs text-muted-foreground">Nenhuma integração adicionada.</div>
            ) : (
              <div className="space-y-2">
                {integrations.map((integration) => (
                  <div key={integration.id} className="flex items-start gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="text-xs font-semibold text-foreground">{integrationLabels[integration.type].label}</div>
                      <Input
                        value={integration.value}
                        onChange={e => setIntegrations(prev => prev.map(i => i.id === integration.id ? { ...i, value: e.target.value } : i))}
                        placeholder={integrationLabels[integration.type].placeholder}
                        className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIntegrations(prev => prev.filter(i => i.id !== integration.id))}
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAddIntegrationOpen(v => !v)}
                className="w-full justify-start"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar integração
              </Button>

              {addIntegrationOpen && (
                <Select
                  value={addIntegrationType}
                  onValueChange={(val) => {
                    const type = val as IntegrationType;
                    setIntegrations(prev => [...prev, { id: uuid(), type, value: '' }]);
                    setAddIntegrationType('');
                    setAddIntegrationOpen(false);
                  }}
                >
                  <SelectTrigger className="bg-secondary border-border text-foreground">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="utmify">UTMify</SelectItem>
                    <SelectItem value="meta">Meta Pixel</SelectItem>
                    <SelectItem value="gtm">Google Tag Manager</SelectItem>
                    <SelectItem value="tiktok">TikTok Pixel</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={scriptsOpen} onOpenChange={setScriptsOpen}>
          <CollapsibleTrigger className="w-full flex items-center justify-between text-left">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {scriptsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Scripts personalizados
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-foreground">{scriptsCount}</span>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            {customScripts.length === 0 ? (
              <div className="text-xs text-muted-foreground">Nenhum script adicionado.</div>
            ) : (
              <div className="space-y-3">
                {customScripts.map((s) => (
                  <div key={s.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Select
                        value={s.position}
                        onValueChange={(val) => setCustomScripts(prev => prev.map(x => x.id === s.id ? { ...x, position: val as ScriptPosition } : x))}
                      >
                        <SelectTrigger className="bg-secondary border-border text-foreground w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="head">{scriptPositionLabels.head}</SelectItem>
                          <SelectItem value="body">{scriptPositionLabels.body}</SelectItem>
                          <SelectItem value="footer">{scriptPositionLabels.footer}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCustomScripts(prev => prev.filter(x => x.id !== s.id))}
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={s.code}
                      onChange={e => setCustomScripts(prev => prev.map(x => x.id === s.id ? { ...x, code: e.target.value } : x))}
                      placeholder="<script>...</script>"
                      rows={4}
                      className="bg-secondary border-border text-foreground placeholder:text-muted-foreground font-mono"
                    />
                  </div>
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="secondary"
              onClick={() => setCustomScripts(prev => [...prev, { id: uuid(), position: 'head', code: '' }])}
              className="w-full justify-start"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar script
            </Button>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={webhookOpen} onOpenChange={setWebhookOpen}>
          <CollapsibleTrigger className="w-full flex items-center justify-between text-left">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {webhookOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Webhook
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-foreground">Ativo</div>
              <button
                type="button"
                aria-pressed={webhookEnabled}
                onClick={() => setWebhookEnabled(v => !v)}
                className={`h-6 w-11 rounded-full border border-border p-0.5 transition-colors ${webhookEnabled ? 'bg-primary' : 'bg-secondary'}`}
              >
                <span className={`block h-5 w-5 rounded-full bg-background transition-transform ${webhookEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">URL do webhook</label>
              <Input
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://..."
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="border-t border-border p-3 bg-card">
        <Button onClick={save} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
          Salvar
        </Button>
      </div>
    </div>
  );
};

export default SettingsPanel;
