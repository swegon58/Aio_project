// R15 UI backlog — regression test for the image-vision wiring gap: an
// image attachment must survive buildRuntimeMessages as an image_url part,
// not get silently dropped (convertToModelMessages emits type: "file", not
// type: "image", for attachments).
// Runner: tsx --test

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { UIMessage } from "ai";
import { buildRuntimeMessages } from "./chat-route-handler.js";

describe("buildRuntimeMessages", () => {
  it("carries an image attachment through as an image_url part", async () => {
    const messages: UIMessage[] = [
      {
        id: "m1",
        role: "user",
        parts: [
          { type: "text", text: "what is this?" },
          {
            type: "file",
            mediaType: "image/png",
            filename: "photo.png",
            url: "data:image/png;base64,AAAA",
          },
        ],
      },
    ];

    const { lastMessage } = await buildRuntimeMessages(messages);
    assert.ok(Array.isArray(lastMessage?.content), "expected multimodal array content");
    const content = lastMessage!.content as Array<{ type: string; image_url?: { url: string } }>;
    const imagePart = content.find((part) => part.type === "image_url");
    assert.ok(imagePart, "expected an image_url part");
    assert.equal(imagePart!.image_url!.url, "data:image/png;base64,AAAA");
  });

  it("keeps text-only messages as a plain string", async () => {
    const messages: UIMessage[] = [
      { id: "m1", role: "user", parts: [{ type: "text", text: "hello" }] },
    ];
    const { lastMessage } = await buildRuntimeMessages(messages);
    assert.equal(lastMessage?.content, "hello");
  });
});
