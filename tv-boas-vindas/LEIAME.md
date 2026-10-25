# Tela de boas-vindas — TV do Quarto Visita (Samsung QM50Q8FAAGXZD)

Mostra: "Bem-vindo, <nome do visitante>!", relógio, botões do quarto (luz, ar, persiana — setas e OK do
controle), cartão da Alexa, QR do Wi-Fi, QR do controle da casa do visitante atual e a estação meteorológica.

## Como o QR e o nome do visitante chegam na TV (sozinhos)
- No app: Equipe > Gerar acesso de visitante, com o nome e a caixinha "Mostrar na TV do Quarto Visita".
- A TV confere a cada 5 minutos. Quando o visitante vence ou é removido, o QR some e volta o "Seja bem-vindo".
- Não precisa reinstalar nada na TV para trocar de visitante.

## Dados guardados na TV (`tv-boas-vindas\dados.js`, fora do GitHub)
- Wi-Fi (rede e senha), frases da Alexa.
- `tv`: e-mail e senha do usuário TV do app (visitante sem validade, só com o Quarto Visita e com a chave
  "É a TV do Quarto Visita" ligada na Equipe). Sem ele, a TV não mostra os botões nem o QR do visitante.
- Se o dados.js sumir, copie o `dados.exemplo.js` para `dados.js` e preencha.

Mudou algo no dados.js? Botão direito em `empacotar.ps1` > "Executar com o PowerShell" e reinstale
`privado\boas-vindas.wgt` na TV.

## Instalar na TV
1. **TV:** Apps > digite **1 2 3 4 5** (pelo teclado numérico do controle do app SmartThings no celular).
   Modo Desenvolvedor **On**, IP do computador (hoje 192.168.120.200), OK. Tire a TV da tomada 30 s.
2. **Computador:** abra o **Apps2Samsung** (https://github.com/Apps2Samsung/Apps2Samsung/releases, arquivo
   `...-win-x64.msi`). Em "Selecionar TV" escolha a **QM50Q8FAAGXZD** (não a de 55" do quarto do casal).
3. Escolha **"Arquivo WGT / TPK"**, aponte para `privado\boas-vindas.wgt` e clique em **Baixar e instalar**.
4. Na TV, o app aparece em Apps como **"Bem-vindo"**. Depois desligue o Modo Desenvolvedor (mesmo caminho, Off).

O botão **VOLTAR** do controle fecha a tela de boas-vindas.
