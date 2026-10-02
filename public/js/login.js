/** Login page: POST /api/auth/login, store the session, back to home. */
(function () {
    const form = document.getElementById('login-form');
    const errorEl = document.getElementById('form-error');
    const submitBtn = document.getElementById('submit-btn');

    // Already signed in? Nothing to do here.
    if (Api.isLoggedIn()) window.location.replace('/');

    const showError = (message) => {
        errorEl.textContent = message;
        errorEl.hidden = false;
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorEl.hidden = true;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in…';

        try {
            const { res, body } = await Api.apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    email: document.getElementById('email').value.trim(),
                    password: document.getElementById('password').value,
                }),
            });

            if (!res.ok) {
                // 422 carries field errors; everything else has a message.
                const fieldError = body.errors?.[0]?.message;
                showError(fieldError || body.message || 'Login failed, please try again.');
                return;
            }

            Api.saveSession(body.data);
            window.location.replace('/');
        } catch {
            showError('Could not reach the server. Is the API running?');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign in';
        }
    });
})();
