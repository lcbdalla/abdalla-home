# Gera privado\boas-vindas.wgt (com a senha do Wi-Fi, por isso fica na pasta privado, fora do GitHub).
# Rodar: botão direito > "Executar com o PowerShell", ou: powershell -File tv-boas-vindas\empacotar.ps1
$pasta = $PSScriptRoot
if (-not (Test-Path "$pasta\dados.js")) { Write-Host "Falta o dados.js: copie o dados.exemplo.js para dados.js e preencha."; exit 1 }
$saida = Join-Path (Split-Path $pasta) "privado"
New-Item -ItemType Directory -Force $saida | Out-Null
$zip = "$saida\boas-vindas.zip"
Remove-Item $zip, "$saida\boas-vindas.wgt" -ErrorAction SilentlyContinue
Compress-Archive -Path "$pasta\config.xml", "$pasta\index.html", "$pasta\icon.png", "$pasta\dados.js", "$pasta\dados.exemplo.js" -DestinationPath $zip
Rename-Item $zip "boas-vindas.wgt"
Write-Host "Pronto: $saida\boas-vindas.wgt"
