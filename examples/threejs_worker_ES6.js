function isMobile () {
  return /Android|mobile|iPad|iPhone/i.test(navigator.userAgent);
}

var setMatrix = function (matrix, value) {
  var array = [];
  for (var key in value) {
    array[key] = value[key];
  }
  if (typeof matrix.elements.set === "function") {
    matrix.elements.set(array);
  } else {
    matrix.elements = [].slice.call(array);
  }
};

function start(markerUrl, video, input_width, input_height, render_update, track_update) {
  var vw, vh;
  var sw, sh;
  var pscale, sscale;
  var w, h;
  var pw, ph;
  var ox, oy;
  var worker;
  var camera_para = './../examples/Data/camera_para.dat'

  var canvas_process = document.createElement('canvas');
  var context_process = canvas_process.getContext('2d');
  var targetCanvas = document.querySelector("#canvas");

  var renderer = new THREE.WebGLRenderer({ canvas: targetCanvas, alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);

  var scene = new THREE.Scene();

  var camera = new THREE.Camera();
  camera.matrixAutoUpdate = false;

  scene.add(camera);
//--------------------------------------------------------------

/*
// 创建video对象
let v = document.createElement('video');
v.src = "./../examples/Data/CPBG-Video.mp4"; // 设置视频地址
v.autoplay = "autoplay"; //要设置播放
// video对象作为VideoTexture参数创建纹理对象
var texture = new THREE.VideoTexture(v)
var geometry = new THREE.PlaneGeometry(108, 71); //矩形平面
var material = new THREE.MeshPhongMaterial({
  map: texture, // 设置纹理贴图
}); //材质对象Material
var rendererTexture = new THREE.Mesh(geometry, material); //网格模型对象Mesh
//scene.add(rendererTexture); //网格模型添加到场景中
*/

  var sphere = new THREE.Mesh(
    new THREE.BoxGeometry(10, 10, 10),
    new THREE.MeshNormalMaterial()
  );

  var root = new THREE.Object3D();
  scene.add(root);

  var marker;

  sphere.material.flatShading;
  sphere.scale.set(1, 1, 1);

  root.matrixAutoUpdate = false;
  root.add(sphere);
  //root.add(rendererTexture);
  
  var load = function () {
    vw = input_width;
    vh = input_height;

    pscale = 320 / Math.max(vw, vh / 3 * 4);
    sscale = isMobile() ? window.outerWidth / input_width : 1;

    sw = vw * sscale;
    sh = vh * sscale;

    w = vw * pscale;
    h = vh * pscale;
    pw = Math.max(w, h / 3 * 4);
    ph = Math.max(h, w / 4 * 3);
    ox = (pw - w) / 2;
    oy = (ph - h) / 2;
    canvas_process.style.clientWidth = pw + "px";
    canvas_process.style.clientHeight = ph + "px";
    canvas_process.width = pw;
    canvas_process.height = ph;

    renderer.setSize(sw, sh);

    worker = new Worker('../js/artoolkitNFT_ES6.worker.js')

    worker.postMessage({ type: "load", pw: pw, ph: ph, camera_para: camera_para, marker: markerUrl });

    worker.onmessage = function (ev) {
      var msg = ev.data;
      switch (msg.type) {
        case "loaded": {
          var proj = JSON.parse(msg.proj);
          var ratioW = pw / w;
          var ratioH = ph / h;
          proj[0] *= ratioW;
          proj[4] *= ratioW;
          proj[8] *= ratioW;
          proj[12] *= ratioW;
          proj[1] *= ratioH;
          proj[5] *= ratioH;
          proj[9] *= ratioH;
          proj[13] *= ratioH;
          setMatrix(camera.projectionMatrix, proj);
          break;
        }
        case "endLoading": {
          if (msg.end == true) {
            // removing loader page if present
            var loader = document.getElementById('loading');
            if (loader) {
              loader.querySelector('.loading-text').innerText = 'Start the tracking!';
              setTimeout(function(){
                loader.parentElement.removeChild(loader);
              }, 2000);
            }
          }
          break;
        }
        case 'found': {
          found(msg);
          break;
        }
        case 'not found': {
          found(null);
          break;
        }
        case 'markerInfos': {
          marker = msg.marker;
        }
      }
      track_update();
      process();
    };
  };

  var world;

  var found = function (msg) {
    if (!msg) {
      world = null;
    } else {
      world = JSON.parse(msg.matrixGL_RH);
    }
  };

  var lasttime = Date.now();
  var time = 0;

  var draw = function () {
    render_update();
    var now = Date.now();
    var dt = now - lasttime;
    time += dt;
    lasttime = now;

    if (!world) {
      sphere.visible = false;
      //rendererTexture.visible = false;
    } else {
      sphere.visible = true;
      sphere.position.y = ((marker.height / marker.dpi) * 2.54 * 10) / 2.0;
      sphere.position.x = ((marker.width / marker.dpi) * 2.54 * 10) / 2.0;
      //rendererTexture.visible = true;
      //rendererTexture.position.y = ((marker.height / marker.dpi) * 2.54 * 10) / 2.0;
      //rendererTexture.position.x = ((marker.width / marker.dpi) * 2.54 * 10) / 2.0;
      // set matrix of 'root' by detected 'world' matrix
      setMatrix(root.matrix, world);
    }
    renderer.render(scene, camera);
  };

  var process = function () {
    context_process.fillStyle = 'black';
    context_process.fillRect(0, 0, pw, ph);
    context_process.drawImage(video, 0, 0, vw, vh, ox, oy, w, h);

    var imageData = context_process.getImageData(0, 0, pw, ph);
    worker.postMessage({ type: 'process', imagedata: imageData }, [imageData.data.buffer]);
  }
  var tick = function () {
    draw();
    requestAnimationFrame(tick);
  };

  load();
  tick();
  process();
}
