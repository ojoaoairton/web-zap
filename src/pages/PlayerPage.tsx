import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import LZString from 'lz-string';
import ChatPlayer from '@/components/player/ChatPlayer';
import { Flow } from '@/types/flow';
import { getProjectBySlug } from '@/lib/projectsService';
import { Loader2 } from 'lucide-react';

export default function PlayerPage() {
  const { flowId } = useParams();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadFlow() {
      try {
        // 1. Tentar Banco de Dados Primeiro via Slug (flowId nesse caso atua como slug)
        if (flowId) {
          try {
            const project = await getProjectBySlug(flowId);
            if (project && project.flow) {
              setFlow(project.flow);
              return;
            }
          } catch (e) {
            console.error('Erro ao buscar do Supabase:', e);
          }
        }

        // 2. Tentar compressão da URL
        const params = new URLSearchParams(window.location.search);
        const flowParam = params.get('flow');

        if (flowParam) {
          try {
            const decompressed = LZString.decompressFromEncodedURIComponent(flowParam);
            const decoded = JSON.parse(decompressed);
            if (decoded && decoded.blocks) {
              setFlow(decoded as Flow);
              return;
            }
          } catch (e) {
            console.error('Erro ao decodificar flow compressado:', e);
          }
        }

        // 3. Tentar fallback de Local Storage
        const saved = localStorage.getItem('zaperflux_flow');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            const isValid =
              parsed &&
              typeof parsed === 'object' &&
              typeof parsed.id === 'string' &&
              Array.isArray(parsed.blocks);

            if (isValid) {
              setFlow(parsed);
              return;
            }
          } catch (e) {
            console.error('Erro ao ler flow do storage local:', e);
          }
        }

        // 4. Falha completa
        setError(true);
      } catch (e) {
        console.error('Erro ao carregar fluxo:', e);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    loadFlow();
  }, [flowId]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#0b141a',
        }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'hsl(var(--primary))' }} />
      </div>
    );
  }

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
        <p>Houve um erro ao carregar o fluxo ou ele não foi encontrado.</p>
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
