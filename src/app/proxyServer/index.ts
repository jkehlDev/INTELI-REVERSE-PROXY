// <== Imports externals modules
import http from 'http';
import httpProxy from 'http-proxy';
import { connection, IMessage, request, server as WsServer } from 'websocket';
import wsConfig from './wsConfig.json';
import Host from '../inteliProtocol/proxyEvent/Host';
import ProxyEvent from '../inteliProtocol/proxyEvent/ProxyEvent';
import ActionEnum from '../inteliProtocol/EventActions';
// ==>

/**
 * @class ProxyServer - This Class provide an Inteli-reverse-proxy server
 * @version 1.00
 */
class ProxyServer {
  private hostsIndexMap: WeakMap<connection, Host>; // Indexed host collection on connection object (connection obj as index key)
  private hostsQueue: Array<connection>; // Load balancer hosts connection queue

  private isAuthentified: (request: request) => boolean;  // Authentification callback

  private wsServer: WsServer = new WsServer();   // Websocket server instance
  private wsHttpServer: http.Server = http.createServer();   // Websocket http server instance
  
  private proxyServer: httpProxy = httpProxy.createProxyServer({}); // Proxy server instance
  private proxyHttpServer: http.Server = http.createServer(
    (req: http.IncomingMessage, res: http.ServerResponse) => {
      const host: Host = this.getTargetHost();
      if (host) {
        this.proxyServer.web(req, res, { target: host });
      } else {
        res.writeHead(503, { 'Content-Type': 'text/html' });
        res.end('Service unavailable', 'utf-8');
      }
    }
  ); // Proxy http server instance

  /**
   * @constructor This provide instance of Inteli-proxy server
   * @param cb - Callback provide request ctrl before accept or reject new host connection
   */
  constructor(cb: (request: request) => boolean) {
    this.isAuthentified = cb;
    this.wsServer.on('request', this.wsServerRequestHandler);
    this.wsServer.on('connect', this.wsServerConnectHandler);
    this.wsServer.on('close', this.wsServerCloseHandler);
  }

  /**
   * @method ProxyServer#Host Get and return available host
   * @returns {Host} Target Host or null
   */
  private getTargetHost(): Host {
    let connection: connection = this.hostsQueue.shift();
    while (
      !this.hostsIndexMap.has(connection) &&
      this.hostsQueue.length > 0
    ) {
      connection = this.hostsQueue.shift();
    } // Looking for available host

    if (this.hostsIndexMap.has(connection)) {
      this.hostsQueue.push(connection);
      return this.hostsIndexMap.get(connection);
    } else {
      return null;
    }
  }

  /**
   * @method ProxyServer#start Start Inteli Proxy server
   */
  public start() {
    this.hostsIndexMap = new WeakMap();
    this.hostsQueue = new Array(0);
    console.log('Starting websocket proxy server ...');
    this.wsServer.mount({
      httpServer: this.wsHttpServer,
      ...wsConfig,
    });
    this.wsHttpServer.listen(process.env.PROXY_WS_PORT, () => {
      console.log(
        `Websocket proxy server start on port : ${process.env.PROXY_WS_PORT}`
      );
    });
    this.proxyHttpServer.listen(process.env.PROXY_PORT, () => {
      console.log(
        `Reverse proxy server start on port : ${process.env.PROXY_PORT}`
      );
    });
  }

  /**
   * @method ProxyServer#stop Stop Inteli Proxy server
   */
  public stop() {
    this.proxyHttpServer.close((err: Error) => {
      if (err) {
        console.error(err);
      } else {
        console.log(
          `Reverse proxy server stop on port : ${process.env.PROXY_PORT}`
        );
      }
    });
    this.wsServer.shutDown();
    this.wsHttpServer.close((err: Error) => {
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
  private wsServerRequestHandler(request: request) {
    if (!this.isAuthentified(request)) {
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
  private wsServerConnectHandler(connection: connection) {
    console.log(`New connection from ${connection.remoteAddress}`);
  }

  /**
   * @method ProxyServer#wsServerCloseHandler WS server close event handler
   * @param connection WS client connection object
   * @param reason Client close reason code
   * @param desc Client close reason description
   */
  private wsServerCloseHandler(connection: connection, reason: number, desc: string) {
    console.log(
      `Closed connection from ${connection.remoteAddress}, reason : ${reason} - ${desc}`
    );
  }

  /**
   * @method ProxyServer#wsCliMessageHandler WS connection message event handler
   * @param connection WS client connection object
   * @param data WS client connection IMessage object
   */
  private wsCliMessageHandler(connection: connection, data: IMessage) {
    const event: ProxyEvent = JSON.parse(data.utf8Data);
    if (event.header.action === ActionEnum.open) {
      this.hostsIndexMap.set(connection, event.payload);
      this.hostsQueue.push(connection);
    }
    if (event.header.action === ActionEnum.close) {
      this.hostsIndexMap.delete(connection);
    }
  }

  /**
   * @method ProxyServer#wsCliCloseHandler WS connection connect event handler
   * @param connection WS client connection object
   * @param code WS client connection close reason code
   * @param desc WS client connection close reason description
   */
  private wsCliCloseHandler(connection: connection, code: number, desc: string) {
    console.log(
      `Closed connection from ${connection.remoteAddress}, reason : ${code} - ${desc}`
    );
    this.hostsIndexMap.delete(connection);
  }

  /**
   * @method ProxyServer#wsServerConnectHandler WS connection connect event handler
   * @param connection WS client connection object
   * @param error WS client connection Error Object
   */
  private wsCliErrorHandler(connection: connection, error: Error) {
    console.error(connection.remoteAddress, error);
    throw error;
  }
}
export default ProxyServer;
