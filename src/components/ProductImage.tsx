import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  style?: CSSProperties;
  draggable?: boolean;
  loading?: 'eager' | 'lazy';
  decoding?: 'sync' | 'async' | 'auto';
  fetchPriority?: 'high' | 'low' | 'auto';
}

export function ProductImage({
  src,
  alt,
  className = '',
  style,
  draggable,
  loading = 'lazy',
  decoding = 'async',
  fetchPriority = 'auto',
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#E7E2D8] dark:bg-[#232328] text-[#5C5952] dark:text-[#A4A097] p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Package className="w-8 h-8 mb-2 opacity-60" aria-hidden="true" />
        <span className="text-xs font-medium tracking-wide max-w-[16ch] truncate">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      style={style}
      draggable={draggable}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
