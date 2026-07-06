import { useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { AioGeneratedImage, HermesActivityData, HermesUIMessage } from "@/lib/hermes/chat-types";
import type { GalleryImage, ImageAspectRatio, ImageGenerationStatus, ImageResolution } from "@/components/app/app-home-types";

interface UseImageGenerationParams {
  messages: HermesUIMessage[];
  setMessages: (messages: HermesUIMessage[]) => void;
  setInput: Dispatch<SetStateAction<string>>;
  setComposerMenuOpen: Dispatch<SetStateAction<boolean>>;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  messagesEndRef: MutableRefObject<HTMLDivElement | null>;
  setLightboxImage: Dispatch<SetStateAction<GalleryImage | null>>;
  setGalleryImages: Dispatch<SetStateAction<GalleryImage[] | null>>;
  logMeta: (text: string) => void;
  setActiveConversationId: Dispatch<SetStateAction<string | null>>;
  loadConversations: () => Promise<void>;
  setActivity: Dispatch<SetStateAction<HermesActivityData[]>>;
  resetRunTimeline: () => void;
  setPlanAwaitingAction: Dispatch<SetStateAction<boolean>>;
}

// Image-generation composer mode (aspect/resolution/reference picker + the
// streamed /api/images/generate submit), extracted verbatim from AppHome.tsx.
// Heavily cross-cutting: touches the chat message list, conversation id,
// run-timeline reset, plan-flow, and gallery state, none of which are owned
// here, so they're all passed in as explicit args per the composition rule.
export function useImageGeneration({
  messages,
  setMessages,
  setInput,
  setComposerMenuOpen,
  textareaRef,
  messagesEndRef,
  setLightboxImage,
  setGalleryImages,
  logMeta,
  setActiveConversationId,
  loadConversations,
  setActivity,
  resetRunTimeline,
  setPlanAwaitingAction,
}: UseImageGenerationParams) {
  const [imageComposerActive, setImageComposerActive] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<ImageAspectRatio>("1:1");
  const [imageResolution, setImageResolution] = useState<ImageResolution>("1K");
  const [imageReference, setImageReference] = useState<AioGeneratedImage | null>(null);
  const [imageGenerationStatus, setImageGenerationStatus] =
    useState<ImageGenerationStatus | null>(null);
  const [imageGenerationError, setImageGenerationError] = useState<string | null>(null);
  const [imageLastPrompt, setImageLastPrompt] = useState("");
  const imageGenerationAbortRef = useRef<AbortController | null>(null);

  const activateImageComposer = (reference: AioGeneratedImage | null = null) => {
    setImageComposerActive(true);
    setImageReference(reference);
    setImageGenerationError(null);
    setComposerMenuOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleGeneratedImageOpen = (image: AioGeneratedImage) => {
    setLightboxImage({
      id: image.id,
      sessionId: null,
      caption: image.prompt,
      createdAt: image.createdAt,
      url: image.url,
      bare: true,
    });
  };

  const handleGeneratedImageEdit = (image: AioGeneratedImage) => {
    activateImageComposer(image);
    setInput("Edit this image: ");
  };

  const handleGeneratedImageVariation = (image: AioGeneratedImage) => {
    activateImageComposer(image);
    setInput("Create a new variation with ");
  };

  const cancelImageGeneration = () => {
    imageGenerationAbortRef.current?.abort();
    imageGenerationAbortRef.current = null;
    setImageGenerationStatus(null);
  };

  const submitImageGeneration = async (prompt: string) => {
    setImageLastPrompt(prompt);
    const userMessage: HermesUIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text: prompt }],
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setImageGenerationError(null);
    setImageGenerationStatus("preparing");
    setActivity([]);
    resetRunTimeline();
    setPlanAwaitingAction(false);

    const controller = new AbortController();
    imageGenerationAbortRef.current = controller;

    try {
      const response = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          aspectRatio: imageAspectRatio,
          resolution: imageResolution,
          referenceImageId: imageReference?.id ?? null,
          messages: nextMessages,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? `Image generation failed (${response.status}).`);
      }
      if (!response.body) throw new Error("Image generation returned no response stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let resultImage: AioGeneratedImage | null = null;
      let resultThreadId: string | null = null;
      let resultMessage: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: "status" | "result" | "error";
            status?: ImageGenerationStatus;
            image?: AioGeneratedImage;
            threadId?: string;
            message?: string;
          };
          if (event.type === "status" && event.status) {
            setImageGenerationStatus(event.status);
          } else if (event.type === "error") {
            throw new Error(event.message || "Image generation failed.");
          } else if (event.type === "result" && event.image) {
            resultImage = event.image;
            resultThreadId = event.threadId ?? null;
            resultMessage = event.message ?? null;
          }
        }
        if (done) break;
      }

      if (!resultImage) throw new Error("Image generation finished without an image.");
      const assistantMessage: HermesUIMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        parts: [{ type: "text", text: resultMessage ?? "Your image is ready." }],
        metadata: { mode: "auto", images: [resultImage] },
      };
      setMessages([...nextMessages, assistantMessage]);
      setActiveConversationId((current) => current ?? resultThreadId);
      setGalleryImages((current) => {
        const galleryImage: GalleryImage = {
          id: resultImage.id,
          sessionId: null,
          caption: resultImage.prompt,
          createdAt: resultImage.createdAt,
          url: resultImage.url,
        };
        return current ? [galleryImage, ...current.filter((item) => item.id !== resultImage.id)] : [galleryImage];
      });
      setImageReference(null);
      logMeta(`Created a ${resultImage.resolution} image and saved it to Gallery`);
      void loadConversations();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (error) {
      if (controller.signal.aborted) {
        setImageGenerationError("Image generation cancelled.");
      } else {
        setImageGenerationError(error instanceof Error ? error.message : "Image generation failed.");
      }
    } finally {
      if (imageGenerationAbortRef.current === controller) imageGenerationAbortRef.current = null;
      setImageGenerationStatus(null);
    }
  };

  return {
    imageComposerActive,
    setImageComposerActive,
    imageAspectRatio,
    setImageAspectRatio,
    imageResolution,
    setImageResolution,
    imageReference,
    setImageReference,
    imageGenerationStatus,
    imageGenerationError,
    setImageGenerationError,
    imageLastPrompt,
    imageGenerationAbortRef,
    activateImageComposer,
    handleGeneratedImageOpen,
    handleGeneratedImageEdit,
    handleGeneratedImageVariation,
    cancelImageGeneration,
    submitImageGeneration,
  };
}
