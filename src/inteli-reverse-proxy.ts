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

// Exports
export * as ProxyServer from './app/ProxyServer';
export * as ProxyWebServer from './app/ProxyWebServer';
export * as ProxySysAdmin from './app/ProxySysAdmin';
export * as InteliConfig from './app/tools/InteliConfig';
export * as ProxyMsgHandler from './app/tools/ProxyMsgHandler';
export * as ProxySelector from './app/tools/ProxySelector';
export * as InteliLogger from './app/tools/logger';
export * as InteliAuth from './app/inteliProtocol/Authentification/InteliAgentSHA256';
export * as InteliEvent from './app/inteliProtocol/InteliEvent';
export * as InteliEventFactory from './app/inteliProtocol/InteliEventFactory';
export * as ResolveStatesEnum from './app/inteliProtocol/enums/ResolveStatesEnum';

import InteliConfig from './app/tools/InteliConfig';
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
  },
};
