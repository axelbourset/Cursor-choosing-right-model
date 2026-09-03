import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'
import { SNAPSHOT_DEV_URL, SNAPSHOT_PATH } from './schema/snapshot'

export function serveSnapshot(): Plugin {
  return {
    name: 'serve-snapshot',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url !== SNAPSHOT_DEV_URL) {
          next()
          return
        }

        const filePath = path.resolve(server.config.root, SNAPSHOT_PATH)
        if (!existsSync(filePath)) {
          res.statusCode = 404
          res.end()
          return
        }

        readFile(filePath, 'utf-8')
          .then((content) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(content)
          })
          .catch(next)
      })
    },
  }
}
