import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import compiler from 'babel-plugin-react-compiler'
import { readJsonBody, sendJson, translateText } from './server/translateProxy.js'
import { rateLimit, getClientIp, validateTranslationInput } from './server/rateLimiter.js'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react({
        babel: {
          // App.jsx is intentionally large; compact output avoids Babel's
          // >500KB code-generator deoptimisation warning during builds.
          compact: true,
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

            // Rate limiting
            const clientIp = getClientIp(req)
            const limitResult = rateLimit(clientIp)
            if (!limitResult.allowed) {
              res.setHeader('Retry-After', String(Math.ceil((limitResult.resetAt - Date.now()) / 1000)))
              return sendJson(res, 429, { error: 'Rate limit exceeded. Please try again later.' })
            }

            try {
              const body = await readJsonBody(req)

              // Input validation
              const validationError = validateTranslationInput(body)
              if (validationError) {
                return sendJson(res, 400, { error: validationError })
              }

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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('/firebase/')) return 'firebase';
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
            if (id.includes('/papaparse/')) return 'csv-vendor';
            if (id.includes('/xlsx/')) return 'xlsx-vendor';
          },
        },
      },
    },
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
