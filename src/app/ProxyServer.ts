// <== Imports externals modules
import http from 'http';
import https from 'https';
import httpProxy from 'http-proxy';
import fs from 'fs';
import {
  connection as Connection,
  IMessage,
  request as Request,
  server as WsServer,
} from 'websocket';
import inteliConfig from 'inteliProxyConfig.json';
import ProxySelector, { DefaultProxySelector } from './tools/ProxySelector';
import Host from 'app/inteliProtocol/webServerEvent/Host';
import InteliEvent from 'app/inteliProtocol/InteliEvent';
import SysAdminEvent from './inteliProtocol/sysAdminEvent/SysAdminEvent';
import WebServerEvent from 'app/inteliProtocol/webServerEvent/WebServerEvent';
import TypeEnum from './inteliProtocol/enums/EventTypes';
import ActionEnum from 'app/inteliProtocol/enums/EventActions';
import EventEncode from 'app/inteliProtocol/enums/EventEncode';
import InteliAgentSHA256, {
  getInteliSHA256FrmAuthorizationHeader,
  inteliSHA256CheckValidity,
} from 'app/inteliProtocol/Authentification/InteliAgentSHA256';
import getLogger from 'app/tools/logger';
// ==>
// LOGGER INSTANCE
const logger = getLogger('ProxyServer');

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
  private wsClientIndexMap: WeakMap<Connection, string>; // Indexed websocket active client collection on connection object (connection obj as index key)

  private originValidator: (origin: string) => Promise<boolean>; // Callback provide request ctrl before accept or reject new host connection
  private proxySelector: ProxySelector; // Instance of ProxySelector

  private wsServer: WsServer = new WsServer(); // Websocket server instance
  private wsHttpServer: http.Server | https.Server; // Websocket http server instance

  private proxyServer: httpProxy = httpProxy.createProxyServer({}); // Proxy server instance
  private proxyHttpServer: http.Server | https.Server; // Proxy http server instance

  /**
   * @constructor This provide instance of Inteli-proxy server
   * @param originValidator - Callback provide origin check before accept new host connection (For CORS)
   * @param proxySelector - Instance of ProxySelector (Optionnal, DefaultProxySelector instance by default)
   */
  constructor(
    originValidator: (origin: string) => Promise<boolean>,
    proxySelector: ProxySelector = new DefaultProxySelector()
  ) {
    this.originValidator = async (origin) => await originValidator(origin);
    this.proxySelector = proxySelector;
    try {
      this.wsServer.on('request', (request: Request) => {
        this.wsServerRequestHandler(this, request);
      });
      this.wsServer.on(
        'close',
        (connection: Connection, reason: number, desc: string) => {
          this.wsServerCloseHandler(this, connection, reason, desc);
        }
      );

      this.wsHttpServer = http.createServer();
      this.proxyHttpServer = http.createServer(
        async (req: http.IncomingMessage, res: http.ServerResponse) => {
          this.proxySelector
            .getTargetHost(req)
            .then((host) => {
              try {
                if (host !== null) {
                  this.proxyServer.web(req, res, { target: host.target });
                } else {
                  res.writeHead(503, { 'Content-Type': 'text/html' });
                  res.end('Service unavailable', 'utf-8');
                }
              } catch (err) {
                logger.error(err);
              }
            })
            .catch((err) => {
              logger.error(err);
            });
        }
      );
    } catch (err) {
      logger.error(
        `An error occured during instanciation of Inteli reverse-proxy server.\nError message : ${err.message}\nStack: ${err.stack}`
      );
      throw err;
    }
  }

  /**
   * @method ProxyServer#start Start Inteli Proxy server
   * @returns {Promise<boolean>} A promise resolve true if server properly start or false overwise
   */
  public start(): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        if (this.state === ServerStates.CLOSE) {
          this.state = ServerStates.PENDING;
          logger.info(`Inteli reverse-proxy start in progress (2 steps)...`);

          this.wsClientIndexMap = new WeakMap();
          await this.proxySelector.cleanHost();
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
            resolve(true);
          });
        } else {
          logger.warn(
            `Inteli reverse-proxy server start attempt aborded: server is already start or in intermediate state`
          );
          resolve(false);
        }
      } catch (err) {
        logger.error(
          `An error occured when Inteli reverse-proxy server attempt to start.\nError message : ${err.message}\nStack: ${err.stack}`
        );
        reject(err);
      }
    });
  }

  /**
   * @method ProxyServer#stop Stop Inteli Proxy server
   * @returns {Promise<boolean>} A promise resolve true if server properly stop or false overwise
   */
  public stop(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        if (this.state === ServerStates.OPEN) {
          this.state = ServerStates.PENDING;
          logger.info(
            `Inteli reverse-proxy server stop in progress (2 steps) ...`
          );
          setTimeout(() => {
            if (this.proxyHttpServer.listening) {
              // Http proxy server try stop listening
              this.proxyHttpServer.close((err: Error) => {
                if (err) {
                  logger.error(
                    `An error occured when Inteli reverse-proxy server attempted to stop.\nError message : ${err.message}\nStack: ${err.stack}`
                  );
                  reject(err);
                } else {
                  logger.info(
                    `Inteli reverse-proxy server stop (1/2) : websocket server stop on port [${process.env.PROXY_WS_PORT}]`
                  );
                }
              });
            }
            this.wsServer.shutDown(); // Shutdown websocket server
            if (this.wsHttpServer.listening) {
              this.wsHttpServer.close(async (err: Error) => {
                if (err) {
                  logger.error(
                    `An error occured when Inteli reverse-proxy websocket server attempted to stop.\nError message : ${err.message}\nStack: ${err.stack}`
                  );
                  reject(err);
                } else {
                  logger.info(
                    `Inteli reverse-proxy server stop (2/2) : reverse-proxy server stop on port [${process.env.PROXY_PORT}]`
                  );
                  this.state = ServerStates.CLOSE;
                  this.wsClientIndexMap = new WeakMap();
                  await this.proxySelector.cleanHost();
                  resolve(true);
                }
              });
            }
          }, inteliConfig.proxyserver.closeTimeout);
        } else {
          logger.warn(
            `Inteli reverse-proxy server stop attempt aborded: server is already stop or in intermediate state`
          );
          resolve(false);
        }
      } catch (err) {
        logger.error(
          `An error occured when Inteli reverse-proxy server attempt to stop.\nError message : ${err.message}\nStack: ${err.stack}`
        );
        reject(err);
      }
    });
  }

  /**
   * @method ProxyServer#wsServerRequestHandler WS server request event handler
   * @param _this Class instance context
   * @param request WS HTTP request object
   */
  private async wsServerRequestHandler(_this: ProxyServer, request: Request) {
    logger.info(
      `New websocket client try to connect to Inteli reverse-proxy websocket server from : ${request.origin}`
    );
    let inteliSHA256: InteliAgentSHA256;
    try {
      inteliSHA256 = getInteliSHA256FrmAuthorizationHeader(
        request.httpRequest.headers.authorization
      );
      if (
        !(await _this.originValidator(request.origin)) ||
        !inteliSHA256CheckValidity(inteliSHA256) ||
        request.requestedProtocols[0] !== inteliConfig.wsprotocol
      ) {
        request.reject(401); // Reject unauthaurized client
        logger.warn(
          `New websocket client connection REJECTED from ${request.origin}.\nAuthorization : <${request.httpRequest.headers.authorization}>`
        );
        return;
      }
    } catch (err) {
      request.reject(401); // Reject client if an error append
      logger.warn(
        `New websocket client connection REJECTED from ${request.origin}.\nAuthorization : <${request.httpRequest.headers.authorization}>`
      );
      return;
    }
    const connection: Connection = request.accept(
      request.requestedProtocols[0],
      request.origin
    ); // Accept client connection and obtain connection object
    logger.info(
      `New websocket client connection ACCEPTED from ${request.origin}. From agentId: [${inteliSHA256.agentId}]`
    );
    _this.wsClientIndexMap.set(connection, inteliSHA256.agentId);
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
    _this.wsCliCloseHandler(_this, connection, reason, desc);
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
    const hostId: string = _this.wsClientIndexMap.get(connection);
    try {
      if ((data.type = EventEncode.utf8)) {
        const event: InteliEvent<TypeEnum, ActionEnum, any, any> = JSON.parse(
          data.utf8Data
        );
        if (inteliSHA256CheckValidity(event.authentification)) {
          switch (event.header.type) {
            case TypeEnum.sysadmin:
              this.handleTypeSysAdminEvent(
                _this,
                connection,
                event as SysAdminEvent
              );
              break;
            case TypeEnum.webServer:
              this.handleTypeWebServerEvent(
                _this,
                connection,
                event as WebServerEvent
              );
              break;
            default:
              logger.warn(
                `Invalid websocket client message type recieved: <${event.header.type}>. From hostId:  ${hostId}`
              );
              connection.close(
                Connection.CLOSE_REASON_PROTOCOL_ERROR,
                'PROTOCOL_ERROR'
              );
              break;
          }
        } else {
          logger.warn(
            `Unhautorized websocket client detected : Client signature invalid. From hostId: [${hostId}]`
          );
          connection.close(Connection.CLOSE_REASON_RESERVED, 'RESERVED');
        }
      } else {
        logger.warn(
          `Invalid websocket message type recieved: <${data.type}>. From hostId: [${hostId}]`
        );
        connection.close(Connection.CLOSE_REASON_INVALID_DATA, 'INVALID DATA');
      }
    } catch (error) {
      logger.error(
        `Invalid websocket client message recieved : <${data}>. From hostId: [${hostId}]`
      );
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
  private async wsCliCloseHandler(
    _this: ProxyServer,
    connection: Connection,
    reason: number,
    desc: string
  ) {
    if (_this.wsClientIndexMap.has(connection)) {
      const hostId: string = _this.wsClientIndexMap.get(connection);
      logger.info(
        `Websocket client connection close [${reason} | ${desc}]. From hostId: [${hostId}]`
      );
    }
    await _this.proxySelector.removeHost(connection);
    _this.wsClientIndexMap.delete(connection);
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
    if (_this.wsClientIndexMap.has(connection)) {
      const hostId: string = _this.wsClientIndexMap.get(connection);
      logger.error(
        `An error occured with client. From hostId: [${hostId}].\nError message : ${error.message}\nStack: ${error.stack}`
      );
    }
    connection.close(Connection.CLOSE_REASON_PROTOCOL_ERROR, 'PROTOCOL_ERROR');
  }

  private handleTypeSysAdminEvent(
    _this: ProxyServer,
    connection: Connection,
    event: SysAdminEvent
  ) {
    switch (event.header.action) {
      case ActionEnum.add:
        logger.info(
          `Sysadmin add public certificat to certstore event received for agentID:[${event.payload.hostId}].`
        );
        fs.writeFile(
          `${process.cwd()}/certstore/${event.payload.hostId}_publicKey.pem`,
          event.payload.publicKey,
          (err) => {
            if (err) throw err;
          }
        );
        break;
      case ActionEnum.remove:
        logger.info(
          `Sysadmin remove public certificat from certstore event received for agentID:[${event.payload.hostId}].`
        );
        fs.rm(
          `${process.cwd()}/certstore/${event.payload.hostId}_publicKey.pem`,
          (err) => {
            if (err) throw err;
          }
        );
        break;
      default:
        if (_this.wsClientIndexMap.has(connection)) {
          const hostId: string = _this.wsClientIndexMap.get(connection);
          logger.warn(
            `Invalid websocket client message action type recieved: <${event.header.action}>. From hostId: ${hostId}`
          );
        }
        connection.close(
          Connection.CLOSE_REASON_PROTOCOL_ERROR,
          'PROTOCOL_ERROR'
        );
        break;
    }
  }

  private async handleTypeWebServerEvent(
    _this: ProxyServer,
    connection: Connection,
    event: WebServerEvent
  ) {
    switch (event.header.action) {
      case ActionEnum.open:
        await _this.proxySelector.addHost(connection, event.payload);
        break;
      case ActionEnum.close:
        connection.close(Connection.CLOSE_REASON_NORMAL, `NORMAL CLOSE`);
        break;
      default:
        if (_this.wsClientIndexMap.has(connection)) {
          const hostId: string = _this.wsClientIndexMap.get(connection);
          logger.warn(
            `Invalid websocket client message action type recieved: <${event.header.action}>. From hostId: ${hostId}`
          );
        }
        connection.close(
          Connection.CLOSE_REASON_PROTOCOL_ERROR,
          'PROTOCOL_ERROR'
        );
        break;
    }
  }
}

export default ProxyServer;
