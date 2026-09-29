// Levanta `vite preview` (la app ya compilada) y espera a que responda.
const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function startPreview(port = 4173) {
  const url = `http://localhost:${port}/`
  if (await ping(url)) return { url, stop() {} } // ya hay un servidor corriendo
  const child = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    stdio: 'ignore',
    cwd: path.resolve(__dirname, '..'),
  })
  for (let i = 0; i < 80; i++) {
    if (await ping(url)) return { url, stop: () => child.kill() }
    await new Promise((r) => setTimeout(r, 250))
  }
  child.kill()
  throw new Error('El servidor de vista previa no arrancó. ¿Corriste `npm run build`?')
}

module.exports = { startPreview }
