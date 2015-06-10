var bcUrl = 'wss://' + window.location.hostname + ':62938';

var privKey, pubKey, remotePubKey;

var noFile = new ArrayBuffer(0);

var w, bc;

var INITIAL_RANDOM_SEED = 50000, // random bytes seeded to worker
    RANDOM_SEED_REQUEST = 20000; // random bytes seeded after worker request


var echoTest = false;

var downloadList = [];


$.getScript("js/binary.min.js" );  
$.getScript("js/jszip.min.js" );  
$.getScript("js/filesaver.min.js" );  

function addSentFile(name, size) {
  html = '<tr><td>' + name + '</td><td class="text-right">' + bytesToSize(size) + '</td></tr>';
  $('#sentTable tr:last').after(html);
}

function addReceivedFile(name, size, url) {
  a = '<a href="'+url+'" download="'+name+'" target="_blank">'+name+'</a>';
  html = '<tr><td>' + a + '</td><td class="text-right">' + bytesToSize(size) + '</td></tr>';
  
  $('#receivedTable tr:last').before(html);
}

function receiveStatus(msg) {
  console.log(msg);
  $('#receiveStatus').text(msg);
}

function sendStatus(msg) {
  console.log(msg);
  $('#fileInputText').val(msg);
}

function inputSendStyle(){
  $('#fileSendButton').prop('disabled', true);
  $('#fileInput').prop('disabled', true);
  $('#fileInputText').prop('disabled', true);
}

function resetInputStyle() {
  $('#fileInputText').val('');
  $('#fileSendButton').prop('disabled', false);
  $('#fileInput').prop('disabled', false);
  $('#fileInputText').prop('disabled', false);
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
  // Connect to BinaryJS
  bc = new BinaryClient(bcUrl);

  bc.on('stream', function(stream, meta){
    if (meta.action == 'file') {
      receiveStatus("Receive...");
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
          var data = str2ab(pubKey.toPacketlist().write());
          bc.send(data, { action: 'pubKey' });
          break;
        case 'file':
          w.postMessage({
            action: 'decrypt',
            data: parts
          }, parts);
          break;
        case 'received':
          resetInputStyle();
          break;
        case 'error':
          if (meta.value == 'id') $('#wrongIdModal').modal();
          else console.log('Some error received from server');
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
        bc.send(msg.data, { action: 'file' });
        if (echoTest) bc.send(noFile, { action: 'received' });
        addSentFile(msg.name, msg.size);
        break;
      case 'decrypted':
        var data = new Blob([ msg.data ], {type : msg.type});
        var url = (window.URL || window.webkitURL).createObjectURL(data);

        addReceivedFile(msg.name, data.size, url);
        downloadList.push({name: msg.name, data: msg.data });
        $('#downloadAllButton').removeAttr('disabled');
        break;
      case 'request-seed':
        seedRandom(RANDOM_SEED_REQUEST);
        break;
      case 'status':
        receiveText = {
          'decrypt': 'Decrypting...',
          'verify': 'Verifying...',
          'decrypted': '',
        };
        sendText = {
          'encrypt': 'Encrypting ' + msg.filename + '...',
          'sign': 'Signing ' + msg.filename + '...',
          'send': 'Sending ' + msg.filename + '...'
        };
        if (msg.value in sendText)
          sendStatus(sendText[msg.value]);
        if (msg.value in receiveText)
          receiveStatus(receiveText[msg.value]);
        break;
    }
  }

  function seedRandom(size) {
    var buf = new Uint8Array(size);
    openpgp.crypto.random.getRandomValues(buf);
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
  console.log('Generating keypair...');

  openpgp.config.useWebCrypto = false;
  openpgp.initWorker('js/openpgp.worker.js');

  var options = {
    numBits: 2048,
    userId: 'Tell-Now.com',
    unlocked: true,
  };

  openpgp.generateKeyPair(options).then(function(keypair) {
    privKey = keypair.key;
    pubKey = privKey.toPublic();

    // Display fingerprint
    $("#privKey").text(privKey.primaryKey.fingerprint);
    console.log('Generated keypair');

    // For local testing
    if (echoTest) {
      remotePubKey = pubKey;
      initWorker();
      $('.carousel').carousel(4);
      $('#privKey').text(privKey.primaryKey.fingerprint);
      $('#remotePubKey').text(remotePubKey.primaryKey.fingerprint);
    }
  })
}

$("#tellApp").load("ui.html", function() {
  generateKeyPair();

  $('#startButton').click(function() {
    initiate();
    $('.carousel').carousel(1);
  });

  $('#createButton').click(function() {
    bc.send(noFile, { action: 'start' });
  });

  $('#connectButton').click(function() {
    var id = $('#idInput').val();
    console.log('Enter with id: ', id);
    bc.send(noFile, { action: 'join', value: id })
  });

  $('#fileSendButton').click(function() {
    if ($('#fileInputText').val() != '') {
      inputSendStyle();
      w.postMessage({
        action: 'encrypt',
        files: $('#fileInput').prop('files'),
      });
    }
  });

  $( "#downloadAllButton" ).click(function() {
    var zip = new JSZip();
    for (i in downloadList) {
      file = downloadList[i];
      zip.file(file.name, file.data);
    }
    saveAs(zip.generate({type : "blob"}), 'Tell-Now-Files.zip');
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
