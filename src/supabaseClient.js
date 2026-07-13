import { createClient } from '@supabase/supabase-js'

// O Vite injeta as variaveis do .env.local em import.meta.env
// (apenas as que comecam com VITE_ ficam disponiveis no frontend).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

// Aviso util durante o desenvolvimento caso o .env.local nao esteja preenchido.
if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_KEY nao definidas. ' +
      'Preencha o arquivo .env.local.'
  )
}

// Cliente unico do Supabase, reutilizado em todo o app.
export const supabase = createClient(supabaseUrl, supabaseKey)
