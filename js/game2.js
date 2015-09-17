
var Game = function() {

}

Game.prototype = {

	keys : [],
	car : null,
	ctx : null,

	laptimes: ['00.000'],
	lapstarttime: new Date().getTime(),
	laptime: null,
	req: null,

	init : function() {
		//this.time = new Date().getTime() / 1000;
		hud = document.querySelector('output');
		canvas = document.getElementById("game");
		this.ctx = canvas.getContext("2d");
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		this.keys = [];

		this.world = new Sprite ({
			name: 'Barcelona',
			images: ['img/track.svg?r=' + Math.floor(Math.random() * 100)],
			x: 0,
			y: 7000,
			height: 3200 * 6,
			width: 3200 * 6
		});

		this.world_bridges = new Sprite ({
			name: 'Barcelona racetrack objects',
			images: ['img/track-bridges.svg?r=' + Math.floor(Math.random() * 100)],
			x: 0,
			y: 7000,
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
				'img/porsche-0.png',
				'img/porsche-1.png'
			],
			x: canvas.width / 2,
			y: canvas.height / 2,
			angle: 180,
			mod: 1,
			speed: 0.5,
			maxspeed: 50,
			width: 240,
			height: 180
		});

		this.engine = new Engine(this.car);

		this.blip = document.querySelector('.blip');

		window.addEventListener("keydown", this.keydown_handler.bind(this), false);
		window.addEventListener("keyup", this.keyup_handler.bind(this), false);
		
		document.body.removeAttribute('unresolved');

		setInterval(function() {
			document.querySelector('.laptimes').innerHTML = '';
			this.laptimes.forEach(function(lap){
				var li = document.createElement('li');
				var text = document.createTextNode(lap);
				li.appendChild(text);
				document.querySelector('.laptimes').appendChild(li);
			})

		}.bind(this), 1000);

		this.req = window.requestAnimationFrame(this.draw.bind(this));	
	},

	draw : function() {
		this.checkUserInput();
		this.engine.updateEngine(this.car.speed);

		this.drawHUD();
		this.drawFloor();

		this.ctx.clearRect(0, 0, canvas.width, canvas.height);
		this.world.draw(this.ctx)
		this.checkGroundType();
		this.car.draw(this.ctx)

		this.world_bridges.draw(this.ctx)

		this.req = window.requestAnimationFrame(this.draw.bind(this));

		var tx = 'translateX(' + (Math.floor(this.world.x / this.world.width * 100) * 3.1 * -1) + 'px)';
		var ty = 'translateY(' + (Math.floor(this.world.y / this.world.height * 100) * 1.9 * -1) + 'px)';

		this.blip.style.transform = tx + ' ' + ty;
	},

	checkGroundType: function () {
		var image = this.ctx.getImageData(canvas.width/2, canvas.height/2, 1,1);
		
		if (image.data[0] > 40 || image.data[0] == 0) {
			this.car.maxspeed = 20;
		} else {
			this.car.maxspeed = 50;
		}

		if(this.car.speed > this.car.maxspeed) {
			this.car.speed -= this.car.speed * 0.1;
		}

		if(image.data[0] === 205) {
			//this.car.angle = 360 - this.car.angle;
			this.car.speed = this.car.speed / 2;
		}

		if(image.data[0] === 219) {
			this.setLapTime();
		}

	},

	setLapTime: function () {
		//if (!this.laptimes.length) this.lapstarttime = new Date().getTime();

		var lapfinish = new Date().getTime();
		// ms to s.
		laptime = (lapfinish - this.lapstarttime ) / 1000;

		if(laptime > 10) {
			this.laptimes.push ( laptime );
			this.lapstarttime = new Date().getTime();
		} else {
			// this.laptimes.push ( new Date().getTime() )	
		}

	},

	drawHUD : function() {
		hud.querySelector('.needle').style.transform = 'rotateZ(' + Math.floor(this.car.speed * 2 * 1.8) + 'deg)';
		
		// hud.getElementsByTagName("b")[0].innerHTML = this.car.speed.toFixed(1) * 2;
		// hud.getElementsByTagName("pre")[0].innerHTML = 'y: ' + this.car.y;

	},

	drawFloor : function() {
		var x = (this.car.speed*this.car.mod) * Math.cos(Math.PI/180 * this.car.angle);
		var y = (this.car.speed*this.car.mod) * Math.sin(Math.PI/180 * this.car.angle);
		
		this.world.x -= x;
		this.world.y -= y;
		this.world_bridges.x -= x;
		this.world_bridges.y -= y;
	},

	checkUserInput : function() {

		if (this.keys[65] == true) {
			
			this.car.mod = 1;

			if (this.car.speed < this.car.maxspeed) {
				//this.car.speed = 1 + (this.car.speed * 1.001);
				this.car.speed += 1;
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
			
			// if (this.car.speed <= 15 && this.car.speed > 0) {
			// 	this.car.speed = Math.floor(this.car.speed * 0.95);
			// }

			if (this.car.speed <= 0) {
				//console.log(this.car.speed);
				this.car.speed = (this.car.speed - 1) * 2.5;
			}
		}

		if (this.keys[37]) {
			if(Math.floor(this.car.speed) !== 0) {
				this.car.angle -= 3.5;
			}
		}
		if (this.keys[39]) {
			if(Math.floor(this.car.speed) !== 0) {
				this.car.angle += 3.5;
			}
		}

	},

	keyup_handler : function (event) {
		this.keys[event.keyCode] = false;
	
		if (event.keyCode == 65 || event.keyCode == 90) {
			this.car.speed -= 0.5;
			this.car.state = 0;	
		}

		if (event.keyCode == 27) {
			window.cancelAnimationFrame(this.req);
		}
	},

	keydown_handler : function(event) {
		this.keys[event.keyCode] = true;
	}

}

window.onload = function() {
	var game = new Game();
	game.init();
};
