# INTELI-REVERSE-PROXY

Inteli-reverse-proxy, is a small and smart reverse proxy with simpliest automatic load balancer for HTTP/HTTPS WEB Server.

Web server and reverse-proxy establish a connection through websocket,
When a Web server starts, it deal with the reverse-proxy to communicate his status and be ready to receive web client request.
Then, the reverse proxy target him to store in his web server list.

And when it stops, the web server disconnect from the reverse-proxy and be deleted from his lists.

Communication between reverse-proxy and web server is secured by TSL and a signed SHA-256 web server id.
Proxy monitors the status of each web server at regular intervals with a ping-pong websocket exchange.

A system adminstration independant module give to sysadmin functions to upload or remove public encryption key for each Web server into reverse-proxy session through websocket.

```
 WEB CLIENT          INTELI-REVERSE-PROXY               WEB SERVER
 ------------------------------------------------------------------
    |                         START                         START BROADCAST
    |                           | <------ SHA256 AUTH ----- CONNECT
    |                           | ------- ACCEPT ---------> |
    |                         ADD TO <--- START EVENT ----- START
    |                         TARGET LIST                   WEB SERVER
    |                           |                           |
   ...                         ...                         ...
    |                           |                           |
 REQUEST --- HTTP REQUEST --> LOAD ---- HTTP REQUEST -----> PROCESS
 WEB PAGE/API                 BALANCE                       WEB CLIENT
    | <----- HTTP RESPONSE ---- | <---- HTTP RESPONSE ----- REQUEST
    |                           |                           |
   ...                         ...                         ...
    |                           | ------- PING -----------> |
    |                           | <------ PONG ------------ |
   ...                         ...                         ...
    |                           |                           |
    |                         REMOVE FROM <-- CLOSE EVENT - CLOSE
    |                         TARGET LIST                   |
    |                           |                           STOP
    |                           |
   ...                         ...
    |                           |
 REQUEST --- HTTP REQUEST --> NO TARGET
 WEB PAGE/API <-- HTTP 403 -- WEB SERVER
                                |
                               ...
                                |
                              STOP
```

## TABLE OF CONTENTS

- [Installation](#Installation)
  - [Inteli reverse-proxy server instance](#Inteli-reverse-proxy-server-instance)
  - [Inteli web server instance](#Inteli-web-server-instance)
  - [Inteli sysadmin tool](#Inteli-sysadmin-tool)
  - [INTELI Broadcasting protocol](#INTELI-Broadcasting-protocol)

## Installation

`npm install inteli-reverse-proxy --save`

Write an environnement configuration file '.env' in your root project directory.

`.env` file example :

```
# INTELI-REVERSE-PROXY PAREMETERS
# -- http/https webSocket Server : host and listening port
PROXY_WS_HOST=localhost
PROXY_WS_PORT=3042
# -- http/https proxy Server : listening port, certificat TSL file path and name, asymetric public key file directory
PROXY_PORT=3080
PROXY_TSL_CERT=tsl/cert.pem
PROXY_TSL_KEY=tsl/key.pem
PROXY_ENCRYPT_CERTSTOR=certstore
# -- proxy client websocket  (proxy web Server) : asymetric private key file directory
PROXY_ENCRYPT_PRIVATE=.
# -- Logger files names output
PROXY_LOGGER_SYSOUT=sysOut
PROXY_LOGGER_SYSERR=sysErr
```

Prepare an Inteli configuration object.
`DEFAULT_CONFIGURATION` example :

[See websocket module server mounting options](https://github.com/theturtle32/WebSocket-Node/blob/a2cd3065167668a9685db0d5f9c4083e8a1839f0/docs/WebSocketServer.md#server-config-options)

```js
import { InteliConfig } from 'inteli-reverse-proxy';
const DEFAULT_CONFIGURATION: InteliConfig = {
  secure: false, // TSL MODE ENABLE WHEN secure at true (false by default)
  wsServerMount: {
    keepalive: true,
    keepaliveInterval: 20000,
    dropConnectionOnKeepaliveTimeout: true,
    keepaliveGracePeriod: 10000,
    autoAcceptConnections: false,
    closeTimeout: 5000,
    disableNagleAlgorithm: true,
    ignoreXForwardedFor: false,
  },
  webserver: {
    version: '1.0.0', // Version of your web server
    closeTimeout: 1000, // Delay before closing server/client at stop action
  },
  sysadmin: {
    closeTimeout: 500, // Delay before closing client at stop action
  },
  proxyserver: {
    closeTimeout: 500, // Delay before closing servers at stop action
  },
};
```

### Inteli reverse-proxy server instance

Inteli reverse-proxy server instance running :

- A proxy-http/https server instance
- A websocket (ws/wss) server instance

A new Inteli reverse-proxy is created by calling `ProxyServer` and passing :

- `originValidator` - Callback provide origin check before accept new host connection (For CORS)
- `proxySelector` - Instance of ProxySelector (Optionnal, DefaultProxySelector instance by default)
- `proxyMsgHandler` - Instance of ProxyMsgHandler (Optionnal, DefaultProxySelector instance by default)
- `inteliConfig` - Inteli-reverse-proxy configuration (Optionnal, SEE DEFAULT CONFIGURATION)

```ts
import { ProxyServer } from 'inteli-reverse-proxy';
// TEST Inteli proxy start and stop with delay
const checkOrigin: (origin: string) => Promise<boolean> = async (
  origin: string
) => {
  return origin === 'localhost';
};
const proxyServer: ProxyServer = new ProxyServer(checkOrigin); // NEW PROXY SERVER
```

An instance of `ProxyServer` will be returned with 2 methodes :

- `.start()` : Start method used to start websocket server and proxy server listening: It return Promise<boolean> object.
- `.stop()` : Stop method used to stop websocket server and proxy server listening: It return Promise<boolean> object.

### Inteli web server instance

Inteli web server instance running :

- A websocket client connected to an Inteli reverse-proxy websocket server instance
- A web http/https server instance

A new Inteli web server is created by calling `ProxyWebServer` and passing :

- `host` : Inteli reverse-proxy web server host
- `port` : Inteli reverse-proxy web server port
- `agentId` : Inteli reverse-proxy web server identifiant
- `rule` : Inteli reverse-proxy web server path rule (for proxy router match rules)
- `httpServer` : Inteli reverse-proxy web server (http/https)
- `inteliConfig` : Inteli-reverse-proxy configuration (Optional, SEE DEFAULT CONFIGURATION)
- `messageHandler` : Websocket client message handler (Optional)

```ts
import { ProxyWebServer } from 'inteli-reverse-proxy';
const web001: ProxyWebServer = new ProxyWebServer( // NEW WEB SERVER 001
  'localhost',
  4242,
  'WEB001',
  '/',
  http.createServer((req, res) => {
    res.setHeader('content-type', 'text/plain');
    res.end('hello, world 1 !');
  })
);
```

An instance of `ProxyWebServer` will be returned with 3 methodes :

- `.start()` : Start method used to start websocket client and web server listening: It return Promise<boolean> object.
- `.stop()` : Stop method used to stop websocket client and web server listening: It return Promise<boolean> object.
- `.send(type, action, payload)` : Send method used to send personalized message to websocket server (`ProxyServer` instance)
  - `type:string` - Use to specifying message type (personalized type)
  - `action:string` - Use to specifying message action requested (personalized action)
  - `payload:any` - Use to specifying message payload (personnalized object)

### Inteli sysadmin tool

Inteli reverse-proxy Sysadmin instance running :

- A websocket client connected to an Inteli reverse-proxy websocket server instance

A new Inteli web server is created by calling `ProxySysAdmin` and passing :

- `origin` : Websocket client origin for server CORS check validity
- `inteliConfig` : Inteli-reverse-proxy configuration (Optional, SEE DEFAULT CONFIGURATION)

```ts
import { ProxySysAdmin } from 'inteli-reverse-proxy';
const proxySysAdmin: ProxySysAdmin = new ProxySysAdmin('localhost'); // NEW PROXY SysAdmin
```

An instance of `ProxySysAdmin` will be returned with 5 methodes :

- `.start()` : Start method used to start websocket client: It return Promise<void> object.
- `.stop()` : Stop method used to stop websocket client: It return Promise<void> object.
- `.send(type, action, payload)` : Send method used to send personalized message to websocket server (`ProxyServer` instance)
  - `type:string` - Use to specifying message type (personalized type)
  - `action:string` - Use to specifying message action requested (personalized action)
  - `payload:any` - Use to specifying message payload (personnalized object)
- `.addPublicKey(hostid,publicKeyFilePath)` : Push new web server encryption public key for specified web server id into `ProxyServer` certificats store.
- `.removePublicKey(hostid)` : Remove web server encryption public key for specified web server id from `ProxyServer` certificats store.

## INTELI Broadcasting protocol

All message broadcasted between server and client websocket are in specific format :

```ts
interface InteliEvent<Type extends string, Action extends string, Payload> {
  header: {
    type: Type;
    action: Action;
  };
  authentification: InteliAgentSHA256;
  payload: Payload;
}
```

So, personalized message have to implement this interface.

`authentification` is in format provide by `InteliAgentSHA256` interface.

```ts
interface InteliAgentSHA256 {
  agentId?: string;
  signature?: string;
}
```

You can use `InteliAgentSHA256Tools` to build your own `InteliAgentSHA256` instance for your personnalized message.

```ts
import {
  InteliAgentSHA256,
  InteliAgentSHA256Tools,
} from 'inteli-reverse-proxy';
const authentification: InteliAgentSHA256 = InteliAgentSHA256Tools.makeInteliAgentSHA256(
  'myAgentID'
);
```

You also use `InteliAgentSHA256Tools` to generate public and private asymetric cryptographic key need for authentification check validity.

```ts
import { InteliAgentSHA256Tools } from 'inteli-reverse-proxy';
InteliAgentSHA256Tools.genKeys('WEB001');
```

Keys are write into files in specified directory into environnement parameters `PROXY_ENCRYPT_PRIVATE`.

You also use `InteliAgentSHA256Tools` to check validity of your InteliAgentSHA256 authentification object.

```ts
import { InteliAgentSHA256Tools } from 'inteli-reverse-proxy';
const isValid: boolean = InteliAgentSHA256Tools.inteliSHA256CheckValidity(
  yourAuthentification
); // TRUE if validity checked
```
