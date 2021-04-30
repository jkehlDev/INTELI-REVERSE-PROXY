// <== Imports externals modules
import dotenv from 'dotenv';
// Load environnement parameters
const result = dotenv.config();
if (result.error) {
  console.error(
    `[${Date.now()}, error, Inteli-reverse-proxy index] Error append during environnement parameters loading.\nError message : ${
      result.error.message
    }\nStack: ${result.error.stack}`
  );
  throw result.error;
}

/**
 * @module Inteli-reverse-proxy
 * @description This module provide a reverse proxy (load balancer) server and proxy client HTTP server
 * @version 1.00
 * @author Armandine, Johann, Thibaud
 */

// Provide ProxyServer Class
import ProxyServer from './app/ProxyServer';

// Provide ProxyWebServer Class
import ProxyWebServer from './app/ProxyWebServer';

// Provide ProxySysAdmin Class
import ProxySysAdmin from './app/ProxySysAdmin';

// Exports
export default { ProxyServer, ProxyWebServer, ProxySysAdmin };
