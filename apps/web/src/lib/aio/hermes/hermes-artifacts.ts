export function artifactUrlForRunPath(runId: string, filePath: string): string {
  return `/api/chat/artifact?runId=${encodeURIComponent(runId)}&path=${encodeURIComponent(filePath)}`;
}
