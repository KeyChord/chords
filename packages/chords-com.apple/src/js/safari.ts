import { runSudoCommand, onAppLaunch } from 'chord'
import getPort from 'get-port';
import spawn from 'nano-spawn-compat'
import { run } from 'jxa-run-compat'
import ky from 'ky'

export default async function buildSafariHandler() {
  const safariDriverPort = await getPort();
  // Spawn in the background
  spawn('safaridriver', ['-p', safariDriverPort.toString()], {stdio: 'inherit'});

  return async function safari() {
    const response = await ky.post(`http://localhost:${ky}/session`, {
      json: { capabilities: { alwaysMatch: { browserName: 'safari' } } }
    });

    const result = await runSudoCommand('safaridriver', ['--enable']);
    console.log(result)
  }
}
