import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: PythonNotice,
});

function PythonNotice() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-8">
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold">Trading Journal — Python edition</h1>
        <p className="text-sm text-muted-foreground">
          This project is now a pure Python (NiceGUI) desktop-style app that
          runs locally on your SSD with two SQLite databases. The React UI in
          this preview is no longer used.
        </p>
        <div className="rounded-md border border-border bg-card p-4 font-mono text-xs">
          <div>cd python</div>
          <div>bash run.sh</div>
          <div className="text-muted-foreground">↳ open http://localhost:8080</div>
        </div>
        <p className="text-xs text-muted-foreground">
          See <code>python/README.md</code> for details. Data lives in{" "}
          <code>python/data/journal.db</code> and{" "}
          <code>python/data/strategies/strategies.db</code>.
        </p>
      </div>
    </div>
  );
}
