import inteliProxy from 'inteliProxy';
import fs from 'fs';
import { InteliSHA256Factory } from 'app/inteliProtocol/Authentification/InteliSHA256';
import http from 'http';

if (!fs.existsSync(`${process.cwd()}/clientPublicKey.pem`)) {
  InteliSHA256Factory.genKeys();
}

// TEST Inteli proxy start and stop with delay
const checkOrigin: (origin: string) => Promise<boolean> = async (
  origin: string
) => {
  return true;
};
const proxyServer = new inteliProxy.ProxyServer(checkOrigin, 'clientPublicKey');
proxyServer.start();
setTimeout(() => {
  proxyServer.stop();
}, 30000);

const proxyClient = new inteliProxy.ProxyWebServer(
  'localhost',
  4242,
  'CLI_001',
  'clientPrivateKey',
  http.createServer((req, res) => {
    res.setHeader('content-type', 'text/plain');
    res.end('hello, world!');
  })
);
setTimeout(() => {
  proxyClient.start();
  setTimeout(() => {
    proxyClient.stop();
  }, 10000);
}, 2000);
