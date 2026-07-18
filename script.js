let selectedPhotoBase64 = "";

// View Elements
const loginSection = document.getElementById('login-section');
const registerSection = document.getElementById('register-section');
const forgotSection = document.getElementById('forgot-section');
const forgotFields = document.getElementById('forgot-reset-fields');

// View Toggles
document.getElementById('link-goto-register').addEventListener('click', (e) => { e.preventDefault(); loginSection.style.display = 'none'; registerSection.style.display = 'block'; });
document.getElementById('link-goto-login').addEventListener('click', (e) => { e.preventDefault(); registerSection.style.display = 'none'; loginSection.style.display = 'block'; });
document.getElementById('link-forgot-password').addEventListener('click', (e) => { e.preventDefault(); loginSection.style.display = 'none'; forgotSection.style.display = 'block'; });
document.getElementById('link-forgot-back').addEventListener('click', (e) => { e.preventDefault(); forgotSection.style.display = 'none'; loginSection.style.display = 'block'; });

// Gallery Image Reader to Base64 Conversion
document.getElementById('reg-photo').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => { selectedPhotoBase64 = reader.result; };
    if (file) reader.readAsDataURL(file);
});

// Send Registration OTP
document.getElementById('btn-reg-otp').addEventListener('click', async () => {
    const email = document.getElementById('reg-email').value;
    const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });
    const data = await res.json();
    alert(data.message);
});

// Register Action
document.getElementById('btn-register').addEventListener('click', async () => {
    const email = document.getElementById('reg-email').value;
    const otp = document.getElementById('reg-otp').value;
    const name = document.getElementById('reg-name').value;
    const studentId = document.getElementById('reg-id').value;
    const phone = document.getElementById('reg-phone').value;
    const role = document.getElementById('reg-role').value;
    const password = document.getElementById('reg-password').value;

    const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, name, studentId, phone, role, password, photoUrl: selectedPhotoBase64 })
    });
    const data = await res.json();
    alert(data.message);
    if(data.success) { registerSection.style.display = 'none'; loginSection.style.display = 'block'; }
});

// Login Action (With Unregistered Auto-Alert Redirect)
document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.status === 444) {
        alert("Account does not exist! Redirecting to Registration Form...");
        loginSection.style.display = 'none';
        registerSection.style.display = 'block';
        document.getElementById('reg-email').value = email;
        return;
    }

    alert(data.message);
    if(data.success) {
        localStorage.setItem('user', JSON.stringify(data.user));
        alert("Success! Login successful.");
    }
});

// Forgot Password - Step 1: Request OTP
document.getElementById('btn-forgot-otp').addEventListener('click', async () => {
    const email = document.getElementById('forgot-email').value;
    const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });
    const data = await res.json();
    alert(data.message);
    if(data.success) forgotFields.style.display = 'block';
});

// Forgot Password - Step 2: Update Password
document.getElementById('btn-confirm-reset').addEventListener('click', async () => {
    const email = document.getElementById('forgot-email').value;
    const otp = document.getElementById('forgot-otp').value;
    const newPassword = document.getElementById('forgot-new-pass').value;

    const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
    });
    const data = await res.json();
    alert(data.message);
    if(data.success) { forgotSection.style.display = 'none'; loginSection.style.display = 'block'; forgotFields.style.display = 'none'; }
});