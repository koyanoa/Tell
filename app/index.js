var http = require('http');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
var port = process.env.PORT || 5000;
var log = true;

// create a server with the express app as a listener
var server = http.createServer(app)
console.log('HTTP server running on port ' + port);

// make subdirectory public available on server to call files
app.use(express.static(__dirname + '/public'));

// attach BinaryServer to the base http server
var BinaryServer = require('binaryjs').BinaryServer;
var bs = new BinaryServer({server: server, path:'/binary-endpoint'});
var noFile = new Buffer(0); // for sending only metadata through binaryjs
console.log('BinaryServer running');

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
	idUsed.splice(idUsed.indexOf(id),1); // remove from array of used IDs
	return;
}

var clientsWaiting = [],
    idWaiting = [],
    clientsMatchStart = [],
    clientsMatchJoin = [],
    startId,
    joinId;

function logAllArrays(){
  if (log){
    console.log('------------- new log --------------');
    console.log(' ---- Waiting clients\n' + clientsWaiting);
    console.log(' ---- Waiting TELL ids\n' + idWaiting);
    console.log(' ---- Matched Starter clients\n' + clientsMatchStart);
    console.log(' ---- Matched Joiner clients\n' + clientsMatchJoin);
    console.log(' ---- TELL ids that are used\n' + idUsed);
  }
}

function inArray(arr, el){
  return (arr.indexOf(el) != -1);
}

// wait for new user connections
bs.on('connection', function(client) {
    
  // incoming stream from browser
  client.on('stream', function(stream, meta) {
  
    function forwardStream(){
      if (inArray(clientsMatchJoin,client.id) || inArray(clientsMatchStart,client.id)){
        var otherClient, idx;
        if (inArray(clientsMatchJoin,client.id)){
          idx = clientsMatchJoin.indexOf(client.id);
          otherClient = bs.clients[clientsMatchStart[idx]];
        }
        else {
          idx = clientsMatchStart.indexOf(client.id);
          otherClient = bs.clients[clientsMatchJoin[idx]];
        }
        var send = otherClient.createStream(meta);
        stream.pipe(send);
        if (log) console.log(' --> Forwarding successful');
      }
      else {
        // forwarding failed. clients not matched yet, or one went offline.
        if (log) console.log(' --> Forwarding failed');
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
          var idx = idWaiting.indexOf(joinId);
          var matchId = clientsWaiting[idx];
          // add BinaryJS client ids to arrays of matched clients
          clientsMatchJoin.push(client.id);
          clientsMatchStart.push(matchId);
          // remove BinaryJS id and TELL id from waiting arrays
          clientsWaiting.splice(idx,1);
          idWaiting.splice(idx,1);
          // in case the other client also requested a Tell id, remove him as well from waiting arrays
          if (inArray(clientsWaiting,client.id)){
            var idx = clientsWaiting.indexOf(client.id);
            clientsWaiting.splice(idx,1);
            freeID(idWaiting[idx]);
            idWaiting.splice(idx,1);
          }
          // make TELL id available again
          freeID(joinId);
          // send to client that he was successfully matched
          client.send(noFile, { action: 'match' });
          bs.clients[matchId].send(noFile, { action: 'match' });
        }
        // send to client that he was not matched
        else client.send(noFile, { action: 'error', value: 'id' });
        
        logAllArrays();
        break;
      
      case 'pubKey':
        if (log) console.log(' -> Forwarding PubKey');
        forwardStream();
        break;
      
      case 'file':
        if (log) console.log(' -> Forwarding file');
        forwardStream();
        break;
    }
  });
  
  
  // Still to do: implement freeing of clientsMatchJoin and clientsMatchStart when disconnecting
	client.on('close', function(){
    // remove from arrays if not yet matched
    if (inArray(clientsWaiting, client.id)){
      var idx = clientsWaiting.indexOf(client.id);
      clientsWaiting.splice(idx,1);
      freeID(idWaiting[idx]);
      idWaiting.splice(idx,1);
    }
    // remove from arrays if already matched
    if (inArray(clientsMatchJoin, client.id)){
      var idx = clientsMatchJoin.indexOf(client.id);
      bs.clients[clientsMatchStart[idx]].send(noFile, { action: 'close' });
      clientsMatchJoin.splice(idx,1);
      clientsMatchStart.splice(idx,1);
    }
    else if (inArray(clientsMatchStart, client.id)){
      var idx = clientsMatchStart.indexOf(client.id);
      bs.clients[clientsMatchJoin[idx]].send(noFile, { action: 'close' });
      clientsMatchJoin.splice(idx,1);
      clientsMatchStart.splice(idx,1);
    }
    logAllArrays();
	});
});


server.listen(port);
