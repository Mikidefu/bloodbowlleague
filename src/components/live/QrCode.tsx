'use client';
// QR code disegnato in SVG: un solo path con i moduli scuri, nero su bianco perché ogni fotocamera lo legga.

import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

export default function QrCode({ value, size = 180, label }: { value: string; size?: number; label: string }) {
  const { count, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    }
    return { count: n, path: d };
  }, [value]);

  const margin = 4;   // zona di rispetto richiesta dallo standard
  const box = count + margin * 2;
  return (
      <svg width={size} height={size} viewBox={`${-margin} ${-margin} ${box} ${box}`} role="img" aria-label={label} shapeRendering="crispEdges">
        <rect x={-margin} y={-margin} width={box} height={box} fill="#fff" />
        <path d={path} fill="#000" />
      </svg>
  );
}
