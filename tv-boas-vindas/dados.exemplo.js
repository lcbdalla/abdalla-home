// Copie este arquivo para "dados.js" (na mesma pasta) e troque os textos.
// O dados.js NÃO vai para o GitHub (tem a senha do Wi-Fi e o link do visitante).
window.DADOS = {
  titulo: "Seja bem-vindo ao Rancho Abdalla",
  subtitulo: "Que sua estadia seja tranquila. Fique à vontade!",
  wifi: { rede: "NOME-DA-REDE", senha: "SENHA-DO-WIFI" },
  // Link do acesso de visitante (app > Equipe > Gerar acesso de visitante). Vazio = sem o QR.
  visitante: "",
  // Estação meteorológica do HA (chave publishable/anon do Supabase, a mesma do .env.local).
  supabaseUrl: "https://hsfnreiryoyenhablydm.supabase.co",
  supabaseKey: "",
  // Localização para a previsão do céu (padrão: Palmas-TO).
  lat: -10.18, lon: -48.33,
};
