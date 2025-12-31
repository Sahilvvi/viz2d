import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import wasm from "vite-plugin-wasm"

export default defineConfig(({ mode }) => {
  // Load env variables based on mode (development/production)
  const env = loadEnv(mode, process.cwd(), "")

  return {
    plugins: [react(),wasm()],
    esbuild:{
      supported:{
        'top-level-await':true
      }
    },
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(env.API_URL),
      "import.meta.env.VITE_WEBSITE_URL": JSON.stringify(env.WEBSITE_URL),
      "import.meta.env.VITE_GOOGLE_MAPS_API_KEY": JSON.stringify(env.GOOGLE_MAPS_API_KEY),
      "import.meta.env.VITE_MINIO_PUBLIC_URL": JSON.stringify(env.MINIO_PUBLIC_URL),
      "import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID": JSON.stringify(env.GOOGLE_OAUTH_CLIENT_ID),
      "import.meta.env.VITE_GIPHY_API_KEY": JSON.stringify(env.GIPHY_API_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src")
      },
    },
  }
})
