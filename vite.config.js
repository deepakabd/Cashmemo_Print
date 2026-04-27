import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import compiler from 'babel-plugin-react-compiler'
import { readJsonBody, sendJson, translateText } from './server/translateProxy.js'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react({
        babel: {
          plugins: [compiler],
        },
      }),
      {
        name: 'translate-api-dev-route',
        configureServer(server) {
          server.middlewares.use('/api/translate', async (req, res) => {
            if (req.method !== 'POST') {
              res.setHeader('Allow', 'POST')
              return sendJson(res, 405, { error: 'Method not allowed' })
            }

            try {
              const body = await readJsonBody(req)
              const translatedText = await translateText({
                apiKey: env.GOOGLE_CLOUD_API_KEY,
                text: body.text,
                source: body.source,
                target: body.target,
                format: body.format,
              })

              return sendJson(res, 200, { translatedText })
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Translation failed'
              console.error('Translation API failed:', message)
              return sendJson(res, 500, { error: message })
            }
          })
        },
      },
    ],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './test/setupTests.js',
      pool: 'threads',
      maxWorkers: 1,
      minWorkers: 1,
    },
    server: {
      port: 8000, // Set the port to 8000
    },
  }
})
