var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioCtx = new AudioContext();

// Create the AudioBufferSourceNode
var sourceBuffer = audioCtx.createBufferSource();

var url = 'sfx/engine-loop.wav';

var request = new XMLHttpRequest();
request.open("GET", url, true);
request.responseType = 'arraybuffer';
 
request.onload = function () {
    var undecodedAudio = request.response;
    audioCtx.decodeAudioData(undecodedAudio, function (buffer) {
        
         
        // Tell the AudioBufferSourceNode to use this AudioBuffer.
        sourceBuffer.buffer = buffer;
        sourceBuffer.connect(audioCtx.destination);
        sourceBuffer.loop = true;
        sourceBuffer.playbackRate.value = 1;
        sourceBuffer.start(audioCtx.currentTime);
    });
};
 
request.send();

function handle_click (event) {
	if (event.target.name == 'stop') {
		sourceBuffer.stop();
	}
}

function handle_slide (event) {
	if (event.target.name == 'pitch') {
		sourceBuffer.playbackRate.value = event.target.value;
	}
	document.querySelector('output').innerHTML = event.target.value;
}

window.addEventListener("click", handle_click, false);
window.addEventListener("input", handle_slide, false);