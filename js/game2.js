
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
	selectedtrack: null,
	car : null,
	track : null,
	startPosition: null,
	racelaps : 3,
	racestarttime: null,
	raceendtime: null,
	laptimes: ['00.000'],
	lapstarttime: null,
	laptime: null,
	racefinished: false,
	lastTime: 0,
	req: null,

	// some magi numbers here
	// max speed _should_ be set in html but just in case
	maxspeed: 100,
	
	// turns the 3200px svg into a 32k image
	// TODO: add car size

	mapsize: Math.pow(2,15),

	// turns the path into a small image so
	// checking pixel color is faster
	// can't be too small or the refueling spot and lap timers 
	// won't trigger!
	pathscale: 0.2,

	blip: null,
	minimap: null,

	cloudiness : Math.random(),

	setup: function () {

		var startRaceButton = document.querySelector('button.toggle-start');
		startRaceButton.addEventListener("click", this.initGame.bind(this), false);

		window.addEventListener("change", function (e) {
			console.log("change: ", e.target.name, e.target.value);
		});

		// TODO: fix gamepad code
		if(this.gamepad === null) {
			window.addEventListener("gamepadconnected", function(e) {
				console.log(e);
			});
		}
	},

	startRace : function() {

		// turn down the ambient noise from the menu
		// make sure there's always *some* sound
		this.ambientAudio = document.querySelector('audio');
		this.ambientAudio.volume = .5;

		var selectedtrack = document.querySelector('input[name=track]:checked');
		var randomTrack = Math.floor(Math.random() * 3);
		var selectedtrack = document.querySelector('input[name=track]:checked') 
			? document.querySelector('input[name=track]:checked') 
			: document.querySelectorAll('input[name=track]')[randomTrack];
		document.querySelector('#minimap .track img').src = `track/${selectedtrack.value}.svg#path`;

		this.selectedtrack = selectedtrack.value;
		var randomCar = Math.floor(Math.random() * 3);
		var selectedcar = document.querySelector('input[name=car]:checked') 
			? document.querySelector('input[name=car]:checked') 
			: document.querySelectorAll('input[name=car]')[randomCar];
		
		// TODO: fix magic number
		this.maxspeed = parseInt(Number(selectedcar.dataset.maxspeed) / 4);

		document.querySelector('.blip').style.backgroundImage = `url('img/car/${selectedcar.value}-1.png')`;

		this.quality = this.setScreenSize();
		hud = document.querySelector('output');
		this.fpsCounter = document.querySelector('[fps]');
		this.blip = document.querySelector('.blip');
		this.minimap = document.querySelector('#minimap');
		
		// the main canvas: draws the car and (smoke) particles
		this.canvas = document.getElementById("game");
		this.canvas.width = (this.quality && this.quality.width ? this.quality.width : 800);
		this.canvas.height = (this.quality && this.quality.height ? this.quality.height : 600);
		this.ctx = this.canvas.getContext("2d");
		// lmao no more frame drop when 'dropping particles' with WebGL enabled 👯
		WebGL2D.enable(this.canvas); 

		// the game engine canvas: draws the #path layer to determine on/off track status
		this.ocvs = document.createElement('canvas');
		this.ocvs.width = this.canvas.width * this.pathscale;
		this.ocvs.height = this.canvas.height * this.pathscale;
		this.octx = this.ocvs.getContext('2d', {willReadFrequently: true});
		WebGL2D.enable(this.ocvs);

		this.racelaps = parseInt(document.querySelector('#laps').value);

		// log pressed keys
		this.keys = [];
		
		// TODO: add input for player name
		this.player = {
			name: "Player 1",
			laptimes: this.laptimes
		};
		
		// offset map start position
		// we don't always want to start in the dad center of the map.
		// the track selector in index.html contains offset coordinates
		// to place the player in the correct spot on the track 
		// (somewhere near the start or pit boxes )
		let [startx,starty] = JSON.parse(selectedtrack.dataset.start);
		this.startPosition = [startx, starty];
		
		// set initial position in world (change values in index.html)
		this.floor = {
			x: startx + (this.canvas.width / 2),
			y: starty + (this.canvas.height / 2)
		}
		
		// the Path sprite is used to check where the player is in the world
		// see checkGroundType, line 383
		this.path = new Sprite({
			name: selectedtrack.value,
			images: [`track/${selectedtrack.value}.svg#path`],
			x: this.floor.x,
			y: this.floor.y,
			angle: 0,
			height: this.mapsize * this.pathscale,
			width: this.mapsize * this.pathscale
		});

		// see index.html
		// basically there's 5 layers that are draw on screen: world, track, car, elevated, clouds 
		// these are all html elements stacked on top of each other (car is a `canvas` element)
		// #path is only drawn off screen 
		// here, all layers are initialized with their bg images in the correct location
		this.gameLayers = document.querySelectorAll('.game-layer');
		Array.from(this.gameLayers).map( layer => {
			
			if(layer.getAttribute('layer') === 'clouds') {
				layer.style.backgroundImage = "url('img/clouds_2k.png')";
				layer.style.opacity = 0.05 + (Math.random() * .5);
			} else {
				if(layer.getAttribute('layer')) {
					layer.style.backgroundImage = `url("track/${selectedtrack.value}.svg#${layer.getAttribute('layer')}")`;
				}
			}		
			layer.style.backgroundPosition = `${this.floor.x}px ${this.floor.y}px`;
		});

		// Playter car sprite
		this.car = new Sprite({
			name: 'user1',
			// moving to html layers instead of canvas sprites
			layers:  {
				container: document.querySelector('#car'),
				car: document.querySelector('#car-sprite img'),
				lights: document.querySelector('#car-lights img'),
				brakelights: document.querySelector('#car-brake-lights img') 
			},
			images: [
				'img/car/' + selectedcar.value + '.png'
			],
			width: 640,
			height: 440,
			x: this.canvas.width / 2,
			y: this.canvas.height / 2,
			angle: parseInt(selectedtrack.dataset.angle) || 0,
			mod: 1,
			speed: 0,
			opacity: 1,
			maxspeed: this.maxspeed,
			fuel: Number(document.querySelector('#fuel').value * 1000), //milliliters :P
			maxfuel: Number(document.querySelector('#fuel').getAttribute('max') * 1000),
			sound: 'sfx/engine2.ogg'
		});
		
		this.car.layers.car.src = 'img/car/' + selectedcar.value + '.png';

		// Particles
		this.poops = [];

		// play starting engine sound
		this.startengine = new Sound({sound: 'sfx/370276__biholao__acceleration-3.ogg', looping: false});
		this.startengine.updateGain(1.5);

		// play engine running loop
		this.engine = new Sound({sound:this.car.sound, looping: true ,});

		window.addEventListener("keydown", this.keydown_handler.bind(this), false);
		window.addEventListener("keyup", this.keyup_handler.bind(this), false);
		window.addEventListener("resize", function () {
			this.canvas.width = window.innerWidth;
			this.canvas.height = window.innerHeight;
		}.bind(this), false);
		this.req = window.requestAnimationFrame(this.draw.bind(this));
	},

	draw : function(timeStamp) {
		
		let deltaTime = timeStamp - this.lastTime;
		
		this.updateFPS(deltaTime);

		// clear both canvases 
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.octx.clearRect(0, 0, this.ocvs.width, this.ocvs.height);
		
		if(this.car.fuel <= 0) {
			this.car.maxspeed = 0;
		}

		// checking what keys were pressed
		this.checkUserInput();
		
		// move the floor
		this.calcWorldMovement(timeStamp);	

		// draw path on offscreen canvas
		this.path.drawSprite(this.octx);
		this.path.x = this.floor.x * this.pathscale;
		this.path.y = this.floor.y * this.pathscale;

		
		// update engine sound
		this.engine.updateEngine(this.car.speed)
		if(this.car.speed < 1 && this.car.fuel <= 0) {
			let sourceBuffer = this.engine.sourceBuffer;
			if(sourceBuffer.context.state === 'running') {
				this.engine.stopSound();

			} 
		}		

		// checks center pixel in #path image on off screen canvas
		// returns a string based on detected color
		// depending on result, car behavior will change
		var wheresthecar = this.checkGroundType();
		
		// set class to body to update HUD with yellow flag / pit limiter etc
		let container = document.body;
		if(!container.classList.contains(wheresthecar)) {
			container.className = `${this.selectedtrack} ${wheresthecar}`;
		} 

		if (wheresthecar === 'ontrack') {
			this.car.maxspeed = this.maxspeed; 
			this.car.opacity = 1;
		}

		if (wheresthecar === 'offtrack') {
			
			// slow down until halted
			if(this.car.speed > 0) {
				this.car.maxspeed = 10;
				this.car.angle += Math.sin(this.floor.x * this.floor.y);
			}  
			
			// draw dust clouds
			if( this.car.speed > 1) {
				this.dropPoop();
			}
			
			// allow stranded player to accelerate somewhat
			if (this.car.speed === 3) {
				this.car.maxspeed = 20;
			}

		}

		if (wheresthecar === 'inpits pitbox') {
			if(this.car.fuel < this.car.maxfuel && this.car.speed < 2) {
				this.car.fuel += 100;
				
				// state decides which of the images[] to display
				// image[2] is a car graphic with pit mechanics included
				if(this.car.speed < 5) {
					this.car.state = 2;
				} else {
					this.car.state = 0;
				}
			}
		}

		if (wheresthecar === 'inpits') {
			this.car.maxspeed = 15; 
		}

		// draw current laptime
		this.updateLaptime();

		// draw speedometer + minimap
		this.drawHUD();
	
		// 'particle' system
		if(this.poops.length) {

			// poor man's garbage collection
			// if a particle is too old, off that MF
			// ain't got no memory for you old man
			let remainingPoops = this.poops.filter( poop => {
				return timeStamp - poop.spawn[2]  < 1000; 
			});

			this.poops = [...remainingPoops];

			this.poops.map(poo => {
				// make it look alive
				// actual poo might be quite static
				// but this is supposed to look like
				// a smoke cloud
				poo.angle += Math.random() * 2;
				poo.x = (this.floor.x - poo.spawn[0]) ;
				poo.y = this.floor.y - poo.spawn[1];
				poo.width = poo.width * 1.01;
				poo.height = poo.width;

				// set opacity to distance from car
				// poo.opacity = 1 - (Math.abs(this.car.x - poo.x) / this.car.x).toFixed(1);
				
				// set opacity to particle age
				poo.opacity = 1 - ( timeStamp - poo.spawn[2] ) / 1000;

				poo.drawSprite(this.ctx);
			});
		}

		// update car sprites
		this.car.layers.car.style.setProperty('--rotation', `${parseInt(this.car.angle)}deg`);
		this.car.layers.lights.style.setProperty('--rotation', `${parseInt(this.car.angle)}deg`);
		this.car.layers.brakelights.style.setProperty('--rotation', `${parseInt(this.car.angle)}deg`);

		switch(this.car.state) {
			default:
			case 0:
				this.car.layers.container.classList.remove('braking')
				this.car.layers.container.classList.remove('pitbox');
				break;
			case 1:
				this.car.layers.container.classList.add('braking');
				break;
		}

		//draw the context to the canvas
		this.ctx.drawImage(this.canvas, 0, 0);

		this.lastTime = timeStamp;

		// ..and do it all again.
		this.req = window.requestAnimationFrame(this.draw.bind(this));
	},

	dropPoop: function () {
		
		const lastpoop = this.poops[this.poops.length - 1];
		
		// don't draw poop too often, cpu got better things to do
		if(!lastpoop || (this.lastTime - lastpoop.spawn[2] > 90)) { 
			let poop = new Sprite({
				name: `poop-${this.poops.length}`,
				images: [`img/smoke/smoke${Math.ceil(Math.random() * 11)}.png`],
				x: this.car.x,
				y: this.car.y,
				angle: this.car.angle + 90,
				state: 0,
				width: 128,
				height: 128,
				opacity: .05,
				spawn: [this.floor.x - this.car.x, this.floor.y - this.car.y, this.lastTime],
			});
			this.poops.push(poop);
		} 
	},

	updateFPS: function (deltaTime) {
		this.fpsCounter.setAttribute('fps', `${Math.floor(1000/deltaTime)}`);
		
		if(this.fpsCounter.childNodes.length == 100) {
			this.fpsCounter.removeChild(this.fpsCounter.firstElementChild);
		}
		const bar = document.createElement('span');
		const fps = parseInt(1000 / deltaTime);
		bar.className = 'bar';
		bar.setAttribute('fps', fps)
		bar.style.height = fps/2 + 'px';
		this.fpsCounter.appendChild(bar);
	},

	updateLaptime: function () {
		if(this.lapstarttime) {
			const currentLapTime = ((new Date().getTime() - this.lapstarttime) / 1000).toFixed(3);
			// 0:00.000
			var mins = Math.floor(currentLapTime / 60);
			var secs = (currentLapTime - mins * 60).toFixed(3);
			if (secs < 10) secs = '0' + secs;
			document.querySelector('.current').innerHTML = `${mins}:${secs}`;
		}
	},

	
	checkGroundType: function () {
		
		// Basically the game engine: sample 1x1 pixel in the center of the screen 
		// (ie location of the car on top of the game world)
		// and make decisions based on that.
		// In order to optimize, only the #path layer is loaded into this canvas
		// so every draw call on that does as little work as possible. 
		// An older version of this game would draw the entire world onto the on-canvas
		// but this turned out to be inefficient. Instead of drawing those layers on 
		// the on-screen canvas, I'm now just setting those layers as css background-images
		// and simply translate the background position on the relevant html elements. 
		// see index.html (div.game-container)	

		var image = this.octx.getImageData(this.ocvs.width/2, this.ocvs.height/2, 1,1);
	
		var pixel1 = image.data[0];
		var pixel2 = image.data[1];
		var pixel3 = image.data[2];
		
		// red: trigger lap timer by hitting red start/finish line rect (see track.svg#path)
		if(pixel1 === 255 && pixel2 === 0 && pixel3 === 0) {
			this.setLapTime();
		}

		// DEBUG PREVIEW
		// creates a snapshot of the path canvas and adds it to the DOM
		// uncomment the code below to inspect the snapshot
		let debugnode = document.querySelector('img#debugsnapshot');
		// if(! debugnode ) {
		// 	var el = document.createElement('img');
		// 	el.id = 'debugsnapshot';
		// 	el.src = this.ocvs.toDataURL("image/png");
		// 	document.body.appendChild(el);
		// } else {
		// 	debugnode.src = this.ocvs.toDataURL("image/png");
		// }


		// green: on track
		if (pixel1 === 0 && pixel2 === 255 && pixel3 === 0) { 
			return 'ontrack';
		}	

		// blue: in pits / paddock
		if (pixel1 === 0 && pixel2 === 0 && pixel3 === 255 ) { 
			return 'inpits';
		}
		
		// purple: in pit box (refueling spot)
		if (pixel1 === 255 && pixel2 === 0 && pixel3 === 255 ) { 
			return 'inpits pitbox';
		}

		// transparent / black: off track
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
		if(laptime > 20 || this.car.fuel <= 0) {
			this.laptimes.push ( mins + ':' + secs );
			this.lapstarttime = new Date().getTime();
		}

		//update HUD
		var laptimes = this.laptimes;
		var last = laptimes[laptimes.length - 1];
		var best = laptimes.slice(0);
		best.sort();
		
		document.querySelector('.laps').innerHTML = `${laptimes.length ? laptimes.length : 1} / ${this.racelaps}`;
		document.querySelector('.best').innerHTML = best[0] ? best[0] : '-:--.---';
		document.querySelector('.last').innerHTML = last ? last : '-:--.---';

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

		// end race condition
		if (this.laptimes.length === this.racelaps && !this.racefinished) {
			this.racefinished = true;
			this.car.maxspeed = 0;
			this.car.state = 1; // turns on the brake lights after finish. maybe change to celebratory blinking lights?
			this.endRace();
		}
	},

	endRace : function () {
		this.engine.updateGain(.2);
		this.ambientAudio.volume = 1;
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
		el.setAttribute('label','race time');
		var text = document.createTextNode(`${mins}:${secs < 10 ? '0' + secs : secs}`);
		el.appendChild(text);

		document.querySelector('.laptimes').appendChild(el);
	},

	drawHUD : function() {
		let currentFuel = Math.floor(this.car.fuel / 100);
		let maxFuel = Math.floor(this.car.maxfuel / 100);
		
		// calculate floor transformation in %
		let tx = (((this.floor.x + this.canvas.width / 2) / this.mapsize) * 100).toFixed(2) ;
		let ty = (((this.floor.y + this.canvas.height / 2) / this.mapsize) * 100).toFixed(2);

		hud.dataset.speed = Number(this.car.speed * 4).toFixed(0);
		hud.querySelector('.needle.speed').style.transform = 'rotateZ(' + Math.ceil(this.car.speed * 2 * 1.8) + 'deg)';

		hud.dataset.fuel = currentFuel < 10 ? '0' + currentFuel : currentFuel;

		hud.querySelector('.needle.fuel').style.transform = 'rotateZ(' + (currentFuel / maxFuel) * 180 + 'deg)';
	
		//move minimap
		this.minimap.querySelector('img').style.transform = `translate(${tx}%, ${ty}%)`;
		this.blip.style.transform = `rotate(${this.car.angle}deg)`;
	},

	calcWorldMovement : function(timeStamp) {
		var x = Math.floor((this.car.speed*this.car.mod) * Math.cos(Math.PI/180 * this.car.angle));
		var y = Math.floor((this.car.speed*this.car.mod) * Math.sin(Math.PI/180 * this.car.angle));

		this.floor.x -= x;
		this.floor.y -= y;
				
		let layerBGPos = `${this.floor.x - (this.mapsize / 2)}px ${this.floor.y -(this.mapsize / 2)}px`;
		Array.from(this.gameLayers).map( layer => {
			// need to make an exception for the clouds layer because we want to make it appear to move over the world
			if(layer.getAttribute('layer') === 'clouds') {
				layerBGPos = `${this.floor.x - (this.mapsize / 2) + parseInt(timeStamp / 10)}px ${this.floor.y -(this.mapsize / 2)}px`;
			}
			// update world layers
			layer.style.backgroundPosition = layerBGPos;
			
		});
	},

	checkGamepad : function () {
		
		try {
			// this.gamepad = navigator.getGamepads()[0];
		} catch (e) {
			console.log(e);
		}
	},

	checkUserInput : function() {
		// TODO: update to reflect keyboard controls
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
				this.car.speed += this.car.acc / 2;
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
			
			// smoke effect for brake lock up
			if(this.car.speed > this.maxspeed * .25) {
				this.dropPoop();
			}

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

	setScreenSize : function () {
		try{
			document.body.requestFullscreen();
			return {'height': window.screen.height,'width': window.screen.width};
		} catch (e) {
			console.error(e);
		}
	},

	keyup_handler : function (event) {
		 
		this.keys[event.keyCode] = false;

		// why not
		if(event.key == 'd') {
			this.dropPoop();
		}

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

	initGame : function () {

		
		// hide menu screen, show game canvas
		document.querySelector('.world').style.display = "none";
		document.body.setAttribute("race-start", "");
		document.body.removeAttribute("race-end");
		
		// resetting lap times
		this.laptimes = [];
		
		// starting the racing
		this.startRace();
	}

}

// handles menu selections
window.addEventListener("change", function (e) {
	var trackpreview = document.querySelector('.track-preview');

	if(e.target.name === 'option' && e.target.value == 1) {
		trackpreview.classList.add('garage-preview');
	}

	if(e.target.name === 'car') {
		document.querySelector('.car-preview').className = 'car-preview ' + e.target.value;
	}

	if(e.target.name === 'track') {
		trackpreview.className = 'track-preview ' + e.target.value;
		trackpreview.style.backgroundImage = 
			`url('track/${e.target.value}.svg#track'), url('track/${e.target.value}.svg#world')`
			;
		document.body.className = (e.target.value);
		document.querySelector('#minimap img').src = `track/${e.target.value}.svg#path`;
		document.querySelector('#minimap img').style.transform = `translate(${e.target.dataset.x}px, ${e.target.dataset.y}px)`;		
	}
});

window.onload = function() {
	document.body.removeAttribute('unresolved');
	document.querySelector('figcaption').innerText = 'Loading complete';
	document.body.setAttribute("loaded","");
	racegame.setup();

};
var racegame = new Game();
