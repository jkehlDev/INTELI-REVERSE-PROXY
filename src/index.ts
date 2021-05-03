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
export {
  default as InteliConfig,
  DEFAULT_CONFIGURATION,
} from './app/tools/InteliConfig';
export {
  default as InteliEvent,
  INTELI_PROTOCOL,
} from './app/inteliProtocol/InteliEvent';
export { default as InteliEventFactory } from './app/inteliProtocol/InteliEventFactory';
export {
  default as InteliAgentSHA256,
  InteliAgentSHA256Tools,
} from './app/inteliProtocol/Authentification/InteliAgentSHA256';
export {
  default as ProxyMsgHandler,
  DefaultProxyMsgHandler,
} from './app/tools/ProxyMsgHandler';
export {
  default as ProxySelector,
  DefaultProxySelector,
} from './app/tools/ProxySelector';
export { default as ResolveStatesEnum } from './app/inteliProtocol/enums/ResolveStatesEnum';
export { default as ProxyServer } from './app/ProxyServer';
export { default as ProxyWebServer } from './app/ProxyWebServer';
export { default as ProxySysAdmin } from './app/ProxySysAdmin';
export { default as Logger } from './app/tools/logger';
