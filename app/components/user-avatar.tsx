"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

export default function UserAvatar({
  imageUrl,
  name,
  size = 34,
  fallback,
}: {
  imageUrl?: string;
  name: string;
  size?: number;
  fallback?: ReactNode;
}) {
  const [failedUrl, setFailedUrl] = useState("");
  return imageUrl && imageUrl !== failedUrl ? (
    <Image
      src={imageUrl}
      alt={`${name} профайлын зураг`}
      width={size}
      height={size}
      unoptimized
      className="user-avatar-image"
      onError={() => setFailedUrl(imageUrl)}
    />
  ) : (
    (fallback ?? name.slice(0, 1))
  );
}
