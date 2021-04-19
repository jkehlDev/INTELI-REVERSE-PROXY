const webSocketServer = require('websocket').server;
const http
    = require('http');

const server = http.createServer(function (request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});
server.listen(8080, function () {
    console.log((new Date()) + ' Server is listening on port 8080');

});

wsServer = new webSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});

// function originIsAllowed(origin) {
//     // Ici on écrit la logique qui détermine si une origine est autorisée
//     return true;
// };

wsServer.on('message', function (str) {
    const ob = JSON.parse(str);
    switch (ob.type) {
        case 'text':
            console.log("Received: " + ob.content)
            ws.send('{ "type":"text", "content":"Server ready."}')
            break;
        case 'image':
            console.log("Received: " + ob.content)
            console.log("Here is an apricot...")
            const path = "apricot.jpg";
            const data = '{ "type":"image", "path":"' + path + '"}';
            ws.send(data);
            break;
    }
})
connection.on('close', function (reasonCode, description) {
    console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
});

});