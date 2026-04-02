#!/usr/bin/env bun
import '@jxa/global-type';
import * as jxa from '../src/jxa/_.ts'
import { runJxaWithUtils } from '../src/utils/jxa.ts'

await runJxaWithUtils(jxa, () => {
  jxa.dumpFocusedApp(3);
})
