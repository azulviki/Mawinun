// --- VARIABLES GLOBALES ---
let escena = "INTRO";
let arboles = [];
let gotas = [];
let cantidadArboles = 20;

// Control de la Nube
let nubeX;
let nubeY;
let radioNube;

// MECÁNICA DE TIEMPO
let tiempoLimite = 80;
let tiempoRestante;
let frameInicial;
let framesPausados = 0; // frames "congelados" mientras el celular está en vertical

// VARIABLES DE CONTROL (Compartidas)
let manoAbierta = false;
let manoAbiertaAnterior = false;
let tiempoInicioEscena = 0; // momento en que arrancó la escena actual (INTRO / VICTORIA / DERROTA)
let últimoTouchTime = 0;

// --- VARIABLES DE DETECCIÓN DE "AGITAR LA MANO" ---
// Se usa en INTRO, VICTORIA y DERROTA para avanzar de pantalla.
// No reemplaza a "manoAbierta" (que sigue sirviendo para regar en el juego).
let nivelAgitacion = 0; // de 0 a 1, se llena agitando y se vacía si dejás de agitar
const AGITACION_INCREMENTO = 0.045; // qué tan rápido se llena por frame agitando
const AGITACION_DECAIMIENTO = 0.02; // qué tan rápido se vacía por frame sin agitar
const AGITACION_UMBRAL_MOVIMIENTO = 0.35; // cuánto movimiento (en 500ms) cuenta como "agitar"
const AGITACION_TIEMPO_MINIMO = 1200; // ms mínimos antes de poder avanzar (para poder leer el texto)
let historialManoX = []; // últimas posiciones crudas de la muñeca, con timestamp

// --- VARIABLES MEDIA PIPE (Cámara) ---
let video;
let hands;

// --- VARIABLES WEBSOCKET / OSC (Comentadas por si acaso) ---
// let ws; // [WS] Descomentar si volvés a WebSockets
// let celularManoX = 0; // [WS]

// ==========================================
// LIENZO LÓGICO FIJO 16:9 (responsive)
// ==========================================
// El juego siempre se dibuja como si la pantalla midiera LW x LH.
// Ese "cuadro" se escala y centra dentro de la ventana real, con
// barras negras si el dispositivo no es exactamente 16:9.
const LW = 960;
const LH = 540;
let escalaJuego = 1;
let offsetX = 0;
let offsetY = 0;
let enLandscape = true;
let estabaPausadoPorRotacion = false;

// --- VARIABLES PARA LAS IMÁGENES y ANIMACIÓN ---
let imgNubeGris;
let imgNubeAgua;
let imgArbolApagado;
let imgGota;
let animacionFuego = [];
let cantidadFotogramas = 4; // Cantidad de frames de fuego

// --- CONTROLES DE TECLADO ---
let velocidadNubeTeclado = 8;

// ==========================================
// CARGA DE MATERIAL GRÁFICO
// ==========================================
function preload() {
  imgNubeGris = loadImage('assets/nube_gris.png');
  imgNubeAgua = loadImage('assets/nube_agua.png');
  imgArbolApagado = loadImage('assets/arbol_apagado.png');
  imgGota = loadImage('assets/gota.png');

  for (let i = 0; i < cantidadFotogramas; i++) {
    animacionFuego[i] = loadImage('assets/fuego' + i + '.png');
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  // Nube en coordenadas LÓGICAS (960x540), no en pixeles reales de pantalla
  radioNube = 120; // cubre bien el ancho, dejando un margen chico para moverse
  nubeX = LW / 2;
  nubeY = LH * 0.26; // un poco más abajo, para dejarle más aire arriba
  frameInicial = frameCount;
  tiempoInicioEscena = millis();

  calcularEscala();

  // ==========================================
  // MEDIA PIPE (cámara) — igual que la versión original
  // ==========================================
  video = createCapture({
    audio: false,
    video: {
      facingMode: "user",
      width: 640,
      height: 480
    }
  });
  video.hide();

  hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  hands.onResults(onHandResults);

  const camera = new Camera(video.elt, {
    onFrame: async () => {
      await hands.send({ image: video.elt });
    },
    width: 640,
    height: 480
  });
  camera.start();

  // ==========================================
  // OPCIÓN B: WEBSOCKET / OSC (Comentado)
  // ==========================================
  // conectarWS();

  crearArboles();
}

// ==========================================
// CÁLCULO DE ESCALA / LETTERBOX 16:9
// ==========================================
function calcularEscala() {
  enLandscape = windowWidth >= windowHeight;
  escalaJuego = min(windowWidth / LW, windowHeight / LH);
  offsetX = (windowWidth - LW * escalaJuego) / 2;
  offsetY = (windowHeight - LH * escalaJuego) / 2;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calcularEscala();
}

// ==========================================
// CREAR ÁRBOLES (en coordenadas lógicas)
// ==========================================
function crearArboles() {
  arboles = [];
  for (let i = 0; i < cantidadArboles; i++) {
    let x = random(40, LW - 40);
    let y = random(LH * 0.68, LH - 60);
    let nuevoArbol = new Arbol(x, y);
    nuevoArbol.estado = "FUEGO";
    arboles.push(nuevoArbol);
  }
}

// ==========================================
// FUNCIONES DE CONEXIÓN WEBSOCKET (Guardadas)
// ==========================================
/* // [WS] Descomentar todo este bloque si volvés a OSC
function conectarWS() {
  ws = new WebSocket("ws://localhost:3333");

  ws.onmessage = function(event) {
    let unpaquetito = JSON.parse(event.data);
    oscReceived(unpaquetito.address, unpaquetito.value);
  };

  ws.onopen = function() {
    console.log("Conectado al bridge OSC");
  };

  ws.onclose = function() {
    console.log("Se cortó la conexión, reintentando en 2s...");
    setTimeout(conectarWS, 2000);
  };

  ws.onerror = function(err) {
    console.log("Error de WebSocket:", err);
    ws.close();
  };
}

function oscReceived(address, value) {
  if (address === "/oscControl/la_nube/x") {
    celularManoX = value[0];
    nubeX = map(celularManoX, 0, 1, 0, width);
  }

  if (address === "/oscControl/la_nube/agua") {
    let estadoBoton = value[0];
    últimoTouchTime = millis();
    manoAbierta = (estadoBoton === 1);
  }
}
*/

function draw() {
  background(0); // barras negras del letterbox

  // CONTROL INMEDIATO DE AUSENCIA DE MANO (Watchdog) — corre siempre,
  // aunque esté en vertical, para que no quede "pegado" al volver.
  if (millis() - últimoTouchTime > 100) {
    manoAbierta = false;
  }

  // Si el celular está en vertical: pausar y pedir que lo giren
  if (!enLandscape) {
    if (!estabaPausadoPorRotacion) estabaPausadoPorRotacion = true;
    framesPausados++;
    dibujarCartelRotar();
    manoAbiertaAnterior = manoAbierta;
    return;
  } else if (estabaPausadoPorRotacion) {
    estabaPausadoPorRotacion = false;
  }

  actualizarControlesTeclado();
  actualizarAgitacion();

  // A partir de acá, todo se dibuja en el lienzo lógico 960x540,
  // escalado y centrado dentro de la ventana real.
  push();
  translate(offsetX, offsetY);
  scale(escalaJuego);

  if (escena === "INTRO") {
    pantallaIntro();
  }
  else if (escena === "JUEGO") {
    let incendios = 0;
    for (let i = 0; i < arboles.length; i++) {
      if (arboles[i].estado === "FUEGO") incendios++;
    }

    if (tiempoRestante <= 0) {
      cambiarEscena("DERROTA");
    } else if (incendios === 0) {
      cambiarEscena("VICTORIA");
    }

    actualizarJuego();
  }
  else if (escena === "VICTORIA") {
    pantallaFinal("¡BOSQUE A SALVO!", color(0, 255, 100), color(0));
    intentarReiniciar();
  }
  else if (escena === "DERROTA") {
    pantallaFinal("EL FUEGO CONSUMIÓ EL BOSQUE", color(255, 50, 50), color(255));
    intentarReiniciar();
  }

  pop();

  manoAbiertaAnterior = manoAbierta;
}

function dibujarCartelRotar() {
  push();
  translate(width / 2, height / 2);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(width > 600 ? 26 : 18);
  text("📱 Girá el celular", 0, -10);
  textSize(width > 600 ? 16 : 12);
  text("Usalo en horizontal para jugar", 0, 20);
  pop();
}

// --- CALLBACK RESULTADOS CÁMARA (MediaPipe) ---
function onHandResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    let puntosMano = results.multiHandLandmarks[0];

    let xMuñeca = 1 - puntosMano[0].x;
    nubeX = lerp(nubeX, map(xMuñeca, 0.2, 0.8, radioNube, LW - radioNube), 0.2);

    // Guardamos la posición cruda (sin lerp) para poder medir agitación real.
    historialManoX.push({ x: xMuñeca, t: millis() });
    if (historialManoX.length > 90) historialManoX.shift();

    let pulgar = puntosMano[4];
    let indice = puntosMano[8];
    let d = dist(pulgar.x, pulgar.y, indice.x, indice.y);

    if (d > 0.08) {
      manoAbierta = true;
    } else {
      manoAbierta = false;
    }

    últimoTouchTime = millis();
  }
}

function actualizarControlesTeclado() {
  if (keyIsDown(LEFT_ARROW))  nubeX -= velocidadNubeTeclado;
  if (keyIsDown(RIGHT_ARROW)) nubeX += velocidadNubeTeclado;
  nubeX = constrain(nubeX, radioNube, LW - radioNube);

  if (keyIsDown(DOWN_ARROW)) {
    manoAbierta = true;
    últimoTouchTime = millis();
  }
}

// ==========================================
// DETECCIÓN DE "AGITAR LA MANO"
// Se usa para avanzar en INTRO / VICTORIA / DERROTA.
// Requiere movimiento real de la mano (no simplemente tenerla abierta),
// así el mensaje de cada pantalla se alcanza a leer.
// ==========================================
function actualizarAgitacion() {
  let ahora = millis();

  // Nos quedamos solo con los puntos de los últimos 500ms
  historialManoX = historialManoX.filter(p => ahora - p.t < 500);

  let movimientoTotal = 0;
  for (let i = 1; i < historialManoX.length; i++) {
    movimientoTotal += abs(historialManoX[i].x - historialManoX[i - 1].x);
  }

  let agitandoPorCamara = movimientoTotal > AGITACION_UMBRAL_MOVIMIENTO;
  // Se mantiene la tecla DOWN_ARROW tal cual funcionaba (abre la mano);
  // acá además la reutilizamos para poder probar la agitación sin cámara.
  let agitandoPorTeclado = keyIsDown(DOWN_ARROW);

  if (agitandoPorCamara || agitandoPorTeclado) {
    nivelAgitacion = min(1, nivelAgitacion + AGITACION_INCREMENTO);
  } else {
    nivelAgitacion = max(0, nivelAgitacion - AGITACION_DECAIMIENTO);
  }
}

function agitacionCompleta() {
  return (millis() - tiempoInicioEscena > AGITACION_TIEMPO_MINIMO) && nivelAgitacion >= 1;
}

function dibujarBarraAgitacion(x, y, w, h) {
  push();
  noStroke();
  fill(255, 255, 255, 60);
  rect(x, y, w, h, h / 2);
  fill(80, 220, 120);
  rect(x, y, w * nivelAgitacion, h, h / 2);
  pop();
}

function cambiarEscena(nuevaEscena) {
  escena = nuevaEscena;
  tiempoInicioEscena = millis();
  nivelAgitacion = 0;
  historialManoX = [];
}

function intentarReiniciar() {
  if (agitacionCompleta()) {
    reiniciarJuego();
  }
}

// ==========================================
// PANTALLA DE INTRODUCCIÓN
// ==========================================
function pantallaIntro() {
  background(15, 25, 35);
  textAlign(CENTER, CENTER);

  fill(255);
  textStyle(BOLD);
  textSize(42);
  text("🔥 SALVÁ EL BOSQUE 🔥", LW / 2, LH * 0.16);

  textStyle(NORMAL);
  textSize(20);
  text("Movés la nube con la mano para llevarla arriba de los árboles en llamas.", LW / 2, LH * 0.34);
  text("Abrí la mano (separá el pulgar del índice) para que llueva y apagar el fuego.", LW / 2, LH * 0.34 + 32);
  text("Apagá todos los árboles antes de que se acabe el tiempo.", LW / 2, LH * 0.34 + 64);

  textSize(24);
  fill(255, 210, 0);
  text("¡Agitá la mano MUY FUERTE para empezar!", LW / 2, LH * 0.74);

  dibujarBarraAgitacion(LW / 2 - 150, LH * 0.82, 300, 22);

  if (agitacionCompleta()) {
    reiniciarJuego();
  }
}

function actualizarJuego() {
  let segundosTranscurridos = floor((frameCount - frameInicial - framesPausados) / 60);
  tiempoRestante = tiempoLimite - segundosTranscurridos;

  if (manoAbierta) {
    if (frameCount % 3 === 0) {
      gotas.push(new Gota(nubeX + random(-radioNube / 2, radioNube / 2), nubeY + 20));
    }
  }

  // DIBUJAR NUBE (Proporcional)
  push();
  imageMode(CENTER);
  let anchoNubeObjetivo = radioNube * 2;

  let imagenActual = manoAbierta ? imgNubeAgua : imgNubeGris;

  let altoNubeProporcional = (anchoNubeObjetivo * imagenActual.height) / imagenActual.width;

  image(imagenActual, nubeX, nubeY, anchoNubeObjetivo, altoNubeProporcional);
  pop();

  // ACTUALIZAR GOTAS Y ÁRBOLES
  for (let i = gotas.length - 1; i >= 0; i--) {
    gotas[i].actualizar();
    gotas[i].mostrar();
    for (let j = 0; j < arboles.length; j++) {
      gotas[i].chequearColision(arboles[j]);
    }
    if (gotas[i].fueraDePantalla()) gotas.splice(i, 1);
  }

  // DIBUJAR ÁRBOLES (Ordenados de atrás hacia adelante)
  arboles.sort((a, b) => a.y - b.y);

  let incendiosActivos = 0;
  for (let i = 0; i < arboles.length; i++) {
    arboles[i].mostrar();
    if (arboles[i].estado === "FUEGO") incendiosActivos++;
  }

  fill(255);
  textAlign(LEFT, TOP);
  textSize(16);
  text("Tiempo: " + max(0, tiempoRestante) + "s", 20, 16);
  text("Fuegos activos: " + incendiosActivos, 20, 38);
}

function pantallaFinal(mensaje, colorFondo, colorTexto) {
  background(colorFondo);
  textAlign(CENTER, CENTER);
  fill(colorTexto);

  textSize(48);
  textStyle(BOLD);
  text(mensaje, LW / 2, LH / 2 - 50);

  textStyle(NORMAL);
  textSize(22);
  text("Agitá la mano MUY FUERTE para volver a jugar", LW / 2, LH / 2 + 20);

  dibujarBarraAgitacion(LW / 2 - 150, LH / 2 + 55, 300, 20);
}

function reiniciarJuego() {
  escena = "JUEGO";
  gotas = [];
  manoAbierta = false;
  manoAbiertaAnterior = false;
  frameInicial = frameCount;
  framesPausados = 0;
  tiempoRestante = tiempoLimite;

  tiempoInicioEscena = millis();
  nivelAgitacion = 0;
  historialManoX = [];

  crearArboles();
}

// ==========================================
// CLASES ÁRBOL (CON STOP MOTION RESPONSIVO) Y GOTA
// ==========================================
class Arbol {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.tam = random(75, 90);
    this.estado = "FUEGO";
    this.saludFuego = 100;
    this.desfaseAnimacion = floor(random(100));
  }

  mostrar() {
    push();
    translate(this.x, this.y);
    imageMode(CENTER);

    if (this.estado === "FUEGO") {
      let indiceFotograma = floor((frameCount + this.desfaseAnimacion) / 6) % cantidadFotogramas;
      image(animacionFuego[indiceFotograma], 0, -this.tam / 2, this.tam * 0.7, this.tam);
    } else {
      image(imgArbolApagado, 0, -this.tam / 2, this.tam * 0.7, this.tam);
    }
    pop();
  }

  recibirAgua() {
    if (this.estado === "FUEGO") {
      this.saludFuego -= 8;
      if (this.saludFuego <= 0) this.estado = "APAGADO";
    }
  }
}

class Gota {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.velY = random(7, 11);
    this.tam = random(8, 14);
  }
  actualizar() { this.y += this.velY; }

  mostrar() {
    push();
    imageMode(CENTER);
    image(imgGota, this.x, this.y, this.tam, this.tam * 1.5);
    pop();
  }

  chequearColision(arbol) {
    if (arbol.estado === "FUEGO") {
      let d = dist(this.x, this.y, arbol.x, arbol.y - arbol.tam / 2);
      if (d < arbol.tam / 2) {
        arbol.recibirAgua();
        this.y = LH + 100;
      }
    }
  }
  fueraDePantalla() { return this.y > LH; }
}