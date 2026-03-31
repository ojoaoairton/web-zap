import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import ChatPlayer from '@/components/player/ChatPlayer';
import { Flow } from '@/types/flow';

export default function PlayerPage() {
  const { flowId } = useParams();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flowParam = params.get('flow');
    if (flowParam) {
      let decoded: unknown = null;
      try {
        const normalized = flowParam.replace(/ /g, '+');
        decoded = JSON.parse(atob(normalized));
      } catch {
        decoded = null;
      }
      if (decoded && (decoded as { blocks?: unknown }).blocks) {
        setFlow(decoded as Flow);
        return;
      }
    }

    const saved = localStorage.getItem('zaperflux_flow');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const isValid =
          parsed &&
          typeof parsed === 'object' &&
          typeof parsed.id === 'string' &&
          typeof parsed.name === 'string' &&
          Array.isArray(parsed.blocks);
        if (isValid) {
          const flowSlug = parsed.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
          if (flowSlug === flowId || flowId === 'default') {
            setFlow(parsed);
            return;
          }
        }
      } catch {
        setError(true);
        return;
      }
    }
    setError(true);
  }, [flowId]);

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#0b141a',
          color: '#e9edef',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <p>Fluxo não encontrado.</p>
      </div>
    );
  }

  if (!flow) return null;

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <ChatPlayer flow={flow} isPreview={false} />
    </div>
  );
}
