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
