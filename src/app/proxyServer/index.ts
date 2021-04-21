import http from 'http';
import httpProxy from 'http-proxy';
import { connection, IMessage, request, server as WsServer } from 'websocket';
import wsConfig from './wsConfig.json';
import Host from '../protocol/proxyEvent/Host';
import ProxyEvent from '../protocol/ProxyEvent';
import ActionEnum from '../protocol/enums/ActionEnum';

/**
 * @class ProxyServer - This Class provide an Inteli-reverse-proxy server
 * @version 1.00
 */
class ProxyServer {
  // Hosts collections :
  #hostsIndexMap: WeakMap<connection, Host>; // Indexed host collection on connection object (connection obj as index key)
  #hostsQueue: Array<connection>; // Load balancer hosts connection queue

  // Authentification callback
  #isAuthentified: (request: request) => boolean;

  // Websocket server instance
  _wsServer: WsServer = new WsServer();
  _wsHttpServer: http.Server = http.createServer();

  // Proxy server instance
  _proxyServer: httpProxy = httpProxy.createProxyServer({});
  _proxyHttpServer: http.Server = http.createServer(
    (req: http.IncomingMessage, res: http.ServerResponse) => {
      const host: Host = this.getTargetHost();
      if (host) {
        this._proxyServer.web(req, res, { target: host });
      } else {
        res.writeHead(503, { 'Content-Type': 'text/html' });
        res.end('Service unavailable', 'utf-8');
      }
    }
  );

  constructor(isAuthentified: (request: request) => boolean) {
    this.#isAuthentified = isAuthentified;
    this._wsServer.on('request', this.wsServerRequestHandler);
    this._wsServer.on('connect', this.wsServerConnectHandler);
    this._wsServer.on('close', this.wsServerCloseHandler);
  }

  getTargetHost(): Host {
    let connection: connection = this.#hostsQueue.shift();
    while (
      !this.#hostsIndexMap.has(connection) &&
      this.#hostsQueue.length > 0
    ) {
      connection = this.#hostsQueue.shift();
    }

    if (this.#hostsIndexMap.has(connection)) {
      this.#hostsQueue.push(connection);
      return this.#hostsIndexMap.get(connection);
    } else {
      return null;
    }
  }

  start() {
    this.#hostsIndexMap = new WeakMap();
    this.#hostsQueue = new Array(0);
    console.log('Starting websocket proxy server ...');
    this._wsServer.mount({
      httpServer: this._wsHttpServer,
      ...wsConfig,
    });
    this._wsHttpServer.listen(process.env.PROXY_WS_PORT, () => {
      console.log(
        `Websocket proxy server start on port : ${process.env.PROXY_WS_PORT}`
      );
    });
    this._proxyHttpServer.listen(process.env.PROXY_PORT, () => {
      console.log(
        `Reverse proxy server start on port : ${process.env.PROXY_PORT}`
      );
    });
  }

  stop() {
    this._proxyHttpServer.close((err: Error) => {
      if (err) {
        console.error(err);
      } else {
        console.log(
          `Reverse proxy server stop on port : ${process.env.PROXY_PORT}`
        );
      }
    });
    this._wsServer.shutDown();
    this._wsHttpServer.close((err: Error) => {
      if (err) {
        console.error(err);
      } else {
        console.log(
          `Websocket proxy server stop on port : ${process.env.PROXY_WS_PORT}`
        );
      }
    });
  }

  wsServerRequestHandler(request: request) {
    if (!this.#isAuthentified(request)) {
      request.reject(); // Reject all unauthorized origin
      console.log(
        `[${new Date()}] Connection reject from ws client ${request.origin}.`
      );
      return;
    }

    const connection: connection = request.accept(null, request.origin); // Accept connection

    // Handle Event
    connection.on('message', (data: IMessage) => {
      this.wsCliMessageHandler(connection, data);
    });
    connection.on('close', (code: number, desc: string) => {
      this.wsCliCloseHandler(connection, code, desc);
    });
    connection.on('error', (error) => {
      this.wsCliErrorHandler(connection, error);
    });
  }

  wsServerConnectHandler(connection: connection) {
    console.log(`New connection from ${connection.remoteAddress}`);
  }
  wsServerCloseHandler(connection: connection, reason: number, desc: string) {
    console.log(
      `Closed connection from ${connection.remoteAddress}, reason : ${reason} - ${desc}`
    );
  }
  wsServerUpgradeErrorHandler(error: Error) {
    console.error(error);
    throw error;
  }

  wsCliMessageHandler(connection: connection, data: IMessage) {
    const event: ProxyEvent = JSON.parse(data.utf8Data);
    if (event.header.action === ActionEnum.open) {
      this.#hostsIndexMap.set(connection, event.payload);
      this.#hostsQueue.push(connection);
    }
    if (event.header.action === ActionEnum.close) {
      this.#hostsIndexMap.delete(connection);
    }
  }
  wsCliCloseHandler(connection: connection, code: number, desc: string) {
    console.log(
      `Closed connection from ${connection.remoteAddress}, reason : ${code} - ${desc}`
    );
    this.#hostsIndexMap.delete(connection);
  }
  wsCliErrorHandler(connection: connection, error: Error) {
    console.error(connection.remoteAddress, error);
    throw error;
  }
}
export default ProxyServer;