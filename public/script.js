// App config
const TEST_MODE = `${TEST_MODE}` === 'true';
const SALT = `${SALT}`;
const STORED_HASH = `${STORED_HASH}`;

// Messages
const MSG_ENTER_PASSWORD = `${MSG_ENTER_PASSWORD}` || 'Enter Password';
const MSG_ACCESS_GRANTED = `${MSG_ACCESS_GRANTED}` || '✓ Access Granted';
const MSG_INCORRECT_PASSWORD = `${MSG_INCORRECT_PASSWORD}` || '✕ Incorrect Password (Attempt %attempt%)';
const MSG_ERROR_PASSWORD = `${MSG_ERROR_PASSWORD}` || '✕ Error checking password';
const MSG_SLIDE_TO_UNLOCK = `${MSG_SLIDE_TO_UNLOCK}` || 'Slide To Trigger';
const MSG_UNLOCKING = `${MSG_UNLOCKING}` || 'UNLOCKING...';
const MSG_UNLOCKED = `${MSG_UNLOCKED}` || 'UNLOCKED';
const MSG_UNLOCKED_TEST = `${MSG_UNLOCKED_TEST}` || 'UNLOCKED';
const MSG_WELCOME = `${MSG_WELCOME}` || 'Command Sent.';
const MSG_ERROR = `${MSG_ERROR}` || 'Failed.';
const MSG_TEST_CONFIRMATION = `${MSG_TEST_CONFIRMATION}` || 'TEST MODE: Confirmed.';

// crypto api ting
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

let isAuthenticated = false;
let failedAttempts = 0;
let sessionToken = sessionStorage.getItem('sessionToken');

if (sessionStorage.getItem('authenticated') === 'true') {
    isAuthenticated = true;
    document.querySelector('.auth-overlay').style.display = 'none';
    document.querySelector('.slider-container').style.display = 'block';
}

// Check for existing session
if (sessionToken) {
    // Validate session token with backend
    fetch('/api/log', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': sessionToken
        },
        body: JSON.stringify({
            event: 'SESSION_CHECK'
        })
    })
    .then(response => {
        if (response.ok) {
            isAuthenticated = true;
            document.querySelector('.auth-overlay').style.display = 'none';
            document.querySelector('.slider-container').style.display = 'block';
        } else {
            sessionStorage.removeItem('sessionToken');
            sessionToken = null;
        }
    })
    .catch(() => {
        sessionStorage.removeItem('sessionToken');
        sessionToken = null;
    });
}

async function checkPassword() { // Will fail when not via HTTPS/localhost
    const input = document.getElementById('password');
    const submitButton = document.getElementById('submit-button');
    const feedback = document.getElementById('password-feedback');
    
    submitButton.disabled = true;
    submitButton.innerHTML = '<div class="spinner"></div>';

    try {
        const enteredHash = await hashPassword(input.value);

        // Authenticate with backend
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                hash: enteredHash
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Store token
            sessionToken = data.token;
            sessionStorage.setItem('sessionToken', sessionToken);

            // Log auth
            fetch('/api/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Auth-Token': sessionToken
                },
                body: JSON.stringify({
                    event: 'AUTH_SUCCESS'
                })
            });

            feedback.textContent = MSG_ACCESS_GRANTED;
            feedback.className = 'password-feedback success';

            const overlay = document.querySelector('.auth-overlay');
            overlay.classList.add('fade-out');

            setTimeout(() => {
                isAuthenticated = true;
                overlay.style.display = 'none';
                document.querySelector('.slider-container').style.display = 'block';
                input.value = '';
                failedAttempts = 0;
            }, 1000);

        } else {
            failedAttempts++;

            // Log attempt
            fetch('/api/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Auth-Token': sessionToken
                },
                body: JSON.stringify({
                    event: 'AUTH_FAIL',
                    details: `Attempt ${failedAttempts}`
                })
            });

            submitButton.classList.add('error');
            feedback.textContent = MSG_INCORRECT_PASSWORD.replace('%attempt%', failedAttempts);
            feedback.className = 'password-feedback error';

            input.value = '';
            setTimeout(() => {
                submitButton.classList.remove('error');
                feedback.textContent = MSG_ENTER_PASSWORD;
                feedback.className = 'password-feedback';
            }, 2000);
        }
    } catch (error) {
        console.error('Error checking password:', error);
        feedback.textContent = MSG_ERROR_PASSWORD;
        feedback.className = 'password-feedback error';
    }

    submitButton.disabled = false;
    submitButton.textContent = 'Unlock';
}

document.getElementById('password').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        checkPassword();
    }
});

document.getElementById('submit-button').addEventListener('click', function(e) {
    e.preventDefault();
    checkPassword();
});

// Show/hide password toggle
document.getElementById('toggle-password').addEventListener('click', function() {
    const passwordInput = document.getElementById('password');
    const icon = this.querySelector('i');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.textContent = '👁️'; // Need to think of something better than this
    } else {
        passwordInput.type = 'password';
        icon.textContent = '👁️‍🗨️';
    }
});

// Add test mode indicator to body if enabled
if (TEST_MODE) {
    document.body.classList.add('test-mode');
}

// DOM Elements -- ?
const slider = document.querySelector('.slider');
const sliderContainer = document.querySelector('.slider-container');
const confirmationMessage = document.getElementById('confirmationMessage');
let isDragging = false;
let startX;
let sliderLeft;

function createRipple(event) {
    const ripple = document.createElement('div');
    const rect = sliderContainer.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size/2}px`;
    ripple.style.top = `${event.clientY - rect.top - size/2}px`;
    ripple.classList.add('ripple');
    sliderContainer.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
}

function updateSliderPosition(x) {
    const rect = sliderContainer.getBoundingClientRect();
    const maxX = rect.width - slider.offsetWidth - 6;
    let newLeft = Math.max(3, Math.min(maxX, x - startX + sliderLeft));
    slider.style.left = `${newLeft}px`;

    if (newLeft >= maxX * 0.9) {
        unlockDoor();
    }
}

function unlockDoor() {
    if (slider.classList.contains('unlocked')) return;

    fetch('/api/log', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': sessionToken
        },
        body: JSON.stringify({
            event: 'UNLOCK_ATTEMPT'
        })
    });

    slider.classList.add('unlocked');
    sliderContainer.classList.remove('active');
    document.querySelector('.slide-text').textContent = MSG_UNLOCKING;

    const rect = sliderContainer.getBoundingClientRect();
    const maxX = rect.width - slider.offsetWidth - 6;
    slider.style.left = `${maxX}px`;

    if (TEST_MODE) {
        setTimeout(() => {
            document.querySelector('.slide-text').textContent = MSG_UNLOCKED_TEST;
            confirmationMessage.textContent = MSG_TEST_CONFIRMATION;
            confirmationMessage.style.display = 'block';
        }, 1000);
        return;
    }

    fetch('/api/unlock', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': sessionToken
        }
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else if (response.status === 401) {
            // Session expired or invalid
            sessionStorage.removeItem('sessionToken');
            window.location.reload();
            throw new Error('Session expired');
        } else {
            throw new Error(`Request failed with status: ${response.status}`);
        }
    })
    .then(data => {
        document.querySelector('.slide-text').textContent = MSG_UNLOCKED;
        confirmationMessage.textContent = MSG_WELCOME;
        confirmationMessage.style.display = 'block';
    })
    .catch((error) => {
        console.error('Error:', error);
        resetSlider();
        confirmationMessage.textContent = MSG_ERROR;
        confirmationMessage.style.display = 'block';
    });
}

function resetSlider() {
    slider.style.left = '3px';
    slider.classList.remove('unlocked');
    document.querySelector('.slide-text').textContent = MSG_SLIDE_TO_UNLOCK;
}

slider.addEventListener('mousedown', (e) => {
    if (!isAuthenticated) return;
    isDragging = true;
    startX = e.clientX;
    sliderLeft = slider.offsetLeft;
    sliderContainer.classList.add('active');
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    updateSliderPosition(e.clientX);
});

document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    sliderContainer.classList.remove('active');

    if (!slider.classList.contains('unlocked')) {
        slider.style.left = '3px';
    }
});

slider.addEventListener('touchstart', (e) => {
    if (!isAuthenticated) return;
    isDragging = true;
    startX = e.touches[0].clientX;
    sliderLeft = slider.offsetLeft;
    sliderContainer.classList.add('active');
});

document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    updateSliderPosition(e.touches[0].clientX);
}, { passive: false
});

document.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    sliderContainer.classList.remove('active');

    if (!slider.classList.contains('unlocked')) {
        slider.style.left = '3px';
    }
});

sliderContainer.addEventListener('click', createRipple);