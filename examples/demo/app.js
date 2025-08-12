// Estado global de la aplicación
let currentUser = null;
let hasPasskey = false;

// Verificar soporte de WebAuthn
if (!window.PublicKeyCredential) {
    showMessage('error', 'Tu navegador no soporta WebAuthn/Passkeys', 'login-message');
}

// Función para cambiar tabs
function switchTab(tabName) {
    // Actualizar tabs
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabName + '-content').classList.add('active');
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

    const originalText = showLoading('', 'Registrando...');
    
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
            
            // Activar siguiente sección
            document.getElementById('passkey-setup').classList.add('active');
            document.getElementById('setup-passkey-btn').disabled = false;
            
            // Scroll a la siguiente sección
            document.getElementById('passkey-setup').scrollIntoView({ behavior: 'smooth' });
        } else {
            showMessage('error', data.error || 'Error en el registro', 'reg-message');
        }
    } catch (error) {
        showMessage('error', 'Error de conexión: ' + error.message, 'reg-message');
    }
}

// Configurar passkey
async function setupPasskey() {
    if (!currentUser) {
        showMessage('error', 'Debes estar registrado primero', 'passkey-message');
        return;
    }

    const originalText = showLoading('setup-passkey-btn', 'Configurando...');
    
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
            
            // Activar sección de login
            document.getElementById('passkey-login').classList.add('active');
            document.getElementById('login-passkey-btn').disabled = false;
            
            // Scroll a la siguiente sección
            setTimeout(() => {
                document.getElementById('passkey-login').scrollIntoView({ behavior: 'smooth' });
            }, 1000);
        } else {
            showMessage('error', result.error || 'Error configurando passkey', 'passkey-message');
        }

    } catch (error) {
        console.error('Error configurando passkey:', error);
        if (error.name === 'AbortError') {
            showMessage('error', 'Configuración cancelada por el usuario', 'passkey-message');
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
        section.classList.remove('active');
    });
    document.getElementById('traditional-auth').classList.add('active');
    
    // Reset passkey status
    updatePasskeyStatus(false);
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Mostrar mensaje inicial
document.addEventListener('DOMContentLoaded', () => {
    showMessage('info', '👋 ¡Bienvenido! Sigue los pasos para probar la autenticación con passkeys.', 'reg-message');
});