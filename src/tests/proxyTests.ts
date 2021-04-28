import inteliProxy from 'inteliProxy';
import fs from 'fs';
import { InteliSHA256Factory } from 'app/inteliProtocol/Authentification/InteliAgentSHA256';
import http from 'http';
import getLogger from 'app/tools/logger';
// ==>
// LOGGER INSTANCE
const logger = getLogger('proxyRunTest');

function runTest() {
  // TEST Inteli proxy start and stop with delay
  const checkOrigin: (origin: string) => Promise<boolean> = async (
    origin: string
  ) => {
    return true;
  };
  const proxyServer = new inteliProxy.ProxyServer(checkOrigin);
  proxyServer.start().then((result) => {
    if (result) {
      try {
        const proxyClient = new inteliProxy.ProxyWebServer(
          'localhost',
          4242,
          'WEB001',
          http.createServer((req, res) => {
            res.setHeader('content-type', 'text/plain');
            res.end('hello, world!');
          })
        );
        setTimeout(() => {
          proxyClient
            .start()
            .then((result) => {
              if (result) {
                setTimeout(() => {
                  proxyClient.stop().catch((err) => {
                    logger.error(err);
                  });
                }, 4000);
              }
            })
            .catch((err) => {
              logger.error(err);
            });
        }, 2000);
      } catch (err) {
        logger.error(err);
      }
      setTimeout(() => {
        proxyServer.stop().catch((err) => {
          logger.error(err);
        });
      }, 10000);
    }
  });
}

try {
  if (!fs.existsSync(`${process.cwd()}/WEB001_privateKey.pem`)) {
    InteliSHA256Factory.genKeys('WEB001').then(() => runTest());
  } else {
    runTest();
  }
} catch (err) {
  logger.error(err);
}
