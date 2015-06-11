window = {};

MAX_FILE_SIZE = 20*1024*1024;

var privKey, pubKey, remotePubKey;
var workingFilename;

importScripts('openpgp.min.js');

function packetlistCloneToKey(packetlistClone) {
  var packetlist = window.openpgp.packet.List.fromStructuredClone(packetlistClone);
  return new window.openpgp.key.Key(packetlist);
}

function str2ab(str) {
  var buf = new ArrayBuffer(str.length); // 2 bytes for each char
  var bufView = new Uint8Array(buf);
  for (var i=0, strLen=str.length; i<strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}


var MIN_SIZE_RANDOM_BUFFER = 40000;
var MAX_SIZE_RANDOM_BUFFER = 60000;

window.openpgp.crypto.random.randomBuffer.init(MAX_SIZE_RANDOM_BUFFER);

self.onmessage = function (event, data) {
  var msg = event.data;

  console.log(msg);
  switch (msg.action) {
    case 'seed-random':
      if (!(msg.buf instanceof Uint8Array)) {
        msg.buf = new Uint8Array(msg.buf);
      }
      window.openpgp.crypto.random.randomBuffer.set(msg.buf);
      break;

    case 'keys':
      privKey = packetlistCloneToKey(msg.privKey);
      pubKey = privKey.toPublic();
      remotePubKey = packetlistCloneToKey(msg.remotePubKey);
      break;

    case 'encrypt':
      // Sign, encrypt and send selected files
      var file = msg.file;
      var name = file.name;
      
      var reader = new FileReaderSync();
      var result = reader.readAsBinaryString(file);

      var msg = window.openpgp.message.fromBinary(result);
      var meta = JSON.stringify({ name: name, type: file.type});
      msg.packets[0].setFilename(meta);
      
      workingFilename = name;
      
      status('sign');
      msg = msg.sign([privKey]);
      
      status('encrypt');
      msg = msg.encrypt([remotePubKey]);

      status('send');
      var data = str2ab(msg.packets.write());
      response({ action: 'encrypted', name: name, size: file.size, data: data }, [data]);

      workingFilename = '';
      status('finished');
      break;

    case 'decrypt':
      var reader = new FileReaderSync();
      result = reader.readAsBinaryString(new Blob(msg.data));

      var packetlist = new window.openpgp.packet.List();
      packetlist.read(result);

      var msg = new window.openpgp.message.Message(packetlist);

      status('decrypt');
      msg = msg.decrypt(privKey);

      var meta = JSON.parse(msg.packets[1].getFilename());

      status('verify');
      var verified = msg.verify([remotePubKey])[0].valid
      console.log("verified: " + verified);
      
      status('decrypted');

      // Display verified file in browser
      if (verified == true) {
        var data = str2ab(msg.getLiteralData());
        response({ action: 'decrypted', name: meta.name, type: meta.type, data: data }, [data]);
      }
  }
}

function response(event, data) {
  if (window.openpgp.crypto.random.randomBuffer.size < MIN_SIZE_RANDOM_BUFFER) {
    postMessage({action: 'request-seed'});
  }
  postMessage(event, data);
}


function status(msg) {
  response({action: 'status', value: msg, filename: workingFilename });
}
