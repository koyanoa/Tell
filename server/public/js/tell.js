var bcUrl = 'ws://localhost:5000/binary-endpoint';

var openpgp = window.openpgp;

var privKey, pubKey, remotePubKey;

var noFile = new ArrayBuffer(0);
var timeOut = 100;

function status(msg) {
  if (!msg) msg = '';

  setTimeout(function() {
    $('#status').text(msg)
  } ,0);
  console.log(msg);
}

// Array buffer <-> Binary string conversion for OpenPGP.js
function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}

function str2ab(str) {
  var buf = new ArrayBuffer(str.length); // 2 bytes for each char
  var bufView = new Uint8Array(buf);
  for (var i=0, strLen=str.length; i<strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

function bytesToSize(bytes) {
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes == 0) return 'n/a';
    var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    if (i == 0) return bytes + ' ' + sizes[i]; 
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
};


function initiate() {
  generateKeyPair();

  // Connect to BinaryJS
  bc = new BinaryClient(bcUrl);

  bc.on('open', function(){
    $( "#fileInput" ).on("change", function() {
      // Sign, encrypt and send selected file
      var file = $('#fileInput').prop('files')[0];
      var name = file.name;

      var reader = new FileReader();
      reader.onloadend = function () {
        var msg = openpgp.message.fromBinary(reader.result);
        msg.packets[0].setFilename(name);
        
        status("Sign...");
        setTimeout(function() {
          msg = msg.sign([privKey]);
          
          status("Encrypt...");
          setTimeout(function() {
            msg = msg.encrypt([remotePubKey]);

            status("Send...");
            var data = new Blob([str2ab(msg.packets.write())]);
            var tx = 0;
            var stream = bc.send(data, { action: 'file' });
            stream.on('data', function(data) {
              status(Math.round(tx+=data.rx*100) + '% complete');
            });
          }, timeOut);
        }, timeOut);
      }

      reader.readAsBinaryString(file);
    });
  });

  bc.on('stream', function(stream, meta){
    if (meta.action == 'file') {
      status("Receive...");
    }
    // collect stream data
    var parts = [];
    stream.on('data', function(data){
      parts.push(data);
    });

    stream.on('end', function(){
      switch (meta.action) {
        case 'id':
          $('#id').text(meta.value);
          break;
        case 'pubKey':
          // Read remote public key
          var packetlist = new openpgp.packet.List();
          packetlist.read(ab2str(parts[0]));
          remotePubKey = new openpgp.key.Key(packetlist);

          $('#remotePubKey').text(remotePubKey.primaryKey.fingerprint);
          break;
        case 'status':
          // Announce public key over BinaryJS connection
          /*
             Keys are small and sent in one chunk, thus we can send as
             ArrayBuffer instead of a Blob
          */
          if (meta.value == true) {
            var data = str2ab(pubKey.toPacketlist().write());
            bc.send(data, { action: 'pubKey' });
          }
          break;
        case 'file':
            // Decrypt and verify received file
            var reader = new FileReader();
            reader.onloadend = function() {
              var packetlist = new openpgp.packet.List();
              packetlist.read(reader.result);

              var msg = new openpgp.message.Message(packetlist);

              status("Decrypt...");
              setTimeout(function() {
                msg = msg.decrypt(privKey);

                var name = msg.packets[1].getFilename();

                status("Verify...");
                setTimeout(function() {
                  var verified = msg.verify([remotePubKey])[0].valid
                  console.log("verified: " + verified);
                  status();

                  // Display verified file in browser
                  if (verified == true) {
                    var data = new Blob([str2ab(msg.getLiteralData())], {type : 'application/octet-stream'});
                    var size = bytesToSize(data.size);
                    var url = (window.URL || window.webkitURL).createObjectURL(data);
                    $('#files ul').append(
                        $('<li>').append(
                          $('<a>').attr({'href': url, 'download': name}).text(name)
                        ).append(" (" + size + ")")
                    );
                  }
                }, timeOut);
              }, timeOut);
            }
            reader.readAsBinaryString(new Blob(parts));
          break;
      }
    });
  });
}

function generateKeyPair() {
  status('Generating keypair...');

  var options = {
    numBits: 2048,
    userId: 'Tell-Now.com',
    unlocked: true,
  };

  openpgp.generateKeyPair(options).then(function(keypair) {
    status();

    privKey = keypair.key;
    pubKey = privKey.toPublic();

    // Display fingerprint
    $("#privKey").text(privKey.primaryKey.fingerprint);
  
  }).catch(function(error) {
    alert("Failed to generate keypair!");
  });
}


$(document).ready(function() {
  initiate();

  $('#startButton').click(function() {
    bc.send(noFile, { action: 'start' });
  });

  $('#connectButton').click(function() {
    var id = $('#idInput').val();
    bc.send(noFile, { action: 'join', value: id })
  });

});
