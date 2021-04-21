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
  throw result.error;
}
console.log(result.parsed);

// Provide Inteli proxy server Class
import ProxyServer from './app/proxyServer';

// Provide Inteli proxy client server Class
//const inteliClient = require("./app/proxyClient");

export default ProxyServer;
