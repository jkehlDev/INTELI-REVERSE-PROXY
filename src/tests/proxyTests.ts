import ProxyServer from '../inteliProxy';

// TEST Inteli proxy start and stop with delay
const proxyServer = new ProxyServer(() => true);
proxyServer.start();
setTimeout(() => {
  proxyServer.stop();
}, 2000);
