import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compiler from 'babel-plugin-react-compiler'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [compiler],
      },
    }),
  ],
  server: {
    port: 8000, // Set the port to 8000
  },
})
