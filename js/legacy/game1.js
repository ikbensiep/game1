window.onload = function() {

	hud = document.querySelector('output');
	canvas = document.getElementById("game");
	context = canvas.getContext("2d");
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	car = {
		image: new Image(),
		x: canvas.width / 2,
		y: canvas.height / 2,
		angle: 0,
		speed: 0,
		mod: 0
	}

	floor = {
		x:0,
		y:0
	}

	car.image.src="img/car-normal.png";

	window.addEventListener("keydown", keypress_handler, false);
	window.addEventListener("keyup", keyup_handler, false);

	keys = [];

	window.requestAnimationFrame(draw);
};

function drawHUD () {
	hud.getElementsByTagName("b")[0].innerHTML = car.speed;
	hud.getElementsByTagName("pre")[0].innerHTML = 'y: ' + car.y;
}

function drawFloor () {
	floor.x += (car.speed*car.mod) * Math.cos(Math.PI/180 * car.angle);
	floor.y += (car.speed*car.mod) * Math.sin(Math.PI/180 * car.angle);

	canvas.style.backgroundPositionY = floor.y * -1.3 + "px";
	canvas.style.backgroundPositionX = floor.x * -1.3 + "px";
}

function drawCar() {

	// car.speed = Math.round(car.speed * 100) / 100;
	// canvas.style.transform = "scale("+ (1 / car.speed ) * 5 +")";
	//car.x += (car.speed*car.mod) * Math.cos(Math.PI/180 * car.angle);
	//car.y += (car.speed*car.mod) * Math.sin(Math.PI/180 * car.angle);
	//
	// Routine to 'reset' the car on the screen
	// when it's gone off on either side

	/*
	if(car.x > canvas.width + 50) car.x = -50;
	if(car.x < 0 - 50) car.x = canvas.width + 50;

	// Same for Y axis;
	if(car.y > canvas.height + 100) car.y = -100;
	if(car.y < 0 - 100) car.y = canvas.height + 100;
	*/

}

function draw () {

	checkUserInput();
	
	drawHUD();
	drawCar();
	drawFloor();


	context = canvas.getContext("2d");
	context.clearRect(0, 0, canvas.width, canvas.height);

	// context.fillStyle = "rgb(200, 100, 220)";
	// context.fillRect(50, 50, 100, 100);

	context.save();
	context.translate(car.x, car.y);
	context.rotate(Math.PI/180 * car.angle);
	context.drawImage(car.image, -(car.image.width/2), -(car.image.height/2));
	context.restore();

	window.requestAnimationFrame(draw);
}

function keyup_handler (event) {
	keys[event.keyCode] = false;
	console.info(keys);
	if (event.keyCode == 87 || event.keyCode == 83) {
		car.speed -= 0.5;
		car.image.src="img/car-normal.png";
	}
}

function keypress_handler (event) {
	keys[event.keyCode] = true;


	if (event.keyCode == 87) {
		car.mod = 1;
		if (car.speed < 50) {
			car.speed += 1.4;
		}
	}

	if (event.keyCode == 83) {
		//mod = -1;
		if( car.speed > 1) {
			car.speed -= 1;
			car.image.src="img/car-brake.png";
		}
		if (car.speed <= 1 && car.speed > 0) {
			car.speed = 0;
		}

		if (car.speed ==  0) {
			car.mod = -1;
			car.speed += 0.5;
		}
	}
	if (event.keyCode == 65) {
		if(car.speed > 0) {
			car.angle -= 5;
		}
	}
	if (event.keyCode == 68) {
		if(car.speed > 0) {
			car.angle += 5;
		}
	}
}
