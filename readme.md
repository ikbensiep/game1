
## Play the game

[play the demo](http://ikbensiep.github.io/game1)


## update 16/10/2022
Big performance update by drawing as little as possible on the `<canvas>`. Why do manually what the browser gives you for free? World layers are now html elements with moving background images. Rather than stacking 5 images on top of each other and drawing that onto a canvas and _then_ draw _all that_ every frame inside a `raf` loop was a bit silly. 
Now, more or less the only real use of the canvas is to check pixel color data. See **Game engine** below.

## Goals
- build a top-down racing game because it's fun
- just add multiplayer1!
- add online leaderboard with laptimes

## Features
- single player free practice (no ai either)
- 4 car skins
- 7 real-world racetracks **edit** todo: <del>remove Russia</del>
- fuel consumption 
- refueling during pit stops
- lap times including fastest lap
- smoke particles when braking / off track
-  yellow flag when going off track
- clouds in the sky scrolling across the world point (dat realism)
- _almost_ real-world advertisers

# Screenshots

![image](https://user-images.githubusercontent.com/5741190/195207132-de52900f-3649-43a9-9239-cecdeca7a96d.png)

![image](https://user-images.githubusercontent.com/5741190/195207409-0ab857cf-d4c0-49e6-8d2d-cfe00a264d3d.png)

![image](https://user-images.githubusercontent.com/5741190/195207502-d768e218-1457-49d3-8523-fbd3b007dc31.png)

![image](https://user-images.githubusercontent.com/5741190/195207638-99e673f1-75fb-4576-8fcd-ae6703c33c26.png)


## Installation
- clone this repo
- run it on a webserver (ie, run `python3 -m http.server` in the checkout folder and open [http://localhost:8000](http://localhost:8000) in a browser)

## Game engine
This is based off of a simple tutorial about moving a character on a plane. 
I took that and inverted some logic to make the world move around the player. 
Next step was to create a system that can determine wether a player is on track or off track. 

Every track has a hidden `#path` layer, with each color representing a type of ground: racetrack, grass / gravel / paddock and pit area. 
The player is always in the center of the screen, so by analyzing the color of the center pixel directly underneath, we can know where in the world the player is and make decisions based on that (ie, slow down, show warning, rumble..). 

The tracks are layered svg files (starting point is the svg file on the racetrack's Wikipedia page). 
Using css in the svg, all layers are hidden, and using the `:target` selector. a layer may become visible by loading the image like: `url("track.svg#world")` or `<img src="track.svg#track">.

One layer, `#path`, will contain a bright-colored version of the track as well as other surfaces such as pit lane, pit box area, all in their own distinct color.
Other layers, `#world`, `#track` and `#elevated` will all contain artwork that is layered on top or below the `#path` layer and do not affect the car behavior in any way.
All the world layers are updated in the game loop to receive new location data to which their background image will move every frame.

## Contribute 
Want to contribute? 
- development: javascript 
- design: decent knowledge of [Inkscape](https://www.inkscape.org) and a little bit of knowledge of its xml/css editor(s)
- checkout [the current issues](https://github.com/ikbensiep/game1/issues) or [project board](https://github.com/ikbensiep/game1/projects/1)

