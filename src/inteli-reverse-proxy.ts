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
import InteliConfig from 'app/tools/InteliConfig';

// Exports
export default { ProxyServer, ProxyWebServer, ProxySysAdmin };
export const DEFAULT_CONFIGURATION: InteliConfig = {
  secure: false,
  wsServerMount: {
    keepalive: true,
    keepaliveInterval: 20000,
    dropConnectionOnKeepaliveTimeout: true,
    keepaliveGracePeriod: 10000,
    autoAcceptConnections: false,
    closeTimeout: 5000,
    disableNagleAlgorithm: true,
    ignoreXForwardedFor: false,
  },
  webserver: {
    version: '1.0.0',
    closeTimeout: 1000,
  },
  sysadmin: {
    closeTimeout: 500,
  },
  proxyserver: {
    closeTimeout: 500,
    TSLCertifacts: {
      certFilePath: 'tsl/cert.pem',
      keyFilePath: 'tsl/key.pem',
    },
  },
};
