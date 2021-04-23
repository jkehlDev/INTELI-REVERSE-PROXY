# INTELI-REVERSE-PROXY

Inteli-reverse-proxy, is a small and smart reverse proxy with simpliest load balancer for HTTP/HTTPS WEB Server.

Web server and reverse-proxy establish websocket connection, 
When Web server start, it broadcast to reverse-proxy it can receive web client request and reverse-praxy add it to it's target web servers list.

When Web server stop (versionning, resolving issue, ...), it broadcast to proxy that it can't receive anymors web client request and proxy delete it from it's target web server list.

Broadcast between reverse-proxy and web server are secure by TSL and with a signed SHA-256 web server id.
Proxy test by interval if each web server is curently online with a ping-pong websocket exchange.

```
 WEB CLIENT          INTELI-REVERSE-PROXY               WEB SERVER
 ------------------------------------------------------------------
    |                         START                         START BROADCAST
    |                           | <------ SHA256 AUTH ----- CONNECT    
    |                           | ------- ACCEPT ---------> |
    |                         ADD TO <--- START EVENT ----- START 
    |                         TARGET LIST                   WEB SERVER
    |                           |                           |
 REQUEST --- HTTP REQUEST --> LOAD ---- HTTP REQUEST -----> PROCESS
 WEB PAGE/API                 BALANCE                       WEB CLIENT
    | <----- HTTP RESPONSE ---- | <---- HTTP RESPONSE ----- REQUEST
    |                           |                           |
    |                         REMOVE FROM <-- CLOSE EVENT - CLOSE
    |                         TARGET LIST                   |
    |                           |                           STOP
 REQUEST --- HTTP REQUEST --> NO TARGET
 WEB PAGE/API <-- HTTP 403 -- WEB SERVER
                                |
                              STOP
``` 