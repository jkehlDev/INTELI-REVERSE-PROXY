import inteliProxy from 'inteliProxy';
import fs from 'fs';
import { InteliSHA256Factory } from 'app/inteliProtocol/Authentification/InteliAgentSHA256';
import http from 'http';
import getLogger from 'app/tools/logger';
import ActionEnum from 'app/inteliProtocol/enums/EventActions';
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
  const proxyServer = new inteliProxy.ProxyServer(checkOrigin); // NEW PROXY SERVER
  const proxySysAdmin = new inteliProxy.ProxySysAdmin('localhost'); // NEW PROXY SysAdmin
  const web001 = new inteliProxy.ProxyWebServer( // NEW WEB SERVER 001
    'localhost',
    4242,
    'WEB001',
    '/',
    http.createServer((req, res) => {
      res.setHeader('content-type', 'text/plain');
      res.end('hello, world 1 !');
    })
  );
  const web002 = new inteliProxy.ProxyWebServer( // NEW WEB SERVER 002
    'localhost',
    4243,
    'WEB002',
    '/test',
    http.createServer((req, res) => {
      res.setHeader('content-type', 'text/plain');
      res.end('hello, world 2 !');
    })
  );
  proxyServer.start().then((result) => {
    // START PROXY
    if (result) {
      proxySysAdmin // ADD CERT PUBLIC KEY TO CERT STORE
        .start()
        .then(() =>
          proxySysAdmin.addPublicKey('WEB001', 'WEB001_publicKey.pem')
        )
        .then(() =>
          proxySysAdmin.addPublicKey('WEB002', 'WEB002_publicKey.pem')
        )
        .catch((err) => {
          logger.error(err);
        });
      setTimeout(() => {
        web001 // START WEB SERVER
          .start()
          .then((result) => {
            if (result) {
              setTimeout(() => {
                web001 // STOP WEB SERVER
                  .stop()
                  .catch((err) => {
                    logger.error(err);
                  })
                  .finally(() => {
                    // REMOVE CERT PUBLIC KEY FROM CERT STORE
                    proxySysAdmin.removePublicKey('WEB001').catch((err) => {
                      logger.error(err);
                    });
                  });
              }, 30000);
            }
          })
          .catch((err) => {
            logger.error(err);
          });
      }, 2500);

      setTimeout(() => {
        web002 // START WEB SERVER
          .start()
          .then((result) => {
            if (result) {
              setTimeout(() => {
                web002 // STOP WEB SERVER
                  .stop()
                  .catch((err) => {
                    logger.error(err);
                  })
                  .finally(() => {
                    // REMOVE CERT PUBLIC KEY FROM CERT STORE
                    proxySysAdmin.removePublicKey('WEB002').catch((err) => {
                      logger.error(err);
                    });
                  });
              },40000);
            }
          })
          .catch((err) => {
            logger.error(err);
          });
      }, 5000);

      setTimeout(() => {
        proxyServer.stop().catch((err) => {
          // STOP PROXY
          logger.error(err);
        });
      }, 120000);
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
