import inteliProxy from 'inteliProxy';

// TEST Inteli proxy start and stop with delay
const proxyServer = new inteliProxy.ProxyServer(async () => true);
proxyServer.start();
setTimeout(() => {
  proxyServer.stop();
}, 2000);
