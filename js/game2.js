
var Game = function() {

}

Game.prototype = {

	keys : [],
	quality: {width: 800, height: 600},
	team: 'porsche',
	player: 'Player1',

	ctx : null,
	ocvs : null,
	octx : null,

	car : null,
	track : null,

	racelaps : 3,
	racestarttime: null,
	raceendtime: null,
	laptimes: ['00.000'],
	lapstarttime: null,
	laptime: null,
	racefinished: false,
	req: null,
	gamepad: null,

	setup: function () {

		var startRaceButton = document.querySelector('button.toggle-start');
		startRaceButton.addEventListener("click", this.initGame.bind(this), false);

		var endRaceButton = document.querySelector('button.toggle-menu');
		endRaceButton.addEventListener("click", this.endGame.bind(this), false);

		window.addEventListener("change", function (e) {
			console.log("change: ", e.target.name, e.target.value);
		});

		this.gamepad = navigator.getGamepads()[0];

		if(this.gamepad === null) {
			window.addEventListener("gamepadconnected", function(e) {
				console.log(e);
			});
		}
	},

	startRace : function() {
		var selectedtrack = document.querySelector('input[name=track]:checked');
		var selectedcar = document.querySelector('input[name=car]:checked');
		var quality = document.querySelector('input[name=screen]:checked').value;

		this.quality = this.setScreenSize(quality);

		hud = document.querySelector('output');
		canvas = document.getElementById("game");
		this.ctx = canvas.getContext("2d");
		canvas.width = this.quality && this.quality.width ? this.quality.width : 800;
		canvas.height = this.quality && this.quality.height ? this.quality.height : 600;

		this.ocvs = document.createElement('canvas');
		this.ocvs.width = canvas.width;
		this.ocvs.height = canvas.height;
		this.octx = this.ocvs.getContext('2d');

		this.player = {
			name: "Player 1",
			laptimes: this.laptimes
		};

		this.keys = [];

		this.world = new Sprite ({
			name: [selectedtrack.value],
			images: [`img/${selectedtrack.value}.svg`],
			x: selectedtrack.dataset.x,
			y: selectedtrack.dataset.y,
			angle: 0,
			height: 3200 * 7,
			width: 3200 * 7
		});

		this.world_bridges = new Sprite ({
			name: 'bridges',
			images: [`img/${selectedtrack.value}.svg`],
			x: selectedtrack.dataset.x,
			y: selectedtrack.dataset.y,
			height: 3200 * 7,
			width: 3200 * 7
		})

		floor = {
			x:0,
			y:0
		}

		this.car = new Sprite({
			name: 'user1',
			images: [
				'img/' + selectedcar.value + '-0.png',
				'img/' + selectedcar.value + '-1.png'
			],
			x: canvas.width / 2,
			y: canvas.height / 2,
			angle: parseInt(selectedtrack.dataset.angle) || 0,
			mod: 1,
			speed: 1,
			maxspeed: 50,
			width: 320,
			height: 220
		});

		this.dustclouds = new Sprite({
			name: 'cloud',
			images: ['img/dust-cloud-2.png'],
			x: canvas.width / 2,
			y: canvas.height / 2,
			opacity: .9,
			angle: 0
		})

		this.engine = new Engine(this.car);

		window.addEventListener("keydown", this.keydown_handler.bind(this), false);
		window.addEventListener("keyup", this.keyup_handler.bind(this), false);

		//window.requestAnimationFrame(this.draw());
		this.req = window.requestAnimationFrame(this.draw.bind(this));

	},

	draw : function() {

		this.checkGamepad();

		// checking what keys were pressed
		
		this.checkUserInput();
		
		if (this.laptimes.length === this.racelaps && !this.racefinished) {
			this.racefinished = true;
			this.endRace();
		}

		// update engine sound
		this.engine.updateEngine(this.car.speed);

		// draw speedometer
		this.drawHUD();

		// move the floor
		var groundLocation = this.drawFloor();

		this.ctx.clearRect(0, 0, canvas.width, canvas.height);
		this.octx.clearRect(0, 0, canvas.width, canvas.height);

		// first draw the world on the off-screen canvas
		this.world.draw(this.octx);
		
		// then check center pixel and return a string ('ontrack','offtrack')
		// if offtrack, draw dust clouds
		var wheresthecar = this.checkGroundType();
		if (wheresthecar === 'offtrack' && this.car.speed > 0) {
			
			this.car.opacity = 0.75;
			
			this.dustclouds.angle = this.car.angle + Math.random() * 180;		
			this.dustclouds.opacity = this.car.speed / 30;
			this.dustclouds.draw(this.octx);

		// 	var secondDustcloud = new Sprite({
		// 		name: 'secondDustcloud',
		// 		images: ['img/dust-cloud.png'],
		// 		x: groundLocation[0],
		// 		y: groundLocation[1],
		// 		opacity: .9,
		// 		angle: Math.random() * 90
		// 	});
		// 	console.info(`CLOUD x:${secondDustcloud.x} y: ${secondDustcloud.y}`);
			
		// 	secondDustcloud.draw(this.octx);
		}
		
		// console.log(`world x:${this.world.x} (${this.world.width}) y: ${this.world.y}`);
		
		// draw the car onto the off-screen canvas
		this.car.draw(this.octx);
		
		// draw the bridges layer onto off-screen canvas
		this.world_bridges.draw(this.octx)

		// draw off-screen canvas to on-screen canvas
		this.ctx.drawImage(this.ocvs, 0, 0);

		// and do it again.
		this.req = window.requestAnimationFrame(this.draw.bind(this));

		// var tx = `translateX( ${(Math.floor(this.world.x / this.world.width * 100) * 3.1 * -1)}px)`;
		// var ty = `translateY( ${(Math.floor(this.world.y / this.world.height * 100) * 3.1 * -1)}px)`;
		// this.blip.style.transform = `${tx} ${ty}`;
	},

	// Basically the game engine: sample 1x1 pixel in the center of the screen 
	// (ie location of the car on top of the game world)
	// and make decisions based on that
	checkGroundType: function () {
		var ontrackStatus = undefined;
		
		var image = this.octx.getImageData(canvas.width/2, canvas.height/2, 1,1);
		var pixel1 = image.data[0];
		var pixel2 = image.data[1];
		var pixel3 = image.data[2];
		
		console.log(`${pixel1}, ${pixel2}, ${pixel3}`)
		// on track
		// in the track svgs, asfalt color is #262626
		
		if (pixel1 === 26 && pixel2 === 26 && pixel3 === 26) { 
			this.car.maxspeed = 50; 
			this.car.opacity = 1;
			ontrackStatus = 'ontrack';
		}	

		// in pits
		// asfalt color is two tones lighter: #282828
		if (pixel1 === 28 && pixel2 === 28 && pixel3 === 28 ) { 
			this.car.maxspeed = 15; 
			this.car.opacity = 1;
			ontrackStatus = 'pits';
		}

		// off track
		// not even sure what prompted this particular check
		if (pixel1 === 0 || pixel1 > 80) {
			
			this.car.maxspeed = 5;
			// test code: add a red svg path around the outline of the track to test and handle collision 
			// for example with guard rails etc (no luck so far)
			if(pixel1 === 128) {
				console.log('collision!')
				this.car.mod = -1;
			} else {
				this.car.mod = 1;
			}
			ontrackStatus = 'offtrack';
		}

		if(this.racefinished) {
			this.car.maxspeed = 0; 
		}

		// trigger lap timer by slightly lighter start/finish line area (see .svg#markings)
		if(image.data[0] === 27 && image.data[1] === 27 && image.data[2] === 27 ) {
			this.setLapTime();
		}

		return ontrackStatus;

	},

	setLapTime: function () {
		if (!this.lapstarttime) {
			this.lapstarttime = new Date().getTime();
			return;
		}
	
		//record current time to compare against last recorded lapstarttime.
		var lapfinish = new Date().getTime();
		// ms to s.
		laptime = (lapfinish - this.lapstarttime ) / 1000;

		// 0:00.000
		var mins = Math.floor(laptime / 60);
		var secs = (laptime - mins * 60).toFixed(3);
		if (secs < 10) secs = '0' + secs;

		// it must be a 'valid' lap
		if(laptime > 20) {
			this.laptimes.push ( mins + ':' + secs );
			this.lapstarttime = new Date().getTime();
		}

		//update HUD
		var laptimes = this.laptimes;
		var last = laptimes[laptimes.length - 1];
		var best = laptimes.slice(0);
		best.sort();

		document.querySelector('.laps').innerHTML = laptimes.length ? laptimes.length : 1;
		document.querySelector('.best').innerHTML = best[0] ? best[0] : '--.---';
		document.querySelector('.last').innerHTML = last ? last : '--.---';

		// highlight fastest laptime in green
		// if last lap == best lap, update time in green
		var pb = false;
		if(last && last === best[0]) {
			pb = true;
		}

		if(pb) {
			document.querySelector('.last').classList.add('pb')
			setTimeout(function(){
				document.querySelector('.last').classList.remove('pb')
			}, 5000)
		} else {
			document.querySelector('.last').classList.remove('pb')
		}

		// store player's best laptime (poorly)
		var p = this.player.name;
		localStorage.setItem('Racer_best', p + ' ' + best[0]);

	},

	drawHUD : function() {
		hud.setAttribute('data-speed', Number(this.car.speed * 4).toFixed(0));
		hud.querySelector('.needle').style.transform = 'rotateZ(' + Math.ceil(this.car.speed * 2 * 1.8) + 'deg)';
	},

	drawFloor : function() {
		var x = Math.floor((this.car.speed*this.car.mod) * Math.cos(Math.PI/180 * this.car.angle));
		var y = Math.floor((this.car.speed*this.car.mod) * Math.sin(Math.PI/180 * this.car.angle));

		this.world.x -= x;
		this.world.y -= y;
		this.world_bridges.x -= x;
		this.world_bridges.y -= y;
		
		
		document.body.style.backgroundPosition = `${this.world.x}px ${this.world.y}px`;

		return [this.world.x, this.world.y];
	},

	checkGamepad : function () {
		this.gamepad = navigator.getGamepads()[0];
	},

	checkUserInput : function() {
		// gamepad
		if(this.gamepad) {

			if (this.gamepad.buttons[7].pressed) {

				this.car.mod = 1;
				this.car.state = 0;

				if (this.car.speed < this.car.maxspeed) {
					var acc = 1.2 * Number(this.gamepad.buttons[7].value.toFixed(3));
					this.car.speed += acc;
				}
			}

			if(!this.gamepad.buttons[6].pressed) {
				this.car.state = 0;
			}

			if (this.gamepad.buttons[6].pressed) {
				this.car.state = 1;

				if( this.car.speed > 1) {
					this.car.speed -= (this.gamepad.buttons[6].value / 2);
				}

				if (this.car.speed <= 15 && this.car.speed > 0) {
					this.car.speed -= 0.5;
				}

				if (this.car.speed <= 0) {
					this.car.speed -= 1;
				}
			}

			if(this.gamepad.axes[0] < 0) {
				if(Math.floor(this.car.speed) !== 0) {
					this.car.angle += this.gamepad.axes[0] * 3;
				}
			}

			if(this.gamepad.axes[0] > 0) {
				if(Math.floor(this.car.speed) !== 0) {
					this.car.angle += this.gamepad.axes[0] * 3;
				}
			}
		}

		// keyboard
		// accelerate
		if (this.keys[65] == true && this.car.mod == 1) {

			if (this.car.speed < this.car.maxspeed && !this.keys[90]) {
				this.car.acc = (this.car.maxspeed - this.car.speed) / 100;
				this.car.speed += this.car.acc;
			}

			if (this.car.speed > this.car.maxspeed) {
				this.car.speed -= Number(this.car.speed * 0.01).toFixed(2);
			}

		} else {
			// release accelerator
			if (this.car.speed > 0) this.car.speed = this.car.speed / 1.005;

			// if (this.car.speed < 0.05) this.car.speed = 0;
			this.car.mod = 1;
		}

		// brake
		if (this.keys[90]) {
			this.car.state = 1;
			
			if( this.car.speed > 1) {
				this.car.speed = this.car.speed * 0.985;
			}

			if (this.car.speed <= 15 && this.car.speed > 0) {
				this.car.speed -= 0.25;
			}

			if (this.car.speed <= 0) {
				this.car.speed = 0;
			}
		}

		// steering
		if (this.keys[37]) {
			if(Math.floor(this.car.speed) !== 0) {
				if( this.car.speed > 20) {
					this.car.angle -= (40 / this.car.speed) * 2;
				} else {
					this.car.angle -= 2;
				}
			}
			
		}
		if (this.keys[39]) {
			if(Math.floor(this.car.speed) !== 0) {
				if(this.car.speed > 20) {
					this.car.angle += (40 / this.car.speed) * 2;
				} else {
					this.car.angle += 2;
				}
			}
		}
	},

	setScreenSize : function (size) {
		switch(size) {
			default:
			case 'mobile' :
				return {'height': 600, 'width': 800};
				break;
			case 'tablet' :
				return {'height': 768,'width': 1024};
				break;
			case 'desktop' :
				return {'height': 1024,'width': 1280};
				break;
			case 'fullscreen' :
				return {'height': window.innerHeight,'width': window.innerWidth};
				break;
		}
	},

	keyup_handler : function (event) {
		this.keys[event.keyCode] = false;

		if (event.keyCode == 65 || event.keyCode == 90) {
			this.car.speed -= 0.5;
			this.car.state = 0;
		}

		// M for mute/unmute
		if(event.keyCode == 77) {
			let sourceBuffer = this.engine.sourceBuffer;
			console.log(sourceBuffer);
			if(sourceBuffer.context.state === 'running') {
				sourceBuffer.context.suspend();
			} else {
				sourceBuffer.context.resume();
			}
		}

		if (event.keyCode == 27) {
			var menu = document.forms[0];
			if(menu.className === '' ){
				menu.className = 'closed';
			} else {
				menu.className = '';
			}
		}
	},

	keydown_handler : function(event) {
		this.keys[event.keyCode] = true;
	},

	endRace : function () {
		window.cancelAnimationFrame(this.req);

		document.body.setAttribute("race-end", "");

		var best = this.laptimes.slice(0);
		best.sort();

		this.laptimes.forEach(function(time, index) {
			var el = document.createElement('li');
			var text = document.createTextNode(time);
			el.appendChild(text);
			document.querySelector('.laptimes').appendChild(el);
			if( time == best[0]) {
				el.className = "laptime pb";
			} else {
				el.className = "laptime";
			}
		});

		this.raceendtime = new Date().getTime();
		racetime = (this.raceendtime - this.racestarttime ) / 1000;

		// 0:00.000
		var mins = Math.floor(laptime / 60);
		var secs = (laptime - mins * 60).toFixed(3);
		if (secs < 10) secs = '0' + secs;

		var el = document.createElement('li');
		var text = document.createTextNode("RACE TIME: " + secs);
		el.appendChild(text);

		document.querySelector('.laptimes').appendChild(el);
	},

	endGame : () => {
		window.location.reload(false); 
	},

	initGame : function (event) {
		// hide menu screen, show game canvas
		var teaser = document.querySelector('.world').style.display = "none";
		var canvas = document.querySelector('canvas').style.opacity = "1";
		
		document.body.setAttribute("race-start", "");
		
		// resetting lap times
		this.laptimes = [];

		// starting the racing
		this.startRace();
	}

}

window.addEventListener("change", function (e) {
	var trackpreview = document.querySelector('.track-preview');

	if(e.target.name === 'car') {
		document.querySelector('.car-preview').style.backgroundImage = "url(img/"+e.target.value+"-1.png)";
	}

	if(e.target.name === 'track') {
		trackpreview.className = 'track-preview ' + e.target.value;
		document.body.className = (e.target.value);
	}
});

window.onload = function() {
	document.body.removeAttribute('unresolved');
	racegame.setup();
};
var racegame = new Game();
