var Engine = function (options) {
	for(item in options) {
		this[item] = options[item];
	}

	this.init();
}

Engine.prototype = {
	AudioContext : window.AudioContext || window.webkitAudioContext,
	audioCtx: null,
	sourceBuffer: null,

	init: function () {
		this.audioCtx = new this.AudioContext();
		this.sourceBuffer = this.audioCtx.createBufferSource();
		this.getSound();
		
		var checkbox = document.querySelector('input[type=checkbox]');
		checkbox.onclick = function (event) {
			if(event.target.checked) {
				this.stopEngine();
			} else {
				this.init();
			}
		}.bind(this)
	},
	
	getSound: function () {

		var url = 'sfx/engine-loop.ogg';
		var request = new XMLHttpRequest();
		request.open("GET", url, true);
		request.responseType = 'arraybuffer';
		
		request.onload = function () {

		    var undecodedAudio = request.response;
		    this.audioCtx.decodeAudioData(undecodedAudio, function (buffer) {

			// Tell the AudioBufferSourceNode to use this AudioBuffer.
			this.sourceBuffer.buffer = buffer;
			this.sourceBuffer.connect(this.audioCtx.destination);
			this.sourceBuffer.loop = true;
			this.sourceBuffer.playbackRate.value = 1;
			this.sourceBuffer.start(this.audioCtx.currentTime);
		    }.bind(this));
		}.bind(this);
		 
		request.send();
	},

	updateEngine: function (speed) {
		this.sourceBuffer.playbackRate.value = 1 + (speed / 75);
	},

	stopEngine: function () {
		this.sourceBuffer.stop();	
	}

}