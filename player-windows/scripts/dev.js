import { createServer } from 'vite'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const viteConfig = fileURLToPath(new URL('../vite.config.ts', import.meta.url))

const server = await createServer({ configFile: viteConfig, root })
await server.listen()
const port = server.config.server.port || 5173
const url = `http://localhost:${port}`

const electronPath = (await import('electron')).default
const child = spawn(electronPath, ['.'], {
  cwd: root,
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
  stdio: 'inherit',
})

child.on('exit', () => {
  server.close()
  process.exit(0)
})

process.on('SIGINT', () => {
  child.kill()
  server.close()
  process.exit(0)
})
