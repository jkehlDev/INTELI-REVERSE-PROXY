const WebSocketClient = require("websocket").client;
const http = require("http");

const clientConfig = require("./clientConfig.json");

class ProxyClient {

wsClient = new WebSocketClient();
domain;
port;

    constructor(domain="my.domain.com", port= 3080) {
        this.domain = domain;
        this.port= port;
        this.wsClient.on("connectFailed", this.wsClientConnectFailedHandler);
        this.wsClient.on("connect", this.wsClientConnectHandler);
    }
    
    open(){
        this.wsClient.connect(`ws://${this.domain}/${this.port}`)
    }
    
    close(){
        this.wsClient.close((err) => {
            if (err) {
                console.error(err);
            } else {
                console.log("Client want to close");
            }
        });
    }

    wsClientConnectFailedHandler(error) {
        console.error(error);
        throw error;
    }
    
    wsClientConnectHandler(connection) {
        console.log("WebSocket Client Connected");
        connection.on("error", function (error) {
            console.error(error);
          });
          connection.on("close", function () {
            console.log("Connection Closed by Server");
          });
          connection.on("message", function (message) {
            if (message.type === "utf8") {
              console.log("Received: '" + message.utf8Data + "'");
            }
          });
          connection.send(
            JSON.stringify({
                header: {
                    type: "proxy",
                    action: "open",
                },
                authentification: {
                    token:"",
                },
                payload: clientConfig
            })
          );
         
    }
}