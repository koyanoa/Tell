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
var noFile = new Buffer(0); // for sending only metadata through binaryjs
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
var idFree = [], // all available IDs
  idUsed = []; // all currently used IDs (not available)

// Generate array with all IDs and shuffle it
for(var i=0;i<1000000;i++){
  idFree.push(('00000' + i.toString()).slice(-6));
}
function shuffle(o){
  for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
  return o;
}
shuffle(idFree);

// get a random ID from free ID array
function getID(){
  randindex = Math.round(Math.random()*1000000);
  var id = idFree[randindex]
  idUsed.push(id);
  idFree.splice(randindex,1);
  return id;
}

// make ID available for use again
function freeID(id){
	idFree.push(id); // add to array of free IDs
	idUsed.splice(id.indexOf(),1); // remove from array of used IDs
	return;
}

var clientsWaiting = [],
    idWaiting = [],
    clientsConnectStart = [],
    clientsConnectJoin = [],
    startId,
    joinId;

function logAllArrays(){
  console.log('------------- new log --------------');
  console.log('---- Waiting clients\n' + clientsWaiting);
  console.log('---- Waiting TELL ids\n' + idWaiting);
  console.log('---- Starter Clients who where matched\n' + clientsConnectStart);
  console.log('---- Joiner Clients who where matched\n' + clientsConnectJoin);
  console.log('---- TELL ids that are used\n' + idUsed);
}

function inArray(arr, el){
  return (arr.indexOf(el) != -1);
}

// wait for new user connections
bs.on('connection', function(client) {
  console.log('client -JOIN- event; client id ' + client.id);
    
  // incoming stream from browser
  client.on('stream', function(stream, meta) {
  
    function forwardStream(){
      if (inArray(clientsConnectJoin,client.id) || inArray(clientsConnectStart,client.id)){
        var otherClient, idx;
        if (inArray(clientsConnectJoin,client.id)){
          idx = clientsConnectJoin.indexOf(client.id);
          otherClient = bs.clients[clientsConnectStart[idx]];
        }
        else {
          idx = clientsConnectStart.indexOf(client.id);
          otherClient = bs.clients[clientsConnectJoin[idx]];
        }
        var send = otherClient.createStream(meta);
        stream.pipe(send);
        console.log(' --> data sent');
        }
        else {
          // forwarding failed. probably clients not matched yet.
          console.log('forwarding failed');
        }
    }
    
    switch (meta.action) {
      case 'start':
        if (!inArray(clientsWaiting, client.id)){
          startId = getID();
          client.send(noFile, { action: 'id', value: startId });
          clientsWaiting.push(client.id);
          idWaiting.push(startId);
        }
        logAllArrays();
        break;
      
      case 'join':
        joinId = meta.value;
        if (inArray(idWaiting,joinId)) {
          console.log('---> MATCH');
          var idx = idWaiting.indexOf(joinId);
          // add BinaryJS client ids to arrays of matched clients
          clientsConnectJoin.push(client.id);
          clientsConnectStart.push(clientsWaiting[idx]);
          // remove BinaryJS id and TELL id from waiting arrays
          clientsWaiting.splice(idx,1);
          idWaiting.splice(idx,1);
          // make TELL id available again
          freeID(joinId);
          // send to client that he was successfully matched
          client.send(noFile, { action: 'status', value: true });
        }
        // send to client that he was not matched
        else client.send(noFile, { action: 'status', value: false });
        logAllArrays();
        break;
      
      case 'pubkey':
        forwardStream();
        break;
      
      case 'file':
        forwardStream();
        break;
    }
  });
  
	client.on('close', function(){
    console.log('client -CLOSE- event; client id ' + client.id);
    if (inArray(clientsWaiting, client.id)){
      var idx = Number(clientsWaiting.indexOf(client.id));
      clientsWaiting.splice(idx,1);
      idWaiting.splice(idx,1);
    }
    console.log(clientsWaiting);
    console.log(idWaiting);
	});
});


server.listen(port);
