var bcUrl = 'ws://localhost:5000/binary-endpoint';

var privKey, pubKey, remotePubKey;

var noFile = new ArrayBuffer(0);

var w;

var INITIAL_RANDOM_SEED = 50000, // random bytes seeded to worker
    RANDOM_SEED_REQUEST = 20000; // random bytes seeded after worker request


function addSentFile(name, size) {
  html = '<tr><td>' + name + '</td><td class="text-right">' + bytesToSize(size) + '</td></tr>';
  $('#sentTable tr:last').after(html);
}

function addReceivedFile(name, size, url) {
  a = '<a href="'+url+'" download="'+name+'">'+name+'</a>';
  html = '<tr><td>' + a + '</td><td class="text-right">' + bytesToSize(size) + '</td></tr>';
  
  $('#receivedTable tr:last').after(html);
}

function status(msg) {
  console.log(msg);

  if (msg == 'finished') msg = '';
  $('#status').text(msg)
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
    var sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB'];
    if (bytes == 0) return 'n/a';
    var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    if (i == 0) return bytes + ' ' + sizes[i]; 
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
};


function initiate() {
  generateKeyPair();

  // Connect to BinaryJS
  bc = new BinaryClient(bcUrl);

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

          $('.carousel').carousel(4);
          
          // update key display
          $('#privKey').text(privKey.primaryKey.fingerprint);
          $('#remotePubKey').text(remotePubKey.primaryKey.fingerprint);

          initWorker();
          break;
        case 'status':
        case 'match':
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
          w.postMessage({
            action: 'decrypt',
            data: parts
          }, parts);
          break;
      }
    });
  });
}

function initWorker() {
  w = new Worker('js/tell.worker.js');

  w.onmessage = function (event, data) {
    var msg = event.data;

    switch (msg.action) {
      case 'encrypted':
        var stream = bc.send(msg.data, { action: 'file' });
        addSentFile(msg.name, msg.size);
        break;
      case 'decrypted':
        var data = new Blob([ msg.data ], {type : 'application/octet-stream'});
        var url = (window.URL || window.webkitURL).createObjectURL(data);
        addReceivedFile(msg.name, data.size, url);
        break;
      case 'request-seed':
        seedRandom(RANDOM_SEED_REQUEST);
        break;
      case 'status':
        status(msg.value);
        break;
    }
  }

  function seedRandom(size) {
    var buf = new Uint8Array(size);
    window.openpgp.crypto.random.getRandomValues(buf);
    w.postMessage({action: 'seed-random', buf: buf});
  };

  seedRandom(INITIAL_RANDOM_SEED);
  w.postMessage({
    action: 'keys',
    privKey: privKey.toPacketlist(),
    remotePubKey: remotePubKey.toPacketlist(),
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
    status('finished');

    privKey = keypair.key;
    pubKey = privKey.toPublic();

    // Display fingerprint
    $("#privKey").text(privKey.primaryKey.fingerprint);

    // For local testing
    /*
    remotePubKey = pubKey;
    initWorker();
    $('.carousel').carousel(4);
    $('#privKey').text(privKey.primaryKey.fingerprint);
    $('#remotePubKey').text(remotePubKey.primaryKey.fingerprint);
    */
  })
}


$(document).ready(function() {
  initiate();

  $('#startButton').click(function() {
    bc.send(noFile, { action: 'start' });
  });

  $('#connectButton').click(function() {
    var id = $('#idInput').val();
    console.log('Enter with id: ', id);
    bc.send(noFile, { action: 'join', value: id })
  });

  $( "#fileSendButton" ).click(function() {
    w.postMessage({
      action: 'encrypt',
      files: $('#fileInput').prop('files'),
    });
  });

  // Special File button handling
  $('.btn-file :file').on('fileselect', function(event, numFiles, label) {
      
      var input = $(this).parents('.input-group').find(':text'),
          log = numFiles > 1 ? numFiles + ' files selected' : label;
      
      if( input.length ) {
          input.val(log);
      } else {
          if( log ) alert(log);
      }
      
  });
  $(document).on('change', '.btn-file :file', function() {
    var input = $(this),
        numFiles = input.get(0).files ? input.get(0).files.length : 1,
        label = input.val().replace(/\\/g, '/').replace(/.*\//, '');
    input.trigger('fileselect', [numFiles, label]);
  });
});

