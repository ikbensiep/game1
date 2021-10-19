var Sprite = function (options) {
	for(item in options) {

		if (item==='images') {
			// images may be a string or an image object. If it's a string,
			// we're automatically turning it into an image object.
			this.images = options.images.map(function(item) {
				if (typeof item =='string') {
					
					if(options.width && options.height) {
						
						var img = new Image(options.width, options.height);
						img.src = item;

					} else {
						
						var img = new Image();
						img.src = item;
					}
					return img;
				} else {
					return item;
				}
			});
		} else {
			this[item] = options[item];
		}
	}

}

Sprite.prototype = {
	name: null,
	images: [],
	x: null,
	y: null,
	angle: null,
	state: 0,
	width: null,
	height: null,
	opacity: 1,

	drawSprite: function (ctx) {

		ctx.save();
		// ctx.translate(this.x, this.y);
		ctx.setTransform(1,0,0,1,this.x,this.y)

		ctx.rotate(Math.PI/180 * this.angle);


		ctx.globalAlpha = this.opacity;
		if (this.width && this.height) {
			ctx.drawImage(
				this.images[this.state],
				-(this.images[this.state].width/2),
				-(this.images[this.state].height/2),
				this.width,
				this.height
			);
		} else {
			ctx.drawImage(
				this.images[this.state],
				-(Math.floor(this.images[this.state].width/2)),
				-(Math.floor(this.images[this.state].height/2))
			);
		}
		//ctx.restore();
		ctx.setTransform(1,0,0,1,0,0);
	}
}