// OBTAIN ENV CONFIGURATION VALUES
require("dotenv").config();

// #################
// ## PROXY PART
// #################
const morgan = require("morgan");
const logger = morgan("tiny");

const http = require("http");
const httpServer = http.createServer((req, res) => {
});
httpServer.listen(process.env.ENV_PROXYWS);

const webSocketServer = require("websocket").server;
const wsServer = new webSocketServer({
  httpServer: httpServer,
  autoAcceptConnections: false,
});

function originIsAllowed(origin) {
  // TODO CORS
  return true;
}

function handlerOnMessage(message) {
  console.log("Message event : ", message);
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

// #################
// ## CLIENT PART
// #################

const WebSocketClient = require("websocket").client;
const { connect } = require("http2");
const { CLIENT_RENEG_LIMIT } = require("tls");
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

  function sendNumber() {
    if (connection.connected) {
      var number = Math.round(Math.random() * 0xffffff);
      connection.sendUTF(number.toString());
      setTimeout(sendNumber, 1000);
    }
  }
  sendNumber();
});

client.connect("ws://localhost:3030/", "echo-protocol");
