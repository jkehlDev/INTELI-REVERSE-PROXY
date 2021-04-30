// <== Imports externals modules
import Yargs from 'yargs';
import inteliConfig from './inteliProxyConfig.json';
import InteliConfig from './app/tools/InteliConfig';
import ProxySysAdmin from './app/ProxySysAdmin';
import getLogger from './app/tools/logger';
// ==>
// LOGGER INSTANCE
const logger = getLogger('InteliSysAdmin');

/**
 * @module inteliSysAdmin Provide a proxy sysadmin console commande line
 * @version 1.0.0
 * @description Execute module with node and get command help
 */

Yargs(process.argv.slice(2))
  .usage('Usage: $0 <command> [options]')
  .command(
    'add',
    'Add a web server to proxy target host RSA public key store.',
    (yargs) => {
      return yargs
        .option('id', {
          alias: 'i',
          type: 'string',
          nargs: 1,
          required: true,
          description: 'Web server id',
        })
        .option('file', {
          alias: 'f',
          type: 'string',
          nargs: 1,
          required: true,
          description: 'RSA public key file',
        })
        .option('origin', {
          alias: 'o',
          type: 'string',
          nargs: 1,
          required: true,
          description: 'Websocket client origin for server CORS check validity',
        });
    },
    ({ id, file, origin }) => {
      const proxySysAdmin: ProxySysAdmin = new ProxySysAdmin(
        inteliConfig as InteliConfig,
        origin
      );
      proxySysAdmin
        .start()
        .then(() => {
          proxySysAdmin.addPublicKey(id, file);
        })
        .catch((err) => {
          logger.error(
            `Cannot send adding request to proxy server.\nError message : ${err.message}\nStack: ${err.stack}`
          );
        })
        .finally(() => {
          proxySysAdmin.stop().catch((err) => {
            logger.error(
              `Error append when proxySysAdmin stop.\nError message : ${err.message}\nStack: ${err.stack}`
            );
          });
        });
    }
  )
  .example(
    '$0 add -i web001 -f web001_publicKey.pem -o localhost',
    'Add web001 web server to proxy target host RSA public key store.'
  )
  .command(
    'remove',
    'Remove a web server to proxy target host RSA public key store.',
    (yargs) => {
      return yargs
        .option('id', {
          alias: 'i',
          nargs: 1,
          type: 'string',
          required: true,
          description: 'Web server id',
        })
        .option('origin', {
          alias: 'o',
          type: 'string',
          nargs: 1,
          required: true,
          description: 'Websocket client origin for server CORS check validity',
        });
    },
    ({ id, origin }) => {
      const proxySysAdmin: ProxySysAdmin = new ProxySysAdmin(
        inteliConfig as InteliConfig,
        origin
      );
      proxySysAdmin
        .start()
        .then(() => {
          proxySysAdmin.removePublicKey(id);
        })
        .catch((err) => {
          logger.error(
            `Cannot send remove request to proxy server.\nError message : ${err.message}\nStack: ${err.stack}`
          );
        })
        .finally(() => {
          proxySysAdmin.stop().catch((err) => {
            logger.error(
              `Error append when proxySysAdmin stop.\nError message : ${err.message}\nStack: ${err.stack}`
            );
          });
        });
    }
  )
  .example(
    '$0 remove -i web001 -o localhost',
    'Remove web001 web server to proxy target host RSA public key store.'
  )
  .version()
  .epilog(
    'GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007. Copyright (C) 2007 Free Software Foundation'
  )
  .demandCommand().argv;
