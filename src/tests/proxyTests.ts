// <== Imports externals modules
import fs from 'fs';
import http from 'http';
import {
  Logger,
  ProxyServer,
  ProxySysAdmin,
  ProxyWebServer,
  InteliAgentSHA256Tools,
} from 'index';
// ==>
// LOGGER INSTANCE
const logger = Logger('proxyRunTest');

function runTest() {
  // TEST Inteli proxy start and stop with delay
  const checkOrigin: (origin: string) => Promise<boolean> = async (
    origin: string
  ) => {
    return origin === 'localhost';
  };
  const proxyServer: ProxyServer = new ProxyServer(checkOrigin); // NEW PROXY SERVER

  const proxySysAdmin: ProxySysAdmin = new ProxySysAdmin('localhost'); // NEW PROXY SysAdmin

  const web001: ProxyWebServer = new ProxyWebServer( // NEW WEB SERVER 001
    'localhost',
    4242,
    'WEB001',
    '/',
    http.createServer((req, res) => {
      res.setHeader('content-type', 'text/plain');
      res.end('hello, world 1 !');
    })
  );

  const web002: ProxyWebServer = new ProxyWebServer( // NEW WEB SERVER 002
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
          proxySysAdmin.addPublicKey('WEB001', 'src/tests/WEB001_publicKey.pem')
        )
        .then(() =>
          proxySysAdmin.addPublicKey('WEB002', 'src/tests/WEB002_publicKey.pem')
        )
        .catch((err) => {
          logger.error(err.message);
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
                    logger.error(err.message);
                  })
                  .finally(() => {
                    // REMOVE CERT PUBLIC KEY FROM CERT STORE
                    proxySysAdmin.removePublicKey('WEB001').catch((err) => {
                      logger.error(err.message);
                    });
                  });
              }, 30000);
            }
          })
          .catch((err) => {
            logger.error(err.message);
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
                    logger.error(err.message);
                  })
                  .finally(() => {
                    // REMOVE CERT PUBLIC KEY FROM CERT STORE
                    proxySysAdmin.removePublicKey('WEB002').catch((err) => {
                      logger.error(err.message);
                    });
                  });
              }, 40000);
            }
          })
          .catch((err) => {
            logger.error(err.message);
          });
      }, 5000);

      setTimeout(() => {
        proxyServer.stop().catch((err) => {
          // STOP PROXY
          logger.error(err.message);
        });
      }, 60000);
    }
  });
}

try {
  if (!fs.existsSync(`${process.cwd()}/WEB001_privateKey.pem`)) {
    InteliAgentSHA256Tools.genKeys('WEB001').then(() => runTest());
  } else {
    runTest();
  }
} catch (err) {
  logger.error(err.message);
}
