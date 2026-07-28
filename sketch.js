// --- VARIABLES GLOBALES ---
let escena = "INTRO";
let arboles = [];
let gotas = [];
let cantidadArboles = 20;

// Control de la Nube
let nubeX;
let nubeY;
let radioNube;

//Las briznas del pasto
let briznasPasto = [];

// MECÁNICA DE TIEMPO
let tiempoLimite = 85;
let tiempoRestante;
let tiempoInicioJuego = 0;
let framesPausados = 0;
let tiempoInicioPausa = 0;      
let tiempoAcumuladoPausa = 0;   

// VARIABLES DE CONTROL (Compartidas)
let manoAbierta = false;
let manoAbiertaAnterior = false;
let tiempoInicioEscena = 0;
let últimoTouchTime = 0;

// --- VARIABLES DE DETECCIÓN DE "2 MANOS ABIERTAS" ---
let nivelJuntarManos = 0; // de 0 a 1
const JUNTAR_INCREMENTO = 0.08; 
const JUNTAR_DECAIMIENTO = 0.04; 

const TIEMPO_MINIMO_PANTALLA = 1000; // 1 segundo de resguardo tras cambio de escena

let cantidadManosDetectadas = 0;
let estadoDosManosAbiertas = false;

// --- CONTROL DE PANTALLA COMPLETA Y WAKE LOCK ---
let wakeLock = null;

// --- VARIABLES MEDIA PIPE (Cámara) ---
let video;
let hands;

// --- VARIABLES WEBSOCKET / OSC  ---
// let ws;
// let celularManoX = 0;

// ==========================================
// LIENZO LÓGICO FIJO 16:9 (responsive)
// ==========================================
const LW = 960;
const LH = 540;
let escalaJuego = 1;
let offsetX = 0;
let offsetY = 0;
let enLandscape = true;
let estabaPausadoPorRotacion = false;

// --- VARIABLES PARA LAS IMÁGENES y ANIMACIÓN ---
let imgPortada;
let imgVictoria; 
let imgDerrota;  
let imgNubeGris;
let imgNubeAgua;
let imgArbolApagado;
let imgGota;
let animacionFuego = [];
let cantidadFotogramas = 4;

// --- CONTROLES DE TECLADO ---
let velocidadNubeTeclado = 8;

// ==========================================
// CARGA DE MATERIAL GRÁFICO
// ==========================================
function preload() {
  imgPortada = loadImage('assets/portada.png');
  imgVictoria = loadImage('assets/victoria.png'); 
  imgDerrota = loadImage('assets/derrota.png');   
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

  radioNube = 120;
  nubeX = LW / 2;
  nubeY = LH * 0.26;
  frameInicial = frameCount;
  tiempoInicioEscena = millis();

  calcularEscala();

  // Solicitar que la pantalla no se apague al iniciar
  solicitarWakeLock();

  // Reactivar Wake Lock si la pestaña vuelve a tener foco
  document.addEventListener("visibilitychange", async () => {
    if (wakeLock !== null && document.visibilityState === "visible") {
      await solicitarWakeLock();
    }

    generarPasto();
  });

   // ==========================================
  // MEDIA PIPE (Cámara optimizada para móviles)
  // ==========================================
  video = createCapture({
    audio: false,
    video: {
      facingMode: "user",
      width: { ideal: 320 },  
      height: { ideal: 240 }
    }
  });

  // Fuerza atributos requeridos por iOS/Android para reproducir video sin congelar la pantalla
  if (video.elt) {
    video.elt.setAttribute('playsinline', '');
    video.elt.setAttribute('muted', '');
  }
  video.hide();

  hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 0,       
    minDetectionConfidence: 0.3, 
    minTrackingConfidence: 0.3
  });

  hands.onResults(onHandResults);

  const camera = new Camera(video.elt, {
    onFrame: async () => {
      if (video.elt && video.elt.readyState === 4) { // Asegura que el video esté listo
        await hands.send({ image: video.elt });
      }
    },
    width: 320,
    height: 240
  });
  camera.start();
  // ==========================================
  // WEBSOCKET / OSC (Comentado)
  // ==========================================
  // conectarWS();

  crearArboles();
}

  // Función para generar las posiciones del pasto
  function generarPasto() {
  briznasPasto = [];
  let cantidadBriznas = 600; 
  
  for (let i = 0; i < cantidadBriznas; i++) {
    briznasPasto.push({
      x: random(0, LW),
      y: random(LH * 0.66, LH - 10), // Solo dentro de la zona del suelo
      largo: random(1, 3),
      inclinacion: random(-3, 3), // Pequeño ángulo aleatorio
      tono: color(random(45, 65), random(75, 95), random(50, 70)) // Variantes de verde
    });
  }
}

// ==========================================
// FUNCIONES DE PANTALLA COMPLETA Y WAKE LOCK
// ==========================================
async function solicitarWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log("Pantalla bloqueada para evitar que se apague");
    }
  } catch (err) {
    console.log("No se pudo activar Screen Wake Lock:", err.message);
  }
}

function touchStarted() {
  activarPantallaCompleta();
  solicitarWakeLock();
  return false; 
}

function mousePressed() {
  activarPantallaCompleta();
  solicitarWakeLock();
}

function activarPantallaCompleta() {
  let elem = document.documentElement;
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(err => console.log(err));
    } else if (elem.webkitRequestFullscreen) { /* Safari / iOS */
      elem.webkitRequestFullscreen();
    }
  }
}

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
// CONEXIÓN Y EVENTOS WEBSOCKET / OSC (Comentados)
// ==========================================
/*
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

// ==========================================
// FONDO ILUSTRADO: DEGRADÉ + HORIZONTE CON COLINAS
// ==========================================
function dibujarFondoHorizonte() {
  push();
  noStroke();

  // 1. DEGRADÉ DE CIELO (Azul cálido arriba -> Dorado suave al horizonte)
  let cArriba = color(40, 80, 140);   // Azul atardecer/bosque
  let cHorizonte = color(230, 100, 100); // Tono cálido de horizonte

  for (let y = 0; y < LH * 0.65; y += 4) {
    let inter = map(y, 0, LH * 0.65, 0, 1);
    let c = lerpColor(cArriba, cHorizonte, inter);
    fill(c);
    rect(0, y, LW, 5);
  }

  // 2. MONTAÑAS/COLINAS LEJANAS (Capa 1 - Silueta suave suave)
  fill(80, 95, 90, 100);
  beginShape();
  vertex(0, LH * 0.65);
  bezierVertex(LW * 0.2, LH * 0.52, LW * 0.4, LH * 0.62, LW * 0.6, LH * 0.55);
  bezierVertex(LW * 0.75, LH * 0.50, LW * 0.88, LH * 0.62, LW, LH * 0.58);
  vertex(LW, LH);
  vertex(0, LH);
  endShape(CLOSE);

  // 3. COLINAS INTERMEDIAS (Capa 2 - Más verde/bosque apagado)
  fill(45, 75, 65);
  beginShape();
  vertex(0, LH * 0.62);
  bezierVertex(LW * 0.25, LH * 0.68, LW * 0.45, LH * 0.58, LW * 0.7, LH * 0.64);
  bezierVertex(LW * 0.85, LH * 0.67, LW * 0.95, LH * 0.60, LW, LH * 0.63);
  vertex(LW, LH);
  vertex(0, LH);
  endShape(CLOSE);

  // 4. SUELO / PRADERA (Donde están los árboles)
  fill(35, 55, 45);
  rect(0, LH * 0.65, LW, LH * 0.35);

  // Línea sutil de luz sobre la pradera
  stroke(180, 190, 120, 100);
  strokeWeight(2);
  line(0, LH * 0.65, LW, LH * 0.65);

  // ==========================================
  // 5. TEXTURA DE BASTONCITOS DE PASTO
  // ==========================================
  strokeCap(ROUND);
  strokeWeight(1); // Grosor del bastoncito
  
  for (let i = 0; i < briznasPasto.length; i++) {
    let b = briznasPasto[i];
    stroke(b.tono);
    // Dibujamos un pequeño bastoncito vertical/inclinado
    line(b.x, b.y, b.x + b.inclinacion, b.y - b.largo);
  }

  pop();
}

function draw() {
  background(0);

  // Reseteo si la cámara pierde señal por un tiempo
  if (millis() - últimoTouchTime > 500) {
    manoAbierta = false;
    estadoDosManosAbiertas = false;
  }

  if (!enLandscape) {
    if (!estabaPausadoPorRotacion) {
      estabaPausadoPorRotacion = true;
      tiempoInicioPausa = millis(); // Empezamos a contar la pausa
    }
    dibujarCartelRotar();
    return;
  } else if (estabaPausadoPorRotacion) {
    estabaPausadoPorRotacion = false;
    tiempoAcumuladoPausa += (millis() - tiempoInicioPausa); // Sumamos el tiempo que estuvo pausado
  }

  actualizarControlesTeclado();

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
    pantallaFinal(imgVictoria);
    intentarReiniciar();
  }
  else if (escena === "DERROTA") {
    pantallaFinal(imgDerrota);
    intentarReiniciar();
  }

  // --- HUD DE ESTADO (MediaPipe) ---
  //fill(255, 255, 0);
  //textAlign(RIGHT, TOP);
  //textSize(13);
  //text("Manos en cámara: " + cantidadManosDetectadas + " / 2", LW - 20, 15);
  //text("¿2 Manos levantadas?: " + (estadoDosManosAbiertas ? "SÍ ✅" : "NO ❌"), LW - 20, 32);

  pop();
}

function dibujarCartelRotar() {
  push();
  translate(width / 2, height / 2);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(22);
  text("📱 Girá el celular a horizontal", 0, 0);
  pop();
}

function evaluarManoAbierta(landmarks) {
  let muñeca = landmarks[0];
  let puntaIndice = landmarks[8];
  let baseIndice = landmarks[5];
  
  let dPunta = dist(muñeca.x, muñeca.y, puntaIndice.x, puntaIndice.y);
  let dBase = dist(muñeca.x, muñeca.y, baseIndice.x, baseIndice.y);

  return dPunta > (dBase * 1.02);
}

function onHandResults(results) {
  let activarBarra = false;
  
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    cantidadManosDetectadas = results.multiHandLandmarks.length;

    // Control de nube mediante primera mano
    let mano1 = results.multiHandLandmarks[0];
    let xMuñeca1 = 1 - mano1[0].x;
    
    nubeX = lerp(nubeX, map(xMuñeca1, 0.15, 0.85, radioNube, LW - radioNube), 0.25);
    let mano1Abierta = evaluarManoAbierta(mano1);
    manoAbierta = mano1Abierta;

    // Detección de 2 manos levantadas
    if (cantidadManosDetectadas >= 2) {
      let mano2 = results.multiHandLandmarks[1];
      let mano2Abierta = evaluarManoAbierta(mano2);

      if (mano1Abierta && mano2Abierta) {
        activarBarra = true;
      }
    }

    últimoTouchTime = millis();
  } else {
    cantidadManosDetectadas = 0;
    manoAbierta = false;
    activarBarra = false;
  }

  estadoDosManosAbiertas = activarBarra;

  // Carga de barra para transiciones (Intro / Victoria / Derrota)
  let juntandoPorTeclado = keyIsDown(DOWN_ARROW);
  let tiempoSuficiente = (millis() - tiempoInicioEscena > TIEMPO_MINIMO_PANTALLA);

  if ((activarBarra || juntandoPorTeclado) && tiempoSuficiente) {
    nivelJuntarManos = min(1, nivelJuntarManos + JUNTAR_INCREMENTO);
  } else {
    nivelJuntarManos = max(0, nivelJuntarManos - JUNTAR_DECAIMIENTO);
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

function accionCompletada() {
  return (millis() - tiempoInicioEscena > TIEMPO_MINIMO_PANTALLA) && nivelJuntarManos >= 0.95;
}

function dibujarBarraProgreso(x, y, w, h) {
  push();
  noStroke();
  fill(255, 255, 255, 50);
  rect(x, y, w, h, h / 2);
  fill(80, 220, 120);
  rect(x, y, w * nivelJuntarManos, h, h / 2);
  pop();
}

function cambiarEscena(nuevaEscena) {
  escena = nuevaEscena;
  tiempoInicioEscena = millis();
  nivelJuntarManos = 0;
  estadoDosManosAbiertas = false;
  manoAbierta = false;
}

function intentarReiniciar() {
  if (accionCompletada()) {
    reiniciarJuego();
  }
}

function pantallaIntro() {
  image(imgPortada, 0, 0, LW, LH);
  dibujarBarraProgreso(LW / 2 - 150, LH * 0.85, 300, 22);

  push();
  textAlign(CENTER, CENTER);
  textSize(13);
  fill(255, 255, 255, 180);
  text("💡 Tocá la pantalla una vez para activar Pantalla Completa", LW / 2, LH * 0.93);
  pop();

  if (accionCompletada()) {
    reiniciarJuego();
  }
}

function actualizarJuego() {

  dibujarFondoHorizonte();
  let segundosTranscurridos = floor((millis() - tiempoInicioJuego - tiempoAcumuladoPausa) / 1000);
  tiempoRestante = tiempoLimite - segundosTranscurridos;

  if (manoAbierta) {
    if (frameCount % 3 === 0) {
      gotas.push(new Gota(nubeX + random(-radioNube / 2, radioNube / 2), nubeY + 20));
    }
  }

  push();
  imageMode(CENTER);
  let anchoNubeObjetivo = radioNube * 2;
  let imagenActual = manoAbierta ? imgNubeAgua : imgNubeGris;
  let altoNubeProporcional = (anchoNubeObjetivo * imagenActual.height) / imagenActual.width;

  image(imagenActual, nubeX, nubeY, anchoNubeObjetivo, altoNubeProporcional);
  pop();

  for (let i = gotas.length - 1; i >= 0; i--) {
    gotas[i].actualizar();
    gotas[i].mostrar();
    for (let j = 0; j < arboles.length; j++) {
      gotas[i].chequearColision(arboles[j]);
    }
    if (gotas[i].fueraDePantalla()) gotas.splice(i, 1);
  }

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

// ==========================================
// PANTALLAS FINALES CON IMÁGENES PERSONALIZADAS
// ==========================================
function pantallaFinal(imagenFinal) {
  // Dibuja la imagen de victoria o derrota
  image(imagenFinal, 0, 0, LW, LH);

  // Barra de progreso interactiva para volver a jugar
  dibujarBarraProgreso(LW / 2 - 150, LH * 0.85, 300, 22);
}

function reiniciarJuego() {
  escena = "JUEGO";
  gotas = [];
  manoAbierta = false;
  manoAbiertaAnterior = false;
  
  // Guardamos el momento exacto de inicio en milisegundos
  tiempoInicioJuego = millis();
  tiempoAcumuladoPausa = 0;
  tiempoRestante = tiempoLimite;

  tiempoInicioEscena = millis();
  nivelJuntarManos = 0;
  estadoDosManosAbiertas = false;

  crearArboles();
}

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
