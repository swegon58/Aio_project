"use client";

import { useState } from "react";
import {
  Download,
  ImageIcon,
  Loader2,
  Maximize2,
  PenLine,
  RefreshCw,
  X,
} from "lucide-react";
import type { AioGeneratedImage } from "@/lib/hermes/chat-types";

interface GeneratedImageCardProps {
  image: AioGeneratedImage;
  onEdit: (image: AioGeneratedImage) => void;
  onVariation: (image: AioGeneratedImage) => void;
  onOpen: (image: AioGeneratedImage) => void;
}

export function GeneratedImageCard({
  image,
  onEdit,
  onVariation,
  onOpen,
}: GeneratedImageCardProps) {
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">("loading");
  const stableUrl = `/api/gallery/image?id=${encodeURIComponent(image.id)}`;
  const stableImage = image.url === stableUrl ? image : { ...image, url: stableUrl };

  return (
    <figure className="generated-image-card">
      <button
        type="button"
        className="generated-image-preview"
        onClick={() => onOpen(stableImage)}
        aria-label="Open generated image"
      >
        {imageState === "loading" && <span className="generated-image-loading" />}
        {imageState === "error" && (
          <span className="generated-image-failed">
            <ImageIcon className="w-5 h-5" />
            Image preview unavailable
          </span>
        )}
        {/* Private image URLs are dynamic and cannot be known to Next Image at build time. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={stableUrl}
          alt={image.prompt}
          className={imageState === "ready" ? "ready" : ""}
          onLoad={() => setImageState("ready")}
          onError={() => setImageState("error")}
        />
        <span className="generated-image-expand" aria-hidden>
          <Maximize2 className="w-4 h-4" />
        </span>
      </button>
      <figcaption className="generated-image-meta">
        <span>
          GPT Image 2 · {image.aspectRatio} · {image.resolution}
        </span>
        <span>${image.estimatedCostUsd.toFixed(2)} estimated</span>
      </figcaption>
      <div className="generated-image-actions">
        <button type="button" onClick={() => onEdit(stableImage)}>
          <PenLine className="w-3.5 h-3.5" /> Edit
        </button>
        <button type="button" onClick={() => onVariation(stableImage)}>
          <RefreshCw className="w-3.5 h-3.5" /> Variations
        </button>
        <a
          href={`${stableUrl}&download=1`}
          download={`aio-${image.id}.png`}
        >
          <Download className="w-3.5 h-3.5" /> Download
        </a>
      </div>
    </figure>
  );
}

interface ImageGenerationProgressProps {
  status: "preparing" | "generating" | "saving";
  onCancel: () => void;
}

const STATUS_COPY = {
  preparing: "Preparing your image",
  generating: "Creating with GPT Image 2",
  saving: "Saving to your Gallery",
} as const;

export function ImageGenerationProgress({
  status,
  onCancel,
}: ImageGenerationProgressProps) {
  return (
    <div className="image-generation-progress" role="status" aria-live="polite">
      <span className="image-generation-progress-icon">
        {status === "saving" ? (
          <ImageIcon className="w-4 h-4" />
        ) : (
          <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
        )}
      </span>
      <span>
        <strong>{STATUS_COPY[status]}</strong>
        <small>This may take about a minute.</small>
      </span>
      <button type="button" onClick={onCancel} aria-label="Cancel image generation">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
