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
      var files = msg.files;
      
      function encryptFile(idx) {
        var file = files[idx];
        var name = file.name;

        var reader = new FileReader();

        reader.onloadend = function () {
          var msg = window.openpgp.message.fromBinary(reader.result);
          msg.packets[0].setFilename(name);
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

          if (idx < files.length-1)
            encryptFile(idx+1);
        }

        if (file.size <= MAX_FILE_SIZE)
          reader.readAsBinaryString(file);
        else if (idx < files.length-1)
            encryptFile(idx+1);
      }

      encryptFile(0);
      break;

    case 'decrypt':
      var reader = new FileReader();

      reader.onloadend = function() {
        var packetlist = new window.openpgp.packet.List();
        packetlist.read(reader.result);

        var msg = new window.openpgp.message.Message(packetlist);

        status('decrypt');
        msg = msg.decrypt(privKey);

        var name = msg.packets[1].getFilename();
        workingFilename = name;

        status('verify');
        var verified = msg.verify([remotePubKey])[0].valid
        console.log("verified: " + verified);
        
        workingFilename = '';
        status('decrypted');

        // Display verified file in browser
        if (verified == true) {
          var data = str2ab(msg.getLiteralData());
          response({ action: 'decrypted', name: name, data: data }, [data]);
        }
      }
      reader.readAsBinaryString(new Blob(msg.data));
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
