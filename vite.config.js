import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import compiler from 'babel-plugin-react-compiler'
import { readJsonBody, sendJson, translateText } from './server/translateProxy.js'
import { rateLimit, getClientIp, validateTranslationInput } from './server/rateLimiter.js'
import { LoginError, verifyDealerLogin } from './server/loginService.js'
import { validateLoginInput, LOGIN_RATE_LIMIT } from './api/login.js'
import { buildPinHashPatch } from './server/pinAdmin.js'
import { checkLoginServiceConfig } from './server/loginConfigCheck.js'
import adminUsersHandler from './api/admin-users.js'
import invoiceWorkspaceHandler from './api/invoice-workspace.js'
import salesReportHandler from './api/sales-report.js'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // loadEnv returns values without populating process.env. The server-side
  // Admin SDK reads process.env, so explicitly forward only its configuration.
  // These credentials must never be exposed through Vite's client defines.
  for (const key of [
    'GOOGLE_APPLICATION_CREDENTIALS',
    'FIREBASE_SERVICE_ACCOUNT',
    'FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_PROJECT_ID',
  ]) {
    if (process.env[key] === undefined && env[key] !== undefined) {
      process.env[key] = env[key]
    }
  }

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
      {
        name: 'login-api-dev-route',
        configureServer(server) {
          server.middlewares.use('/api/admin-users', adminUsersHandler);
          server.middlewares.use('/api/invoice-workspace', invoiceWorkspaceHandler);
          server.middlewares.use('/api/sales-report', salesReportHandler);
          // Warn at boot, not just at the first failed login.
          checkLoginServiceConfig();

          server.middlewares.use('/api/login', async (req, res) => {
            if (req.method !== 'POST') {
              res.setHeader('Allow', 'POST')
              return sendJson(res, 405, { error: 'Method not allowed' })
            }

            const clientIp = getClientIp(req)
            const limitResult = rateLimit(clientIp, LOGIN_RATE_LIMIT)
            if (!limitResult.allowed) {
              res.setHeader('Retry-After', String(Math.ceil((limitResult.resetAt - Date.now()) / 1000)))
              return sendJson(res, 429, { error: 'Too many login attempts. Please try again later.', code: 'rate-limited' })
            }

            try {
              const body = await readJsonBody(req)

              const validationError = validateLoginInput(body)
              if (validationError) {
                return sendJson(res, 400, { error: validationError, code: 'invalid-input' })
              }

              const result = await verifyDealerLogin({
                dealerCode: body.dealerCode,
                pin: body.pin,
              })

              return sendJson(res, 200, result)
            } catch (error) {
              if (error instanceof LoginError) {
                return sendJson(res, error.status, { error: error.message, code: error.code })
              }
              console.error('Login failed:', error instanceof Error ? error.message : error)
              return sendJson(res, 500, { error: 'Login failed. Please try again.', code: 'server-error' })
            }
          })

          server.middlewares.use('/api/pin-hash', async (req, res) => {
            if (req.method !== 'POST') {
              res.setHeader('Allow', 'POST')
              return sendJson(res, 405, { error: 'Method not allowed' })
            }

            const limitResult = rateLimit(getClientIp(req), { windowMs: 60 * 1000, maxRequests: 30 })
            if (!limitResult.allowed) {
              res.setHeader('Retry-After', String(Math.ceil((limitResult.resetAt - Date.now()) / 1000)))
              return sendJson(res, 429, { error: 'Too many requests.', code: 'rate-limited' })
            }

            try {
              const body = await readJsonBody(req)
              if (!body?.pin || typeof body.pin !== 'string') {
                return sendJson(res, 400, { error: 'Missing or invalid "pin" field.', code: 'invalid-input' })
              }
              return sendJson(res, 200, await buildPinHashPatch(body.pin))
            } catch (error) {
              if (error instanceof LoginError) {
                return sendJson(res, error.status, { error: error.message, code: error.code })
              }
              console.error('PIN hash failed:', error instanceof Error ? error.message : error)
              return sendJson(res, 500, { error: 'PIN hashing failed.', code: 'server-error' })
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
