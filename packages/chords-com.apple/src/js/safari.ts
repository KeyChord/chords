import { runSudoCommand, onAppLaunch } from 'chord'
import getPort from 'get-port';
import spawn from 'nano-spawn-compat'

export default async function buildSafariHandler() {
  const safariDriverPort = await getPort();
  await spawn('safaridriver', ['-p', safariDriverPort.toString()]);

  return async function safari() {
    await runSudoProcess('safaridriver', ['--enable']);
  }
}
