// Estado global de la aplicación
let currentUser = null;
let hasPasskey = false;
let currentStep = 1;

// Verificar soporte de WebAuthn
if (!window.PublicKeyCredential) {
    showMessage('error', 'Tu navegador no soporta WebAuthn/Passkeys', 'login-message');
    updateContextInfo('browser-not-supported');
}

// Función para cambiar tabs
function switchTab(tabName) {
    // Actualizar tabs
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(tabName + '-content').classList.add('active');
}

// Función para actualizar el progreso visual
function updateProgress(step, status = 'active') {
    currentStep = step;

    // Actualizar todos los pasos
    for (let i = 1; i <= 3; i++) {
        const progressStep = document.getElementById(`progress-${i}`);
        progressStep.classList.remove('active', 'completed');

        if (i < step) {
            progressStep.classList.add('completed');
        } else if (i === step) {
            progressStep.classList.add(status);
        }
    }
}

// Función para actualizar información contextual
function updateContextInfo(context) {
    const contextInfo = document.getElementById('context-info');
    const contexts = {
        'welcome': {
            title: 'Bienvenido al Tutorial',
            content: 'Este demo interactivo te guiará paso a paso a través del proceso de implementar autenticación con passkeys en tu aplicación.'
        },
        'register': {
            title: 'Paso 1: Registro',
            content: 'Estás creando una cuenta de usuario tradicional. Este paso simula el flujo normal de registro que los usuarios ya conocen.'
        },
        'setup-passkey': {
            title: 'Paso 2: Configurar Passkey',
            content: 'Aquí es donde la magia sucede. Tu navegador generará un par de claves criptográficas. La clave privada nunca saldrá de tu dispositivo.'
        },
        'passkey-setup-pending': {
            title: '⏳ Esperando tu acción',
            content: 'El navegador te mostrará un diálogo de autenticación. Usa tu huella digital, Face ID, o PIN para crear tu passkey.'
        },
        'login-passkey': {
            title: 'Paso 3: Login con Passkey',
            content: '¡Momento de brillar! Ahora puedes autenticarte instantáneamente sin escribir contraseñas. Solo usa tu método biométrico.'
        },
        'completed': {
            title: '✅ ¡Completado!',
            content: '¡Excelente! Has completado todo el flujo de passkeys. Ahora entiendes cómo funciona el proceso completo de autenticación sin contraseñas.'
        },
        'browser-not-supported': {
            title: '⚠️ Navegador no Compatible',
            content: 'Tu navegador no soporta WebAuthn/Passkeys. Intenta usar Chrome, Firefox, Safari o Edge en su versión más reciente.'
        }
    };

    const info = contexts[context] || contexts['welcome'];
    contextInfo.innerHTML = `
        <h4>${info.title}</h4>
        <p>${info.content}</p>
    `;
}

// Función para mostrar mensajes
function showMessage(type, text, elementId) {
    const element = document.getElementById(elementId);
    element.className = `message ${type}`;
    element.textContent = text;
    element.style.display = 'block';
    
    // Auto-hide después de 5 segundos para mensajes de éxito
    if (type === 'success') {
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
}

// Función para mostrar loading
function showLoading(buttonId, text = '') {
    const button = document.getElementById(buttonId);
    const originalText = button.innerHTML;
    button.innerHTML = `<span class="loading"></span> ${text || 'Procesando...'}`;
    button.disabled = true;
    return originalText;
}

// Función para ocultar loading
function hideLoading(buttonId, originalText) {
    const button = document.getElementById(buttonId);
    button.innerHTML = originalText;
    button.disabled = false;
}

// Registro tradicional
async function registerTraditional() {
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    if (!username || !email || !password) {
        showMessage('error', 'Por favor completa todos los campos', 'reg-message');
        return;
    }

    const originalText = showLoading('register-btn', 'Registrando...');
    updateContextInfo('register');

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (data.success) {
            currentUser = data.user;
            showMessage('success', '✅ Registro exitoso! Ahora puedes configurar tu passkey.', 'reg-message');

            // Marcar sección 1 como completada
            document.getElementById('traditional-auth').classList.add('completed');
            updateProgress(1, 'completed');

            // Activar siguiente sección
            setTimeout(() => {
                document.getElementById('passkey-setup').classList.add('active');
                document.getElementById('setup-passkey-btn').disabled = false;
                updateProgress(2, 'active');
                updateContextInfo('setup-passkey');

                // Scroll a la siguiente sección
                document.getElementById('passkey-setup').scrollIntoView({ behavior: 'smooth' });
            }, 500);
        } else {
            showMessage('error', data.error || 'Error en el registro', 'reg-message');
        }
    } catch (error) {
        showMessage('error', 'Error de conexión: ' + error.message, 'reg-message');
    } finally {
        hideLoading('register-btn', originalText);
    }
}

// Configurar passkey
async function setupPasskey() {
    if (!currentUser) {
        showMessage('error', 'Debes estar registrado primero', 'passkey-message');
        return;
    }

    const originalText = showLoading('setup-passkey-btn', 'Configurando...');
    updateContextInfo('passkey-setup-pending');

    try {
        // 1. Obtener opciones del servidor
        const beginResponse = await fetch('/api/passkey/register/begin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                username: currentUser.username,
                displayName: currentUser.username
            })
        });

        const options = await beginResponse.json();

        if (!beginResponse.ok) {
            throw new Error(options.error || 'Error obteniendo opciones de registro');
        }

        showMessage('info', '👆 Usa tu método de autenticación preferido (huella, Face ID, etc.)', 'passkey-message');

        // 2. Crear credencial con WebAuthn
        const { startRegistration } = SimpleWebAuthnBrowser;
        const attResp = await startRegistration(options);

        // 3. Enviar respuesta al servidor
        const finishResponse = await fetch('/api/passkey/register/finish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                response: attResp
            })
        });

        const result = await finishResponse.json();

        if (result.success) {
            hasPasskey = true;
            updatePasskeyStatus(true);
            showMessage('success', '🎉 ¡Passkey configurado exitosamente!', 'passkey-message');

            // Marcar sección 2 como completada
            document.getElementById('passkey-setup').classList.add('completed');
            updateProgress(2, 'completed');

            // Activar sección de login
            setTimeout(() => {
                document.getElementById('passkey-login').classList.add('active');
                document.getElementById('login-passkey-btn').disabled = false;
                updateProgress(3, 'active');
                updateContextInfo('login-passkey');

                // Scroll a la siguiente sección
                document.getElementById('passkey-login').scrollIntoView({ behavior: 'smooth' });
            }, 1000);
        } else {
            showMessage('error', result.error || 'Error configurando passkey', 'passkey-message');
        }

    } catch (error) {
        console.error('Error configurando passkey:', error);
        if (error.name === 'AbortError') {
            showMessage('error', 'Configuración cancelada por el usuario', 'passkey-message');
            updateContextInfo('setup-passkey');
        } else if (error.name === 'NotSupportedError') {
            showMessage('error', 'Tu dispositivo no soporta esta función', 'passkey-message');
        } else {
            showMessage('error', 'Error: ' + error.message, 'passkey-message');
        }
    } finally {
        hideLoading('setup-passkey-btn', originalText);
    }
}

// Login con passkey
async function loginWithPasskey() {
    const originalText = showLoading('login-passkey-btn', 'Autenticando...');
    updateContextInfo('login-passkey');

    try {
        // 1. Obtener opciones del servidor
        const beginResponse = await fetch('/api/passkey/authenticate/begin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser?.id // Opcional
            })
        });

        const options = await beginResponse.json();

        if (!beginResponse.ok) {
            throw new Error(options.error || 'Error obteniendo opciones de autenticación');
        }

        showMessage('info', '👆 Usa tu método de autenticación para hacer login', 'login-message');

        // 2. Autenticar con WebAuthn
        const { startAuthentication } = SimpleWebAuthnBrowser;
        const asseResp = await startAuthentication(options);

        // 3. Verificar respuesta en el servidor
        const finishResponse = await fetch('/api/passkey/authenticate/finish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser?.id,
                response: asseResp
            })
        });

        const result = await finishResponse.json();

        if (result.success) {
            showMessage('success', '🎉 ¡Login exitoso con passkey!', 'login-message');

            // Marcar sección 3 como completada
            document.getElementById('passkey-login').classList.add('completed');
            updateProgress(3, 'completed');
            updateContextInfo('completed');

            // Mostrar info del usuario
            showUserInfo(result.user);
        } else {
            showMessage('error', result.error || 'Error en la autenticación', 'login-message');
        }

    } catch (error) {
        console.error('Error en login con passkey:', error);
        if (error.name === 'AbortError') {
            showMessage('error', 'Login cancelado por el usuario', 'login-message');
        } else if (error.name === 'NotAllowedError') {
            showMessage('error', 'Acceso denegado o timeout', 'login-message');
        } else {
            showMessage('error', 'Error: ' + error.message, 'login-message');
        }
    } finally {
        hideLoading('login-passkey-btn', originalText);
    }
}

// Mostrar información del usuario
function showUserInfo(user) {
    const userInfo = document.getElementById('user-info');
    const userDetails = document.getElementById('user-details');
    
    userDetails.innerHTML = `
        <p><strong>ID:</strong> ${user.id}</p>
        <p><strong>Usuario:</strong> ${user.username}</p>
        <p><strong>Nombre:</strong> ${user.displayName || user.username}</p>
        <p><strong>Autenticado con:</strong> Passkey 🔑</p>
    `;
    
    userInfo.style.display = 'block';
    userInfo.scrollIntoView({ behavior: 'smooth' });
}

// Actualizar estado del passkey
function updatePasskeyStatus(active) {
    const dot = document.getElementById('passkey-dot');
    const status = document.getElementById('passkey-status');
    
    if (active) {
        dot.classList.add('active');
        status.textContent = 'Configurado ✅';
    } else {
        dot.classList.remove('active');
        status.textContent = 'Sin configurar';
    }
}

// Cerrar sesión
function logout() {
    currentUser = null;
    hasPasskey = false;
    currentStep = 1;

    // Ocultar info de usuario
    document.getElementById('user-info').style.display = 'none';

    // Limpiar mensajes
    document.querySelectorAll('.message').forEach(msg => msg.style.display = 'none');

    // Reset form
    document.getElementById('reg-username').value = 'demo.user';
    document.getElementById('reg-email').value = 'demo@example.com';
    document.getElementById('reg-password').value = 'demo123';

    // Reset buttons
    document.getElementById('setup-passkey-btn').disabled = true;
    document.getElementById('login-passkey-btn').disabled = true;

    // Reset sections
    document.querySelectorAll('.auth-section').forEach(section => {
        section.classList.remove('active', 'completed');
    });
    document.getElementById('traditional-auth').classList.add('active');

    // Reset passkey status
    updatePasskeyStatus(false);

    // Reset progress
    updateProgress(1, 'active');
    updateContextInfo('welcome');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Mostrar mensaje de bienvenida
    setTimeout(() => {
        showMessage('info', '🔄 Demo reiniciado. Puedes empezar de nuevo!', 'reg-message');
    }, 300);
}

// Mostrar mensaje inicial
document.addEventListener('DOMContentLoaded', () => {
    showMessage('info', '👋 ¡Bienvenido! Sigue los pasos numerados para probar la autenticación con passkeys.', 'reg-message');
    updateProgress(1, 'active');
    updateContextInfo('welcome');
});