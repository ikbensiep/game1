
var Game = function() {

}

Game.prototype = {

	keys : [],
	quality: {width: 800, height: 600},
	team: 'porsche',
	player: 'Player1',
	car : null,
	ctx : null,
	ocvs : null,
	octx : null,

	laptimes: ['00.000'],
	lapstarttime: new Date().getTime(),
	laptime: null,
	req: null,
	
	setup: function () {
		var cars = document.querySelectorAll('input[name=player-car]');
		var q =    document.querySelectorAll('input[name=settings-quality]');
		cars[0].addEventListener("change", this.radio_car_handler.bind(this), false);
		cars[1].addEventListener("change", this.radio_car_handler.bind(this), false);
		cars[2].addEventListener("change", this.radio_car_handler.bind(this), false);
		q[0].addEventListener("change", this.radio_quality_handler.bind(this), false);
		q[1].addEventListener("change", this.radio_quality_handler.bind(this), false);
		q[2].addEventListener("change", this.radio_quality_handler.bind(this), false);

		window.addEventListener("click", this.button_handler.bind(this), false);

		var best = localStorage.getItem('Racer_best');
		document.querySelector('.lap-record').innerHTML = best ? best : '-:--.---'
	},

	init : function() {

		hud = document.querySelector('output');
		canvas = document.getElementById("game");
		this.ctx = canvas.getContext("2d");
		canvas.width = this.quality.width || 800;
		canvas.height = this.quality.height || 600;

		this.ocvs = document.createElement('canvas');
		this.ocvs.width = this.quality.width;
		this.ocvs.height = this.quality.height;
		this.octx = this.ocvs.getContext('2d');

		this.player = {
			name: document.querySelector('input[name=driver-name]').value,
			laptimes: this.laptimes
		};

		this.keys = [];

		this.world = new Sprite ({
			name: 'Barcelona',
			images: ['img/interlagos.svg'],
			x: 0,
			y: 4350,
			height: 3200 * 6,
			width: 3200 * 6
		});

		this.world_bridges = new Sprite ({
			name: 'Barcelona racetrack objects',
			images: ['img/track-bridges.svg'],
			x: 0,
			y: 4350,
			height: 3200 * 6,
			width: 3200 * 6
		});

		floor = {
			x:0,
			y:0
		}

		this.car = new Sprite({
			name: 'user1',
			images: [
				'img/' + this.team + '-0.png',
				'img/' + this.team + '-1.png'
			],
			x: canvas.width / 2,
			y: canvas.height / 2,
			angle: 180,
			mod: 1,
			speed: 0.5,
			maxspeed: 52,
			width: 240,
			height: 180
		});

		this.engine = new Engine(this.car);

		this.blip = document.querySelector('.blip');

		window.addEventListener("keydown", this.keydown_handler.bind(this), false);
		window.addEventListener("keyup", this.keyup_handler.bind(this), false);

		document.body.removeAttribute('unresolved');

		this.req = window.requestAnimationFrame(this.draw.bind(this));	
		
		// var that = this;
		// setInterval(function(){
		// 	that.drawHUD();
		// }, 100);

	},



	draw : function() {

		// checking what keys were pressed
		this.checkUserInput();

		// update engine sound
		this.engine.updateEngine(this.car.speed);
		// draw speedometer
		// this.drawHUD();

		// moving the floor
		this.drawFloor();

		this.octx.clearRect(0, 0, canvas.width, canvas.height);
		this.ctx.clearRect(0, 0, canvas.width, canvas.height);
		
		this.world.draw(this.octx);
		this.ctx.drawImage(this.ocvs, 0, 0)

		this.checkGroundType();
		

		this.car.draw(this.octx)
		this.ctx.drawImage(this.ocvs, 0, 0)
		
		this.world_bridges.draw(this.octx)
		this.ctx.drawImage(this.ocvs, 0, 0)

		this.req = window.requestAnimationFrame(this.draw.bind(this));

		// var tx = 'translateX(' + (Math.floor(this.world.x / this.world.width * 100) * 3.1 * -1) + 'px)';
		// var ty = 'translateY(' + (Math.floor(this.world.y / this.world.height * 100) * 3.1 * -1) + 'px)';

		// this.blip.style.transform = tx + ' ' + ty;
	},

	checkGroundType: function () {
		
		var image = this.octx.getImageData(canvas.width/2, canvas.height/2, 1,1);
		
		if (image.data[0] == 26) {
			this.car.maxspeed = 52;
		}


		if (image.data[0] == 0 || image.data[0] > 80) {
			if(image.data[0] !== 219) {
				this.car.maxspeed = 22;
			}
		} 

		if(this.car.speed > this.car.maxspeed) {
			this.car.speed -= this.car.speed * 0.02;
		}

		if(image.data[0] === 205) {
			//this.car.angle = 360 - this.car.angle;
			this.car.speed = this.car.speed / 2;
		}

		if(image.data[0] === 219 && image.data[1] === 33 && image.data[2] === 204 ) {
			this.setLapTime();
		}

	},

	setLapTime: function () {
		
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
		var best = laptimes.sort();


		document.querySelector('.laps').innerHTML = laptimes.length;
		document.querySelector('.best').innerHTML = best[0] ? best[0] : '--.---';
		document.querySelector('.last').innerHTML = last ? last : '--.---';
		
		// highlight fastest laptime in green
		// if last lap == best lap, update time in green
		var pb = false;
		if(last && last === best[0]) {
			pb = true;
		}

		if(pb) {
			document.querySelector('.last').style.color = "#00ff00";
			setTimeout(function(){
				document.querySelector('.last').style.color = "";
			}, 5000)
		} else {
			document.querySelector('.last').style.color = "";
		}
		
		// store player's best laptime (poorly)
    	var p = this.player.name;
    	localStorage.setItem('Racer_best', p + ' ' + best[0]);

	},

	drawHUD : function() {
		hud.setAttribute('data-speed', Number(this.car.speed * 2).toFixed(0));
		hud.querySelector('.needle').style.transform = 'rotateZ(' + Math.ceil(this.car.speed * 2 * 1.8) + 'deg)';
	},

	drawFloor : function() {
		var x = Math.floor((this.car.speed*this.car.mod) * Math.cos(Math.PI/180 * this.car.angle));
		var y = Math.floor((this.car.speed*this.car.mod) * Math.sin(Math.PI/180 * this.car.angle));
		
		this.world.x -= x;
		this.world.y -= y;
		this.world_bridges.x -= x;
		this.world_bridges.y -= y;
	},

	checkUserInput : function() {

		if (this.keys[65] == true) {
			
			this.car.mod = 1;

			if (this.car.speed < this.car.maxspeed && !this.keys[90]) {
				//this.car.speed = 1 + (this.car.speed * 1.001);
				this.car.speed += 0.5;
			}

			if (this.car.speed > this.car.maxspeed) {
				this.car.speed -= Number(this.car.speed * 0.01).toFixed(2);
			}

			if (this.car.speed <= 0) this.car.speed = 0.1;

		} else {
			
			if (this.car.speed > 0) this.car.speed = this.car.speed * 0.975;
			
			if (this.car.speed < 0) this.car.speed = 0;
		}

		if (this.keys[90]) {
			this.car.state = 1;
			//this.car.mod = -1;

			if( this.car.speed > 1) {
				this.car.speed = this.car.speed * 0.98;
			}
			
			if (this.car.speed <= 15 && this.car.speed > 0) {
				this.car.speed -= 0.5;
			}

			if (this.car.speed <= 0) {			
				this.car.speed -= 1;
			}
		}

		if (this.keys[37]) {
			if(Math.floor(this.car.speed) !== 0) {
				this.car.angle -= 3;
			}
		}
		if (this.keys[39]) {
			if(Math.floor(this.car.speed) !== 0) {
				this.car.angle += 3;
			}
		}
	},

	setScreenSize : function (size) {
		switch(size) {
			default:
			case 'low' : 
				return {'height': 600, 'width': 800};
				break;
			case 'medium' :
				return {'height': 768,'width': 1024};
				break;
			case 'high' :
				return {'height': 1024,'width': 1280};
				break;
		}
	},

	keyup_handler : function (event) {
		this.keys[event.keyCode] = false;
	
		if (event.keyCode == 65 || event.keyCode == 90) {
			this.car.speed -= 0.5;
			this.car.state = 0;	
		}

		if (event.keyCode == 27) {
			var menu = document.querySelector('#menu');
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

	radio_car_handler : function (event) {
		this.team = event.target.value;
	},

	radio_quality_handler : function (event) {
		console.log(event.target.value)
		this.quality = this.setScreenSize(event.target.value);
	},

	button_handler : function (event) {
		if(event.target.name == 'race-start') {
			document.querySelector('#menu').className = 'closed';
			this.laptimes = [];
			this.init();
		}
	}

}

window.onload = function() {
	var game = new Game();
	game.setup();
	//game.init();
};
