var bcUrl = 'wss://' + window.location.hostname + ':62938';

var privKey, pubKey, remotePubKey;

var noFile = new ArrayBuffer(0);

var w, bc;


var INITIAL_RANDOM_SEED = 50000, // random bytes seeded to worker
    RANDOM_SEED_REQUEST = 20000; // random bytes seeded after worker request

MAX_FILE_SIZE = 20*1024*1024;


var echoTest = false;

var receivedFiles = {};

var sendFiles = {}


// Warning for unsupported download attribute in Safari
var isSafari = (navigator.userAgent.indexOf('Safari') != -1
             && navigator.userAgent.indexOf('Chrome') == -1);
var safariSupported = [ 'pdf', 'jpg', 'png', 'txt', 'mp3' ];
var safariWarn = true;

$.getScript("js/binary.min.js" );  
$.getScript("js/jszip.min.js" );  
$.getScript("js/filesaver.min.js" );  

function mobileAndTabletcheck () {
  var check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))check = true})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
}

function error(title, msg, crit) {
  crit = crit || false;

  $('#errorModalTitle').text(title);
  $('#errorModalText').html(msg);

  if (crit) {
    $('#errorModalClose').hide();
    $('#errorModalRestart').show();
    options = {
      'backdrop':'static', 
      'keyboard': false
    };
  } else {
    $('#errorModalClose').show();
    $('#errorModalRestart').hide();
    options = {};
  }

  $('#errorModal').modal(options);
}

function sendNextFile() {
  console.log(sendFiles.list);
  for(var file; file=sendFiles.list[sendFiles.idx]; sendFiles.idx++) {
    if (file.size <= MAX_FILE_SIZE) {
      w.postMessage({
        action: 'encrypt',
        file: file,
      });
      sendFiles.idx++;
      return true;
    }
  }
  return false
}
    

function addSentFile(name, size) {
	var row = $('<tr>');
	row.append($('<td>').text(name));
	row.append($('<td class="text-right">').text(bytesToSize(size)));
  row.appendTo('#sentTable');
}

function addReceivedFile(name, size) {
  var ext = name.split('.').pop();

  // Hande unsupported files on Safari
  if (isSafari && $.inArray(ext, safariSupported) == -1 ) {
    if (safariWarn) {
      msg = "Due to a bug in Safari, only a few filetypes are supported. \
          For full functionality, please use another browser, like Chrome or Firefox.<br /><br /> \
          Supported types: " + safariSupported.join(', ');
      error('Unsupported filetype in Safari', msg);
      safariWarn = false;
    }
    var tdA = $('<td>').text(a)
  } else {
		var a = $('<a href="#">').text(name).click(function() { downloadFile(name) });
    var tdA = $('<td>').append(a)
	}
  
	var row = $('<tr>');
	row.append(tdA);
	row.append($('<td class="text-right">').text(bytesToSize(size)));
  $('#receiveStatus').parent().before(row);
}

function downloadFile(name) {
  file = receivedFiles[name]
  data = new Blob([ file.data ], {type : file.type});
  saveAs(data, name);
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

function enableFileInput() {
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
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes == 0) return 'n/a';
    var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    if (i == 0) return bytes + ' ' + sizes[i]; 
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
};

function formatKey(key) {
  key = key.primaryKey.fingerprint.toUpperCase();
  // Split in parts of 4
  return key.match(/.{1,4}/g).join(' ');
}

function initiate() {
  // Connect to BinaryJS
  bc = new BinaryClient(bcUrl);

  bc.on('error', function (err) {
        error('BinaryJS client error', err, true);
  });

  bc.on('close', function () {
        error('Connection closed', 'BinaryJS client disconnected.', true);
  });

  bc.on('stream', function(stream, meta){
    if (meta.action == 'file') {
      receiveStatus("Receive...");
      $('#hideReceive').show();
      $('#hideSendRequest').hide();
    }
    // collect stream data
    var parts = [];
    stream.on('data', function(data){
      parts.push(data);
    });

    stream.on('error', function (err) {
        error('Send error', err);
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
          
          // update key display
          $('#remotePubKey').text(formatKey(remotePubKey));
          tryInitWorker();
          break;
        case 'match':
          $('.carousel').carousel(4);
          $('#section2').hide();
          $('#questionSign').hide();
          $('#keyGen').modal( {'backdrop':'static'} );
          break;
        case 'file':
          w.postMessage({
            action: 'decrypt',
            data: parts
          }, parts);
          break;
        case 'received':
          $('#fileInputText').val('');
          break;
        case 'error':
          if (meta.value == 'id')
            error('Sorry, wrong number.',
                '<div class="text-left">It seems you entered a wrong number. \
                  <ul> \
                    <li>The number is necessary to establish a secure channel between you and the other person.</li> \
                    <li>As you\'re on this page, the other person has to give you this number to enter, for example by phone.</li> \
                    <li>It has six digits between 0 and 9.</li> \
                  </ul> \
                  </div>'
            );
          else console.log('Some error received from server');
          break;
        case 'close':
          error(
              'Connection closed.',
              'The other person has left the channel. To send files again, create a new session.',
              true
          );
          break;
      }
    });
  });
}

function tryInitWorker() {
  if (privKey && remotePubKey) {
    initWorker();
    $('#keyGen').modal('hide');
    $('#hideSendRequest').show();
  }
}

function initWorker() {
  
  w = new Worker('js/tell.worker.js');

  w.addEventListener('error', function(err) { 
    error('WebWorker error', err, true);
  }, false);

  w.onmessage = function (event, data) {
    var msg = event.data;

    switch (msg.action) {
      case 'encrypted':
        bc.send(msg.data, { action: 'file' });
        if (echoTest) bc.send(noFile, { action: 'received' });
        addSentFile(msg.name, msg.size);

        if (!sendNextFile()) {
          enableFileInput();
        }
        break;
      case 'decrypted':
        receivedFiles[msg.name] = {
          data: msg.data,
          type: msg.type,
        };
        addReceivedFile(msg.name, msg.data.byteLength);
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

  var options = {
    numBits: 2048,
    userId: 'Tell-Now.com',
    unlocked: true,
  };

  openpgp.generateKeyPair(options).then(function(keypair) {
    privKey = keypair.key;
    pubKey = privKey.toPublic();

    // Display fingerprint
    $('#privKey').text(formatKey(privKey));
    console.log('Generated keypair');
    
    var data = str2ab(pubKey.toPacketlist().write());
    bc.send(data, { action: 'pubKey' });
    tryInitWorker();

    // For local testing
    if (echoTest) {
      remotePubKey = pubKey;
      initWorker();
      $('.carousel').carousel(4);
      $('#privKey').text(formatKey(privKey));
      $('#remotePubKey').text(formatKey(remotePubKey));
    }
  }).catch(function(error) {
    error('Error generating PGP Keypair', error, true);
});
}

$("#tellApp").load("ui.html", function() {
	if (echoTest) {
		initiate();
	 	generateKeyPair();
	}

  $('#startButton').click(function() {
    if (mobileAndTabletcheck())
      error(
          'Mobile browser',
          'Sorry, this website has so far only been tested on desktop browsers and might not work as expected.'
      );
    initiate();
    $('.carousel').carousel(1);
  });

  $('#createButton').click(function() {
    bc.send(noFile, { action: 'start' });
  });
  
  $('#carousel').on('slid.bs.carousel', function (event) {
    id = event.relatedTarget.id;
    switch (id) {
      case 'selectPage':
        $('#idInput').focus();
        break;
      case 'main':
        generateKeyPair();
        break;
    }
  });

  $('#connectForm').submit(function(event) {
    var id = $('#idInput').val();
    console.log('Enter with id: ', id);
    bc.send(noFile, { action: 'join', value: id })
    event.preventDefault();
  });

  $('#fileSendButton').click(function() {
    if ($('#fileInputText').val() != '') {
      inputSendStyle();

      sendFiles.list = $('#fileInput').prop('files');
      sendFiles.idx = 0;
      sendNextFile();
    }
  });

  $( "#downloadAllButton" ).click(function() {
    var zip = new JSZip();
    for (var name in receivedFiles) {
      zip.file(name, receivedFiles[name].data);
    }
    saveAs(zip.generate({type : "blob"}), 'Tell-Now-Files.zip');
  });
  
  if (isSafari) $("#downloadAllButton").hide();

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
