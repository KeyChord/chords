#!/usr/bin/env node
import { runMain } from "citty";
import { listMirrorsCommand } from "#list-mirrors-command";

await runMain(listMirrorsCommand);
