import { useEffect, useRef } from 'react';

/** Shows an existing MediaStream (the Mac camera) in another <video> element. */
export function LiveVideo({ stream, mirror }: { stream: MediaStream | null; mirror: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (v && v.srcObject !== stream) v.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className={mirror ? 'is-mirrored' : undefined} />;
}
