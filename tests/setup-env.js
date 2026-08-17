// Isolate every test run from the developer's real ~/.dsh/free-vision.json.
// The plugin honors DSH_FREE_VISION_CONFIG_PATH; tests write to a temp file
// under the OS temp directory instead of the user's home directory.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'dsh-free-vision-test-'))
process.env.DSH_FREE_VISION_CONFIG_PATH = join(dir, 'free-vision.json')

// Best-effort cleanup when the worker exits; test runners normally clean up
// their own temp dirs after the process ends, but this keeps /tmp tidy.
process.on('exit', () => {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    // ignore
  }
})