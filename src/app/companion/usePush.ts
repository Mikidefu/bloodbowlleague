'use client';
// Notifiche push della companion: il telefono si abbona con la chiave VAPID del server.
// Una volta attivate restano attive: entrando in un'altra partita l'abbonamento si sposta sulla nuova squadra.
// Su iPhone funzionano solo con la companion aggiunta alla schermata Home (iOS 16.4+).

import { useCallback, useEffect, useRef, useState } from 'react';

export type PushState = 'checking' | 'unsupported' | 'needs-install' | 'unavailable' | 'off' | 'on' | 'denied' | 'busy' | 'error';

const SW_URL = '/companion-sw.js';
const SCOPE = '/companion';

function keyBytes(base64url: string) {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export function usePush({ matchId, token, language }: { matchId: string; token: string; language: 'it' | 'en' }) {
  const [state, setState] = useState<PushState>('checking');
  const key = useRef<string | null>(null);

  const call = useCallback((method: 'POST' | 'DELETE', body: unknown) => fetch(`/api/live/${matchId}/push`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }), [matchId, token]);

  useEffect(() => {
    let cancelled = false;
    const set = (s: PushState) => { if (!cancelled) setState(s); };
    (async () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!supported) return set(ios && !standalone ? 'needs-install' : 'unsupported');
      const { publicKey } = await fetch(`/api/live/${matchId}/push`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ publicKey: null }));
      if (!publicKey) return set('unavailable');
      key.current = publicKey;
      if (Notification.permission === 'denied') return set('denied');
      const registration = await navigator.serviceWorker.getRegistration(SCOPE);
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription || Notification.permission !== 'granted') return set('off');
      // Già attive su questo telefono: si legano a questa partita e squadra
      const res = await call('POST', { subscription: subscription.toJSON(), language }).catch(() => null);
      set(res?.ok ? 'on' : 'off');
    })().catch(() => set('error'));
    return () => { cancelled = true; };
  }, [matchId, call, language]);

  // Va chiamata da un tocco: iPhone chiede il permesso solo in risposta a un gesto
  const enable = useCallback(async () => {
    if (!key.current) return;
    setState('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setState(permission === 'denied' ? 'denied' : 'off'); return; }
      await navigator.serviceWorker.register(SW_URL, { scope: SCOPE });
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription()
        ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key.current) });
      const res = await call('POST', { subscription: subscription.toJSON(), language });
      setState(res.ok ? 'on' : 'error');
    } catch {
      setState('error');
    }
  }, [call, language]);

  const disable = useCallback(async () => {
    setState('busy');
    try {
      const registration = await navigator.serviceWorker.getRegistration(SCOPE);
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await call('DELETE', { endpoint: subscription.endpoint }).catch(() => null);
        await subscription.unsubscribe();
      }
      setState('off');
    } catch {
      setState('error');
    }
  }, [call]);

  return { state, enable, disable };
}
