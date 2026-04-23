/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}

let initialized = false;

export function initPixel(pixelId: string) {
  if (!pixelId || initialized) return;
  initialized = true;

  const f = window;
  const n = 'fbq';
  if (f[n]) return;

  const fbq: any = function (...args: any[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  };
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  f[n] = fbq;
  f._fbq = fbq;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  fbq('init', pixelId);
}

export function trackEvent(eventName: string, data?: Record<string, any>) {
  // Ignorar disparo client-side de InitiateCheckout para evitar duplicação com CAPI
  if (eventName === 'InitiateCheckout') return;

  if (window.fbq) {
    window.fbq('track', eventName, data || {});
  }
}
