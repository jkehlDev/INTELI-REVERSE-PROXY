const http = require("http");
const WsServer = require("websocket").server;
const wsConfig = require("./wsConfig.json");

/**
 * @class ProxyServer - This Class provide an Inteli-reverse-proxy server
 * @version 1.00
 */
class ProxyServer {
  //#hostsIndexMap = new WeakMap();
  //#hostsQueue = new Array(0);
  #wsServer = new WsServer();
  _wsHttpServer = http.createServer();
  //#proxyServer;
  #isAuthentified;

  /**
   * @constructor ProxyServer - constructor
   * @param {CallableFunction} isAuthentified Callback - Do CORS and JWT implementation in
   */
  constructor(isAuthentified) {
    this.#isAuthentified = isAuthentified;
    this.#wsServer.on("request", this.wsServerRequestHandler);
    this.#wsServer.on("connect", this.wsServerConnectHandler);
    this.#wsServer.on("close", this.wsServerCloseHandler);
    this.#wsServer.on("upgradeError", this.wsServerUpgradeErrorHandler);
  }

  /**
   * @method start
   * @description Start Inteli-reverse-proxy instance
   */
  start() {
    console.log("Starting websocket proxy server ...");
    this.#wsServer.mount({
      httpServer: this._wsHttpServer,
      ...wsConfig,
    });
    this._wsHttpServer.listen(process.env.PROXY_WS_PORT, () => {
      console.log(
        `Websocket proxy server start on port : ${process.env.PROXY_WS_PORT}`
      );
    });
  }

  /**
   * @method stop
   * @description Stop Inteli-reverse-proxy instance
   */
  stop() {
    console.log("Closing proxy ws http server ...");
    this.#wsServer.shutDown();
    this._wsHttpServer.close((err) => {
      if (err) {
        console.error(err);
      } else {
        console.log("Proxy - ws http server close");
      }
    });
  }

  wsServerRequestHandler(webSocketRequest) {
    if (!this.#isAuthentified(webSocketRequest)) {
      webSocketRequest.reject(); // Reject all unauthorized origin
      console.log(
        `[${new Date()}] Connection reject from ws client ${
          webSocketRequest.origin
        }.`
      );
      return;
    }

    const webSocketConnection = webSocketRequest.accept(
      null,
      webSocketRequest.origin
    ); // Accept connection

    // Handle Event
    webSocketConnection.on("message", (message) => {
      this.wsCliMessageHandler(webSocketConnection, message);
    });
    webSocketConnection.on("close", (reasonCode, description) => {
      this.wsCliCloseHandler(webSocketConnection, reasonCode, description);
    });
    webSocketConnection.on("error", (error) => {
      this.wsCliErrorHandler(webSocketConnection, error);
    });
  }

  wsServerConnectHandler(webSocketConnection) {
    console.log(`New connection from ${webSocketConnection.origin}`);
  }
  wsServerCloseHandler(webSocketConnection, closeReason, description) {
    console.log(
      `Closed connection from ${webSocketConnection.origin}, reason : ${closeReason} - ${description}`
    );
  }
  wsServerUpgradeErrorHandler(error) {
    console.error(error);
    throw error;
  }

  wsCliMessageHandler(webSocketConnection, message) {
    // TODO IMPLEMENT MESSAGE HANDLER with TS Enum
  }
  wsCliCloseHandler(webSocketConnection, reasonCode, description) {}
  wsCliErrorHandler(webSocketConnection, error) {
    console.error(webSocketConnection.origin, error);
    throw error;
  }
}

module.exports = ProxyServer;
