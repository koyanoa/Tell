var http = require('http');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
var port = process.env.PORT || 5000;

// create a server with the express app as a listener
var server = http.createServer(app)
console.log('HTTP server running on port ' + port);

// make subdirectory public available on localhost to call files
app.use(express.static(__dirname + '/public'));

// attach BinaryServer to the base http server
var BinaryServer = require('binaryjs').BinaryServer;
var bs = new BinaryServer({server: server, path:'/binary-endpoint'});
console.log('BinaryServer running');

/*app.post('/action', function(req, res){
	var action = req.body.action;
	console.log('--------- New ' + action + ' requested ----------');
	if (action == 'start'){
		id = getID();
		console.log('User requests ' + id);
		res.send(id);
	}
	else if (action == 'join'){
		join_id = req.body.id;
		console.log('User wants to connect to ' + join_id);
		res.send('Trying to connect you. The ID you send is ' + join_id);
	}
	else console.log('Problem recognizing action');
});*/

// Create 6 digit session IDs
var id_free = [], // all available IDs
  id_used = []; // all currently available IDs

// Generate array with all IDs and shuffle it
for(var i=0;i<1000000;i++){
  id_free.push(('00000' + i.toString()).slice(-6));
}
function shuffle(o){
  for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
  return o;
}
shuffle(id_free);

// get a random ID from free ID array
function getID(){
  randindex = Math.round(Math.random()*1000000);
  var id = id_free[randindex]
  id_used.push(id);
  id_free.splice(randindex,1);
  return id;
}

// make ID available for use again
function freeID(id){
	id_free.push(id); // add to array of free IDs
	id_used.splice(id.indexOf(),1); // remove from array of used IDs
	return;
}

// wait for new user connections
bs.on('connection', function(client) {
  console.log('client -JOIN- event; client id ' + client.id);
  // incoming stream from browser
  client.on('stream', function(stream, meta) {
  console.log('stream on');
  if (meta.action == 'start') {
    var newId = getID();
    console.log('id ' + newID + ' generated');
    bs.send(null, { action: 'id', value: newId });
    console.log('id sent');
  }
  // broadcast to all other clients
  /*for(var id in bs.clients) {
    var otherClient = bs.clients[id];
    if(otherClient != client) {
      var send = otherClient.createStream(meta);
      stream.pipe(send);
	    }
    }*/
  });
	client.on('close', function(){
    console.log('client -CLOSE- event; client id ' + client.id);
	});
});


server.listen(port);
