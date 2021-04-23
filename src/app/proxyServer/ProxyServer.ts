// <== Imports externals modules
import http from 'http';
import httpProxy from 'http-proxy';
import fs from 'fs';
import {
  connection as Connection,
  IMessage,
  request as Request,
  server as WsServer,
} from 'websocket';
import wsConfig from 'app/proxyServer/wsConfig.json';
import Host from 'app/inteliProtocol/clientEvent/Host';
import ClientEvent from 'app/inteliProtocol/clientEvent/ClientEvent';
import ActionEnum from 'app/inteliProtocol/EventActions';
import EventEncode from 'app/inteliProtocol/EventEncode';
import {
  inteliSHA256CheckAuthorizationHeader,
  inteliSHA256CheckValidity,
} from 'app/inteliProtocol/Authentification/InteliSHA256';
// ==>

/**
 * @class ProxyServer - This provide an Inteli-reverse-proxy server class
 * @version 1.00
 */
class ProxyServer {
  private hostsIndexMap: WeakMap<Connection, Host>; // Indexed host collection on connection object (connection obj as index key)
  private hostsQueue: Array<Connection>; // Load balancer hosts connection queue

  private checkOrigin: (origin: string) => Promise<boolean>; // Callback provide request ctrl before accept or reject new host connection
  private clientPublicKeyFileName: string; // Proxy client public key cert

  private wsServer: WsServer = new WsServer(); // Websocket server instance
  private wsHttpServer: http.Server = http.createServer(); // Websocket http server instance

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
   * @param cb - Callback provide origin check before accept new host connection (For CORS)
   * @param clientPublicKeyFileName
   */
  constructor(
    cb: (origin: string) => Promise<boolean>,
    clientPublicKeyFileName: string
  ) {
    this.checkOrigin = async (origin) => await cb(origin);
    try {
      if (fs.existsSync(`${process.cwd()}/${clientPublicKeyFileName}.pem`)) {
        this.clientPublicKeyFileName = clientPublicKeyFileName;
      } else {
        throw new Error(
          `client public key don't exist : ${process.cwd()}/${clientPublicKeyFileName}.pem`
        );
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
    this.wsServer.on('request', (request: Request) => {
      this.wsServerRequestHandler(this, request);
    });
    this.wsServer.on('connect', (connection: Connection) => {
      this.wsServerConnectHandler(this, connection);
    });
    this.wsServer.on(
      'close',
      (connection: Connection, reason: number, desc: string) => {
        this.wsServerCloseHandler(this, connection, reason, desc);
      }
    );
  }

  /**
   * @method ProxyServer#Host Get and return available host
   * @returns {Host} Target Host or null
   */
  private getTargetHost(): Host {
    let connection: Connection = this.hostsQueue.shift();
    while (!this.hostsIndexMap.has(connection) && this.hostsQueue.length > 0) {
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
   * @param _this Class instance context
   * @param request WS HTTP request object
   */
  private async wsServerRequestHandler(_this: ProxyServer, request: Request) {
    console.log('Client try to connect from origin ', request.origin);
    if (
      !(await _this.checkOrigin(request.origin)) ||
      !inteliSHA256CheckAuthorizationHeader(
        request.httpRequest.headers.authorization,
        _this.clientPublicKeyFileName
      )
    ) {
      request.reject(401); // Reject all unauthaurized client
      console.log(
        `[${new Date()}] Connection reject from ws client ${request.origin}.`
      );
      return;
    }

    const connection: Connection = request.accept('inteli', request.origin); // Accept client connection and obtain connection object

    // <=== Handling client connection events
    connection.on('message', (data: IMessage) => {
      _this.wsCliMessageHandler(_this, connection, data);
    });
    connection.on('close', (code: number, desc: string) => {
      _this.wsCliCloseHandler(_this, connection, code, desc);
    });
    connection.on('error', (error) => {
      _this.wsCliErrorHandler(_this, connection, error);
    });
    // ===>
  }

  /**
   * @method ProxyServer#wsServerConnectHandler WS server connect event handler
   * @param _this Class instance context
   * @param connection WS client connection object
   */
  private wsServerConnectHandler(_this: ProxyServer, connection: Connection) {
    console.log(`New connection from ${connection.remoteAddress}`);
  }

  /**
   * @method ProxyServer#wsServerCloseHandler WS server close event handler
   * @param _this Class instance context
   * @param connection WS client connection object
   * @param reason Client close reason code
   * @param desc Client close reason description
   */
  private wsServerCloseHandler(
    _this: ProxyServer,
    connection: Connection,
    reason: number,
    desc: string
  ) {
    console.log(
      `Closed connection from ${connection.remoteAddress}, reason : ${reason} - ${desc}`
    );
  }

  /**
   * @method ProxyServer#wsCliMessageHandler WS connection message event handler
   * @param _this Class instance context
   * @param connection WS client connection object
   * @param data WS client connection IMessage object
   */
  private wsCliMessageHandler(
    _this: ProxyServer,
    connection: Connection,
    data: IMessage
  ) {
    if ((data.type = EventEncode.utf8)) {
      const event: ClientEvent = JSON.parse(data.utf8Data);
      if (
        inteliSHA256CheckValidity(
          event.authentification,
          _this.clientPublicKeyFileName
        )
      ) {
        if (event.header.action === ActionEnum.open) {
          _this.hostsIndexMap.set(connection, event.payload);
          _this.hostsQueue.push(connection);
        } else if (event.header.action === ActionEnum.close) {
          _this.hostsIndexMap.delete(connection);
        } else {
          _this.hostsIndexMap.delete(connection);
          connection.close(
            Connection.CLOSE_REASON_PROTOCOL_ERROR,
            'PROTOCOL_ERROR'
          );
        }
      } else {
        _this.hostsIndexMap.delete(connection);
        connection.close(Connection.CLOSE_REASON_RESERVED, 'RESERVED');
      }
    } else {
      _this.hostsIndexMap.delete(connection);
      connection.close(Connection.CLOSE_REASON_INVALID_DATA, 'INVALID DATA');
    }
  }

  /**
   * @method ProxyServer#wsCliCloseHandler WS connection connect event handler
   * @param _this Class instance context
   * @param connection WS client connection object
   * @param code WS client connection close reason code
   * @param desc WS client connection close reason description
   */
  private wsCliCloseHandler(
    _this: ProxyServer,
    connection: Connection,
    code: number,
    desc: string
  ) {
    console.log(
      `Closed connection from ${connection.remoteAddress}, reason : ${code} - ${desc}`
    );
    _this.hostsIndexMap.delete(connection);
  }

  /**
   * @method ProxyServer#wsServerConnectHandler WS connection connect event handler
   * @param _this Class instance context
   * @param connection WS client connection object
   * @param error WS client connection Error Object
   */
  private wsCliErrorHandler(
    _this: ProxyServer,
    connection: Connection,
    error: Error
  ) {
    console.error(connection.remoteAddress, error);
    throw error;
  }
}
export default ProxyServer;
