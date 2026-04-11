import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import LZString from 'lz-string';
import ChatPlayer from '@/components/player/ChatPlayer';
import { Flow } from '@/types/flow';

export default function PlayerPage() {
  const { flowId } = useParams();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    console.log('PlayerPage montou');
    console.log('flowId:', flowId);

    const params = new URLSearchParams(window.location.search);
    const flowParam = params.get('flow');
    console.log('flowParam existe:', !!flowParam);
    console.log('flowParam tamanho:', flowParam?.length);

    if (flowParam) {
      try {
        const decompressed = LZString.decompressFromEncodedURIComponent(flowParam);
        console.log('decompressed:', decompressed?.substring(0, 100));
        const decoded = JSON.parse(decompressed);
        console.log('decoded.blocks:', decoded?.blocks?.length);
        if (decoded && decoded.blocks) {
          setFlow(decoded as Flow);
          return;
        }
      } catch (e) {
        console.error('Erro ao decodificar flow:', e);
      }
    }

    const saved = localStorage.getItem('zaperflux_flow');
    console.log('localStorage flow existe:', !!saved);

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
            console.log('Flow carregado do localStorage');
            setFlow(parsed);
            return;
          }
        }
      } catch (e) {
        console.error('Erro ao analisar localStorage:', e);
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
