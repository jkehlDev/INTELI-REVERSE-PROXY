// <== Imports externals modules
import dotenv from 'dotenv';
import getLogger from './app/tools/logger';
// LOGGER INSTANCE
const logger = getLogger('InteliProxy');

/**
 * @module Inteli-reverse-proxy
 * @description This module provide a reverse proxy (load balancer) server and proxy client HTTP server
 * @version 1.00
 * @author Armandine, Johann, Thibaud
 */

// Load environnement parameters
const result = dotenv.config();
if (result.error) {
  logger.error(
    `Error append during environnement parameters loading, ${result.error.message}`
  );
  throw result.error;
}

// Provide ProxyServer Class
import ProxyServer from './app/ProxyServer';

// Provide ProxyWebServer Class
import ProxyWebServer from './app/ProxyWebServer';

// Provide ProxySysAdmin Class
import ProxySysAdmin from './app/ProxySysAdmin';

// Exports
export default { ProxyServer, ProxyWebServer, ProxySysAdmin };
