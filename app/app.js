// OBTAIN ENV CONFIGURATION VALUES
require("dotenv").config();
let urlTable = new Map();
let targetQueue = [];

// #################
// ## PROXY PART
// #################
// -- WS server
const morgan = require("morgan");
const logger = morgan("combined");

const http = require("http");

const httpServer = http.createServer((req, res) => {});
httpServer.listen(process.env.ENV_PROXYWS);
const webSocketServer = require("websocket").server;
const wsServer = new webSocketServer({
  httpServer: httpServer,
  autoAcceptConnections: false,
});
function originIsAllowed(origin) {
  return true; // TODO CORS
}
function handlerOnMessage(message) {
  console.log("Message event : ", message);
  const event = JSON.parse(message.utf8Data);
  if (event.type === "ready") {
    urlTable.set(event.server.id, {
      host: event.server.host,
      port: event.server.port,
    });
    targetQueue.push(event.server.id);
    console.log("push host : ", event.server);
  }
  if (event.type === "close") {
    urlTable.delete(event.server.id);
    console.log("delete host : ", event.server);
  }
}
function handlerOnClose(reasonCode, description) {
  console.log("Close event : ", reasonCode, description);
}
wsServer.on("request", function (req) {
  if (!originIsAllowed(req.origin)) {
    req.reject();
    console.log(
      new Date() + " Connection from origin " + req.origin + " rejected."
    );
    return;
  }

  var connection = req.accept("echo-protocol", req.origin);
  connection.on("message", handlerOnMessage);
  connection.on("close", handlerOnClose);
});

// --- Proxy server
const httpproxy = require("http-proxy");
// OBTAIN HTTP PROXY SERVER INSTANCE
// [INFO] activate the websocket support for the proxy using ws:true in the options
const proxy = httpproxy.createProxyServer({});

// FORWARD HTTP REQUEST TO PROXY SERVER INSTANCE
function getTarget(req, res) {
  let targetId = targetQueue.shift();
  while (!urlTable.has(targetId) && targetQueue.length > 0) {
    targetId = targetQueue.shift();
  }

  if (urlTable.has(targetId)) {
    targetQueue.push(targetId);
    return urlTable.get(targetId);
  } else {
    return null;
  }
}
const proxyserver = http.createServer((req, res) => {
  const target = getTarget();
  console.log("target", target);
  if (target) {
    proxy.web(req, res, { target: getTarget() });
  } else {
    res.writeHead(503, { "Content-Type": "text/html" });
    res.end("Service unavailable", "utf-8");
  }
});
proxyserver.listen(process.env.ENV_PROXYPORT);

// #################
// ## CLIENT PART
// #################

const WebSocketClient = require("websocket").client;
const { connect } = require("http2");
const { CLIENT_RENEG_LIMIT } = require("tls");
const { table } = require("console");
const client = new WebSocketClient();

client.on("connectFailed", function (error) {
  console.log("Connect Error: " + error.toString());
});

client.on("connect", function (connection) {
  console.log("WebSocket Client Connected");
  connection.on("error", function (error) {
    console.log("Connection Error: " + error.toString());
  });
  connection.on("close", function () {
    console.log("echo-protocol Connection Closed");
  });
  connection.on("message", function (message) {
    if (message.type === "utf8") {
      console.log("Received: '" + message.utf8Data + "'");
    }
  });
  connection.send(
    JSON.stringify({
      type: "ready",
      server: {
        id: "AA",
        host: "localhost",
        port: 4242,
      },
    })
  );
  setTimeout(() => {
    connection.send(
      JSON.stringify({
        type: "close",
        server: {
          id: "AA",
          host: "localhost",
          port: 4242,
        },
      })
    );
  }, 10000);
});

client.connect("ws://localhost:3030/", "echo-protocol");

// SERVER HTTP
const httpHostServer = http.createServer((req, res) => {
  res.setHeader("content-type", "text/plain");
  res.end("hello, world!");
  logger(req, res, (err) => {
    if (err) {
      console.error(err);
    }
  });
});

httpHostServer.listen(process.env.ENV_BACK);
