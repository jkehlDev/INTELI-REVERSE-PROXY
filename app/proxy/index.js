// OBTAIN ENV CONFIGURATION VALUES
require("dotenv").config();
// TODO - TRANSFORM INTO HTTPS with certificat files
const http = require("http");

/**
 * @function getTarget Obtain target URL to forward request
 * @param req Client request
 * @param res Client response
 */
function getTarget(req, res) {
  return { host: "localhost", port: 3030 };
}

// REQUIRE HTTP-PROXY MODULE
const httpproxy = require("http-proxy");
// OBTAIN HTTP PROXY SERVER INSTANCE
// [INFO] activate the websocket support for the proxy using ws:true in the options
const proxy = httpproxy.createProxyServer({});

// FORWARD HTTP REQUEST TO PROXY SERVER INSTANCE
const morgan = require("morgan");
const logger = morgan("tiny");
const proxyserver = http.createServer((req, res) => {
  proxy.web(req, res, { target: getTarget() });
  logger(req, res, (err) => {
    if (err) {
      console.error(err);
    }
  });
});

/* proxyserver.on("open", (req, socket, head) => {
  proxy.ws(req, socket, head, { target: getTarget() });
}); */

proxyserver.listen(process.env.ENV_PROXYPORT);
