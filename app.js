/*
This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version. This program is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
details. You should have received a copy of the GNU General Public License along
with this program. If not, see <https://www.gnu.org/licenses/>.
*/

var canvas;
var gl;

// const degToRad = 0.0174533;
// const radToDeg = 57.2957795;

const saveFileVersionID =
  2172535;  // Uint32 id to check if save file is compatible

var saveFileName = '';

var sim_res_x;
var sim_res_y;

var frameNum = 0;
var lastFrameNum = 0;

var IterNum = 0;

var viewXpos = 0.0;
var viewYpos = 0.0;
var viewZoom = 0.8;

// selection coordinates
var selectionStartX = -1;
var selectionStartY = -1;
var selectionEndX = -1;
var selectionEndY = -1;

// selection coordinates for use in shaders
var selectionMinX = -1;
var selectionMinY = -1;
var selectionMaxX = -1;
var selectionMaxY = -1;

var selection = false;  // bool if there is currently a selection

// actions:
const NONE = Symbol('NONE');
const DELETE = Symbol('DELETE');
const COPY = Symbol('COPY');
const CUT = Symbol('CUT');
const PASTE = Symbol('PASTE');

var ACTION = NONE;  // one of the above actions that is executed once



// var controls = {paused: false, displayMode: 1};

class TexBuf {  // combines texture, framebuffer and resolution
  texture;
  frameBuf;
  width;
  height;

  constructor(height, width) {
    this.width = width;
    this.height = height;

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA8I, width, height, 0, gl.RGBA_INTEGER, gl.BYTE,
      null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.frameBuf = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuf);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
  }
}

function download(filename, data) {
  var url = URL.createObjectURL(data);
  const element = document.createElement('a');
  element.setAttribute('href', url);
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

// Universal Functions

function mod(a, b) {
  // proper modulo to handle negative numbers
  return ((a % b) + b) % b;
}

function map_range(value, low1, high1, low2, high2) {
  return low2 + ((high2 - low2) * (value - low1)) / (high1 - low1);
}

function max(num1, num2) {
  if (num1 > num2)
    return num1;
  else
    return num2;
}

function min(num1, num2) {
  if (num1 < num2)
    return num1;
  else
    return num2;
}

async function loadData() {
  let file = document.getElementById('fileInput').files[0];

  if (file != null) {
    let versionBlob =
      file.slice(0, 4);  // extract first 4 bytes containing version id
    let versionBuf = await versionBlob.arrayBuffer();
    let version = new Uint32Array(versionBuf)[0];  // convert to Uint32

    if (version == saveFileVersionID) {
      // check version id, only proceed if file has the right version id
      let fileArrBuf = await file.slice(4);
      /*.arrayBuffer();*/  // slice from behind version id to the end of the
      // file
      // let fileUint8Arr = new Uint8Array(fileArrBuf); // convert to Uint8Array
      // for pako let decompressed = window.pako.inflate(fileUint8Arr); //
      // uncompress let dataBlob = new Blob([decompressed]); // turn into blob

      dataBlob = fileArrBuf;  // not compressed

      let sliceStart = 0;
      let sliceEnd = 4;

      let resBlob = dataBlob.slice(
        sliceStart, sliceEnd);  // extract first 4 bytes containing resolution
      let resBuf = await resBlob.arrayBuffer();
      resArray = new Uint16Array(resBuf);
      sim_res_x = resArray[0];
      sim_res_y = resArray[1];

      saveFileName = file.name;

      if (saveFileName.includes('.')) {
        saveFileName =
          saveFileName.split('.').slice(0, -1).join('.');  // remove extension
      }

      console.log('loading file: ' + saveFileName);
      console.log('File versionID: ' + version);
      console.log('sim_res_x: ' + sim_res_x);
      console.log('sim_res_y: ' + sim_res_y);

      sliceStart = sliceEnd;
      sliceEnd += sim_res_x * sim_res_y * 4 * 1;
      let texBlob = dataBlob.slice(sliceStart, sliceEnd);
      let texBuf = await texBlob.arrayBuffer();
      let texI8 = new Int8Array(texBuf);

      sliceStart = sliceEnd;
      let settingsArrayBlob = dataBlob.slice(sliceStart);  // until end of file

      controlsFromSaveFile = await settingsArrayBlob.text();

      mainScript(texI8);
    } else {
      // wrong id
      alert('Incompatible file!');
      document.getElementById('fileInput').value = '';  // clear file
    }
  } else {
    // no file, so create new simulation
    sim_res_x = parseInt(document.getElementById('simResSelX').value);
    sim_res_y = parseInt(document.getElementById('simResSelY').value);
    mainScript(null);
  }
}

async function mainScript(initialTex) {
  const beforeUnloadListener = (event) => {
    event.preventDefault();
    return event.returnValue = 'Are you sure you want to exit?';
  };

  canvas = document.getElementById('mainCanvas');

  var contextAttributes = {
    alpha: false,
    desynchronized: false,
    antialias: true,
    depth: false,
    failIfMajorPerformanceCaveat: false,
    powerPreference: 'high-performance',
    premultipliedAlpha: true,  // true
    preserveDrawingBuffer: false,
    stencil: false,
  };
  gl = canvas.getContext('webgl2', contextAttributes);
  // console.log(gl.getContextAttributes());

  if (!gl) {
    alert('Your browser does not support WebGL2, Download a new browser.');
    throw ' Error: Your browser does not support WebGL2';
  }

  document.addEventListener(
    'contextmenu',
    event => event.preventDefault());  // disable right clicking menu

  var element = document.getElementById('IntroScreen');
  element.parentNode.removeChild(element);  // remove introscreen div



  ///////////////////////////////////////////////////////////// GUI DEV



  const guiControls = {

  };  // object where all controllable variables are stored

  gui = new Gui(guiControls, 350, 500);
  gui.addSlider('iterPerFrame', 1, 50);
  gui.addSlider('clockSpeed', 1, 100);
  // gui.addSlider('example', 1, 10, 0.1);

  gui.addSelect('displayMode', 'Signal', 'All');

  gui.addSelect(
    'tool', 'select', 'signal', 'wire', 'bridge', 'input', 'or', 'nor', 'and',
    'nand', 'xor', 'xnor', 'sum', 'carry', 'mem', 'clk', 'v2h', 'v2hn', 'h2v', 'h2vn');

  gui.addToggle('paused');

  // guiControls.iterPerFrame = 10;

  // guiControls.example = 0.8;

  // guiControls.tool = 'signal';


  ////////////////////////////////////////////////////// END of GUI DEV



  const sim_aspect = sim_res_x / sim_res_y;

  var canvas_aspect;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';
  canvas_aspect = canvas.width / canvas.height;

  var mouseXinSim, mouseYinSim;

  window.addEventListener('resize', function () {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas_aspect = canvas.width / canvas.height;
  });

  function binStr(val) {
    return '0b' + val.toString(2).padStart(8, '0');
  }

  function hexStr(val) {
    return '0x' + val.toString(16).padStart(2, '0');
  }

  function logSample() {
    // mouse position in sim coordinates
    var simXpos = Math.floor(mouseXinSim * sim_res_x);
    var simYpos = Math.floor(mouseYinSim * sim_res_y);

    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuff_0);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);  // basetexture
    var baseTextureValues = new Int8Array(4);
    gl.readPixels(
      simXpos, simYpos, 1, 1, gl.RGBA_INTEGER, gl.BYTE,
      baseTextureValues);  // read single cell

    console.log('');
    console.log('');
    console.log('Sample at:      X: ' + simXpos, '  Y: ' + simYpos);
    console.log(
      '0 CELTYPE:', baseTextureValues[0], '\t', hexStr(baseTextureValues[0]),
      '\t', binStr(baseTextureValues[0]));
    console.log('1 SIG TOP', baseTextureValues[1]);
    console.log('2 SIG BOT', baseTextureValues[2]);
  }

  var middleMousePressed = false;
  var leftMousePressed = false;
  var prevMouseX = 0;
  var prevMouseY = 0;
  var mouseX = 0;
  var mouseY = 0;
  var ctrlPressed = false;
  var bPressed = false;
  var leftPressed = false;
  var downPressed = false;
  var rightPressed = false;
  var upPressed = false;
  var plusPressed = false;
  var minusPressed = false;

  function changeViewZoom(change) {
    viewZoom *= 1.0 + change;

    if (viewZoom > 20.0) {
      viewZoom = 20.0;
      return false;
    } else if (viewZoom < 0.5) {
      viewZoom = 0.5;
      return false;
    } else {
      return true;
    }
  }

  function zoomAtMousePos(delta) {
    if (changeViewZoom(delta)) {
      // zoom center at mouse position
      var mousePositionZoomCorrectionX =
        (((mouseX - canvas.width / 2 + viewXpos) * delta) / viewZoom /
          canvas.width) *
        2.0;
      var mousePositionZoomCorrectionY =
        ((((mouseY - canvas.height / 2 + viewYpos) * delta) / viewZoom /
          canvas.height) *
          2.0) /
        canvas_aspect;
      viewXpos -= mousePositionZoomCorrectionX;
      viewYpos += mousePositionZoomCorrectionY;
    }
  }

  // EVENT LISTENERS

  window.addEventListener('wheel', function (event) {
    var delta = 0.1;
    if (event.deltaY > 0) delta *= -1;
    if (typeof lastWheel == 'undefined') lastWheel = 0;  // init static variable
    const now = new Date().getTime();

    if (bPressed) {
      guiControls.brushSize *= 1.0 + delta * 1.0;
      if (guiControls.brushSize < 1)
        guiControls.brushSize = 1;
      else if (guiControls.brushSize > 200)
        guiControls.brushSize = 200;
    } else {
      if (now - lastWheel > 20) {
        // change zoom
        lastWheel = now;

        zoomAtMousePos(delta);
      }
    }
  });

  window.addEventListener('mousemove', function (event) {
    var rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;

    //  console.log(event.movementX);

    if (middleMousePressed) {
      // drag view position
      viewXpos += ((mouseX - prevMouseX) / viewZoom / canvas.width) * 2.0;
      viewYpos -= ((mouseY - prevMouseY) / viewZoom / canvas.width) * 2.0;

      prevMouseX = mouseX;
      prevMouseY = mouseY;
      // console.log(viewXpos, viewYpos, viewZoom);
    }
  });

  canvas.addEventListener('mousedown', function (event) {
    // console.log('mousedown tool:' + guiControls.tool);
    if (event.button == 0) {
      leftMousePressed = true;
      if (guiControls.tool == 'select') {
        selectionStartX = mouseXinSim * sim_res_x;
        selectionStartY = mouseYinSim * sim_res_y;
        selection = true;
      }
    } else if (event.button == 1) {
      // middle mouse button
      middleMousePressed = true;
      prevMouseX = mouseX;
      prevMouseY = mouseY;
    } else if (event.button == 2) { // right mouse
      selection = false;
    }
  });

  window.addEventListener('mouseup', function (event) {
    if (event.button == 0) {
      leftMousePressed = false;
    } else if (event.button == 1) {
      // middle mouse button
      middleMousePressed = false;
    }
  });


  canvas.addEventListener('touchstart', function (event) {
    event.preventDefault();

    if (guiControls.tool == 'select') {
      selection = false;
    }
  }, { passive: false });

  canvas.addEventListener('touchend', function (event) {
    event.preventDefault();
    if (event.touches.length == 0) { // all fingers released
      leftMousePressed = false;
      //   }else if(event.touches.length == 1){
      wasTwoFingerTouchBefore = false;
      previousTouches = null;
    }
  }, { passive: false });

  var wasTwoFingerTouchBefore = false;

  var previousTouches;
  canvas.addEventListener('touchmove', function (event) {
    event.preventDefault();

    if (event.touches.length == 1) { // single finger

      //console.log(event.touches[0]);
      if (!wasTwoFingerTouchBefore) {
        leftMousePressed = true;// treat just like holding left mouse button
        mouseX = event.touches[0].clientX;
        mouseY = event.touches[0].clientY;
      }
    } else {
      leftMousePressed = false;

      if (event.touches.length == 2 && previousTouches && previousTouches.length == 2) // 2 finger zoom
      {
        mouseX = (event.touches[0].clientX + event.touches[1].clientX) / 2.0; // position inbetween two fingers
        mouseY = (event.touches[0].clientY + event.touches[1].clientY) / 2.0;

        let prevXsep = previousTouches[0].clientX - previousTouches[1].clientX;
        let prevYsep = previousTouches[0].clientY - previousTouches[1].clientY;
        let prevSep = Math.sqrt(prevXsep * prevXsep + prevYsep * prevYsep);

        let curXsep = event.touches[0].clientX - event.touches[1].clientX;
        let curYsep = event.touches[0].clientY - event.touches[1].clientY;
        let curSep = Math.sqrt(curXsep * curXsep + curYsep * curYsep);

        zoomAtMousePos((curSep / prevSep) - 1.0);

        if (wasTwoFingerTouchBefore) {
          viewXpos += ((mouseX - prevMouseX) / viewZoom / canvas.width) * 2.0;
          viewYpos -= ((mouseY - prevMouseY) / viewZoom / canvas.width) * 2.0;
        }
        wasTwoFingerTouchBefore = true;
        prevMouseX = mouseX;
        prevMouseY = mouseY;
      }
    }

    previousTouches = event.touches;
  }, { passive: false });

  var lastBpressTime;

  document.addEventListener('keydown', (event) => {
    if (event.keyCode == 17 || event.keyCode == 224) {
      // ctrl or cmd on mac
      ctrlPressed = true;
    } else if (ctrlPressed && event.key === 's') {
      // Prevent the Save dialog to open
      event.preventDefault();
      // Place your code here
      console.log('CTRL + S');
    } else if (event.code == "Space") {
      // space bar
      console.log("SPACE");
      guiControls.paused = !guiControls.paused;
    }
    else if (event.code == 'KeyD') {
      // download
      prepareDownload();
    } else if (event.code == 'KeyB') {
      // B: scrolling to change brush size
      bPressed = true;
      if (new Date().getTime() - lastBpressTime < 300)
        controls.wholeWidth = !controls.wholeWidth;  // toggle whole width brush

      // lastBpressTime = new Date().getTime();
    } /*else if (event.code == "KeyV") {
            // V: reset view to full simulation area
            viewXpos = 0.0;
            viewYpos = 0.0; // match bottem to bottem of screen
            viewZoom = 0.8;
    }*/
    else if (event.code == 'KeyG') {
      // G
      controls.showGraph = !controls.showGraph;
      hideOrShowGraph();
    } else if (event.code == 'KeyS') {
      // S: log sample at mouse location
      logSample();
      // number keys for displaymodes
    } else if (event.key == 1) {
      guiControls.displayMode = 'Signal';
    } else if (event.key == 2) {
      guiControls.displayMode = 'All';
    } else if (event.key == 3) {
      //  guiControls.displayMode = 3;
    } else if (event.key == 'ArrowLeft') {
      leftPressed = true;  // <
    } else if (event.key == 'ArrowUp') {
      upPressed = true;  // ^
    } else if (event.key == 'ArrowRight') {
      rightPressed = true;  // >
    } else if (event.key == 'ArrowDown') {
      downPressed = true;  // v
    } else if (event.key == '=' || event.key == '+') {
      plusPressed = true;  // +
    } else if (event.key == '-') {
      minusPressed = true;  // -
    } else if (event.code == 'Backquote') {
      guiControls.tool = 'select';
    } else if (event.code == 'KeyQ') {
      guiControls.tool = 'signal';
    } else if (event.code == 'KeyW') {
      guiControls.tool = 'wire';
    } else if (event.code == 'KeyE') {
      guiControls.tool = 'bridge';
    } else if (event.code == 'KeyR') {
      guiControls.tool = 'input';
    } else if (event.code == 'KeyT') {
      guiControls.tool = 'or';
    } else if (event.code == 'KeyY') {
      guiControls.tool = 'nor';
    } else if (event.code == 'KeyU') {
      guiControls.tool = 'and';
    } else if (event.code == 'KeyI') {
      guiControls.tool = 'nand';
    } else if (event.code == 'KeyO') {
      guiControls.tool = 'xor';
    } else if (event.code == 'KeyP') {
      guiControls.tool = 'xnor';
    } else if (event.code == 'KeyM') {
      guiControls.tool = 'mem';
    } else if (event.key == 'PageUp') {
      guiControls.iterPerFrame += 1;
    } else if (event.code == 'PageDown') {
      guiControls.iterPerFrame -= 1;
    } else if (event.code == 'Delete') {
      ACTION = DELETE;
    } else if (event.code == 'KeyZ' && ctrlPressed) {
      // console.log('undo');
    } else if (event.code == 'KeyX' && ctrlPressed) {
      console.log('cut');
      ACTION = CUT;
    } else if (event.code == 'KeyC' && ctrlPressed) {
      ACTION = COPY;
    } else if (event.code == 'KeyV' && ctrlPressed) {
      ACTION = PASTE;
    }
  });

  document.addEventListener('keyup', (event) => {
    if (event.keyCode == 17 || event.keyCode == 224) {
      ctrlPressed = false;
    } else if (event.code == 'KeyB') {
      bPressed = false;
      lastBpressTime = new Date().getTime();
    } else if (event.key == 'ArrowLeft') {
      leftPressed = false;  // <
    } else if (event.key == 'ArrowUp') {
      upPressed = false;  // ^
    } else if (event.key == 'ArrowRight') {
      rightPressed = false;  // >
    } else if (event.key == 'ArrowDown') {
      downPressed = false;  // v
    } else if (event.key == '=' || event.key == '+') {
      plusPressed = false;  // +
    } else if (event.key == '-') {
      minusPressed = false;  // -
    }
  });

  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);

  // load shaders
  var commonSource = loadSourceFile('shaders/common.glsl');
  var commonDisplaySource = loadSourceFile('shaders/commonDisplay.glsl');

  const simVertexShader = await loadShader('simShader.vert');
  const dispVertexShader = await loadShader('dispShader.vert');

  const setupShader = await loadShader('setupShader.frag');
  const logicShader = await loadShader('logicShader.frag');
  const userInputShader = await loadShader('userInputShader.frag');
  const copyShader = await loadShader('copyShader.frag');

  const displayShader1 = await loadShader('displayShader1.frag');
  const displayShader2 = await loadShader('displayShader2.frag');
  const displayShader3 = await loadShader('displayShader3.frag');

  // create programs
  const setupProgram = createProgram(simVertexShader, setupShader);
  const logicProgram = createProgram(simVertexShader, logicShader);
  const userInputProgram = createProgram(simVertexShader, userInputShader);
  const copyProgram = createProgram(simVertexShader, copyShader);

  const displayProgram1 = createProgram(dispVertexShader, displayShader1);
  const displayProgram2 = createProgram(dispVertexShader, displayShader2);
  const displayProgram3 = createProgram(dispVertexShader, displayShader3);

  // // quad that fills the screen, so fragment shader is run for every pixel //
  // X, Y,  U, V  (x4)

  const quadVertices = [
    // X, Y,  U, V
    -1.0,  // 1
    -1.0,
    0.0,
    0.0,
    1.0,  // 2
    -1.0,
    sim_res_x,
    0.0,
    -1.0,  // 3
    1.0,
    0,
    sim_res_y,
    1.0,  // 4
    1.0,
    sim_res_x,
    sim_res_y,
  ];

  gl.activeTexture(gl.TEXTURE0);

  var VertexBufferObject = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, VertexBufferObject);
  gl.bufferData(
    gl.ARRAY_BUFFER, new Float32Array(quadVertices), gl.STATIC_DRAW);
  var positionAttribLocation = gl.getAttribLocation(
    setupProgram,
    'vertPosition');  // 0 these positions are the same for every program,
  // since they all use the same vertex shader
  var texCoordAttribLocation = gl.getAttribLocation(
    setupProgram,
    'vertTexCoord');  // 1

  gl.vertexAttribPointer(
    positionAttribLocation,  // Attribute location
    2,                       // Number of elements per attribute
    gl.FLOAT,                // Type of elements
    gl.FALSE,
    4 * Float32Array.BYTES_PER_ELEMENT,  // Size of an individual vertex
    0  // Offset from the beginning of a single vertex to this attribute
  );
  gl.vertexAttribPointer(
    texCoordAttribLocation,  // Attribute location
    2,                       // Number of elements per attribute
    gl.FLOAT,                // Type of elements
    gl.FALSE,
    4 * Float32Array.BYTES_PER_ELEMENT,  // Size of an individual vertex
    2 * Float32Array.BYTES_PER_ELEMENT   // Offset from the beginning of a
    // single vertex to this attribute
  );

  gl.enableVertexAttribArray(positionAttribLocation);
  gl.enableVertexAttribArray(texCoordAttribLocation);

  // CREATE TEXTURES

  const texture_0 = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture_0);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA8I, sim_res_x, sim_res_y, 0, gl.RGBA_INTEGER,
    gl.BYTE, initialTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const texture_1 = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture_1);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA8I, sim_res_x, sim_res_y, 0, gl.RGBA_INTEGER,
    gl.BYTE, initialTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // CREATE FRAMEBUFFERS
  const frameBuff_0 = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuff_0);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture_0, 0);

  const frameBuff_1 = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuff_1);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture_1, 0);

  var copyTexbuf = new TexBuf(sim_res_x, sim_res_y);
  copyTexbuf.width = 0;   // indicate that it's
  copyTexbuf.height = 0;  // empty

  // load textures
  var imgElement = document.getElementById('ASCII_img');
  // console.log(imgElement.width);
  const ASCII_Texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, ASCII_Texture);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, imgElement.width, imgElement.height, 0,
    gl.RGBA, gl.UNSIGNED_BYTE, imgElement);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); //
  // REPEAT default, so no need to set gl.texParameteri(gl.TEXTURE_2D,
  // gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  var texelSizeX = 1.0 / sim_res_x;
  var texelSizeY = 1.0 / sim_res_y;

  // SET CONSTANT UNIFORMS
  gl.useProgram(setupProgram);
  gl.uniform2f(
    gl.getUniformLocation(setupProgram, 'texelSize'), texelSizeX, texelSizeY);
  gl.uniform2i(
    gl.getUniformLocation(setupProgram, 'resolution'), sim_res_x, sim_res_y);

  gl.useProgram(logicProgram);
  gl.uniform2f(
    gl.getUniformLocation(logicProgram, 'texelSize'), texelSizeX, texelSizeY);
  gl.uniform2i(
    gl.getUniformLocation(logicProgram, 'resolution'), sim_res_x, sim_res_y);

  gl.useProgram(userInputProgram);
  gl.uniform2f(
    gl.getUniformLocation(userInputProgram, 'texelSize'), texelSizeX,
    texelSizeY);
  gl.uniform2i(
    gl.getUniformLocation(userInputProgram, 'resolution'), sim_res_x,
    sim_res_y);
  gl.uniform1i(gl.getUniformLocation(userInputProgram, 'tex'), 0);
  gl.uniform1i(gl.getUniformLocation(userInputProgram, 'copyTex'), 1);

  gl.useProgram(displayProgram1);
  gl.uniform2f(
    gl.getUniformLocation(displayProgram1, 'texelSize'), texelSizeX,
    texelSizeY);
  gl.uniform2i(
    gl.getUniformLocation(displayProgram1, 'resolution'), sim_res_x,
    sim_res_y);
  gl.uniform1i(gl.getUniformLocation(displayProgram1, 'tex'), 0);
  gl.uniform1i(gl.getUniformLocation(displayProgram1, 'ASCCI_tex'), 1);

  gl.useProgram(displayProgram2);
  gl.uniform2f(
    gl.getUniformLocation(displayProgram2, 'texelSize'), texelSizeX,
    texelSizeY);
  gl.uniform2i(
    gl.getUniformLocation(displayProgram2, 'resolution'), sim_res_x,
    sim_res_y);
  gl.uniform1i(gl.getUniformLocation(displayProgram2, 'tex'), 0);
  gl.uniform1i(gl.getUniformLocation(displayProgram2, 'ASCCI_tex'), 1);

  // if no save file was loaded
  // Use setup shader to set initial conditions
  if (initialTex == null) {
    console.log('Running Setup Program');
    gl.viewport(0, 0, sim_res_x, sim_res_y);
    gl.useProgram(setupProgram);
    // Render to both framebuffers
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuff_0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuff_1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function setTex2d(texUnit, tex) {
    gl.activeTexture(texUnit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  // setInterval(calcFps, 1000); // log fps

  requestAnimationFrame(draw);  // 60 fps  or other screen refresh rate
  // setInterval(draw, 1000); // reduced fps
  // setInterval(draw, 50); // reduced fps

  function draw() {
    //	console.log("Draw");
    if (leftPressed) {
      viewXpos += 0.01 / viewZoom;  // <
    }
    if (upPressed) {
      viewYpos -= 0.01 / viewZoom;  // ^
    }
    if (rightPressed) {
      viewXpos -= 0.01 / viewZoom;  // >
    }
    if (downPressed) {
      viewYpos += 0.01 / viewZoom;  // v
    }
    if (plusPressed) {
      changeViewZoom(0.02);  // +
    }
    if (minusPressed) {
      changeViewZoom(-0.02);  // -
    }

    var leftEdge = canvas.width / 2.0 - (canvas.width * viewZoom) / 2.0;
    var rightEdge = canvas.width / 2.0 + (canvas.width * viewZoom) / 2.0;
    mouseXinSim =
      map_range(mouseX, leftEdge, rightEdge, 0.0, 1.0) - viewXpos / 2.0;

    var topEdge =
      canvas.height / 2.0 - ((canvas.width / sim_aspect) * viewZoom) / 2.0;
    var bottemEdge =
      canvas.height / 2.0 + ((canvas.width / sim_aspect) * viewZoom) / 2.0;
    mouseYinSim = map_range(mouseY, bottemEdge, topEdge, 0.0, 1.0) -
      (viewYpos / 2.0) * sim_aspect;
    // set selection area:
    if (selection && leftMousePressed && guiControls.tool == 'select') {
      selectionEndX = Math.floor(mouseXinSim * sim_res_x);
      selectionEndY = Math.floor(mouseYinSim * sim_res_y);

      selectionMinX = Math.min(selectionStartX, selectionEndX);
      selectionMaxX = Math.max(selectionStartX, selectionEndX);
      selectionMinY = Math.min(selectionStartY, selectionEndY);
      selectionMaxY = Math.max(selectionStartY, selectionEndY);
    }

    if (!guiControls.paused) {  // simulation loop:
      gl.viewport(0, 0, sim_res_x, sim_res_y);
      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      // IterPerFrame

      var inputType = 0, reverseInput = 0;

      if (ACTION != NONE) {  // Special action
        let nextACTION = NONE;
        switch (ACTION) {
          case DELETE:
            inputType = 100;
            break;
          case CUT:
            nextACTION = DELETE;  // Will perform delete operation after copy
          case COPY:
            console.log('copy');
            gl.useProgram(copyProgram);
            gl.uniform4i(
              gl.getUniformLocation(copyProgram, 'selection'), selectionMinX,
              selectionMinY, selectionMaxX, selectionMaxY);
            setTex2d(gl.TEXTURE0, texture_0);
            gl.bindFramebuffer(gl.FRAMEBUFFER, copyTexbuf.frameBuf);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            copyTexbuf.width = Math.abs(selectionEndX - selectionStartX);
            copyTexbuf.height = Math.abs(selectionEndY - selectionStartY);
            break;
          case PASTE:
            if (copyTexbuf.width > 0) {
              console.log('PASTE');
              inputType = 101;  // paste
            }
            break;
        }
        ACTION = nextACTION;
      } else if (leftMousePressed || selection) {  // mouse input

        switch (guiControls.tool) {
          case 'select':
            inputType = 0;  // does nothing
            break;
          case 'signal':
            inputType = 1000;
            break;
          case 'wire':
            inputType = 1;
            break;
          case 'bridge':
            inputType = 2;
            break;
          case 'input':
            inputType = 3;
            break;
          case 'h2v':
            inputType = 4;
            break;
          case 'v2h':
            inputType = 5;
            break;
          case 'h2vn':
            inputType = 6;
            break;
          case 'v2hn':
            inputType = 7;
            break;

          case 'clk':
            inputType = 9;
            break;
          case 'or':
            inputType = 10;
            break;
          case 'nor':
            inputType = 11;
            break;
          case 'and':
            inputType = 12;
            break;
          case 'nand':
            inputType = 13;
            break;
          case 'xor':
            inputType = 14;
            break;
          case 'xnor':
            inputType = 15;
            break;
          case 'sum':
            inputType = 16;
            break;
          case 'carry':
            inputType = 17;
            break;
          case 'mem':
            inputType = 20;
            break;
          default:
            throw 'invalid input type!'
        }

        if (ctrlPressed) {
          reverseInput = 1;
        }
      }


      gl.useProgram(userInputProgram);
      gl.uniform2i(
        gl.getUniformLocation(userInputProgram, 'pasteSize'),
        copyTexbuf.width, copyTexbuf.height);
      gl.uniform4i(
        gl.getUniformLocation(userInputProgram, 'userInputValues'),
        mouseXinSim * sim_res_x, mouseYinSim * sim_res_y, inputType,
        reverseInput);
      if (selection) {
        gl.uniform4i(
          gl.getUniformLocation(userInputProgram, 'selection'), selectionMinX,
          selectionMinY, selectionMaxX, selectionMaxY);
      } else {
        gl.uniform4i(
          gl.getUniformLocation(userInputProgram, 'selection'), -1, -1, -1,
          -1);
      }
      // console.log(selectionStartX, selectionStartY,mouseXinSim,mouseYinSim)

      for (var i = 0; i < guiControls.iterPerFrame; i++) {
        gl.useProgram(logicProgram);
        setTex2d(gl.TEXTURE0, texture_0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuff_1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.useProgram(userInputProgram);
        setTex2d(gl.TEXTURE0, texture_1);
        setTex2d(gl.TEXTURE1, copyTexbuf.texture);
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuff_0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        IterNum++;
        gl.useProgram(logicProgram);
        gl.uniform1i(gl.getUniformLocation(logicProgram, 'IterNum'), IterNum);
      }
    }  // end of simulation part

    // render to canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);  // null is canvas
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.15, 0.15, 0.15, 1.0);  // background color
    gl.clear(gl.COLOR_BUFFER_BIT);

    setTex2d(gl.TEXTURE0, texture_0);
    setTex2d(gl.TEXTURE1, ASCII_Texture);

    let currentDisplayProgram = displayProgram1;

    switch (guiControls.displayMode) {
      case 'All':
        currentDisplayProgram = displayProgram1;
        break;
      case 'Signal':
        currentDisplayProgram = displayProgram2;
        break;
      case 3:

        break;
    }

    gl.useProgram(currentDisplayProgram);
    if (selection) {
      gl.uniform4i(
        gl.getUniformLocation(currentDisplayProgram, 'selection'),
        selectionMinX, selectionMinY, selectionMaxX, selectionMaxY);
    } else {
      gl.uniform4i(
        gl.getUniformLocation(currentDisplayProgram, 'selection'), -1, -1, -1,
        -1);
    }

    gl.uniform2f(
      gl.getUniformLocation(currentDisplayProgram, 'aspectRatios'),
      sim_aspect, canvas_aspect);
    gl.uniform3f(
      gl.getUniformLocation(currentDisplayProgram, 'view'), viewXpos,
      viewYpos, viewZoom);


    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);  // draw to canvas

    frameNum++;
    requestAnimationFrame(draw);
  }  // end of draw()

  //////////////////////////////////////////////////////// functions:

  async function prepareDownload() {
    var newFileName =
      prompt('Please enter a file name. Can not include \'.\'', saveFileName);

    if (newFileName != null) {
      if (newFileName != '' && !newFileName.includes('.')) {
        saveFileName = newFileName;

        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuff_0);
        // gl.readBuffer(gl.COLOR_ATTACHMENT0);
        let textureValues = new Int8Array(4 * sim_res_x * sim_res_y);
        gl.readPixels(
          0, 0, sim_res_x, sim_res_y, gl.RGBA_INTEGER, gl.BYTE,
          textureValues);

        let strcontrols = JSON.stringify(guiControls);

        let saveDataArray = [
          Uint32Array.of(saveFileVersionID),
          Uint16Array.of(sim_res_x),
          Uint16Array.of(sim_res_y),
          textureValues,
          strcontrols,
        ];
        let blob =
          new Blob(saveDataArray);  // combine everything into a single blob
        download(saveFileName + '.logicsim', blob);
        /*
        let arrBuff = await blob.arrayBuffer(); // turn into array
        let arr = new Uint8Array(arrBuff);
        let compressed = window.pako.deflate(arr); // compress
        let compressedBlob = new Blob(
                [Uint32Array.of(saveFileVersionID), compressed],
                { type: "application/x-binary" }
        ); // turn back into blob and add version id in front
        download(saveFileName + ".weathersim4", compressedBlob);
        */
      } else {
        alert('You didn\'t enter a valid file name!');
      }
    }
  }

  function createProgram(
    vertexShader, fragmentShader, transform_feedback_varyings) {
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    if (transform_feedback_varyings != null)
      gl.transformFeedbackVaryings(
        program, transform_feedback_varyings, gl.INTERLEAVED_ATTRIBS);

    gl.linkProgram(program);
    gl.validateProgram(program);
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return program;  // linked succesfully
    } else {
      throw 'ERROR: ' + gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
    }
  }

  function loadSourceFile(fileName) {
    var request = new XMLHttpRequest();
    request.open('GET', fileName, false);
    request.send(null);
    if (request.status === 200)
      return request.responseText;
    else if (request.status === 404)
      throw 'File not found: ' + fileName;
    else
      throw 'File loading error' + request.status;
  }

  async function loadShader(nameIn) {
    const re = /(?:\.([^.]+))?$/;

    let extension = re.exec(nameIn)[1];  // extract file extension

    let shaderType;
    let type;

    if (extension == 'vert') {
      type = 'vertex';
      shaderType = gl.VERTEX_SHADER;
    } else if (extension == 'frag') {
      type = 'fragment';
      shaderType = gl.FRAGMENT_SHADER;
    } else {
      throw 'Invalid shadertype: ' + extension;
    }

    let filename = 'shaders/' + type + '/' + nameIn;

    var shaderSource = loadSourceFile(filename);
    if (shaderSource) {
      if (shaderSource.includes('#include "common.glsl"')) {
        shaderSource =
          shaderSource.replace('#include "common.glsl"', commonSource);
      }

      if (shaderSource.includes('#include "commonDisplay.glsl"')) {
        shaderSource = shaderSource.replace(
          '#include "commonDisplay.glsl"', commonDisplaySource);
      }

      const shader = gl.createShader(shaderType);
      gl.shaderSource(shader, shaderSource);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        // Compile error
        throw filename + ' COMPILATION ' + gl.getShaderInfoLog(shader);
      }
      return new Promise(async (resolve) => {
        resolve(shader);
      });
    }
  }

  function isPageHidden() {
    return (
      document.hidden || document.msHidden || document.webkitHidden ||
      document.mozHidden);
  }

  /*
  function calcFps() {
          if (!isPageHidden()) {
                  var FPS = frameNum - lastFrameNum;
                  lastFrameNum = frameNum;

                  const fpsTarget = 60;

                  if (controls.auto_IterPerFrame && !controls.paused) {
                          console.log(
                                  FPS +
                                          " FPS   " +
                                          controls.IterPerFrame +
                                          " Iterations / frame      " +
                                          FPS * controls.IterPerFrame +
                                          " Iterations / second"
                          );
                          adjIterPerFrame((FPS / fpsTarget - 1.0) * 5.0); //
  example: ((30 / 60)-1.0) = -0.5

                          if (FPS == fpsTarget) adjIterPerFrame(1);
                  }
          }
  }
  */
}  // end of mainscript