
var Game = function() {

}

Game.prototype = {

	keys : [],
	quality: {width: 800, height: 600},
	team: 'porsche',
	player: 'Player1',
	gamepad: null,
	debugmode: false,
	debugNode: document.querySelector('img#track-debug'),
	canvas: null,
	ctx : null,
	ocvs : null,
	octx : null,
	selectedtrack: null,
	car : null,
	carUpgrades: null,
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
	surface: {type: 'track', lastSnapshot: 0},
	req: null,

	// some magi numbers here
	// max speed _should_ be set in html but just in case
	maxspeed: 100,
	maxsteer: 0,
	// turns the 3200px svg into a 32k image
	// TODO: add car size

	mapsize: Math.pow(2,15),

	// turns the path into a small image so
	// checking pixel color is faster
	// can't be too small or the refueling spot and lap timers 
	// won't trigger!
	pathscale: 0.1,

	blip: null,
	minimap: null,

	cloudiness : Math.random(),
	smokeParticles: [],
	rubbers: [],

	setup: function () {

		var startRaceButton = document.querySelector('button.toggle-start');
		startRaceButton.addEventListener("click", this.initGame.bind(this), false);

		window.addEventListener("change", function (e) {
			console.log("change: ", e.target.name, e.target.value);
		});

		// TODO: fix gamepad code
		if(this.gamepad === null) {
			window.addEventListener("gamepadconnected", function(e) {
				this.gamepad = navigator.getGamepads()[0];
				console.log(this.gamepad);
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
		this.selectedcar = selectedcar.value;
		// TODO: fix magic number
		this.maxspeed = parseInt(Number(selectedcar.dataset.maxspeed) / 4);

		const carUpgrades = document.querySelectorAll('[name=upgrade]:checked');
		
		carUpgrades.forEach( (upgrade) => { 
			
			this.maxspeed += parseInt(upgrade.dataset.speedBoost);
			this.maxsteer = Number(upgrade.dataset.steerBoost) || 0;
			this.carUpgrades += ` ${upgrade.value}`;
		});

		document.querySelector('.blip').style.backgroundImage = `url('img/car/${selectedcar.value}.png')`;

		this.quality = this.setScreenSize();
		hud = document.querySelector('output');
		this.fpsCounter = document.querySelector('[fps]');
		this.blip = document.querySelector('.blip');
		this.minimap = document.querySelector('#minimap');
		
		// the main canvas: draws the car and (smoke) particles
		this.canvas = document.getElementById("game");
		this.canvas.width = (this.quality && this.quality.width ? this.quality.width : 800);
		this.canvas.height = (this.quality && this.quality.height ? this.quality.height : 600);
		// lmao no more frame drop when 'dropping particles' with WebGL enabled 👯
		WebGL2D.enable(this.canvas); 
		this.ctx = this.canvas.getContext("2d");

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
		// see checkSurfaceType, line 383
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
			
			switch (layer.getAttribute('layer')) {
				case 'world':
					layer.style.backgroundImage = 
						`url("track/${selectedtrack.value}.svg#track"), url("track/${selectedtrack.value}.svg#world")`;
					break;
				case 'track':
						break;
				case 'elevated':
					layer.style.backgroundImage = `url("track/${selectedtrack.value}.svg#elevated")`;
					break;
				case 'clouds':
					layer.style.backgroundImage = "url('img/clouds_2k.png')";
					layer.style.opacity = 0.05 + (Math.random() * .25);
					break;
			}
		});

		// Playter car sprite
		this.car = new Sprite({
			name: 'user1',
			// moving to html layers instead of canvas sprites
			layers:  {
				container: document.querySelector('#car'),
				car: document.querySelector('#car-sprite .car'),
				lights: document.querySelector('#car-lights'),
				brakelights: document.querySelector('#car-brake-lights') 
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
		
		const carimg = `img/car/${selectedcar.value}.png`;
		this.car.layers.car.style.backgroundImage = `url(${carimg})`;
		this.car.layers.container.className = `${selectedcar.value} ${this.carUpgrades}`;
		this.car.layers.car.querySelector('img').src = carimg;

		// Particle state images
		this.smokeImages = Array.from(document.querySelectorAll('img.smoke')).map( img => img.src);
		
		// Particles
		this.smokes = [];
		this.rubbers = [];

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

	/* -------------- */
	/* MAIN GAME LOOP */
	/* -------------- */

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
		if(timeStamp - this.surface.lastSnapshot > 200) {
			this.surface.type = this.checkSurfaceType();
			this.surface.lastSnapshot = timeStamp;
		}

		// set class to body to update HUD with yellow flag / pit limiter etc
		if(!(document.querySelector('.laptimes')).classList.contains(this.surface.type)) {
			(document.querySelector('.laptimes')).className = `laptimes ${this.surface.type}`;
		}

		if (this.surface.type === 'track') {
			this.car.maxspeed = this.maxspeed; 
			this.car.opacity = 1;
		}

		if (this.surface.type === 'offtrack') {
			
			// slow down until halted
			if(this.car.speed > 0) {
				this.car.maxspeed = 10;
				this.car.angle += Math.sin(this.floor.x * this.floor.y) * 7;
			}  
			
			// draw dust clouds
			if( this.car.speed > 20) {
				if(!this.smokes.length || timeStamp - this.smokes[this.smokes.length - 1].spawn[2] > 1000) {
				 this.dropSmoke();
				}
			}
			
			// allow stranded player to accelerate somewhat
			if (this.car.speed < 5) {
				this.car.maxspeed = 20;
			}

		}

		if (this.surface.type === 'inpits pitbox') {
			if(this.car.fuel < this.car.maxfuel && this.car.speed < 2) {
				this.car.fuel += 100;
				
				// state decides which of the images[] to display
				// image[2] is a car graphic with pit mechanics included
				// TODO: delete, pit crew graphics aren't used in sprite
				// TODO: make pit crew system, spawn at own coordinates
				if(this.car.speed < 5) {
					this.car.state = 2;
				} else {
					this.car.state = 0;
				}
			}
		}

		if (this.surface.type === 'inpits') {
			this.car.maxspeed = 15; 
		}

		this.car.layers.container.className = `${this.selectedcar} ${this.carUpgrades} ${this.surface.type}`;

		// draw current laptime
		this.updateLaptime();

		// draw speedometer + minimap
		this.drawHUD();
	
		// 'particle' system
		if(this.smokes.length) {

			// poor man's garbage collection
			// if a particle is too old, off that MF
			// ain't got no memory for you old man
			let remainingsmokes = this.smokes.filter( smoke => {
				return timeStamp - smoke.spawn[2]  < 1000; 
			});

			this.smokes = [...remainingsmokes];

			this.smokes.map( (smoke, idx) => {
				// make it look alive				
				smoke.angle = smoke.angle - (timeStamp - smoke.spawn[2]) / 500;
	
				smoke.x = this.floor.x - smoke.spawn[0];
				smoke.y = this.floor.y - smoke.spawn[1];
				smoke.width = smoke.width * 1.01;
				smoke.height = smoke.width;
							
				// set opacity to particle age
				smoke.opacity = (1 - ( timeStamp - smoke.spawn[2] ) / 1000);

				smoke.drawSprite(this.ctx);
			});
		}

		if(this.rubbers.length) {
			this.rubbers.map(rubber => { 
				rubber.x = this.floor.x - rubber.spawn[0];
				rubber.y = this.floor.y - rubber.spawn[1];

				if(rubber.x > 0 && 
					rubber.x - rubber.width / 2 < this.canvas.width &&
					rubber.y > 0 &&
					rubber.y - rubber.height / 2 < this.canvas.height
					) {
					rubber.drawSprite(this.ctx)
				}
			});
		}

		// update car sprites
		this.car.layers.container.style.setProperty('--rotation', `${parseInt(this.car.angle)}deg`)

		switch(this.car.state) {
			default:
			case 0:
				this.car.layers.container.classList.remove('braking');
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

	dropRubber: function (opacity) {
		if (this.surface.type === 'offtrack') return;
		const lastrubber = this.rubbers[this.rubbers.length - 1];
		if(!lastrubber || (this.lastTime - lastrubber.spawn[2] > 100)) { 
		let rubber = new Sprite({
			name: `rubber-${this.rubbers.length}`,
			images: ['/img/car/tire-rubber-2.png'],
			x: this.car.x - this.width / 2,
			y: this.car.y,
			angle: this.car.angle,
			state: 0,
			width: Math.floor(640 * (this.car.speed / this.car.maxspeed)),
			height: 70,
			opacity: opacity ? opacity : this.car.speed / this.car.maxspeed,
			spawn: [this.floor.x - this.car.x, this.floor.y - this.car.y, this.lastTime],
		});
		this.rubbers.push(rubber);
		}
	},

	dropSmoke: function () {
		
		const lastsmoke = this.smokes[this.smokes.length - 1];
		
		// don't draw smoke too often, cpu got better things to do
		if(!lastsmoke || (this.lastTime - lastsmoke.spawn[2] > 50)) { 
			let smoke = new Sprite({
				name: `smoke-${this.smokes.length}`,
				images: this.smokeImages,
				x: this.floor.x - (this.car.x - this.car.width),
				y: this.floor.y - (this.car.y - this.car.height),
				angle: 20 - Math.random() * 40 + (this.car.angle + 90),
				state: Math.floor(Math.random() * 10),
				width: 128,
				height: 128,
				opacity: .05,
				spawn: [this.floor.x - this.car.x, this.floor.y - this.car.y, this.lastTime],
			});
			this.smokes.push(smoke);
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

	
	checkSurfaceType: function () {
		
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
		
		// DEBUG PREVIEW
		// creates a snapshot of the path canvas and adds it to the DOM
		
		if(this.debugmode) {
			this.debugNode.style.opacity = .5;
			this.debugNode.src = this.ocvs.toDataURL("image/png");
		} else {
			this.debugNode.style.opacity = 0;
		}

		// transparent: offtrack
		if (image.data[3] === 0) return 'offtrack';

		// green: on track
		if (image.data[0] === 0 && image.data[1] === 255 && image.data[2] === 0) { 
			return 'track';
		}

		// red: trigger lap timer
		if(image.data[0] === 255 && image.data[1] === 0 && image.data[2] === 0) {
			this.setLapTime();
		}

		// blue: in pits / paddock
		if (image.data[0] === 0 && image.data[1] === 0 && image.data[2] === 255 ) { 
			return 'inpits';
		}
		
		// purple: in pit box (refueling spot)
		if (image.data[0] === 255 && image.data[1] === 0 && image.data[2] === 255 ) {
			if(this.car.speed === 0) {
				return 'inpits pitbox';
			}
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
		
		const currentLap = laptimes.length 
			? laptimes.length >=this.racelaps
				? this.racelaps
				: laptimes.length + 1
			: 1;
			

		document.querySelector('.laps').innerHTML = `${currentLap} / ${this.racelaps}`;
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
			this.gamepad = navigator.getGamepads()[0];
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
					this.car.speed = 0;
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
			if(this.car.speed > this.maxspeed * .5) {
				if( this.car.speed < this.maxspeed * .8) {
					this.dropSmoke();
				}
				if(this.car.speed > this.maxspeed * .5) {
					this.dropRubber();
				}
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
			this.car.layers.car.classList.add('steer-left');
			if(Math.floor(this.car.speed) !== 0) {
				if( this.car.speed > 20) {
					this.car.angle -= (40 / this.car.speed) * 2 + this.maxsteer;
				} else {
					this.car.angle -= (2 + this.maxsteer);
				}
			}
			
		}
		if (this.keys[39]) {
			this.car.layers.car.classList.add('steer-right');
			if(Math.floor(this.car.speed) !== 0) {
				if(this.car.speed > 20) {
					this.car.angle += (40 / this.car.speed) * 2 + this.maxsteer;
				} else {
					this.car.angle += (2  + this.maxsteer);
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
		this.car.layers.car.classList.remove('steer-left');
		this.car.layers.car.classList.remove('steer-right');
		// why not
		switch(event.key) {
			case 's':
				this.dropSmoke();
				break;
			case 'd':
				this.dropRubber(1);
				break;
			case 'f':
				this.debugmode = !this.debugmode;
				break;
			case 'p':
				console.log(this.floor);
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
