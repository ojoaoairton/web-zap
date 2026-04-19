import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import LZString from 'lz-string';
import ChatPlayer from '@/components/player/ChatPlayer';
import { Flow } from '@/types/flow';
import { getProjectBySlug } from '@/lib/projectsService';
import { PATTERN_BASE64 } from '@/assets/pattern';

interface HeaderCache {
  contactName: string;
  avatarUrl: string;
  theme: string;
}

export default function PlayerPage() {
  const { flowId } = useParams();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [headerData, setHeaderData] = useState<HeaderCache | null>(null);
  const [isLoadingFlow, setIsLoadingFlow] = useState(true);
  const [error, setError] = useState(false);

  const HEADER_CACHE_KEY = 'zf_header_' + flowId;

  useEffect(() => {
    // Tentar carregar dados básicos do cache local primeiro
    try {
      const cached = localStorage.getItem(HEADER_CACHE_KEY);
      if (cached) {
        setHeaderData(JSON.parse(cached));
      }
    } catch (e) {
      // Cache corrompido, ignorar
    }

    async function loadFlow() {
      setIsLoadingFlow(true);
      try {
        // 1. Tentar Banco de Dados Primeiro via Slug
        if (flowId) {
          try {
            const project = await getProjectBySlug(flowId);
            if (project && project.flow) {
              setFlow(project.flow);
              // Salvar header no cache para próxima visita
              localStorage.setItem(HEADER_CACHE_KEY, JSON.stringify({
                contactName: project.flow.contactName || project.flow.name,
                avatarUrl: project.flow.avatarUrl || '',
                theme: project.flow.theme || 'dark',
              }));
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
        setIsLoadingFlow(false);
      }
    }

    loadFlow();
  }, [flowId]);

  useEffect(() => {
    if (!flow) return;
    
    const scripts = flow.customScripts || [];
    
    scripts.forEach((script) => {
      // Criar elemento div temporário para parsear o HTML
      const div = document.createElement('div');
      div.innerHTML = script.code;
      
      // Extrair todos os elementos script
      const scriptElements = div.querySelectorAll('script');
      const noscriptElements = div.querySelectorAll('noscript');
      
      scriptElements.forEach(scriptEl => {
        const newScript = document.createElement('script');
        // Copiar atributos
        Array.from(scriptEl.attributes).forEach(attr => {
          newScript.setAttribute(attr.name, attr.value);
        });
        // Copiar conteúdo inline
        if (scriptEl.innerHTML) {
          newScript.innerHTML = scriptEl.innerHTML;
        }
        
        if (script.position === 'head') {
          document.head.appendChild(newScript);
        } else if (script.position === 'body') {
          document.body.prepend(newScript);
        } else {
          document.body.appendChild(newScript);
        }
      });
      
      // Injetar noscript também
      noscriptElements.forEach(noscriptEl => {
        const newNoscript = document.createElement('noscript');
        newNoscript.innerHTML = noscriptEl.innerHTML;
        document.head.appendChild(newNoscript);
      });
    });

    const integrations = flow.integrations || [];
    integrations.forEach(integration => {
       if (!integration.value || !integration.value.trim()) return;
       const val = integration.value.trim();
       
       if (integration.type === 'meta') {
         const script = document.createElement('script');
         script.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
         n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
         n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
         t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
         document,'script','https://connect.facebook.net/en_US/fbevents.js');
         fbq('init', '${val}');`;
         document.head.appendChild(script);
       } else if (integration.type === 'gtm') {
         const script = document.createElement('script');
         script.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
         new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
         j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
         'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
         })(window,document,'script','dataLayer','${val}');`;
         document.head.appendChild(script);

         const noscript = document.createElement('noscript');
         noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${val}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
         document.body.prepend(noscript);
       } else if (integration.type === 'tiktok') {
         const script = document.createElement('script');
         script.innerHTML = `!function (w, d, t) {
         w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
         ttq.load('${val}');
         ttq.page();
         }(window, document, 'ttq');`;
         document.head.appendChild(script);
       } else if (integration.type === 'utmify') {
         const script = document.createElement('script');
         script.src = `https://cdn.utmify.com.br/scripts/utms/latest.js`;
         script.setAttribute('data-utmify-id', val);
         script.async = true;
         document.head.appendChild(script);
         
         const inline = document.createElement('script');
         inline.innerHTML = `window.pixelId = "${val}";
         var a = document.createElement("script");
         a.setAttribute("async", "");
         a.setAttribute("defer", "");
         a.setAttribute("src", "https://cdn.utmify.com.br/scripts/pixel/pixel.js");
         document.head.appendChild(a);`;
         document.head.appendChild(inline);
       }
    });
    
  }, [flow]);

  // Estado A: Sem cache e sem fluxo → tela mínima com spinner
  if (!headerData && !flow && isLoadingFlow) {
    return (
      <div style={{
        height: '100vh',
        background: 'rgba(11,20,26,1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTop: '3px solid #25D366',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Estado B: Tem cache mas fluxo ainda carregando → header + digitando
  if (headerData && isLoadingFlow && !flow) {
    const dataTheme = headerData.theme !== 'auto' ? headerData.theme : undefined;
    return (
      <div
        className="chat-theme h-full w-full flex flex-col"
        data-theme={dataTheme}
        style={{ height: '100vh' }}
      >
        {/* Background pattern */}
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage: `linear-gradient(var(--bg-overlay, rgba(11,20,26,0.85)), var(--bg-overlay, rgba(11,20,26,0.85))), url("${PATTERN_BASE64}")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '400px auto',
            backgroundPosition: 'top left',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />

        {/* Header imediato */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          background: 'var(--header-bg, #1f2c34)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          shrink: 0,
        }}>
          {headerData.avatarUrl ? (
            <img
              src={headerData.avatarUrl}
              alt="avatar"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                objectFit: 'cover',
                ring: '2px solid rgba(0,168,132,0.1)',
              }}
            />
          ) : (
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(0,168,132,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}>
              🤖
            </div>
          )}
          <div>
            <div style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary, #e9edef)',
            }}>
              {headerData.contactName || 'Carregando...'}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#25D366',
            }}>
              digitando...
            </div>
          </div>
        </div>

        {/* Área de mensagens com typing indicator */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}>
          {/* Typing indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'var(--bubble-received, #1f2c34)',
            borderRadius: '8px',
            padding: '10px 14px',
            width: 'fit-content',
            position: 'relative',
          }}>
            {/* Biquinho */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: '-8px',
              width: 0,
              height: 0,
              borderTop: '8px solid var(--bubble-received, #1f2c34)',
              borderLeft: '8px solid transparent',
            }} />
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.4)',
                animation: 'typingDot 1.4s infinite',
                animationDelay: `${i * 0.2}s`,
              }} />
            ))}
          </div>
        </div>

        {/* Barra de input desabilitada */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          background: 'var(--header-bg, #1f2c34)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '8px 12px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}>
          <div style={{
            flex: 1,
            background: 'var(--input-bg, #2a3942)',
            borderRadius: '20px',
            padding: '8px 16px',
            color: 'rgba(255,255,255,0.3)',
            fontSize: '14px',
          }}>
            Aguardando...
          </div>
        </div>

        <style>{`
          @keyframes typingDot {
            0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
            30% { opacity: 1; transform: scale(1); }
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
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

  // Estado C: fluxo carregado → renderizar ChatPlayer normalmente
  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <ChatPlayer flow={flow} isPreview={false} />
    </div>
  );
}
