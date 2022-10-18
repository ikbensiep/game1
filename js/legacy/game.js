var canvas = document.getElementById('game');
var context = canvas.getContext('2d');
var carimage = document.getElementById('car');

var width = 1024, height = 768;

var keys = [];

var player = {
	x: 100,
	y: 600,
	width: 100,
	height: 200,
	speed: 5,
	angle: 30
}

window.addEventListener('keydown', function(e) {
	keys[e.keyCode] = true;
}, false)

window.addEventListener('keyup', function(e) {
	delete keys[e.keyCode];
}, false)

var directions = {
	up: 38,
	down: 40,
	left: 37,
	right: 39
}

function game() {
	update();
	render();
}

function update() {

	if(keys[38]) {
		player.y -= player.speed;
		canvas.style.backgroundPositionY = player.y * -1 + "px";
	}
	if(keys[40]) {
		player.y += player.speed;
		canvas.style.backgroundPositionY = player.y * -1 + "px";
	}
	if(keys[37]) player.x -= player.speed;
	if(keys[39]) player.x += player.speed;

	if(player.x < 0) player.x = 0;
	if(player.x >= width - player.width) player.x = width - player.width;
	if(player.y < 0) player.y = 0;
	if(player.y >= height - player.height) player.y = height - player.height;

}

function render() {

	context.clearRect(0,0,1024,768);
	context.fillStyle = "black";
	//context.fillRect(player.x, player.y, player.width, player.height);
	context.drawImage(carimage, player.x, player.y, 100, 200);
}
