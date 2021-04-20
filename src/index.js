// Load environnement parameters
const dotenv = require("dotenv");
const result = dotenv.config();
 if (result.error) {
  throw result.error
}
console.log(result.parsed)

// Provide Inteli proxy server class
const proxyServer = require("./app/proxyServer");

// Provide Inteli proxy client server class
//const inteliClient = require("./app/proxyClient");

/**
 * @module Inteli-reverse-proxy
 * @description This module provide a reverse proxy (load balancer) server and proxy client HTTP server
 * @version 1.00
 * @author @Armandine337711 @jkehlDev
 */
module.exports = {
  proxyServer,
};