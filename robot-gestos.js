// ========================================
// VARIABLES GLOBALES
// ========================================
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const robot = document.getElementById('robot');
const arena = document.getElementById('arena');
const directionDisplay = document.getElementById('direction');
const statusDisplay = document.getElementById('status');
const toggleBtn = document.getElementById('toggleCamera');


let cameraActive = false;
let model, webcam, maxPredictions;
let animationId = null;

// Referencias a los brazos del robot
const leftArm = document.getElementById('leftArm');
const rightArm = document.getElementById('rightArm');

// Configuración
const MOVEMENT_SPEED = 15;
const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/XKSVVEz4G/';

// MODELO DE POSTURA - Teachable Machine Pose Detection
// Detecta posturas corporales en tiempo real

// ========================================
// INICIALIZAR ROBOT
// ========================================
function initRobot() {
    // El robot está centrado con CSS, no necesita posición JS
    console.log('🤖 Robot inicializado en el centro');
}

// ========================================
// CARGAR MODELO DE TEACHABLE MACHINE
// ========================================
async function loadModel() {
    const modelURL = MODEL_URL + 'model.json';
    const metadataURL = MODEL_URL + 'metadata.json';

    console.log('📦 Cargando modelo de Teachable Machine Pose...');
    statusDisplay.textContent = '⏳ Cargando modelo de postura...';
    
    try {
        // Cargar el modelo de postura
        model = await tmPose.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();
        
        console.log('✅ Modelo de postura cargado correctamente');
        console.log(`📊 Clases de postura detectables: ${maxPredictions}`);
        
        return true;
    } catch (error) {
        console.error('❌ Error al cargar el modelo de postura:', error);
        statusDisplay.textContent = '❌ Error: Modelo de postura no disponible';
        statusDisplay.className = 'status error';
        return false;
    }
}

// ========================================
// ACTIVAR/DESACTIVAR CÁMARA
// ========================================
async function toggleCamera() {
    if (!cameraActive) {
        try {
            statusDisplay.textContent = '⏳ Iniciando sistema...';
            statusDisplay.className = 'status';

            // Cargar modelo si no está cargado
            if (!model) {
                const loaded = await loadModel();
                if (!loaded) return;
            }

            // Configurar webcam
            const flip = true; // Modo espejo
            webcam = new tmPose.Webcam(480, 360, flip);
            await webcam.setup();
            await webcam.play();
            
            // Asignar el canvas de la webcam al video element
            video.srcObject = webcam.canvas.captureStream();
            
            cameraActive = true;
            toggleBtn.textContent = '🔴 Detener Cámara';
            toggleBtn.classList.add('active');
            statusDisplay.textContent = '✅ Sistema activo - Mueve tu cuerpo';
            statusDisplay.className = 'status active';
            
            console.log('✅ Cámara iniciada correctamente');
            
            // Iniciar loop de predicción
            predictLoop();

        } catch (error) {
            console.error('❌ Error al iniciar la cámara:', error);
            statusDisplay.textContent = '❌ Error: No se pudo acceder a la cámara';
            statusDisplay.className = 'status error';
        }
    } else {
        // Detener sistema
        if (webcam) {
            webcam.stop();
        }
        
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        
        cameraActive = false;
        toggleBtn.textContent = '📷 Activar Cámara';
        toggleBtn.classList.remove('active');
        statusDisplay.textContent = 'Sistema detenido';
        statusDisplay.className = 'status';
        directionDisplay.textContent = 'Esperando postura...';
        
        console.log('⏹️ Sistema detenido');
    }
}

// ========================================
// LOOP DE PREDICCIÓN
// ========================================
async function predictLoop() {
    if (!cameraActive) return;

    // Actualizar webcam
    webcam.update();
    
    // Hacer predicción
    const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
    const predictions = await model.predict(posenetOutput);

    // Procesar predicciones
    processPredictions(predictions);

    // Dibujar pose en canvas (opcional)
    drawPose(pose);

    // Continuar el loop
    animationId = requestAnimationFrame(predictLoop);
}

// ========================================
// PROCESAR PREDICCIONES
// ========================================
function processPredictions(predictions) {
    // Buscar la clase con mayor probabilidad
    let maxProb = 0;
    let detectedClass = null;

    predictions.forEach(prediction => {
        if (prediction.probability > maxProb) {
            maxProb = prediction.probability;
            detectedClass = prediction.className;
        }
    });

    // Si hay una clase detectada con al menos 50% de confianza
    if (detectedClass && maxProb > 0.5) {
        moveRobotByPose(detectedClass, maxProb);
    } else {
        // Sin detección clara
        leftArm.classList.remove('raised');
        rightArm.classList.remove('raised');
        directionDisplay.textContent = 'Esperando postura...';
    }
}

// ========================================
// MOVER BRAZOS DEL ROBOT SEGÚN POSTURA DETECTADA
// ========================================
function moveRobotByPose(className, probability) {
    const probPercent = (probability * 100).toFixed(0);
    const normalizedClass = className.toLowerCase().trim();

    // Remover animaciones previas
    leftArm.classList.remove('raised');
    rightArm.classList.remove('raised');

    // DETECCIÓN SIMPLE Y DIRECTA
    
    // 1. AMBOS
    if (normalizedClass.includes('ambos')) {
        leftArm.classList.add('raised');
        rightArm.classList.add('raised');
        directionDisplay.textContent = `🙌 Ambos (${probPercent}%)`;
        return;
    }
    
    // 2. INDETERMINADO
    if (normalizedClass.includes('indeterminado')) {
        directionDisplay.textContent = `❓ Indeterminado (${probPercent}%)`;
        return;
    }
    
    // 3. DERECHA
    if (normalizedClass.includes('derecha') || normalizedClass.includes('right')) {
        rightArm.classList.add('raised');
        directionDisplay.textContent = `🤚 Derecha (${probPercent}%)`;
        return;
    }
    
    // 4. IZQUIERDA
    if (normalizedClass.includes('izquierda') || normalizedClass.includes('left')) {
        leftArm.classList.add('raised');
        directionDisplay.textContent = `🤚 Izquierda (${probPercent}%)`;
        return;
    }
    
    // 5. CUALQUIER OTRA CLASE
    directionDisplay.textContent = `${className} (${probPercent}%)`;
}

// ========================================
// DIBUJAR POSE EN CANVAS (OPCIONAL)
// ========================================
function drawPose(pose) {
    if (!pose || !pose.keypoints) return;

    // Configurar canvas
    canvas.width = webcam.canvas.width;
    canvas.height = webcam.canvas.height;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Dibujar puntos clave
    pose.keypoints.forEach(keypoint => {
        if (keypoint.score > 0.5) {
            ctx.beginPath();
            ctx.arc(keypoint.position.x, keypoint.position.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = '#00ff88';
            ctx.fill();
        }
    });
}



// ========================================
// EVENT LISTENERS
// ========================================
toggleBtn.addEventListener('click', toggleCamera);



// ========================================
// INICIALIZACIÓN
// ========================================
initRobot();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🤖 SISTEMA DE CONTROL POR POSTURA INICIADO');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔗 Modelo: ' + MODEL_URL);
console.log('💡 Tipo: Teachable Machine Pose Detection');
console.log('');
console.log('📋 El robot detectará tus posturas corporales:');
console.log('   • Brazo derecho levantado → Robot levanta brazo derecho 🤚');
console.log('   • Brazo izquierdo levantado → Robot levanta brazo izquierdo 🤚');
console.log('   • Ambos brazos levantados → Robot levanta ambos brazos 🙌');
console.log('   • Postura indeterminada → Muestra estado ❓');
console.log('');
console.log('📹 Haz clic en "Activar Cámara" para comenzar');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
