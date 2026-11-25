'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * An image that develops into view: it starts blurred, slightly enlarged and transparent,
 * then settles once the file has loaded. Give it a different `key` when `src` changes.
 */
export default function Pic({ className = '', onLoad, alt = '', ...rest }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth) setReady(true); // already cached or loaded before hydration
  }, []);

  return (
    <img
      ref={ref}
      alt={alt}
      {...rest}
      className={`pic${ready ? ' ready' : ''}${className ? ' ' + className : ''}`}
      onLoad={(e) => { setReady(true); onLoad?.(e); }}
    />
  );
}
