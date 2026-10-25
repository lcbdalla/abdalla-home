// Copie este arquivo para "dados.js" (na mesma pasta) e troque os textos.
// O dados.js NÃO vai para o GitHub (tem a senha do Wi-Fi e a do usuário TV).
window.DADOS = {
  titulo: "Seja bem-vindo ao Rancho Abdalla",
  subtitulo: "Que sua estadia seja tranquila. Fique à vontade!",
  wifi: { rede: "NOME-DA-REDE", senha: "SENHA-DO-WIFI" },
  // Exemplos de comandos de voz (cartão "Fale com a Alexa").
  alexa: ["ligar o ar", "apagar a luz", "acender o abajur"],
  // Usuário TV do app (visitante sem validade, só com o Quarto Visita). Com ele a TV
  // mostra os botões do quarto e o QR/nome do visitante atual (Equipe > Gerar acesso de visitante).
  tv: { email: "", senha: "" },
  // Supabase (chave publishable/anon, a mesma do .env.local).
  supabaseUrl: "https://hsfnreiryoyenhablydm.supabase.co",
  supabaseKey: "",
};
