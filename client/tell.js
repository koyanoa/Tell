var bcUrl = 'ws://localhost:5000';
var role = null;

var openpgp = window.openpgp;
var bc = new BinaryClient(bcUrl);

var privKey, pubKey, remotePubKey;

function log(str) {
  $('#log').append(str + '<br />');
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
  // Connect to BinaryJS
  bc = new BinaryClient(bcUrl);

  bc.on('stream', function(stream, meta){
    // collect stream data
    var parts = [];
    stream.on('data', function(data){
      parts.push(data);
    });

    stream.on('end', function(){
      if (meta.action == 'id') {
        console.log(meta.value);
      }
    });
  });

  // Generate keypair on page loading
  var options = {
    numBits: 2048,
    userId: 'Tell-Now.com',
    unlocked: true,
  };

  openpgp.generateKeyPair(options).then(function(keypair) {
    privKey = keypair.key;
    pubKey = privKey.toPublic();
    $("#privKeyPrint").text(privKey.primaryKey.fingerprint);
  }).catch(function(error) {
    alert("Failed to generate keypair!");
  });
}



$(document).ready(function() {
  $('#startButton').click(function() {
    initiate();
    bc.send(null, { action: 'start' })
  });

  $('#connectButton').click(function() {
    var id = $('#idInput').val();
    bc.send(null, { action: 'join', value=id })
  });
});
