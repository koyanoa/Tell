var fs = require('fs');
var BinaryServer = require('binaryjs').BinaryServer;
var port = process.env.PORT || 5000

// Serve client side statically
var bs = BinaryServer({port: port});

// wait for new user connections

bs.on('connection', function(client) {
    // incoming stream from browser
    client.on('stream', function(stream, meta) {
	// broadcast to all other clients
	for(var id in bs.clients) {
	    var otherClient = bs.clients[id];
	    if(otherClient != client) {
		var send = otherClient.createStream(meta);
		stream.pipe(send);
	    }
	}
    });
});

