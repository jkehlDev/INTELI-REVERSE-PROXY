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
import inteliConfig from 'inteliProxyConfig.json';
import Host from 'app/inteliProtocol/webServerEvent/Host';
import WebServerEvent from 'app/inteliProtocol/webServerEvent/WebServerEvent';
import ActionEnum from 'app/inteliProtocol/enums/EventActions';
import EventEncode from 'app/inteliProtocol/enums/EventEncode';
import {
  inteliSHA256CheckAuthorizationHeader,
  inteliSHA256CheckValidity,
} from 'app/inteliProtocol/Authentification/InteliSHA256';
import logger from 'app/tools/logger';
// ==>

enum ServerStates {
  CLOSE,
  PENDING,
  OPEN,
}

/**
 * @class ProxyServer - This provide an Inteli-reverse-proxy server class
 * @version 1.00
 */
class ProxyServer {
  private state: ServerStates = ServerStates.CLOSE; // Current server state
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
      if (host !== null) {
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
   * @param clientPublicKeyFileName - Websocket client RSA public key validity check
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
        logger.error(
          `An error occured during instanciation of Inteli reverse-proxy Web server. RSA public key not found at ${process.cwd()}/${clientPublicKeyFileName}.pem`
        );
        throw new Error(
          `ERROR - [${new Date()}] Web server RSA public key not found at ${process.cwd()}/${clientPublicKeyFileName}.pem`
        );
      }
    } catch (err) {
      logger.error(
        `An error occured during instanciation of Inteli reverse-proxy server.
          Error message : ${err.message}
          Stack: ${err.stack}
        `
      );
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
   * @method ProxyServer#start Start Inteli Proxy server
   */
  public start() {
    if (this.state === ServerStates.CLOSE) {
      logger.info(`Inteli reverse-proxy start in progress (2 steps)...`);

      this.state = ServerStates.PENDING;
      this.hostsIndexMap = new WeakMap();
      this.hostsQueue = new Array(0);
      // Websocket server mounting
      this.wsServer.mount({
        httpServer: this.wsHttpServer,
        ...inteliConfig.wsServerMount,
      });
      // Websocket server start listening
      this.wsHttpServer.listen(process.env.PROXY_WS_PORT, () => {
        logger.info(
          `Inteli reverse-proxy server start (1/2) : websocket server start on port [${process.env.PROXY_WS_PORT}]`
        );
      });
      // Http proxy server start listening
      this.proxyHttpServer.listen(process.env.PROXY_PORT, () => {
        logger.info(
          `Inteli reverse-proxy server start (2/2) : reverse-proxy server start on port [${process.env.PROXY_PORT}]`
        );
        this.state = ServerStates.OPEN;
      });
    } else {
      logger.warn(
        `Inteli reverse-proxy server start attempt aborded: server is already start or in intermediate state`
      );
    }
  }

  /**
   * @method ProxyServer#stop Stop Inteli Proxy server
   */
  public stop() {
    if (this.state === ServerStates.OPEN) {
      logger.info(`Inteli reverse-proxy server stop in progress (2 steps) ...`);

      this.state = ServerStates.PENDING;

      // Http proxy server try stop listening
      if (this.proxyHttpServer.listening) {
        this.proxyHttpServer.close((err: Error) => {
          if (err) {
            logger.error(
              `An error occured when Inteli reverse-proxy server attempted to stop 
                Error message : ${err.message}
                Stack: ${err.stack}
              `
            );
          } else {
            logger.info(
              `Inteli reverse-proxy server stop (1/2) : websocket server stop on port [${process.env.PROXY_WS_PORT}]`
            );
          }
        });
      }

      // Shutdown websocket server
      this.wsServer.shutDown();
      if (this.wsHttpServer.listening) {
        this.wsHttpServer.close((err: Error) => {
          if (err) {
            logger.error(
              `An error occured when Inteli reverse-proxy websocket server attempted to stop 
                Error message : ${err.message}
                Stack: ${err.stack}
              `
            );
          } else {
            logger.info(
              `Inteli reverse-proxy server stop (2/2) : reverse-proxy server stop on port [${process.env.PROXY_PORT}]`
            );
            this.state = ServerStates.CLOSE;
          }
        });
      }
    } else {
      logger.warn(
        `Inteli reverse-proxy server stop attempt aborded: server is already stop or in intermediate state`
      );
    }
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
      logger.warn(
        `Inteli reverse-proxy server can't resolve web client request, no host registred`
      );
      return null;
    }
  }

  /**
   * @method ProxyServer#wsServerRequestHandler WS server request event handler
   * @param _this Class instance context
   * @param request WS HTTP request object
   */
  private async wsServerRequestHandler(_this: ProxyServer, request: Request) {
    logger.info(
      `New websocket client try to connect to Inteli reverse-proxy websocket server from ${request.origin}`
    );
    if (
      !(await _this.checkOrigin(request.origin)) ||
      !inteliSHA256CheckAuthorizationHeader(
        request.httpRequest.headers.authorization,
        _this.clientPublicKeyFileName
      )
    ) {
      request.reject(401); // Reject all unauthaurized client
      logger.warn(
        `New websocket client connection REJECTED from ${request.origin}
          Authorization : <${request.httpRequest.headers.authorization}>`
      );
      return;
    } else {
      logger.info(
        `New websocket client connection ACCEPTED from ${request.origin}
          Authorization : <${request.httpRequest.headers.authorization}>`
      );
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
  private wsServerConnectHandler(_this: ProxyServer, connection: Connection) {}

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
    if (_this.hostsIndexMap.has(connection)) {
      const host: Host = _this.hostsIndexMap.get(connection);
      logger.info(
        `Inteli reverse-proxy websocket server event - Websocket client close connection [${reason} | ${desc}], 
          hostId: ${host.hostId}
          host : ${host.host}
          port : ${host.port}`
      );
      _this.hostsIndexMap.delete(connection);
    }
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
      const event: WebServerEvent = JSON.parse(data.utf8Data);
      if (
        inteliSHA256CheckValidity(
          event.authentification,
          _this.clientPublicKeyFileName
        )
      ) {
        try {
          if (event.header.action === ActionEnum.open) {
            _this.hostsIndexMap.set(connection, event.payload);
            _this.hostsQueue.push(connection);
          } else if (event.header.action === ActionEnum.close) {
            _this.hostsIndexMap.delete(connection);
            connection.close(Connection.CLOSE_REASON_NORMAL, `NORMAL CLOSE`);
          } else {
            const host: Host = _this.hostsIndexMap.get(connection);
            logger.warn(
              `Invalid websocket client message action type recieved: <${event.header.action}>
                From hostId: ${host.hostId}`
            );
            _this.hostsIndexMap.delete(connection);
            connection.close(
              Connection.CLOSE_REASON_PROTOCOL_ERROR,
              'PROTOCOL_ERROR'
            );
          }
        } catch (error) {
          const host: Host = _this.hostsIndexMap.get(connection);
          logger.error(
            `Invalid websocket client message recieved : <${event}>
              From hostId: ${host.hostId}`
          );
          _this.hostsIndexMap.delete(connection);
          connection.close(Connection.CLOSE_REASON_RESERVED, 'RESERVED');
        }
      } else {
        const host: Host = _this.hostsIndexMap.get(connection);
        logger.warn(
          `Unhautorized websocket client detected, client signature invalid. 
            From hostId: ${host.hostId}`
        );
        _this.hostsIndexMap.delete(connection);
        connection.close(Connection.CLOSE_REASON_RESERVED, 'RESERVED');
      }
    } else {
      const host: Host = _this.hostsIndexMap.get(connection);
      logger.warn(
        `Invalid websocket message type recieved: <${data.type}> 
          From hostId: ${host.hostId}`
      );
      _this.hostsIndexMap.delete(connection);
      connection.close(Connection.CLOSE_REASON_INVALID_DATA, 'INVALID DATA');
    }
  }

  /**
   * @method ProxyServer#wsCliCloseHandler WS connection connect event handler
   * @param _this Class instance context
   * @param connection WS client connection object
   * @param reason WS client connection close reason code
   * @param desc WS client connection close reason description
   */
  private wsCliCloseHandler(
    _this: ProxyServer,
    connection: Connection,
    reason: number,
    desc: string
  ) {
    if (_this.hostsIndexMap.has(connection)) {
      const host: Host = _this.hostsIndexMap.get(connection);
      logger.info(
        `Inteli reverse-proxy websocket server event - Websocket client close connection [${reason} | ${desc}], 
          hostId: ${host.hostId}
          host : ${host.host}
          port : ${host.port}
    `
      );
      _this.hostsIndexMap.delete(connection);
    }
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
    const host: Host = _this.hostsIndexMap.get(connection);
    logger.error(
      `Inteli reverse-proxy websocket server event - An error occured with client, 
        hostId: ${host.hostId}
        host : ${host.host}
        port : ${host.port}
        
        Error message : ${error.message}
        Stack: ${error.stack}
      `
    );
    connection.close(Connection.CLOSE_REASON_PROTOCOL_ERROR, 'PROTOCOL_ERROR');
  }
}
export default ProxyServer;
