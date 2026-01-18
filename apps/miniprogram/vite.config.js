import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { UnifiedViteWeappTailwindcssPlugin } from 'weapp-tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || ''),
      'define_import_meta_env_default.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
      'define_import_meta_env_default.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || '')
    },
    plugins: [
      uni(),
      UnifiedViteWeappTailwindcssPlugin({
        rem2rpx: true,
        cssEntries: [path.resolve(process.cwd(), 'src/tailwind.css')]
      })
    ],
    css: {
      postcss: {
        plugins: [
          require('tailwindcss')(),
          require('autoprefixer')()
        ]
      }
    }
  }
})
