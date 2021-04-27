import inteliProxy from 'inteliProxy';
import fs from 'fs';
import { InteliSHA256Factory } from 'app/inteliProtocol/Authentification/InteliAgentSHA256';
import http from 'http';

if (!fs.existsSync(`${process.cwd()}/CLI_001_privateKey.pem`)) {
  InteliSHA256Factory.genKeys('CLI_001');
}

// TEST Inteli proxy start and stop with delay
const checkOrigin: (origin: string) => Promise<boolean> = async (
  origin: string
) => {
  return true;
};
const proxyServer = new inteliProxy.ProxyServer(checkOrigin);
proxyServer.start();
setTimeout(() => {
  proxyServer.stop();
}, 60000);

const proxyClient = new inteliProxy.ProxyWebServer(
  'localhost',
  4242,
  'CLI_001',
  http.createServer((req, res) => {
    res.setHeader('content-type', 'text/plain');
    res.end('hello, world!');
  })
);
setTimeout(() => {
  proxyClient.start();
  setTimeout(() => {
    proxyClient.stop();
  }, 40000);
}, 2000);
