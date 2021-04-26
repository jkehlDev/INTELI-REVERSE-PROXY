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
import InteliSHA256, {
  InteliSHA256Factory,
} from 'app/inteliProtocol/Authentification/InteliSHA256';
import fs from 'fs';
import logger from 'app/tools/logger';
// ==>

enum ServerStates {
  CLOSE,
  PENDING,
  OPEN,
}

/**
 * @class ProxyWebServer - This provide Inteli-reverse-proxy client class
 * @version 1.00
 */
class ProxyWebServer {
  private state: ServerStates = ServerStates.CLOSE; // Server current state

  private wsClient: WsClient = new WsClient(); // Websocket client instance
  private httpServer: http.Server | https.Server; // Http/Https server instance

  // Authentification agentId & signature
  private inteliSHA256: InteliSHA256;
  // TIPS https://nodejs.org/api/crypto.html#crypto_class_sign

  private host: string; // Http/Https server host domain
  private port: number; // Http/Https server port
  private connection: Connection = null; // Websocket client connection instance

  /**
   * @constructor This provide instance Inteli-reverse-proxy client (back-end http server)
   * @param host - Inteli reverse-proxy web server host
   * @param port - Inteli reverse-proxy web server port
   * @param agentId - Inteli reverse-proxy web server identifiant
   * @param clientPrivateKeyFileName  - Inteli reverse-proxy web server cert private key file name
   * @param httpServer - Inteli reverse-proxy web server (http/https)
   */
  constructor(
    host: string,
    port: number,
    agentId: string,
    clientPrivateKeyFileName: string,
    httpServer: http.Server | https.Server
  ) {
    this.host = host;
    this.port = port;
    try {
      if (fs.existsSync(`${process.cwd()}/${clientPrivateKeyFileName}.pem`)) {
        this.inteliSHA256 = InteliSHA256Factory.makeInteliSHA256(
          agentId,
          clientPrivateKeyFileName
        );
      } else {
        logger.error(
          `An error occured during instanciation of Inteli reverse-proxy Web server. RSA private key not found at ${process.cwd()}/${clientPrivateKeyFileName}.pem`
        );
        throw new Error(
          `ERROR - [${new Date()}] Web server RSA private key not found at ${process.cwd()}/${clientPrivateKeyFileName}.pem`
        );
      }
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
    this.wsClient.on('connectFailed', (err: Error) => {
      this.wsClientConnectFailedHandler(this, err);
    });
    this.wsClient.on('connect', (connection: Connection) => {
      this.wsClientConnectHandler(this, connection);
    });
  }

  /**
   * @method ProxyClient#Start Start Inteli-reverse-proxy client
   */
  public start() {
    if (this.state === ServerStates.CLOSE) {
      logger.info(
        `Inteli reverse-proxy web server start in progress (2 steps)...`
      );

      this.state = ServerStates.PENDING;

      const headers: http.OutgoingHttpHeaders = {
        Authorization: `INTELI-SHA256 AgentId=${this.inteliSHA256.agentId}, Signature=${this.inteliSHA256.signature}`,
      };

      this.wsClient.connect(
        `ws://${process.env.PROXY_WS_HOST}:${process.env.PROXY_WS_PORT}/`,
        'inteli',
        'localhost',
        headers
      );
    } else {
      logger.warn(
        `Inteli reverse-proxy web server start attempt aborded: server is already start or in intermediate state`
      );
    }
  }

  /**
   * @method ProxyClient#Stop Stop Inteli-reverse-proxy client
   */
  public stop() {
    if (this.state === ServerStates.OPEN) {
      try {
        logger.info(
          `Inteli reverse-proxy web server stop in progress (2 steps) ...`
        );

        this.state = ServerStates.PENDING;

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
                  Stack: ${err.stack}
                `
                );
              } else {
                this.httpServerCloseHandler(this, err);
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
      }
    } else {
      logger.warn(
        `Inteli reverse-proxy web server stop attempt aborded: server is already stop or in intermediate state`
      );
    }
  }

  /**
   * @method ProxyClient#wsClientConnectFailedHandler Deal with error from the connection attempt
   * @param _this Class instance context
   * @param err Error send by server when client attempt to connect
   */
  private wsClientConnectFailedHandler(_this: ProxyWebServer, err: Error) {
    logger.error(
      `Inteli reverse-proxy websocket client event - An error occured when attempted websocket connection
        Error message : ${err.message}
        Stack: ${err.stack}`
    );
    this.state = ServerStates.CLOSE;
  }

  /**
   * @method ProxyClient#wsClientConnectHandler That will occured if connection succeeds
   * @param _this Class instance context
   * @param connection WS Client connection object
   */
  private wsClientConnectHandler(
    _this: ProxyWebServer,
    connection: Connection
  ) {
    _this.connection = connection;
    connection.on('error', (err: Error) => {
      _this.wsClientErrorHandler(_this, err);
    });
    connection.on('close', (code: number, desc: string) => {
      _this.wsClientCloseHandler(_this, code, desc);
    });
    connection.on('message', (data: IMessage) => {
      _this.wsClientMessageHandler(_this, data);
    });

    logger.info(
      `Inteli reverse-proxy web server start (1/2) : websocket client start`
    );
    _this.httpServer.listen(_this.port, () => {
      _this.httpServerListenHandler(_this);
    });
  }

  /**
   * @method ProxyClient#wsClientCloseHandler That will occured if connection close by server
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
   * @method ProxyClient#wsClientMessageHandler That will occured if message send by server
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
   * @method ProxyClient#wsClientErrorHandler That will occured if an error send by server
   * @param _this Class instance context
   * @param err Error send by server
   */
  private wsClientErrorHandler(_this: ProxyWebServer, err: Error) {
    logger.error(
      `Inteli reverse-proxy websocket client event - An error occured when attempted to stop web server
        Error message : ${err.message}
        Stack: ${err.stack}`
    );
    if (_this.state === ServerStates.OPEN) {
      _this.stop();
    }
  }

  /**
   * @method ProxyClient#httpServerListenHandler That will occured if http server start listening
   * @param _this Class instance context
   */
  private httpServerListenHandler(_this: ProxyWebServer) {
    logger.info(
      `Inteli reverse-proxy web server start (2/2) : web server start on port [${_this.port}]`
    );
    const openProxyEvent: WebServerEvent = InteliEventFactory.makeWebServerEvent(
      ActionEnum.open,
      _this.inteliSHA256,
      inteliConfig.webserver.version,
      _this.host,
      _this.port
    );
    _this.connection.send(JSON.stringify(openProxyEvent));
    this.state = ServerStates.OPEN;
  }

  /**
   * @method ProxyClient#httpServerListenHandler That will occured if http server close
   * @param _this Class instance context
   * @param err Error if error occured
   */
  private httpServerCloseHandler(_this: ProxyWebServer, err?: Error) {
    if (err) {
      logger.error(
        `Inteli reverse-proxy websocket client event - An error occured when attempted to stop web server
          Error message : ${err.message}
          Stack: ${err.stack}`
      );
    } else {
      logger.info(
        `Inteli reverse-proxy web server stop (2/2) : web server stop on port [${_this.port}]`
      );
      this.state = ServerStates.CLOSE;
    }
  }
}

export default ProxyWebServer;
