var fs = require('fs');
var https = require('https');
var express = require('express');

var privateKey  = fs.readFileSync('tls/ssl.dec.key', 'utf8');
var certificate = fs.readFileSync('tls/ssl.crt', 'utf8');

var credentials = {key: privateKey, cert: certificate};
var app = express();
var port = process.env.PORT || 62938;
var log = false;


//... bunch of other express stuff here ...

//pass in your express app and credentials to create an https server
var server = https.createServer(credentials, app);
console.log('HTTP server running on port ' + port);

// make subdirectory public available on server to call files
app.use(express.static(__dirname + '/public'));

// attach BinaryServer to the base http server
var BinaryServer = require('binaryjs').BinaryServer;
var bs = new BinaryServer({server: server});
var noFile = new Buffer(0); // for sending only metadata through binaryjs
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
