// ============================================
// NINJA RUNNER - MOTOR DEL JUEGO
// Versión 1.0 - Cyberpunk Edition
// ============================================

// CONFIGURACIÓN INICIAL
const CONFIG = {
    GRAVITY: 0.8,
    JUMP_FORCE: -15,
    SPEED_INITIAL: 5,
    SPEED_INCREMENT: 0.001,
    CLOUD_SPEED: 1,
    GROUND_HEIGHT: 50,
    NINJA_WIDTH: 60,
    NINJA_HEIGHT: 90,
    OBSTACLE_WIDTH: 40,
    COIN_SIZE: 20,
    POWERUP_SIZE: 30,
    DRONE_SIZE: 40,
    SPAWN_RATE: 100 // Frames entre obstáculos
};

// ESTADO DEL JUEGO
let gameState = {
    isRunning: false,
    isPaused: false,
    gameOver: false,
    score: 0,
    highScore: localStorage.getItem('ninjaRunnerHighScore') || 0,
    coins: parseInt(localStorage.getItem('ninjaRunnerCoins')) || 0,
    lives: 3,
    speed: CONFIG.SPEED_INITIAL,
    combo: 1,
    comboTime: 0,
    distance: 0,
    difficulty: 'normal',
    activePowerUps: [],
    achievements: JSON.parse(localStorage.getItem('ninjaRunnerAchievements')) || {
        firstRun: false,
        speedMaster: false,
        coinCollector: false,
        droneDestroyer: false,
        comboKing: false
    }
};

// VARIABLES DEL JUEGO
let canvas, ctx;
let ninja = { x: 100, y: 0, vy: 0, isJumping: false, isSliding: false, attackCooldown: 0 };
let obstacles = [];
let coins = [];
let powerUps = [];
let drones = [];
let clouds = [];
let particles = [];
let keys = {};
let gameTime = 0;
let spawnCounter = 0;
let lastFrameTime = 0;
let animationId = null;

// POWER-UP DEFINICIONES
const POWERUPS = {
    SHIELD: { id: 'shield', duration: 10000, color: '#00ffff', icon: '🛡️' },
    DOUBLE_JUMP: { id: 'doubleJump', duration: 15000, color: '#ff00ff', icon: '👟' },
    MAGNET: { id: 'magnet', duration: 12000, color: '#ffff00', icon: '🧲' },
    SPEED_BOOST: { id: 'speedBoost', duration: 8000, color: '#ff5500', icon: '⚡' },
    INVINCIBILITY: { id: 'invincibility', duration: 5000, color: '#ff0000', icon: '🌟' }
};

// OBSTÁCULOS
const OBSTACLES = [
    { type: 'cactus', height: 60, width: 40, color: '#00aa00' },
    { type: 'barrier', height: 80, width: 30, color: '#888888' },
    { type: 'laser', height: 120, width: 20, color: '#ff0000' },
    { type: 'spikes', height: 40, width: 60, color: '#aa0000' }
];

// INICIALIZACIÓN
function initializeGame() {
    console.log('⚡ Inicializando Ninja Runner...');
    
    // Obtener elementos del DOM
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Ajustar canvas al contenedor
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Configurar controles
    setupControls();
    
    // Inicializar nubes
    initClouds();
    
    // Cargar datos guardados
    loadGameData();
    
    // Actualizar UI
    updateUI();
    
    // Iniciar bucle del juego
    gameLoop();
    
    // Mostrar pantalla de inicio
    showStartScreen();
    
    // Configurar eventos de botones
    document.getElementById('startButton').addEventListener('click', startGame);
    document.getElementById('retryButton').addEventListener('click', restartGame);
    document.getElementById('shareButton').addEventListener('click', shareScore);
    
    // Configurar selección de dificultad
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            gameState.difficulty = this.dataset.difficulty;
            updateDifficulty();
        });
    });
    
    // Configurar skins
    document.querySelectorAll('.skin').forEach(skin => {
        skin.addEventListener('click', function() {
            if (this.classList.contains('active')) return;
            
            const skinType = this.dataset.skin;
            const price = parseInt(this.querySelector('.skin-price')?.textContent) || 0;
            
            if (price > 0 && price > gameState.coins) {
                showMessage('¡No tienes suficientes cripto-coins!');
                return;
            }
            
            if (price > 0) {
                gameState.coins -= price;
                localStorage.setItem('ninjaRunnerCoins', gameState.coins);
            }
            
            document.querySelectorAll('.skin').forEach(s => s.classList.remove('active'));
            this.classList.add('active');
            changeNinjaSkin(skinType);
        });
    });
    
    // Configurar modales
    document.getElementById('settingsBtn').addEventListener('click', showSettings);
    document.getElementById('closeSettings').addEventListener('click', hideSettings);
    
    // Primer logro
    if (!gameState.achievements.firstRun) {
        unlockAchievement('firstRun');
    }
    
    console.log('✅ Juego inicializado correctamente');
}

// AJUSTAR CANVAS
function resizeCanvas() {
    const container = document.getElementById('gameContainer');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight - 100;
    
    // Recalcular posición del suelo
    ninja.y = canvas.height - CONFIG.GROUND_HEIGHT - CONFIG.NINJA_HEIGHT;
}

// CONFIGURAR CONTROLES
function setupControls() {
    // Teclado
    document.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
        
        if (e.key === ' ' && gameState.isRunning && !gameState.gameOver) {
            jump();
            e.preventDefault();
        }
        
        if (e.key === 's' && gameState.isRunning && !gameState.gameOver) {
            slide();
        }
        
        if (e.key === 'd' && gameState.isRunning && !gameState.gameOver) {
            attack();
        }
        
        if (e.key === 'p' && gameState.isRunning) {
            togglePause();
        }
        
        if (e.key === 'Escape' && gameState.gameOver) {
            showStartScreen();
        }
    });
    
    document.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
        
        if (e.key === 's' && ninja.isSliding) {
            ninja.isSliding = false;
        }
    });
    
    // Controles táctiles
    document.querySelector('.mobile-jump').addEventListener('touchstart', (e) => {
        if (gameState.isRunning && !gameState.gameOver) {
            jump();
        }
        e.preventDefault();
    });
    
    document.querySelector('.mobile-slide').addEventListener('touchstart', (e) => {
        if (gameState.isRunning && !gameState.gameOver) {
            slide();
        }
        e.preventDefault();
    });
    
    document.querySelector('.mobile-slide').addEventListener('touchend', () => {
        ninja.isSliding = false;
    });
    
    document.querySelector('.mobile-attack').addEventListener('touchstart', (e) => {
        if (gameState.isRunning && !gameState.gameOver) {
            attack();
        }
        e.preventDefault();
    });
    
    // Botones de pantalla
    document.getElementById('jumpBtn').addEventListener('click', jump);
    
    // Pausa/continuar
    document.getElementById('pauseBtn').addEventListener('click', togglePause);
}

// INICIAR NUBES
function initClouds() {
    clouds = [
        { x: 200, y: 80, speed: 0.5, size: 40 },
        { x: 500, y: 120, speed: 0.7, size: 60 },
        { x: 800, y: 60, speed: 0.4, size: 50 }
    ];
}

// CARGAR DATOS
function loadGameData() {
    // Actualizar puntuación máxima en UI
    document.getElementById('highScore').textContent = gameState.highScore;
    
    // Actualizar monedas
    updateCoinsUI();
}

// BUCLE PRINCIPAL DEL JUEGO
function gameLoop(timestamp) {
    // Calcular delta time
    const deltaTime = timestamp - lastFrameTime || 0;
    lastFrameTime = timestamp;
    
    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Dibujar fondo
    drawBackground();
    
    // Actualizar y dibujar nubes
    updateClouds();
    drawClouds();
    
    if (gameState.isRunning && !gameState.isPaused) {
        // Actualizar tiempo del juego
        gameTime += deltaTime;
        
        // Actualizar física
        updatePhysics();
        
        // Actualizar combo
        updateCombo(deltaTime);
        
        // Generar obstáculos
        spawnObjects(deltaTime);
        
        // Actualizar objetos
        updateObstacles();
        updateCoins();
        updatePowerUps();
        updateDrones();
        updateParticles(deltaTime);
        
        // Actualizar power-ups activos
        updateActivePowerUps(deltaTime);
        
        // Actualizar distancia
        gameState.distance += gameState.speed * deltaTime / 1000;
        
        // Actualizar velocidad
        gameState.speed += CONFIG.SPEED_INCREMENT;
        
        // Incrementar puntuación
        gameState.score += Math.floor(gameState.speed * gameState.combo);
        
        // Actualizar UI
        updateGameUI();
        
        // Verificar colisiones
        checkCollisions();
        
        // Verificar logros
        checkAchievements();
    }
    
    // Dibujar objetos del juego
    drawGround();
    drawCoins();
    drawPowerUps();
    drawDrones();
    drawObstacles();
    drawParticles();
    drawNinja();
    
    // Dibujar HUD
    drawHUD();
    
    // Continuar bucle
    animationId = requestAnimationFrame(gameLoop);
}

// DIBUJAR FONDO
function drawBackground() {
    // Cielo nocturno
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#001122');
    gradient.addColorStop(1, '#003344');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Edificios futuristas
    drawCitySkyline();
    
    // Efectos de neón
    drawNeonEffects();
}

// DIBUJAR CIUDAD
function drawCitySkyline() {
    const buildingCount = 20;
    const buildingWidth = canvas.width / buildingCount;
    
    for (let i = 0; i < buildingCount; i++) {
        const x = i * buildingWidth;
        const height = 100 + Math.random() * 150;
        const width = buildingWidth * (0.5 + Math.random() * 0.5);
        
        // Edificio
        ctx.fillStyle = `rgba(20, 30, 70, ${0.5 + Math.random() * 0.3})`;
        ctx.fillRect(x, canvas.height - height, width, height);
        
        // Ventanas
        ctx.fillStyle = `rgba(255, 255, ${100 + Math.random() * 155}, ${0.3 + Math.random() * 0.7})`;
        const windowRows = Math.floor(height / 30);
        const windowCols = Math.floor(width / 20);
        
        for (let row = 0; row < windowRows; row++) {
            for (let col = 0; col < windowCols; col++) {
                if (Math.random() > 0.6) {
                    const wx = x + col * 20 + 5;
                    const wy = canvas.height - height + row * 30 + 10;
                    ctx.fillRect(wx, wy, 10, 15);
                }
            }
        }
        
        // Luces de neón
        if (Math.random() > 0.7) {
            ctx.fillStyle = `hsl(${Math.random() * 360}, 100%, 60%)`;
            ctx.fillRect(x + width / 2 - 10, canvas.height - height - 10, 20, 10);
        }
    }
}

// DIBUJAR EFECTOS NEÓN
function drawNeonEffects() {
    // Líneas de tráfico
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 10]);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 30);
    ctx.lineTo(canvas.width, canvas.height - 30);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Señales holográficas
    if (gameTime % 2000 < 1000) {
        ctx.fillStyle = 'rgba(255, 0, 255, 0.5)';
        ctx.font = 'bold 20px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText('NINJA RUNNER', canvas.width / 2, 50);
    }
}

// ACTUALIZAR NUBES
function updateClouds() {
    clouds.forEach(cloud => {
        cloud.x -= cloud.speed;
        if (cloud.x < -cloud.size) {
            cloud.x = canvas.width + cloud.size;
            cloud.y = 50 + Math.random() * 100;
        }
    });
}

// DIBUJAR NUBES
function drawClouds() {
    clouds.forEach(cloud => {
        ctx.fillStyle = 'rgba(100, 100, 200, 0.4)';
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.size / 2, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.size / 3, cloud.y - cloud.size / 4, cloud.size / 3, 0, Math.PI * 2);
        ctx.arc(cloud.x - cloud.size / 3, cloud.y - cloud.size / 4, cloud.size / 3, 0, Math.PI * 2);
        ctx.fill();
    });
}

// DIBUJAR SUELO
function drawGround() {
    // Carretera
    ctx.fillStyle = '#222244';
    ctx.fillRect(0, canvas.height - CONFIG.GROUND_HEIGHT, canvas.width, CONFIG.GROUND_HEIGHT);
    
    // Marcas de carretera
    ctx.fillStyle = '#ffff00';
    for (let x = 0; x < canvas.width; x += 60) {
        const offset = (gameTime / 10) % 60;
        ctx.fillRect(x - offset, canvas.height - CONFIG.GROUND_HEIGHT / 2 - 2, 30, 4);
    }
    
    // Bordillo
    ctx.fillStyle = '#555577';
    ctx.fillRect(0, canvas.height - CONFIG.GROUND_HEIGHT, canvas.width, 5);
}

// ACTUALIZAR FÍSICA
function updatePhysics() {
    // Gravedad
    ninja.vy += CONFIG.GRAVITY;
    ninja.y += ninja.vy;
    
    // Limitar al suelo
    const groundY = canvas.height - CONFIG.GROUND_HEIGHT - CONFIG.NINJA_HEIGHT;
    if (ninja.y > groundY) {
        ninja.y = groundY;
        ninja.vy = 0;
        ninja.isJumping = false;
        
        // Si estaba deslizándose, restablecer altura normal
        if (ninja.isSliding) {
            ninja.y = groundY + 30; // Más bajo para deslizar
        }
    }
    
    // Enfriamiento de ataque
    if (ninja.attackCooldown > 0) {
        ninja.attackCooldown--;
    }
    
    // Efecto de velocidad en objetos
    const speedMultiplier = gameState.speed / CONFIG.SPEED_INITIAL;
    
    // Mover obstáculos
    obstacles.forEach(obs => {
        obs.x -= gameState.speed * speedMultiplier;
    });
    
    // Mover monedas
    coins.forEach(coin => {
        coin.x -= gameState.speed * speedMultiplier * 0.8;
    });
    
    // Mover power-ups
    powerUps.forEach(pu => {
        pu.x -= gameState.speed * speedMultiplier * 0.7;
    });
    
    // Mover drones
    drones.forEach(drone => {
        drone.x -= gameState.speed * speedMultiplier * 0.9;
        
        // Movimiento vertical de drones
        if (drone.y <= 100 || drone.y >= canvas.height - 200) {
            drone.vy *= -1;
        }
        drone.y += drone.vy;
    });
}

// SALTAR
function jump() {
    if (!gameState.isRunning || gameState.gameOver) return;
    
    // Doble salto si tiene el power-up
    const hasDoubleJump = gameState.activePowerUps.some(pu => pu.id === 'doubleJump');
    
    if (!ninja.isJumping || hasDoubleJump) {
        ninja.vy = CONFIG.JUMP_FORCE;
        ninja.isJumping = true;
        
        // Efecto de partículas
        createParticles(ninja.x + CONFIG.NINJA_WIDTH / 2, ninja.y + CONFIG.NINJA_HEIGHT, 5, '#00ffff');
        
        // Sonido (simulado)
        playSound('jump');
    }
}

// DESLIZAR
function slide() {
    if (!gameState.isRunning || gameState.gameOver || ninja.isSliding) return;
    
    ninja.isSliding = true;
    setTimeout(() => {
        if (ninja.isSliding) ninja.isSliding = false;
    }, 800);
    
    // Efecto de partículas
    createParticles(ninja.x + CONFIG.NINJA_WIDTH, ninja.y + CONFIG.NINJA_HEIGHT - 20, 3, '#ff5500');
}

// ATACAR
function attack() {
    if (!gameState.isRunning || gameState.gameOver || ninja.attackCooldown > 0) return;
    
    ninja.attackCooldown = 20;
    
    // Verificar colisión con drones
    drones.forEach((drone, index) => {
        if (drone.x < ninja.x + CONFIG.NINJA_WIDTH + 50 && 
            drone.x + CONFIG.DRONE_SIZE > ninja.x &&
            drone.y < ninja.y + CONFIG.NINJA_HEIGHT &&
            drone.y + CONFIG.DRONE_SIZE > ninja.y) {
            
            // Destruir drone
            drones.splice(index, 1);
            gameState.score += 500 * gameState.combo;
            
            // Efecto de explosión
            createExplosion(drone.x + CONFIG.DRONE_SIZE / 2, drone.y + CONFIG.DRONE_SIZE / 2);
            
            // Logro
            if (++gameState.dronesDestroyed >= 10) {
                unlockAchievement('droneDestroyer');
            }
        }
    });
    
    // Efecto visual de ataque
    ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
    ctx.fillRect(ninja.x + CONFIG.NINJA_WIDTH, ninja.y, 50, CONFIG.NINJA_HEIGHT);
}

// GENERAR OBJETOS
function spawnObjects(deltaTime) {
    spawnCounter += deltaTime;
    
    if (spawnCounter > CONFIG.SPAWN_RATE) {
        spawnCounter = 0;
        
        // Determinar qué spawnear basado en probabilidades
        const rand = Math.random();
        
        if (rand < 0.4) {
            // Obstáculo
            const typeIndex = Math.floor(Math.random() * OBSTACLES.length);
            const obstacle = {
                ...OBSTACLES[typeIndex],
                x: canvas.width,
                y: canvas.height - CONFIG.GROUND_HEIGHT - OBSTACLES[typeIndex].height
            };
            obstacles.push(obstacle);
        } else if (rand < 0.7) {
            // Moneda
            coins.push({
                x: canvas.width,
                y: canvas.height - CONFIG.GROUND_HEIGHT - 100 - Math.random() * 200,
                size: CONFIG.COIN_SIZE,
                type: 'coin',
                value: 1
            });
        } else if (rand < 0.85) {
            // Power-up
            const powerUpKeys = Object.keys(POWERUPS);
            const randomPowerUp = POWERUPS[powerUpKeys[Math.floor(Math.random() * powerUpKeys.length)]];
            
            powerUps.push({
                ...randomPowerUp,
                x: canvas.width,
                y: canvas.height - CONFIG.GROUND_HEIGHT - 150 - Math.random() * 150,
                width: CONFIG.POWERUP_SIZE,
                height: CONFIG.POWERUP_SIZE
            });
        } else if (rand < 0.95) {
            // Drone
            drones.push({
                x: canvas.width,
                y: 100 + Math.random() * (canvas.height - 300),
                width: CONFIG.DRONE_SIZE,
                height: CONFIG.DRONE_SIZE,
                vy: 1 + Math.random() * 2,
                type: 'drone'
            });
        }
    }
}

// ACTUALIZAR OBSTÁCULOS
function updateObstacles() {
    // Eliminar obstáculos fuera de pantalla
    obstacles = obstacles.filter(obs => obs.x + obs.width > 0);
}

// ACTUALIZAR MONEDAS
function updateCoins() {
    // Efecto de imán si tiene el power-up
    const hasMagnet = gameState.activePowerUps.some(pu => pu.id === 'magnet');
    
    coins.forEach((coin, index) => {
        // Atraer monedas con imán
        if (hasMagnet) {
            const dx = ninja.x + CONFIG.NINJA_WIDTH / 2 - coin.x;
            const dy = ninja.y + CONFIG.NINJA_HEIGHT / 2 - coin.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 200) {
                const speed = 5;
                coin.x += (dx / distance) * speed;
                coin.y += (dy / distance) * speed;
            }
        }
        
        // Verificar recolección
        if (checkCollision(ninja, coin, CONFIG.NINJA_WIDTH, CONFIG.NINJA_HEIGHT, coin.size, coin.size)) {
            coins.splice(index, 1);
            collectCoin(coin);
        }
    });
    
    // Eliminar monedas fuera de pantalla
    coins = coins.filter(coin => coin.x + coin.size > 0);
}

// ACTUALIZAR POWER-UPS
function updatePowerUps() {
    powerUps.forEach((powerUp, index) => {
        // Verificar recolección
        if (checkCollision(ninja, powerUp, CONFIG.NINJA_WIDTH, CONFIG.NINJA_HEIGHT, powerUp.width, powerUp.height)) {
            powerUps.splice(index, 1);
            collectPowerUp(powerUp);
        }
    });
    
    // Eliminar power-ups fuera de pantalla
    powerUps = powerUps.filter(pu => pu.x + pu.width > 0);
}

// ACTUALIZAR DRONES
function updateDrones() {
    // Eliminar drones fuera de pantalla
    drones = drones.filter(drone => drone.x + drone.width > 0);
}

// ACTUALIZAR PARTÍCULAS
function updateParticles(deltaTime) {
    particles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= deltaTime / 1000;
        
        // Gravedad
        particle.vy += 0.1;
        
        if (particle.life <= 0) {
            particles.splice(index, 1);
        }
    });
}

// ACTUALIZAR POWER-UPS ACTIVOS
function updateActivePowerUps(deltaTime) {
    gameState.activePowerUps.forEach((powerUp, index) => {
        powerUp.remainingTime -= deltaTime;
        
        if (powerUp.remainingTime <= 0) {
            gameState.activePowerUps.splice(index, 1);
            updatePowerUpUI();
        }
    });
}

// DIBUJAR NINJA
function drawNinja() {
    ctx.save();
    
    // Posición del ninja
    const x = ninja.x;
    let y = ninja.y;
    
    // Ajustar para deslizamiento
    if (ninja.isSliding) {
        y += 30;
    }
    
    // Cuerpo (traje cyberpunk)
    ctx.fillStyle = '#333344';
    ctx.fillRect(x, y, CONFIG.NINJA_WIDTH, CONFIG.NINJA_HEIGHT);
    
    // Detalles de neón
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(x + 5, y + 10, CONFIG.NINJA_WIDTH - 10, 5); // Cinturón
    ctx.fillRect(x + 10, y + CONFIG.NINJA_HEIGHT - 20, 15, 5); // Brazo
    
    // Cabeza
    ctx.fillStyle = '#222233';
    ctx.fillRect(x + 15, y - 10, 30, 15);
    
    // Visor
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(x + 20, y - 5, 20, 5);
    
    // Efecto de ataque
    if (ninja.attackCooldown > 15) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.fillRect(x + CONFIG.NINJA_WIDTH, y, 50, CONFIG.NINJA_HEIGHT);
    }
    
    // Escudo si tiene el power-up
    const hasShield = gameState.activePowerUps.some(pu => pu.id === 'shield');
    if (hasShield) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x + CONFIG.NINJA_WIDTH / 2, y + CONFIG.NINJA_HEIGHT / 2, 
                CONFIG.NINJA_WIDTH, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Invencibilidad si tiene el power-up
    const hasInvincibility = gameState.activePowerUps.some(pu => pu.id === 'invincibility');
    if (hasInvincibility) {
        const alpha = 0.3 + 0.3 * Math.sin(gameTime / 100);
        ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
        ctx.fillRect(x - 5, y - 5, CONFIG.NINJA_WIDTH + 10, CONFIG.NINJA_HEIGHT + 10);
    }
    
    ctx.restore();
}

// DIBUJAR OBSTÁCULOS
function drawObstacles() {
    obstacles.forEach(obs => {
        ctx.fillStyle = obs.color;
        
        switch (obs.type) {
            case 'cactus':
                // Dibujar cactus
                ctx.fillRect(obs.x, obs.y, 20, obs.height);
                ctx.fillRect(obs.x - 10, obs.y + 20, 40, 10);
                ctx.fillRect(obs.x - 5, obs.y + 40, 30, 10);
                break;
                
            case 'barrier':
                // Dibujar barrera
                ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                ctx.fillStyle = '#ff0000';
                for (let i = 0; i < obs.height; i += 20) {
                    ctx.fillRect(obs.x, obs.y + i, obs.width, 5);
                }
                break;
                
            case 'laser':
                // Dibujar láser
                const alpha = 0.5 + 0.5 * Math.sin(gameTime / 100);
                ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
                ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                break;
                
            case 'spikes':
                // Dibujar púas
                ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                for (let i = 0; i < obs.width; i += 15) {
                    ctx.beginPath();
                    ctx.moveTo(obs.x + i, obs.y + obs.height);
                    ctx.lineTo(obs.x + i + 7, obs.y);
                    ctx.lineTo(obs.x + i + 14, obs.y + obs.height);
                    ctx.closePath();
                    ctx.fill();
                }
                break;
        }
    });
}

// DIBUJAR MONEDAS
function drawCoins() {
    coins.forEach(coin => {
        // Animación de rotación
        const rotation = gameTime / 200;
        
        ctx.save();
        ctx.translate(coin.x + coin.size / 2, coin.y + coin.size / 2);
        ctx.rotate(rotation);
        
        // Moneda dorada
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(0, 0, coin.size / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Detalle interior
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(0, 0, coin.size / 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Símbolo de cripto
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('C', 0, 0);
        
        ctx.restore();
    });
}

// DIBUJAR POWER-UPS
function drawPowerUps() {
    powerUps.forEach(pu => {
        // Animación de flotación
        const floatY = Math.sin(gameTime / 300) * 10;
        
        ctx.save();
        ctx.translate(pu.x + pu.width / 2, pu.y + pu.height / 2 + floatY);
        
        // Fondo brillante
        ctx.fillStyle = pu.color;
        ctx.beginPath();
        ctx.arc(0, 0, pu.width / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Borde neón
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Icono
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pu.icon, 0, 0);
        
        ctx.restore();
    });
}

// DIBUJAR DRONES
function drawDrones() {
    drones.forEach(drone => {
        // Cuerpo del drone
        ctx.fillStyle = '#444466';
        ctx.fillRect(drone.x, drone.y, drone.width, drone.height);
        
        // Detalles
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(drone.x + 5, drone.y + 5, drone.width - 10, 5); // Luz
        
        // Hélices
        ctx.strokeStyle = '#8888aa';
        ctx.lineWidth = 3;
        const propRotation = gameTime / 50;
        
        // Hélice izquierda
        ctx.save();
        ctx.translate(drone.x + 10, drone.y + drone.height / 2);
        ctx.rotate(propRotation);
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
        ctx.restore();
        
        // Hélice derecha
        ctx.save();
        ctx.translate(drone.x + drone.width - 10, drone.y + drone.height / 2);
        ctx.rotate(-propRotation);
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
        ctx.restore();
        
        // Rayo láser (intermitente)
        if (Math.sin(gameTime / 200) > 0.5) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(drone.x, drone.y + drone.height / 2);
            ctx.lineTo(drone.x - 30, drone.y + drone.height / 2);
            ctx.stroke();
        }
    });
}

// DIBUJAR PARTÍCULAS
function drawParticles() {
    particles.forEach(particle => {
        ctx.globalAlpha = particle.life;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

// DIBUJAR HUD
function drawHUD() {
    // Solo mostrar HUD durante el juego
    if (!gameState.isRunning || !gameState.isRunning) return;
    
    // Multiplicador de combo
    if (gameState.combo > 1) {
        ctx.fillStyle = `rgba(255, ${100 + gameState.combo * 20}, 0, 0.7)`;
        ctx.font = `bold ${20 + gameState.combo * 5}px Orbitron`;
        ctx.textAlign = 'right';
        ctx.fillText(`COMBO x${gameState.combo}`, canvas.width - 20, 50);
    }
}

// VERIFICAR COLISIONES
function checkCollisions() {
    // Verificar colisión con obstáculos
    obstacles.forEach((obs, index) => {
        if (checkCollision(ninja, obs, CONFIG.NINJA_WIDTH, CONFIG.NINJA_HEIGHT, obs.width, obs.height)) {
            // Si tiene invincibilidad, no recibir daño
            const hasInvincibility = gameState.activePowerUps.some(pu => pu.id === 'invincibility');
            
            if (!hasInvincibility) {
                // Si tiene escudo, consumirlo
                const shieldIndex = gameState.activePowerUps.findIndex(pu => pu.id === 'shield');
                if (shieldIndex >= 0) {
                    gameState.activePowerUps.splice(shieldIndex, 1);
                    updatePowerUpUI();
                } else {
                    // Recibir daño
                    takeDamage();
                }
            }
            
            // Eliminar obstáculo
            obstacles.splice(index, 1);
            
            // Efecto de partículas
            create
