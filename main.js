import * as THREE from 'three';
import { Color } from "three";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';


const scene = new THREE.Scene();
//one of several cameras shipped with 3js
//attributes: Field of view (degrees) more FOV, more shown on screen, then aspect ratio hence the calc
//then "near" clipping pane, things closer than near won't be rendered
//then "far", same as near, but for if they are farther than the givne value 
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
///make this bad boy to render the app
const renderer = new THREE.WebGLRenderer();
//set the size to the size you want the app to be, usually gonna be width and height of the screen
renderer.setSize(window.innerWidth, window.innerHeight); 
//add renderer to dom
document.body.appendChild(renderer.domElement); 

const light = new THREE.DirectionalLight( 0xffffff );
/*CONTENT */

light.castShadow = true; // default false
light.position.set(5,5,5)
scene.add( light );
camera.position.z = 5; //change the location of the cube to be 0,0,5 

//load in the ship model and set its position
const loader = new GLTFLoader();
let ship; 
let asteroid; 
let screenWidthCameraPerspective_z0; 
let screenHeightCameraPerspective_z0; 
let playZoneUpperY; 
let playZoneLowerY
let playZoneUpperX;
let playZoneLowerX
let shots = []
let asteroids = []

loader.load('./assets/ship.glb', function ( gltf ) {
    ship = gltf.scene
    gltf.scene.rotation.y = Math.PI
    gltf.scene.scale.set(0.2,0.2,0.2)
    gltf.scene.position.y -= 2.5; 
	scene.add( gltf.scene );

    //this must go here as we are basing it off of ship position, so must call after
    //ship has been loaded
    initializePlayZone()

}, undefined, function ( error ) {
	console.error( error );
} );

/* HELPERS */

// const axesHelper = new THREE.AxesHelper( 7.6);
// const lightHelper = new THREE.PointLightHelper(light);
// const gridHelper = new THREE.GridHelper(200, 50)
// scene.add(lightHelper)
// scene.add( axesHelper )
// scene.add(gridHelper)


//Get width of the screen
const visibleHeightAtZDepth = ( depth, camera ) => {
    // compensate for cameras not positioned at z=0
    const cameraOffset = camera.position.z;
    if ( depth < cameraOffset ) depth -= cameraOffset;
    else depth += cameraOffset;
  
    // vertical fov in radians
    const vFOV = camera.fov * Math.PI / 180; 
  
    // Math.abs to ensure the result is always positive
    return 2 * Math.tan( vFOV / 2 ) * Math.abs( depth );
  };
  
  const visibleWidthAtZDepth = ( depth, camera ) => {
    const height = visibleHeightAtZDepth( depth, camera );
    return height * camera.aspect;
  };


function initializePlayZone(){
    screenWidthCameraPerspective_z0 = visibleWidthAtZDepth(ship.position.z, camera) 
    screenHeightCameraPerspective_z0 = visibleHeightAtZDepth(ship.position.z, camera)
    console.log(screenHeightCameraPerspective_z0, screenWidthCameraPerspective_z0)

    //the selection of 0.5 is just to make the play area slightly more restricted
    //I would like a way to do this progamatically with the size of the ship but
    //I haven't gotten to it yet. 
    playZoneUpperY = screenHeightCameraPerspective_z0 / 2 - 0.5
    playZoneUpperX = screenWidthCameraPerspective_z0 / 2 - 1
    playZoneLowerY = -(playZoneUpperY)
    playZoneLowerX = -(playZoneUpperX)
}
/* BASIC SETUP */

//The height and width of the frame as seen by the camera at the depth of the ship
//AKA play boundaries


//so we can move around with mouse
const controls = new OrbitControls(camera, renderer.domElement) 

// const shotGeometry = new THREE.SphereGeometry(0.15, 20, 20); 
const shotGeometry = new THREE.CapsuleGeometry( 0.1, 0.4, 4, 8 )
const shotMaterial = new THREE.MeshBasicMaterial({color: 0x14eb00})


/** Background */

//randomize the size of each star
let size = Math.abs(THREE.MathUtils.randFloatSpread(0.5))
const starGemoetry = new THREE.SphereGeometry(size, 20, 20); 
const starMaterial = new THREE.MeshStandardMaterial({color: 0xFFFFFF})

//generate and add stars
function generateStar(value){
    let x = THREE.MathUtils.randFloatSpread(100)
    let y = THREE.MathUtils.randFloatSpread(100)
    let z = THREE.MathUtils.randFloatSpread(100)


    const star  = new THREE.Mesh(starGemoetry, starMaterial); 
    star.position.set(x,y,z)
    scene.add(star)
}

Array(200).fill().forEach(generateStar); 

let baseRadius = 0.1
const asteroidGeometry = new THREE.SphereGeometry(baseRadius, 20, 20); 
const asteroidTexture = new THREE.TextureLoader().load("/assets/Rock050_2K_NormalGL.png")
const asteroidMaterial = new THREE.MeshStandardMaterial({normalMap: asteroidTexture})

function generateAsteroid(value){
    let x = THREE.MathUtils.randFloatSpread(playZoneUpperX * 2)
    let y = THREE.MathUtils.randFloatSpread(playZoneUpperY * 2)
    let z = -80
    
    let asteroid  = new THREE.Mesh(asteroidGeometry, asteroidMaterial); 
    asteroid.position.set(x,y,z)
    let scalingFactor = THREE.MathUtils.randFloat(0.5, 20)
    asteroid.scale.set(scalingFactor, scalingFactor, scalingFactor)
    // let asteroidBoundingBox = new THREE.Sphere(asteroid.position, baseRadius * scalingFactor)
  
    asteroids.push({"object": asteroid})

    scene.add(asteroid)
}

/* BEHAVIOUR */ 

//to actually animate we need a loop to "do something", the renderer is in the DOM,
//but until we add the loop, it isn't doing anything
//not the long term way o implement this
let asteroidTimeCount = 0  
let score = 0

//keep record of recent killed asteroids
let last_dead_asteroids = [] 
let increment; 
let speed; 
let shipHitBox; 
let stop = false 
//handle high score
let highScore
function animate(){
    // console.log("SHIP", ship)
    //adjust difficulty by score
    if(stop == false){ 
    if(ship){
        if(score < 20){
            increment = 2; 
            speed = 0.15
        }
        else if(score > 20 && score < 100){
            increment = 4; 
            speed = 0.20
        }
        else if(score >= 100 && score < 500){
            increment = 6; 
            speed = 0.35
        }
        else if(score > 500){
            increment = 10; 
            speed = 0.7
        }

        asteroidTimeCount += increment
        //create asteroids
        if(asteroidTimeCount > 400){
            generateAsteroid()
            asteroidTimeCount = 0; 
        }

        let i = 0; 
        for(i; i < asteroids.length; i++){
            asteroid = asteroids[i].object
            asteroid.position.z += speed
            let sphere = new THREE.Box3().setFromObject( asteroid )
            
            if(asteroid.position.z > 15){
                scene.remove(asteroid)
            }
        }
    
        //update shots
        i = 0;
        for(i; i < shots.length; i++){
            let currentShot = shots[i].object
            currentShot.position.z -= 1
            let box = new THREE.Box3().setFromObject( currentShot );
    
            //update hitboxes
            //check for collisions with shot
            let j = 0;
            for(j; j < asteroids.length; j++){
                let asteroid = asteroids[j].object
                if(asteroids.length > 30){
                    asteroids.splice(0, 1); 
                }
                let sphere = new THREE.Box3().setFromObject( asteroid )
            
                if(box.intersectsBox(sphere)){
                    let y = 0 ;
                    let deleted = false; 
                    //Check if asteroid has already been killed
                    for(y; y < last_dead_asteroids.length; y++){
                        if(asteroid.uuid == last_dead_asteroids[y].uuid){
                            deleted = true; 
                        }
                    }
                    console.log(last_dead_asteroids.push(asteroid))
                    if(last_dead_asteroids.length > 10){
                        last_dead_asteroids.pop()
                    }

                    scene.remove(asteroid)
                    asteroids.splice(j, 1)
                    if(deleted == false){
                        score += 1; 
                        scene.remove(currentShot)
                        
                        shots.splice(i, 1);
                        document.getElementById("score").innerHTML = "SCORE: " + score;
                       
                    }
                
                }
        
            }
            // }
            if(currentShot.position.z < -80){
                scene.remove(currentShot)
                shots.splice(i, 1);
            }
            
        }

        //update movement
        if(keyMap["ArrowLeft"] == true  && ship.position.x > playZoneLowerX){
            ship.position.x -= 0.075; 
            ship.rotation.z = -(Math.PI / 15);
        }
        if(keyMap["ArrowRight"] == true && ship.position.x < playZoneUpperX){
            ship.position.x += 0.075
            ship.rotation.z = (Math.PI / 15);
        }
        if(keyMap["ArrowUp"] == true  && ship.position.y < playZoneUpperY){
            ship.position.y += 0.075
        }
        if(keyMap["ArrowDown"] == true && ship.position.y > playZoneLowerY){
            ship.position.y -= 0.075
        }
        shipHitBox = new THREE.Box3().setFromObject(ship); 
        i = 0
        //cehck if asteroids have hit ship
        for(i; i < asteroids.length; i++){
            let asteroid = asteroids[i].object
            let sphere = new THREE.Box3().setFromObject( asteroid )
            const helper = new THREE.Box3Helper( sphere, 0xffff00 );
            const helper2 = new THREE.Box3Helper( shipHitBox, 0xffff00 );

            if(shipHitBox.intersectsBox(sphere)){
                console.log("SHIP WAS HIT")
                document.getElementById("gameOver").innerHTML = " GAME OVER";
                document.getElementById("button").style.opacity = "100%"
              
                scene.add(helper)
                scene.add(helper2)
                stop = true; 

                if(score > highScore){
                    localStorage.setItem("highScore", score)
                    document.getElementById("highScore").innerHTML = "HIGH SCORE: " + score
                }
            }
            
        }
    }
}
    controls.update() 
    requestAnimationFrame(animate);
    renderer.render(scene, camera); 
    
}   


//map used to detect multiple keystrokes 
let keyMap = {}

window.addEventListener('keyup', (event) => {
    keyMap[event.key] = false 
    ship.rotation.z = 0; 
})


window.addEventListener('keydown', (event)=> {
    keyMap[event.key] = true
    if(keyMap[" "] == true){
        if(event.key == " " && event.repeat == false){
            let shot = new THREE.Mesh(shotGeometry, shotMaterial); 
            shot.position.set(ship.position.x, ship.position.y, ship.position.z)
            shot.rotation.x = Math.PI / 2

            shots.push({"object": shot}) 
            scene.add(shot)  
        }
        
    }
})

document.getElementById("button").addEventListener("click", ()=> {
    if(stop == true){
        window.location.reload();
    }
})

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
})




if(localStorage.getItem("highScore")){
    highScore = localStorage.getItem("highScore")
}
else{
    highScore = 0; 
}
document.getElementById("highScore").innerHTML = "HIGH SCORE: " + highScore

animate(); 