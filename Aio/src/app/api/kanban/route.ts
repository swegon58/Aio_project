import { spawn } from "child_process";
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { hermesSpawnEnv } from "@/lib/hermes/config";

const HERMES_BIN = "/home/swegon/.local/bin/hermes";

// Mirrors hermes_cli/kanban.py's _cmd_list status set (kanban_db.py Task.status).
const KANBAN_STATUSES = [
  "todo",
  "ready",
  "running",
  "scheduled",
  "blocked",
  "done",
  "archived",
] as const;

interface KanbanTask {
  id: string;
  title: string;
  status: string;
  assignee: string | null;
  priority: number | string | null;
  created_at: string | null;
  updated_at?: string | null;
}

function run(
  cmd: string,
  args: string[],
  env: Record<string, string>,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: { ...process.env, ...env } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

// GET /api/kanban — read-only snapshot of the Hermes Kanban board for the
// signed-in customer's profile, grouped by status. Shells out to
// `hermes kanban list --json --archived` (kanban.py _cmd_list) instead of
// reading kanban.db directly — board resolution, recompute_ready(), and
// multi-board fallback logic live in kanban_db.py and are nontrivial to
// reimplement safely from Node. `--archived` is included so archived tasks
// still show in their column rather than disappearing silently.
export async function GET() {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { row } = ctxResult.ctx;

  const profileName = row.profile_name ?? "aio";

  const result = await run(
    HERMES_BIN,
    ["-p", profileName, "kanban", "list", "--json", "--archived"],
    hermesSpawnEnv(profileName),
  );

  if (result.code !== 0) {
    return Response.json(
      { error: `hermes kanban list failed: ${result.stderr || "unknown error"}` },
      { status: 502 },
    );
  }

  let tasks: KanbanTask[] = [];
  try {
    tasks = JSON.parse(result.stdout || "[]");
  } catch {
    return Response.json(
      { error: "Failed to parse kanban list output" },
      { status: 502 },
    );
  }

  const columns: Record<string, KanbanTask[]> = {};
  for (const status of KANBAN_STATUSES) columns[status] = [];
  for (const task of tasks) {
    const bucket = columns[task.status] ?? (columns[task.status] = []);
    bucket.push(task);
  }

  return Response.json({ statuses: KANBAN_STATUSES, columns });
}
