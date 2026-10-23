# Tela de boas-vindas — TV do Quarto Visita (Samsung QM50Q8FAAGXZD)

## Mudar os textos (Wi-Fi, avisos)
1. Abra `tv-boas-vindas\dados.js` no Bloco de Notas e troque os textos.
   (Esse arquivo não vai para o GitHub. Se ele sumir, copie o `dados.exemplo.js` para `dados.js`.)
2. Clique com o botão direito em `empacotar.ps1` > "Executar com o PowerShell".
3. Instale de novo o arquivo `privado\boas-vindas.wgt` na TV (passo abaixo).

## Instalar na TV (só o computador e a TV na mesma rede)
1. **No computador:** descubra o IP dele (Configurações > Rede e Internet > Propriedades do Wi-Fi > "Endereço IPv4").
2. **Na TV:** abra **Apps**. Com o controle, digite **1 2 3 4 5** (use o teclado numérico da tela, se o controle não tiver números).
   Ligue o **Modo Desenvolvedor**, coloque o IP do computador e **desligue e ligue a TV** (na tomada, se precisar).
3. **No computador:** baixe o **Apps2Samsung** em https://github.com/Apps2Samsung/Apps2Samsung/releases (versão Windows).
   Abra, escolha a TV, escolha **"arquivo .wgt próprio"** e aponte para `privado\boas-vindas.wgt`. Instale.
   (Na primeira vez ele pede login na conta Samsung para gerar o certificado.)
4. O app aparece em **Apps** com o nome **"Bem-vindo"**. Dá para mover para o começo da lista.
5. Depois de instalado, pode **desligar o Modo Desenvolvedor** na TV (mesmo caminho do passo 2).

O botão **VOLTAR** do controle fecha a tela de boas-vindas.

## Ver no computador antes de instalar
Abra `index.html` com um servidor local (ou peça ao Claude: "abre a tela de boas-vindas").
