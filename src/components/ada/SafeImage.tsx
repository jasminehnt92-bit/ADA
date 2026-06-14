import { useState } from "react";
import { ImageIcon } from "lucide-react";

export function SafeImage({
  src,
  alt = "",
  className = "",
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ backgroundColor: "#FDFBF7" }}
      >
        <ImageIcon className="h-8 w-8 text-navy" strokeWidth={1.25} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
