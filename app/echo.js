var http = require('http');
var express = require('express');
var app = express();
var port = process.env.PORT || 5000;

// create a server with the express app as a listener
var server = http.createServer(app)
console.log('HTTP server running on port ' + port);

// make subdirectory public available on localhost to call files
app.use(express.static(__dirname + '/public'));

// attach BinaryServer to the base http server
var BinaryServer = require('binaryjs').BinaryServer;
var bs = BinaryServer({server: server, path:'/binary-endpoint'});
console.log('BinaryServer running');


// wait for new user connections

bs.on('connection', function(client) {
    // incoming stream from browser
    client.on('stream', function(stream, meta) {
			// broadcast to all other clients
			for(var id in bs.clients) {
				var otherClient = bs.clients[id];
				if(otherClient == client) {
					var send = otherClient.createStream(meta);
					stream.pipe(send);
				}
			}
		});
});

server.listen(port);
