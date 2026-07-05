const IMAGE_READY_REPLIES = [
  "Your image is ready.",
  "Here it is — hot off the render.",
  "Done! Take a look.",
  "All set, here's your image.",
  "Ready for you.",
  "Here's what I made.",
] as const;

export function pickImageReadyReply(): string {
  return IMAGE_READY_REPLIES[Math.floor(Math.random() * IMAGE_READY_REPLIES.length)];
}
