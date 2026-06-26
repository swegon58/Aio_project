// Wire shape emitted by Hermes /v1/runs/{run_id}/events SSE.
// Keep this contained in the adapter layer; product code should prefer
// AioRunEvent from lib/aio/runs/aio-run-events.
export interface HermesRunEvent {
  event?: string;
  run_id?: string;
  timestamp?: number;
  delta?: string;
  tool?: string;
  tool_call_id?: string;
  input?: unknown;
  output?: unknown;
  preview?: string;
  risk?: string;
  risk_level?: string;
  duration?: number;
  error?: boolean;
  error_text?: string;
  result_preview?: string;
  file_path?: string;
  file_name?: string;
  artifact_id?: string;
  artifact_name?: string;
  mime_type?: string;
  url?: string;
  text?: string;
  title?: string;
  command?: string;
  description?: string;
  pattern_key?: string;
  allow_permanent?: boolean;
  choices?: string[];
  choice?: string;
  approval_id?: string;
  clarify_id?: string;
  question?: string;
  response?: string;
  status?: "running" | "completed" | "error";
  task_data?: {
    scriptPath?: string;
    code?: string;
    stdout?: string;
    resultsFile?: string;
    resultsTable?: Record<string, string>[];
  };
}
