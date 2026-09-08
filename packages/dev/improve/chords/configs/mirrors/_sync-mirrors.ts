#!/usr/bin/env node
import { runMain } from "citty";
import { syncMirrorsCommand } from "#sync-mirrors-command";

await runMain(syncMirrorsCommand);
