// <== Imports externals modules
import {
  connection as Connection,
  client as WsClient,
  IMessage,
} from 'websocket';
import WebServerEvent from 'app/inteliProtocol/webServerEvent/WebServerEvent';
import InteliEventFactory from 'app/inteliProtocol/InteliEventFactory';
import ActionEnum from 'app/inteliProtocol/enums/EventActions';
import http from 'http';
import https from 'https';
import EventEncode from 'app/inteliProtocol/enums/EventEncode';
import inteliConfig from 'inteliProxyConfig.json';
import InteliAgentSHA256, {
  InteliSHA256Factory,
} from 'app/inteliProtocol/Authentification/InteliAgentSHA256';
import getLogger from 'app/tools/logger';
// ==>
// LOGGER INSTANCE
const logger = getLogger('ProxyWebServer');

enum ServerStates {
  CLOSE,
  PENDING,
  OPEN,
}

/**
 * @class ProxyWebServer - This provide Inteli-reverse-proxy web server class
 * @version 1.00
 */
class ProxyWebServer {
  private state: ServerStates = ServerStates.CLOSE; // Server current state

  private wsClient: WsClient = new WsClient(); // Websocket client instance
  private httpServer: http.Server | https.Server; // Http/Https server instance

  // Authentification agentId & signature
  private inteliAgentSHA256: InteliAgentSHA256;

  private host: string; // Http/Https server host domain
  private port: number; // Http/Https server port
  private connection: Connection = null; // Websocket client connection instance

  /**
   * @constructor This provide instance Inteli-reverse-proxy web server (back-end web http server)
   * @param host - Inteli reverse-proxy web server host
   * @param port - Inteli reverse-proxy web server port
   * @param agentId - Inteli reverse-proxy web server identifiant
   * @param httpServer - Inteli reverse-proxy web server (http/https)
   */
  constructor(
    host: string,
    port: number,
    agentId: string,
    httpServer: http.Server | https.Server
  ) {
    this.host = host;
    this.port = port;
    try {
      this.inteliAgentSHA256 = InteliSHA256Factory.makeInteliAgentSHA256(
        agentId
      );
    } catch (err) {
      logger.error(
        `An error occured during instanciation of Inteli reverse-proxy web server.
          Error message : ${err.message}
          Stack: ${err.stack}
        `
      );
      throw err;
    }
    this.httpServer = httpServer;
  }

  /**
   * @method ProxyWebServer#Start Start Inteli-reverse-proxy client
   */
  public start(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        if (this.state === ServerStates.CLOSE) {
          this.state = ServerStates.PENDING;
          logger.info(
            `Inteli reverse-proxy web server start in progress (2 steps)...`
          );

          this.wsClient.on('connectFailed', (err: Error) => {
            logger.error(
              `Inteli reverse-proxy websocket client event - An error occured when attempted websocket connection
              Error message : ${err.message}
              Stack: ${err.stack}`
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
              this.wsClientMessageHandler(this, data);
            });

            logger.info(
              `Inteli reverse-proxy web server start (1/2) : websocket client start`
            );
            this.httpServer.listen(this.port, () => {
              logger.info(
                `Inteli reverse-proxy web server start (2/2) : web server start on port [${this.port}]`
              );
              const openProxyEvent: WebServerEvent = InteliEventFactory.makeWebServerEvent(
                ActionEnum.open,
                this.inteliAgentSHA256,
                inteliConfig.webserver.version,
                this.host,
                this.port
              );
              this.connection.send(JSON.stringify(openProxyEvent));
              this.state = ServerStates.OPEN;
              resolve(true);
            });
          });

          const headers: http.OutgoingHttpHeaders = {
            Authorization: `INTELI-SHA256 AgentId=${this.inteliAgentSHA256.agentId}, Signature=${this.inteliAgentSHA256.signature}`,
          };
          this.wsClient.connect(
            `ws://${process.env.PROXY_WS_HOST}:${process.env.PROXY_WS_PORT}/`,
            'inteli',
            this.host,
            headers
          );
        } else {
          logger.warn(
            `Inteli reverse-proxy web server start attempt aborded: server is already start or in intermediate state`
          );
          resolve(false);
        }
      } catch (err) {
        logger.error(
          `An error occured when proxy web server attempt to start.
            Error message : ${err.message}
            Stack: ${err.stack}`
        );
        reject(err);
      }
    });
  }

  /**
   * @method ProxyWebServer#Stop Stop Inteli-reverse-proxy client
   */
  public stop(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        if (this.state === ServerStates.OPEN) {
          this.state = ServerStates.PENDING;
          logger.info(
            `Inteli reverse-proxy web server stop in progress (2 steps) ...`
          );
          try {
            this.connection.close();
            logger.info(
              `Inteli reverse-proxy web server stop (1/2) : websocket client stop`
            );
            setTimeout(() => {
              if (this.httpServer.listening) {
                this.httpServer.close((err?: Error) => {
                  if (err) {
                    logger.error(
                      `An error occured when Inteli reverse-proxy web server attempted to stop 
                        Error message : ${err.message}
                        Stack: ${err.stack}`
                    );
                    reject(err);
                  } else {
                    logger.info(
                      `Inteli reverse-proxy web server stop (2/2) : web server stop on port [${this.port}]`
                    );
                    this.state = ServerStates.CLOSE;
                    resolve(true);
                  }
                });
              }
            }, inteliConfig.webserver.closeTimeout);
          } catch (err) {
            logger.error(
              `An error occured when Inteli reverse-proxy web server attempted to stop 
              Error message : ${err.message}
              Stack: ${err.stack}`
            );
            reject(err);
          }
        } else {
          logger.warn(
            `Inteli reverse-proxy web server stop attempt aborded: server is already stop or in intermediate state`
          );
          resolve(false);
        }
      } catch (err) {
        logger.error(
          `An error occured when proxy web server attempt to stop.
            Error message : ${err.message}
            Stack: ${err.stack}`
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
      `Inteli reverse-proxy webSocket client disconnected, reason : ${code} - ${desc}`
    );
    if (_this.state === ServerStates.OPEN) {
      _this.stop();
    }
  }

  /**
   * @method ProxyWebServer#wsClientMessageHandler That will occured if message send by server
   * @param _this Class instance context
   * @param data Message data content
   */
  private wsClientMessageHandler(_this: ProxyWebServer, data: IMessage) {
    if (data.type === EventEncode.utf8) {
      logger.warn(
        `Inteli reverse-proxy webSocket client receive utf8 message : <${data.utf8Data}>`
      );
    }
    if (data.type === EventEncode.binary) {
      logger.warn(
        `Inteli reverse-proxy webSocket client receive binary message : <${data.utf8Data}>`
      );
    }
  }

  /**
   * @method ProxyWebServer#wsClientErrorHandler That will occured if an error send by server
   * @param _this Class instance context
   * @param err Error send by server
   */
  private wsClientErrorHandler(_this: ProxyWebServer, err: Error) {
    logger.error(
      `Inteli reverse-proxy websocket client event - An error occured
        Error message : ${err.message}
        Stack: ${err.stack}`
    );
    if (_this.state === ServerStates.OPEN) {
      _this.stop();
    }
  }
}

export default ProxyWebServer;
