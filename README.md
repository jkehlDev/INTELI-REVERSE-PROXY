# INTELI-REVERSE-PROXY

Inteli-reverse-proxy, is a small and smart reverse proxy with simpliest automatic load balancer for HTTP/HTTPS WEB Server.

Web server and reverse-proxy establish a connection through websocket,
When a Web server starts, it deal with the reverse-proxy to communicate his status and be ready to receive web client request.
Then, the reverse proxy target him to store in his web server list.

And when it stops, the web server disconnect from the reverse-proxy and be deleted from his lists.

Communication between reverse-proxy and web server is secured by TSL and a signed SHA-256 web server id.
Proxy monitors the status of each web server at regular intervals with a ping-pong websocket exchange.

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
