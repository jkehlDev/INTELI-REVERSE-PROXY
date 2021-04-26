import logger from 'app/tools/logger';

/**
 * @module Inteli-reverse-proxy
 * @description This module provide a reverse proxy (load balancer) server and proxy client HTTP server
 * @version 1.00
 * @author Armandine, Johann, Thibaud
 */

// Load environnement parameters
import dotenv from 'dotenv';
const result = dotenv.config();
if (result.error) {
  logger.error(
    `Error append during environnement parameters loading, ${result.error.message}`
  );
  throw result.error;
}

// Provide Inteli proxy server Class
import ProxyServer from './app/proxyServer/ProxyServer';

// Provide Inteli proxy client server Class
import ProxyClient from './app/proxyClient/ProxyClient';

export default { ProxyServer, ProxyClient };
