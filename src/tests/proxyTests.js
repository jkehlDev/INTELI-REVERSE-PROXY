const ProxyServer = require("../index").proxyServer;
const proxyServer = new ProxyServer(() => true);

proxyServer.start();

setTimeout(() => {
  proxyServer.stop();
}, 2000);
