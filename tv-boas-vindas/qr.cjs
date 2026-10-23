// Gera os QRs (wifi-qr.svg e visitante-qr.svg) a partir do dados.js. Chamado pelo empacotar.ps1.
const fs = require("fs"), path = require("path"), QR = require("qrcode");
const window = {};
eval(fs.readFileSync(path.join(__dirname, "dados.js"), "utf8"));
const D = window.DADOS;
const esc = (s) => String(s).replace(/([\\;,:"])/g, "\\$1");
const gerar = (texto, arq) => {
  const destino = path.join(__dirname, arq);
  if (!texto) return fs.rmSync(destino, { force: true });
  return QR.toString(texto, { type: "svg", margin: 1, color: { dark: "#1f5c39", light: "#ffffff" } }).then((svg) => fs.writeFileSync(destino, svg));
};
gerar(`WIFI:T:WPA;S:${esc(D.wifi.rede)};P:${esc(D.wifi.senha)};;`, "wifi-qr.svg");
gerar(D.visitante, "visitante-qr.svg");
