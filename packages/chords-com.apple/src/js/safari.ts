import { runSudoCommand, onAppLaunch } from 'chord'
import getPort from 'get-port';
import spawn from 'nano-spawn-compat'
import { run } from 'jxa-run-compat'

export default async function buildSafariHandler() {
  const safariDriverPort = await getPort();
  spawn('safaridriver', ['-p', safariDriverPort.toString()], {stdio: 'inherit'});
  console.log(safariDriverPort)
  console.log(await fetch('http://google.com'))

  const fetchSession = async () => {
    const response = await fetch(`http://127.0.0.1:${safariDriverPort}/session`, {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capabilities: { alwaysMatch: { browserName: 'safari' } } })
    });
    return response;
  }

  return async function safari() {
    let response = await fetchSession()
    const json: any = await response.json()

    if (json?.value?.message === "Could not create a session: You must enable 'Allow remote automation' in the Developer section of Safari Settings to control Safari via WebDriver.") {
      // TODO: show a dialog with JXA to let the user know
      await runSudoCommand('safaridriver', ['--enable']);
      response = await fetchSession()
    }

    console.log(response)

  //   const response = await fetch(`${baseUrl}/execute/sync`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ script: script, args: [] })
  // });
  // const data = await response.json();

  }
}
