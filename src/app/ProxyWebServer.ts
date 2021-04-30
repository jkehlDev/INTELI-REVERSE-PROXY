// <== Imports externals modules
import http from 'http';
import https from 'https';
import {
  connection as Connection,
  client as WsClient,
  IMessage,
} from 'websocket';
import { DEFAULT_CONFIGURATION } from '../inteli-reverse-proxy';
import InteliConfig from './tools/InteliConfig';
import { INTELI_PROTOCOL } from './inteliProtocol/InteliEvent';
import ActionsEnum from './inteliProtocol/enums/ActionsEnum';
import EncodesEnum from './inteliProtocol/enums/EncodesEnum';
import ResolveStatesEnum from './inteliProtocol/enums/ResolveStatesEnum';
import TypesEnum from './inteliProtocol/enums/TypesEnum';
import WebServerEvent from './inteliProtocol/webServerEvent/WebServerEvent';
import InteliEventFactory from './inteliProtocol/InteliEventFactory';
import InteliAgentSHA256, {
  InteliAgentSHA256Tools,
} from './inteliProtocol/Authentification/InteliAgentSHA256';
import getLogger from './tools/logger';

// ==>
// LOGGER INSTANCE
const logger = getLogger('ProxyWebServer');

enum ServerStates {
  CLOSE,
  PENDING,
  OPEN,
}

/**
 * @function wsClientMessageHandler That will occured if message send by server
 * @param data Message data content
 */
function wsClientMessageHandler(data: IMessage) {
  if (data.type === EncodesEnum.utf8) {
    logger.warn(
      `Inteli reverse-proxy webSocket client receive utf8 message : <${data.utf8Data}>`
    );
  }
  if (data.type === EncodesEnum.binary) {
    logger.warn(
      `Inteli reverse-proxy webSocket client receive binary message : <${data.utf8Data}>`
    );
  }
}

/**
 * @class ProxyWebServer - This provide Inteli-reverse-proxy web server class
 * @version 1.00
 */
class ProxyWebServer {
  private inteliConfig: InteliConfig;
  private state: ServerStates = ServerStates.CLOSE; // Server current state

  private wsClient: WsClient = new WsClient({
    tlsOptions: { rejectUnauthorized: false },
  }); // Websocket client instance
  private httpServer: http.Server | https.Server; // Http/Https server instance

  // Authentification agentId & signature
  private inteliAgentSHA256: InteliAgentSHA256;

  private host: string; // Http/Https server host domain
  private port: number; // Http/Https server port
  private rule: string; // Inteli reverse-proxy web server path rule (for proxy router match rules)
  private connection: Connection = null; // Websocket client connection instance

  private messageHandler: (data: IMessage) => void; // Websocket client message handler

  /**
   * @constructor This provide instance Inteli-reverse-proxy web server (back-end web http server)
   * @param host - Inteli reverse-proxy web server host
   * @param port - Inteli reverse-proxy web server port
   * @param agentId - Inteli reverse-proxy web server identifiant
   * @param rule - Inteli reverse-proxy web server path rule (for proxy router match rules)
   * @param httpServer - Inteli reverse-proxy web server (http/https)
   * @param inteliConfig - Inteli-reverse-proxy configuration (OPTIONNAL - SEE DEFAULT CONFIGURATION)
   * @param messageHandler - Websocket client message handler (optional)
   */
  constructor(
    host: string,
    port: number,
    agentId: string,
    rule: string,
    httpServer: http.Server | https.Server,
    inteliConfig: InteliConfig = DEFAULT_CONFIGURATION,
    messageHandler: (data: IMessage) => void = wsClientMessageHandler
  ) {
    try {
      this.inteliConfig = inteliConfig;
      this.host = host;
      this.port = port;
      this.rule = rule;
      this.inteliAgentSHA256 = InteliAgentSHA256Tools.makeInteliAgentSHA256(
        agentId
      );
      this.messageHandler = messageHandler;
      this.httpServer = httpServer;
    } catch (err) {
      logger.error(
        `An error occured during instanciation of Inteli reverse-proxy web server [${agentId}].\nError message : ${err.message}\nStack: ${err.stack}`
      );
      throw err;
    }
  }

  /**
   * @method ProxyWebServer#Start Start Inteli-reverse-proxy client
   * @returns {Promise<boolean>} Resolve true if it start properly, false otherwise
   */
  public start(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        if (this.state === ServerStates.CLOSE) {
          this.state = ServerStates.PENDING;
          logger.info(
            `Inteli reverse-proxy web server start in progress (2 steps) [${this.inteliAgentSHA256.agentId}] ...`
          );
          this.wsClient.on('connectFailed', (err: Error) => {
            logger.error(
              `An error occured when attempted websocket connection [${this.inteliAgentSHA256.agentId}].\nError message : ${err.message}\nStack: ${err.stack}`
            );
            this.state = ServerStates.CLOSE;
            reject(err);
          });
          this.wsClient.on('connect', (connection: Connection) => {
            this.connection = connection;
            connection.on('error', (err: Error) => {
              this.wsClientErrorHandler(this, err);
            });
            connection.on('close', (code: number, desc: string) => {
              this.wsClientCloseHandler(this, code, desc);
            });
            connection.on('message', (data: IMessage) => {
              this.messageHandler(data);
            });
            logger.info(
              `Inteli reverse-proxy web server start (1/2) [${this.inteliAgentSHA256.agentId}]: websocket client start`
            );
            this.httpServer.listen(this.port, () => {
              logger.info(
                `Inteli reverse-proxy web server start (2/2) [${this.inteliAgentSHA256.agentId}]: web server start on port [${this.port}]`
              );
              const openProxyEvent: WebServerEvent = InteliEventFactory.makeWebServerEvent(
                ActionsEnum.open,
                this.inteliAgentSHA256,
                this.inteliConfig.webserver.version,
                this.host,
                this.port,
                this.rule
              );
              this.connection.send(JSON.stringify(openProxyEvent), (err) => {
                if (err) {
                  reject(err);
                } else {
                  this.state = ServerStates.OPEN;
                  resolve(true);
                }
              });
            });
          });
          const headers: http.OutgoingHttpHeaders = {
            Authorization: `INTELI-SHA256 AgentId=${this.inteliAgentSHA256.agentId}, Signature=${this.inteliAgentSHA256.signature}`,
          };
          if (this.inteliConfig.secure) {
            this.wsClient.connect(
              `wss://${process.env.PROXY_WS_HOST}:${process.env.PROXY_WS_PORT}/`,
              INTELI_PROTOCOL,
              this.host,
              headers
            );
          } else {
            this.wsClient.connect(
              `ws://${process.env.PROXY_WS_HOST}:${process.env.PROXY_WS_PORT}/`,
              INTELI_PROTOCOL,
              this.host,
              headers
            );
          }
        } else {
          logger.warn(
            `Inteli reverse-proxy web server start attempt aborded [${this.inteliAgentSHA256.agentId}]: server is already start or in intermediate state`
          );
          resolve(false);
        }
      } catch (err) {
        logger.error(
          `Error append on websocket client start [${this.inteliAgentSHA256.agentId}].\nError message : ${err.message}\nStack: ${err.stack}`
        );
        reject(err);
      }
    });
  }

  /**
   * @method ProxyWebServer#Stop Stop Inteli-reverse-proxy client
   * @returns {Promise<boolean>} Resolve true if it stop properly, false otherwise
   */
  public stop(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        if (this.state === ServerStates.OPEN) {
          this.state = ServerStates.PENDING;
          logger.info(
            `Inteli reverse-proxy web server stop in progress (2 steps) [${this.inteliAgentSHA256.agentId}] ...`
          );
          if (this.connection.connected) {
            const closeProxyEvent: WebServerEvent = InteliEventFactory.makeWebServerEvent(
              ActionsEnum.close,
              this.inteliAgentSHA256,
              this.inteliConfig.webserver.version,
              this.host,
              this.port,
              this.rule
            );
            this.connection.send(JSON.stringify(closeProxyEvent), (err) => {
              if (err) {
                reject(err);
              }
            });
          }
          setTimeout(() => {
            if (this.connection.connected) {
              this.connection.close();
            }
            logger.info(
              `Inteli reverse-proxy web server stop (1/2) [${this.inteliAgentSHA256.agentId}]: websocket client stop`
            );
            setTimeout(() => {
              if (this.httpServer.listening) {
                this.httpServer.close((err?: Error) => {
                  if (err) {
                    logger.error(
                      `An error occured when Inteli reverse-proxy web server attempted to stop [${this.inteliAgentSHA256.agentId}].\nError message : ${err.message}\nStack: ${err.stack}`
                    );
                    reject(err);
                  } else {
                    logger.info(
                      `Inteli reverse-proxy web server stop (2/2) [${this.inteliAgentSHA256.agentId}]: web server stop on port [${this.port}]`
                    );
                    this.state = ServerStates.CLOSE;
                    resolve(true);
                  }
                });
              }
            }, this.inteliConfig.webserver.closeTimeout);
          }, this.inteliConfig.webserver.closeTimeout);
        } else {
          logger.warn(
            `Inteli reverse-proxy web server stop attempt aborded [${this.inteliAgentSHA256.agentId}]: server is already stop or in intermediate state`
          );
          resolve(false);
        }
      } catch (err) {
        logger.error(
          `Error append on websocket client stop [${this.inteliAgentSHA256.agentId}].\nError message : ${err.message}\nStack: ${err.stack}`
        );
        reject(err);
      }
    });
  }

  /**
   * @method ProxyWebServer#wsClientCloseHandler That will occured if connection close by server
   * @param _this Class instance context
   * @param code Close reason code send by server
   * @param desc Close description reason send by server
   */
  private wsClientCloseHandler(
    _this: ProxyWebServer,
    code: number,
    desc: string
  ) {
    logger.info(
      `Client disconnected [${_this.inteliAgentSHA256.agentId}], reason : [${code} | ${desc}]`
    );
    if (_this.state === ServerStates.OPEN) {
      _this.stop();
    }
  }

  /**
   * @method ProxyWebServer#wsClientErrorHandler That will occured if an error send by server
   * @param _this Class instance context
   * @param err Error send by server
   */
  private wsClientErrorHandler(_this: ProxyWebServer, err: Error) {
    logger.error(
      `Error append on websocket client [${this.inteliAgentSHA256.agentId}].\nError message : ${err.message}\nStack: ${err.stack}`
    );
    if (_this.state === ServerStates.OPEN) {
      _this.stop();
    }
  }

  public send(
    type: Exclude<string, TypesEnum>,
    action: string,
    payload: any
  ): Promise<ResolveStatesEnum> {
    return new Promise((resolve, reject) => {
      try {
        if (this.state === ServerStates.OPEN) {
          const sendPayload: string = JSON.stringify(
            InteliEventFactory.makeInteliEvent(
              type,
              action,
              this.inteliAgentSHA256,
              payload
            )
          );
          this.connection.send(sendPayload, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve(ResolveStatesEnum.VALID);
            }
          });
        } else {
          resolve(ResolveStatesEnum.UNVAILABLE);
        }
      } catch (err) {
        reject(err);
      }
    });
  }
}

export default ProxyWebServer;
