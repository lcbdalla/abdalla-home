// Gera o QR do Wi-Fi (wifi-qr.svg) a partir do dados.js. Chamado pelo empacotar.ps1.
const fs = require("fs"), path = require("path"), QR = require("qrcode");
const window = {};
eval(fs.readFileSync(path.join(__dirname, "dados.js"), "utf8"));
const esc = (s) => String(s).replace(/([\\;,:"])/g, "\\$1");
const { rede, senha } = window.DADOS.wifi;
QR.toString(`WIFI:T:WPA;S:${esc(rede)};P:${esc(senha)};;`, { type: "svg", margin: 1, color: { dark: "#1f5c39", light: "#ffffff" } })
  .then((svg) => fs.writeFileSync(path.join(__dirname, "wifi-qr.svg"), svg));
