import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/** QR code image (data URL) for a link, or null while it's being made. */
export function useQr(link: string | null, width = 480): string | null {
  const [qr, setQr] = useState<{ link: string; url: string } | null>(null);
  useEffect(() => {
    if (!link) return;
    let alive = true;
    QRCode.toDataURL(link, { margin: 1, width }).then(
      (url) => alive && setQr({ link, url }),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [link, width]);
  return link && qr?.link === link ? qr.url : null;
}
