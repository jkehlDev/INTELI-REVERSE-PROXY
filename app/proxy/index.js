// OBTAIN ENV CONFIGURATION VALUES
require("dotenv").config();

// TODO - TRANSFORM INTO HTTPS with certificat files
const http = require("http");

// REQUIRE HTTP-PROXY MODULE
const proxy = require("http-proxy");

const server = http
  .createServer((req, res) => {
    proxy.web(req, res, { target });
  })
  .listen(process.env.ENV_PROXYPORT);
