var bcUrl = 'ws://localhost:5000/binary-endpoint';
var role = null;

var openpgp = window.openpgp;

var privKey, pubKey, remotePubKey;

var  bc = new BinaryClient(bcUrl);
var noFile = new Blob();


bc.on('stream', function(stream, meta){
      
      // collect stream data
      var parts = [];
      stream.on('data', function(data){
        parts.push(data);
      });
      
      // when finished, set it as the background image
      stream.on('end', function(){
        if (meta.action == 'id') {
          console.log(meta.value);
        }
        else {
          var url = (window.URL || window.webkitURL).createObjectURL(new Blob(parts));
          document.body.style.backgroundImage = 'url(' + url + ')';
        }
      });
    });

function initiate() {
    bc.send(noFile, { action: 'start' });
}



$(document).ready(function() {
  $('#startButton').click(function() {
    initiate();
  });

  $('#connectButton').click(function() {
    var id = $('#idInput').val();
    bc.send(noFile, { action: 'join', value: id })
  });
  
  $( "#fileInput" ).on("change", function() {
			var file = $('#fileInput').prop('files')[0];
      bc.send(file, {action:'file'});
    });
});
