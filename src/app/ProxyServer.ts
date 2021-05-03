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
import { DEFAULT_CONFIGURATION } from '..';
import InteliConfig from './tools/InteliConfig';
import { INTELI_PROTOCOL } from './inteliProtocol/InteliEvent';
import InteliAgentSHA256, {
  InteliAgentSHA256Tools,
} from './inteliProtocol/Authentification/InteliAgentSHA256';
import ResolveStatesEnum from './inteliProtocol/enums/ResolveStatesEnum';
import Host from './inteliProtocol/webServerEvent/Host';
import ProxySelector, { DefaultProxySelector } from './tools/ProxySelector';
import ProxyMsgHandler, {
  DefaultProxyMsgHandler,
} from './tools/ProxyMsgHandler';

import getLogger from './tools/logger';

// ==>
// LOGGER INSTANCE
const logger = getLogger('ProxyServer');

enum ServerStates {
  CLOSE,
  PENDING,
  OPEN,
}

const PROXY_TSL_KEY: string = process.env.PROXY_TSL_KEY || 'tsl/key.pem';
const PROXY_TSL_CERT: string = process.env.PROXY_TSL_CERT || 'tsl/cert.pem';

/**
 * @class ProxyServer - This provide an Inteli-reverse-proxy server class
 * @version 1.00
 */
class ProxyServer {
  private inteliConfig: InteliConfig;
  private state: ServerStates = ServerStates.CLOSE; // Current server state
  private wsClientIndexMap: WeakMap<Connection, string>; // Indexed websocket active client collection on connection object (connection obj as index key)

  private originValidator: (origin: string) => Promise<boolean>; // Callback provide request ctrl before accept or reject new host connection
  private proxySelector: ProxySelector; // Instance of ProxySelector
  private proxyMsgHandler: ProxyMsgHandler; // Instance of ProxyMsgHandler

  private wsServer: WsServer = new WsServer(); // Websocket server instance
  private wsHttpServer: http.Server | https.Server; // Websocket http server instance

  private proxyServer: httpProxy; // Proxy server instance
  private proxyHttpServer: http.Server | https.Server; // Proxy http server instance

  /**
   * @constructor This provide instance of Inteli-proxy server
   * @param originValidator - Callback provide origin check before accept new host connection (For CORS)
   * @param proxySelector - Instance of ProxySelector (Optionnal, DefaultProxySelector instance by default)
   * @param proxyMsgHandler - Instance of ProxyMsgHandler (Optionnal, DefaultProxySelector instance by default)
   * @param inteliConfig - Inteli-reverse-proxy configuration (OPTIONNAL - SEE DEFAULT CONFIGURATION)
   */
  constructor(
    originValidator: (origin: string) => Promise<boolean>,
    inteliConfig: InteliConfig = DEFAULT_CONFIGURATION,
    proxySelector: ProxySelector = new DefaultProxySelector(),
    proxyMsgHandler: ProxyMsgHandler = new DefaultProxyMsgHandler()
  ) {
    try {
      this.inteliConfig = inteliConfig;
      logger.info(
        `Inteli Proxy Server secure mode (TSL) [${
          this.inteliConfig.secure ? 'ENABLE' : 'DISABLE'
        }].`
      );
      this.proxyServer = httpProxy.createProxyServer({
        secure: this.inteliConfig.secure,
      });
      this.originValidator = async (origin) => await originValidator(origin);
      this.proxySelector = proxySelector;
      this.proxyMsgHandler = proxyMsgHandler;
      this.wsServer.on('request', (request: Request) => {
        this.wsServerRequestHandler(this, request);
      });
      const cbProxyServer: (
        req: http.IncomingMessage,
        res: http.ServerResponse
      ) => void = async (
        req: http.IncomingMessage,
        res: http.ServerResponse
      ) => {
        try {
          const host: Host = await this.proxySelector.getTargetHost(req);
          if (host) {
            this.proxyServer.web(
              req,
              res,
              {
                target: {
                  ...host.target,
                  protocol: inteliConfig.secure ? 'https:' : 'http:',
                },
              },
              (err) => {
                logger.error(
                  `An error occured when Inteli reverse-proxy server attempt to forward request.\nError message : ${err.message}\nStack: ${err.stack}`
                );
                res.writeHead(503, { 'Content-Type': 'text/html' });
                res.end('Service unavailable', 'utf-8');
              }
            );
          } else {
            res.writeHead(503, { 'Content-Type': 'text/html' });
            res.end('Service unavailable', 'utf-8');
          }
        } catch (err) {
          logger.error(
            `An error occured when Inteli reverse-proxy server attempt to forward request.\nError message : ${err.message}\nStack: ${err.stack}`
          );
          res.writeHead(503, { 'Content-Type': 'text/html' });
          res.end('Service unavailable', 'utf-8');
        }
      };
      if (inteliConfig.secure) {
        const options = {
          key: fs.readFileSync(`${process.cwd()}/${PROXY_TSL_KEY}`),
          cert: fs.readFileSync(`${process.cwd()}/${PROXY_TSL_CERT}`),
        };
        this.wsHttpServer = https.createServer(options);
        this.proxyHttpServer = https.createServer(options, cbProxyServer);
      } else {
        this.wsHttpServer = http.createServer();
        this.proxyHttpServer = http.createServer(cbProxyServer);
      }
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
            ...this.inteliConfig.wsServerMount,
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
                  this.proxyServer.close();
                  logger.info(
                    `Inteli reverse-proxy server stop (1/2) : reverse-proxy server stop on port [${process.env.PROXY_PORT}]`
                  );
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
                          `Inteli reverse-proxy server stop (2/2) : websocket server stop on port [${process.env.PROXY_WS_PORT}]`
                        );
                        this.state = ServerStates.CLOSE;
                        this.wsClientIndexMap = new WeakMap();
                        await this.proxySelector.cleanHost();
                        resolve(true);
                      }
                    });
                  }
                }
              });
            }
          }, this.inteliConfig.proxyserver.closeTimeout);
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
      `New websocket client try to connect to Inteli reverse-proxy websocket server from : [${request.origin}]`
    );
    let inteliSHA256: InteliAgentSHA256;
    try {
      inteliSHA256 = InteliAgentSHA256Tools.getInteliSHA256FrmAuthorizationHeader(
        request.httpRequest.headers.authorization
      );
      if (
        !(await _this.originValidator(request.origin)) ||
        !InteliAgentSHA256Tools.inteliSHA256CheckValidity(inteliSHA256) ||
        request.requestedProtocols[0] !== INTELI_PROTOCOL
      ) {
        request.reject(401); // Reject unauthaurized client
        logger.warn(
          `New websocket client connection REJECTED from [${request.origin}] protocol [${request.requestedProtocols[0]}].\nAuthorization : <${request.httpRequest.headers.authorization}>`
        );
        return;
      }
    } catch (err) {
      request.reject(401); // Reject client if an error append
      logger.error(
        `New websocket client connection REJECTED from [${request.origin}]  protocol [${request.requestedProtocols[0]}].\nAuthorization : <${request.httpRequest.headers.authorization}>\nError message : ${err.message}\nStack: ${err.stack}`
      );
      return;
    }
    const connection: Connection = request.accept(
      request.requestedProtocols[0],
      request.origin
    ); // Accept client connection and obtain connection object
    logger.info(
      `New websocket client connection ACCEPTED from [${request.origin}]. From agentId: [${inteliSHA256.agentId}]`
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
      this.proxyMsgHandler
        .msgHandler(connection, _this.proxySelector, data)
        .then((resolveState) => {
          switch (resolveState) {
            case ResolveStatesEnum.INVALID:
              logger.warn(
                `Invalid websocket client message recieved: <${data}>. From hostId: [${hostId}]`
              );
              connection.close(
                Connection.CLOSE_REASON_PROTOCOL_ERROR,
                'PROTOCOL_ERROR'
              );
              break;
            case ResolveStatesEnum.UNAUTHORIZED:
              logger.warn(
                `Unhautorized websocket client detected : <${data}>. From hostId: [${hostId}]`
              );
              connection.close(
                Connection.CLOSE_REASON_POLICY_VIOLATION,
                'UNAUTHORIZED'
              );
              break;
            default:
              break;
          }
        })
        .catch((err) => {
          logger.error(
            `Error append when receiving client message.\nError message : ${err.message}\nStack: ${err.stack}`
          );
          connection.close(
            Connection.CLOSE_REASON_INVALID_DATA,
            'INVALID DATA'
          );
        });
    } catch (err) {
      logger.error(
        `Error append when receiving client message.\nError message : ${err.message}\nStack: ${err.stack}`
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
}

export default ProxyServer;
