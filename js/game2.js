
var Game = function() {

}

Game.prototype = {

	keys : [],
	quality: {width: 800, height: 600},
	team: 'porsche',
	player: 'Player1',
	gamepad: null,

	canvas: null,
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
	lastTime: 0,
	req: null,

	mapsize: Math.pow(2,14),
	pathscale: 20,
	blip: null,
	minimap: null,

	cloudiness : Math.random(),
	chanceofrain : 0,

	setup: function () {

		var startRaceButton = document.querySelector('button.toggle-start');
		startRaceButton.addEventListener("click", this.initGame.bind(this), false);

		var endRaceButton = document.querySelector('button.toggle-menu');
		endRaceButton.addEventListener("click", this.endGame.bind(this), false);

		window.addEventListener("change", function (e) {
			console.log("change: ", e.target.name, e.target.value);
		});

		// this.gamepad = navigator.getGamepads()[0];

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
		this.blip = document.querySelector('.blip');
		this.minimap = document.querySelector('#minimap');
		
		this.canvas = document.getElementById("game");
		this.canvas.width = this.quality && this.quality.width ? this.quality.width : 800;
		this.canvas.height = this.quality && this.quality.height ? this.quality.height : 600;
		this.ctx = this.canvas.getContext("2d");

		this.ocvs = document.createElement('canvas');
		this.ocvs.width = this.canvas.width / this.pathscale;
		this.ocvs.height = this.canvas.height / this.pathscale;
		this.octx = this.ocvs.getContext('2d');
		
		this.keys = [];

		this.player = {
			name: "Player 1",
			laptimes: this.laptimes
		};

		// set initial position in world (change values in index.html)
		this.floor = {
			//original svg is 3200x3200, this is a useful reference when inspecting the inkscape file 
			x: ((selectedtrack.dataset.x / 3200) / this.mapsize) - this.canvas.width / 2,
			y: ((selectedtrack.dataset.y / 3200) / this.mapsize) - this.canvas.height / 2
		}
		
		console.log(this.floor, selectedtrack.dataset)
		
		this.path = new Sprite({
			name: [selectedtrack.value],
			images: [`tracks/${selectedtrack.value}.svg#path`],
			x: this.floor.x,
			y: this.floor.y,
			angle: 0,
			height: this.mapsize / this.pathscale,
			width: this.mapsize / this.pathscale
		});

		const layers = ['world', 'track', 'elevated'];

		this.worldlayers = [];
		layers.map( layer => {
			this.worldlayers[layer] = 
				new Sprite({
					name: [selectedtrack.value],
					images: [`tracks/${selectedtrack.value}.svg#${layer}`],
					x: this.floor.x,
					y: this.floor.x,
					angle: 0,
					height: this.mapsize,
					width: this.mapsize
				});
		});


		this.car = new Sprite({
			name: 'user1',
			images: [
				'img/' + selectedcar.value + '-0.png',
				'img/' + selectedcar.value + '-1.png'
			],
			x: this.canvas.width / 2,
			y: this.canvas.height / 2,
			angle: parseInt(selectedtrack.dataset.angle) || 0,
			mod: 1,
			speed: 1,
			maxspeed: 50,
			fuel: 8000, //milliliters :P
			maxfuel: 10000,
			width: 320,
			height: 220,
			sound: 'sfx/engine2.ogg'
		});

		this.chanceofrain = this.cloudiness > 0.2 ? true : false;
		console.log(this.chanceofrain, this.cloudiness);
		if(this.chanceofrain) {
			this.clouds = new Sprite({
				name: 'clouds',
				images: ['img/clouds_2k.png'],
				width: this.mapsize * 2, 
				height: this.mapsize * 2,
				opacity: this.cloudiness,
				speed: 2,
				x: 0,
				y: 0
			})
		}
		this.dustclouds = new Sprite({
			name: 'dustcloud',
			images: ['img/dust-cloud-2.png'],
			x: this.canvas.width / 2,
			y: this.canvas.height / 2,
			opacity: .9,
			angle: 0
		})

		this.ambient = new Sound({sound: 'sfx/FX Engine On-0ff Fiat Panda External 001.mp3', looping: false});
		this.ambient.updateGain(2);

		this.engine = new Sound(this.car);

		window.addEventListener("keydown", this.keydown_handler.bind(this), false);
		window.addEventListener("keyup", this.keyup_handler.bind(this), false);

		
		this.req = window.requestAnimationFrame(this.draw.bind(this));
	},

	draw : function(timeStamp) {
		let deltaTime = timeStamp - this.lastTime;
		this.lastTime = timeStamp;
		document.querySelector('.laps').setAttribute('fps', Math.floor(1000/deltaTime));
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.octx.clearRect(0, 0, this.ocvs.width, this.ocvs.height);
		
		if(this.car.fuel <= 0) this.car.maxspeed = 0;

		// checking what keys were pressed
		this.checkUserInput();
		
		// move the floor
		this.calcFloorLocation();

		// draw path on offscreen canvas
		this.path.x = this.floor.x / this.pathscale;
		this.path.y = this.floor.y / this.pathscale;
		this.path.drawSprite(this.octx);

		
		// update engine sound

		this.engine.updateEngine(this.car.speed)
		if(this.car.speed < 1 && this.car.fuel <= 0) {
			let sourceBuffer = this.engine.sourceBuffer;
			if(sourceBuffer.context.state === 'running') {
				this.engine.stopSound();

			} 
		}

		this.worldlayers.world.drawSprite(this.ctx);
		this.worldlayers.world.x = this.floor.x;
		this.worldlayers.world.y = this.floor.y;
		
		this.worldlayers.track.drawSprite(this.ctx);
		this.worldlayers.track.x = this.floor.x;
		this.worldlayers.track.y = this.floor.y;
		
		var wheresthecar = this.checkGroundType();
		
		let container = document.querySelector('.game-container');
		
		if(!container.classList.contains(wheresthecar)) {
			document.body.className = `game-container ${wheresthecar}`;
		} 

		if (wheresthecar === 'ontrack') {
			this.car.maxspeed = 50; 
			this.car.opacity = 1;
		}

		if (wheresthecar === 'offtrack') {
			
			// slow until halted
			if(this.car.speed > 0) {
				this.car.maxspeed = 3;
				this.car.angle += 3 - (Math.random() * 6);
			}  
			
			if (this.car.speed === 3) {
				this.car.maxspeed = 20;
			}

			if( this.car.speed > 1) {
				
				// handle rumble
				let randx = 1 - (Math.random() * 2);
				let randy = 1 - (Math.random() * 2);
				
				this.worldlayers.track.x += randx;
				this.worldlayers.world.x += randx;
				this.canvas.style.backgroundPositionX += randx;
				this.worldlayers.track.y += randy;
				this.worldlayers.world.y += randy;
				this.canvas.style.backgroundPositionY += randy;

				// draw dust clouds
				this.dustclouds.angle += this.car.angle + Math.random() * 2;		
				this.dustclouds.opacity = this.car.speed / 40 + Math.random() / 5;
				this.dustclouds.drawSprite(this.ctx);
			}
		}

		if (wheresthecar === 'inpits') {
			this.car.maxspeed = 15; 
			this.car.opacity = 1;
		}

		if (wheresthecar === 'inpits pitbox') {
			this.car.state = 1;
			if(this.car.fuel < this.car.maxfuel && this.car.speed < 2) this.car.fuel += 10;
		}

		// draw speedometer
		this.drawHUD();

		// draw the car onto the canvas
		this.car.drawSprite(this.ctx);
		
		// draw the 'elevated' layer onto canvas
		this.worldlayers.elevated.drawSprite(this.ctx);
		this.worldlayers.elevated.x = this.floor.x;
		this.worldlayers.elevated.y = this.floor.y;
		
		if (this.chanceofrain) {
			this.clouds.drawSprite(this.ctx);
			this.clouds.x *= this.clouds.speed;
			this.clouds.x = (this.floor.x * 1.5);
			this.clouds.y = this.floor.y * 1.4;
			this.clouds.angle += Math.random() * .1;
		}

		this.ctx.drawImage(this.canvas, 0, 0);

		// ..and do it all again.
		this.req = window.requestAnimationFrame(this.draw.bind(this));
	},

	// Basically the game engine: sample 1x1 pixel in the center of the screen 
	// (ie location of the car on top of the game world)
	// and make decisions based on that
	checkGroundType: function () {
		
		var image = this.octx.getImageData(this.ocvs.width/2, this.ocvs.height/2, 1,1);
	
	//	creates a snapshot of the path canvas and adds it to the DOM
	// 	let debugnode = document.querySelector('img#debugsnapshot');
	// 	if(! debugnode ) {
	// 		var el = document.createElement('img');
	// 		el.id = 'debugsnapshot';
	// 		el.src = this.ocvs.toDataURL("image/png");
	// 		document.body.appendChild(el);
	// 	} else {
	// 		debugnode.src = this.ocvs.toDataURL("image/png");
	// 	}
	
		var pixel1 = image.data[0];
		var pixel2 = image.data[1];
		var pixel3 = image.data[2];
		
		// trigger lap timer by hitting red start/finish line rect (see track.svg#path)
		if(pixel1 === 255 && pixel2 === 0 && pixel3 === 0) {
			this.setLapTime();
		}

		if (this.laptimes.length === this.racelaps && !this.racefinished) {
			this.racefinished = true;
			this.car.maxspeed = 0;
			this.car.state = 1; // turns on the brake lights after finish. maybe change to celebratory blinking lights?
			this.endRace();
		}

		// on track
		if (pixel1 === 0 && pixel2 === 255 && pixel3 === 0) { 
			return 'ontrack';
		}	

		// in pits
		if (pixel1 === 0 && pixel2 === 0 && pixel3 === 255 ) { 
			return 'inpits';
		}
		
		// in pits
		if (pixel1 === 255 && pixel2 === 0 && pixel3 === 255 ) { 
			return 'inpits pitbox';
		}

		// off track
		if (pixel1 === 0 && pixel2 === 0 && pixel3 === 0) {
			return 'offtrack';
		}
	},

	setLapTime: function () {
		if (!this.lapstarttime) {
			this.lapstarttime = new Date().getTime();
			this.racestarttime = new Date().getTime();
			return;
		}
	
		//record current time to compare against last recorded lapstarttime.
		var lapfinish = new Date().getTime();
		// ms to s.
		var laptime = (lapfinish - this.lapstarttime ) / 1000;

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
		var racetime = (this.raceendtime - this.racestarttime ) / 1000;
		
		// 0:00.000
		var mins = Math.floor(racetime / 60);
		var secs = (racetime - mins * 60).toFixed(3);

		var el = document.createElement('li');
		var text = document.createTextNode(`RACE TIME: ${mins}:${secs < 10 ? '0' + secs : secs}`);
		el.appendChild(text);

		document.querySelector('.laptimes').appendChild(el);
	},

	drawHUD : function() {
		let currentFuel = Math.floor(this.car.fuel / 100);
	
		// calculate floor transformation in %
		let tx = (((this.floor.x - this.canvas.width / 2) / this.worldlayers.world.width) * 100).toFixed(2) ;
		let ty = (((this.floor.y - this.canvas.height / 2) / this.worldlayers.world.height) * 100).toFixed(2);

		hud.dataset.speed = Number(this.car.speed * 4).toFixed(0);
		hud.querySelector('.needle.speed').style.transform = 'rotateZ(' + Math.ceil(this.car.speed * 2 * 1.8) + 'deg)';

		hud.dataset.fuel = currentFuel < 10 ? '0' + currentFuel : currentFuel;
		hud.querySelector('.needle.fuel').style.transform = 'rotateZ(' + (currentFuel * 1.75) + 'deg)';
	
		//move minimap
		this.minimap.querySelector('img').style.transform = `translate(${tx}%, ${ty}%)`;
		this.blip.style.transform = `rotate(${this.car.angle}deg)`;
	},

	calcFloorLocation : function() {
		var x = Math.floor((this.car.speed*this.car.mod) * Math.cos(Math.PI/180 * this.car.angle));
		var y = Math.floor((this.car.speed*this.car.mod) * Math.sin(Math.PI/180 * this.car.angle));

		this.floor.x -= x;
		this.floor.y -= y;
		
		this.canvas.style.backgroundPosition = `${this.floor.x}px ${this.floor.y}px`;
	},

	checkGamepad : function () {
		try {
			// this.gamepad = navigator.getGamepads()[0];
		} catch (e) {
			console.log(e);
		}
	},

	checkUserInput : function() {
		// gamepad
		if(this.gamepad) {

			if (this.gamepad.buttons[7].pressed) {
				
				this.car.mod = 1;
				this.car.state = 0;
/*
				if (this.car.speed < this.car.maxspeed) {
					var acc = 1.001 * (1 + Number(this.gamepad.axes[5].toFixed(3)) / 2);
					// var acc = (this.car.maxspeed - this.car.speed) / 100;
					this.car.speed += acc;	
				}*/

				if (this.car.speed < this.car.maxspeed ) {
					var acc = (this.car.maxspeed - this.car.speed) / 80;
					this.car.speed += acc;
				}
	
				if (this.car.speed > this.car.maxspeed) {
					this.car.speed -= Number(this.car.speed * 0.01).toFixed(2);
				}
				console.log(this.car.speed, this.car.maxspeed)
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
		
		if (this.keys[65] == true && this.car.mod == 1 && !this.racefinished) {

			if (this.car.speed < this.car.maxspeed && !this.keys[90] ) {
				this.car.acc = (this.car.maxspeed - this.car.speed) / 100;
				this.car.speed += this.car.acc;
			} 
			
			if (this.car.speed > this.car.maxspeed) {
				// todo check for offtrack status and dramatically increase deceleration
				this.car.speed -= Number(this.car.speed * 0.01).toFixed(2);
			}

			if(this.car.fuel > 0) this.car.fuel -= 2;

		} else {
			// release accelerator
			if (this.car.speed > 0) this.car.speed = this.car.speed / 1.005;

			// if (this.car.speed < 0.05) this.car.speed = 0;
			this.car.mod = 1;
			if(this.car.fuel > 0) this.car.fuel -= 0.1;
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
			
			if(this.car.speed > 0) this.car.speed -= 0.5;
			if(this.car.speed < 3) this.car.speed = 0;
			if(!this.racefinished) this.car.state = 0;
		}

		// M for mute/unmute engine
		if(event.keyCode == 77) {
			let sourceBuffer = this.engine.sourceBuffer;
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

	endGame : () => {
		window.location.reload(false); 
	},

	initGame : function (event) {
		// hide menu screen, show game canvas
		var teaser = document.querySelector('.world').style.display = "none";
		
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
		document.querySelector('.car-preview img').src = "img/"+e.target.value+"-1.png";
	}

	if(e.target.name === 'track') {
		trackpreview.className = 'track-preview ' + e.target.value;
		trackpreview.style.backgroundImage = `url('img/${e.target.value}.svg')`;
		document.body.className = (e.target.value);
		document.querySelector('#minimap img').src = `tracks/${e.target.value}.svg#path`;
		document.querySelector('#minimap img').style.transform = `translate(${e.target.dataset.x}px, ${e.target.dataset.y}px)`;		
	}
});

window.onload = function() {
	document.body.removeAttribute('unresolved');
	racegame.setup();
};
var racegame = new Game();
