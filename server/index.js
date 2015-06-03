var http = require('http');
var app = require('express')();
var port = process.env.PORT || 5000;

// create a server with the express app as a listener
var server = http.createServer(app).listen(port);
console.log('HTTP server running on port ' + port);

// attach BinaryServer to the base http server
var BinaryServer = require('binaryjs').BinaryServer;
var bs = new BinaryServer({server: server, path: '/binary-endpoint'});
console.log('BinaryServer running');

app.get('/start', function(req, res){
	id = getID();
	console.log('ID ' + id + ' requested');
	res.send(id);
});

app.get('/join', function(req, res){
	console.log('User wants to connect to ' + id);
	res.send('Trying to connect you');
});

// Create 6 digit session IDs
var id_free = [], // all available IDs
	id_used = []; // all currently available IDs

for(i=0;i<1000000;i++){
	id_free.push(('00000' + i.toString()).slice(-6));
}

function getID(){
	randindex = Math.round(Math.random()*1000000);
	id = id_free[randindex]
	id_used.push(id);
	id_free.splice(randindex,1);
	return id;
}

function freeID(id){
	id_free.push(id); // add to array of free IDs
	id_used.splice(id.indexOf(),1); // remove from array of used IDs
	return;
}

// Test getID and freeID functions
/*for(i=0;i<10;i++){
	console.log('Round' + i);
	id = getID();
	console.log(id_used);
	console.log('Length of free ID array: ' + id_free.length);
}

for(i=0;i<10;i++){
	freeID(id_used[0]);
	console.log(id_used);
	console.log('Length of free ID array: ' + id_free.length);
	console.log(id_used[id_used.length-1]);
}*/

// wait for new user connections
bs.on('connection', function(client) {

    // incoming stream from browser
    client.on('stream', function(stream, meta) {

	// broadcast to all other clients
	console.log('New client online. Got id ' + client.id);

	for(var id in bs.clients) {
	    var otherClient = bs.clients[id];
	    if(otherClient != client) {
		var send = otherClient.createStream(meta);
		stream.pipe(send);
	    }
	}
    });
});