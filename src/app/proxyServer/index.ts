// <== Imports externals modules
import http from 'http';
import httpProxy from 'http-proxy';
import { connection, IMessage, request, server as WsServer } from 'websocket';
import wsConfig from './wsConfig.json';
import Host from '../protocol/proxyEvent/Host';
import ProxyEvent from '../protocol/ProxyEvent';
import ActionEnum from '../protocol/enums/ActionEnum';
// ==>

/**
 * @class ProxyServer - This Class provide an Inteli-reverse-proxy server
 * @version 1.00
 */
class ProxyServer {
  #hostsIndexMap: WeakMap<connection, Host>; // Indexed host collection on connection object (connection obj as index key)
  #hostsQueue: Array<connection>; // Load balancer hosts connection queue

  #isAuthentified: (request: request) => boolean;  // Authentification callback


  _wsServer: WsServer = new WsServer();   // Websocket server instance
  _wsHttpServer: http.Server = http.createServer();   // Websocket http server instance

  
  _proxyServer: httpProxy = httpProxy.createProxyServer({}); // Proxy server instance
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
  ); // Proxy http server instance

  /**
   * @constructor This provide instance of Inteli-proxy server
   * @param cb - Callback provide origine ctrl before accept or reject new host connection
   */
  constructor(cb: (request: request) => boolean) {
    this.#isAuthentified = cb;
    this._wsServer.on('request', this.wsServerRequestHandler);
    this._wsServer.on('connect', this.wsServerConnectHandler);
    this._wsServer.on('close', this.wsServerCloseHandler);
  }

  /**
   * @method ProxyServer#Host Get and return available host
   * @returns {Host} Target Host or null
   */
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

  /**
   * @method ProxyServer#start Start Inteli Proxy server
   */
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

  /**
   * @method ProxyServer#stop Stop Inteli Proxy server
   */
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

  /**
   * @method ProxyServer#wsServerRequestHandler WS server request event handler
   * @param request WS HTTP request object
   */
  wsServerRequestHandler(request: request) {
    if (!this.#isAuthentified(request)) {
      request.reject(); // Reject all unauthentified client
      console.log(
        `[${new Date()}] Connection reject from ws client ${request.origin}.`
      );
      return;
    }

    const connection: connection = request.accept(null, request.origin); // Accept client connection and obtain connection object

    // <=== Handling client connection events
    connection.on('message', (data: IMessage) => {
      this.wsCliMessageHandler(connection, data);
    });
    connection.on('close', (code: number, desc: string) => {
      this.wsCliCloseHandler(connection, code, desc);
    });
    connection.on('error', (error) => {
      this.wsCliErrorHandler(connection, error);
    });
    // ===>
  }

  /**
   * @method ProxyServer#wsServerConnectHandler WS server connect event handler
   * @param connection WS client connection object
   */
  wsServerConnectHandler(connection: connection) {
    console.log(`New connection from ${connection.remoteAddress}`);
  }

  /**
   * @method ProxyServer#wsServerCloseHandler WS server close event handler
   * @param connection WS client connection object
   * @param reason Client close reason code
   * @param desc Client close reason description
   */
  wsServerCloseHandler(connection: connection, reason: number, desc: string) {
    console.log(
      `Closed connection from ${connection.remoteAddress}, reason : ${reason} - ${desc}`
    );
  }

  /**
   * @method ProxyServer#wsCliMessageHandler WS connection message event handler
   * @param connection WS client connection object
   * @param data WS client connection IMessage object
   */
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

  /**
   * @method ProxyServer#wsCliCloseHandler WS connection connect event handler
   * @param connection WS client connection object
   * @param code WS client connection close reason code
   * @param desc WS client connection close reason description
   */
  wsCliCloseHandler(connection: connection, code: number, desc: string) {
    console.log(
      `Closed connection from ${connection.remoteAddress}, reason : ${code} - ${desc}`
    );
    this.#hostsIndexMap.delete(connection);
  }

  /**
   * @method ProxyServer#wsServerConnectHandler WS connection connect event handler
   * @param connection WS client connection object
   * @param error WS client connection Error Object
   */
  wsCliErrorHandler(connection: connection, error: Error) {
    console.error(connection.remoteAddress, error);
    throw error;
  }
}
export default ProxyServer;
