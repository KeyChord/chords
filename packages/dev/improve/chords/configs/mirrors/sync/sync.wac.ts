import { Workflow } from "@github-actions-workflow-ts/lib";

export const syncWorkflow = new Workflow("sync", {
  name: "Sync",
  on: {
    push: { branches: ["main"] },
    workflow_dispatch: {},
    // Repair mirror-only edits even when the source has not changed.
    schedule: [{ cron: "17 * * * *" }],
  },
  permissions: { contents: "read" },
  concurrency: {
    group: "sync-mirrors",
    "cancel-in-progress": false,
  },
  jobs: {
    "sync-to-mirrors": {
      if: "${{ github.repository == 'KeyChord/chords' && github.ref == 'refs/heads/main' }}",
      "runs-on": "ubuntu-latest",
      "timeout-minutes": 20,
      steps: [
        {
          uses: "actions/checkout@v4",
          with: {
            // Queued and manual runs always reconcile the latest main.
            ref: "main",
            "fetch-depth": 0,
            "persist-credentials": false,
          },
        },
        { uses: "voidzero-dev/setup-vp@v1", with: { cache: true } },
        {
          name: "Verify generated workflow",
          run: "git diff --exit-code -- .github/workflows",
        },
        {
          name: "Sync read-only mirrors",
          run: "vp run mirrors:sync",
          env: {
            BUILD_BASE: "${{ github.workspace }}/@keychord",
            // checkout may have advanced beyond the revision that queued the run.
            GITHUB_SHA: "HEAD",
            API_TOKEN_GITHUB: "${{ secrets.ORG_KEYCHORD_BOT_PAT }}",
          },
        },
      ],
    },
  },
});
