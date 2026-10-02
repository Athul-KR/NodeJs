/**
 * Shared API helper for the frontend.
 *
 * Owns the token lifecycle in localStorage and wraps fetch() so every page
 * gets the same behavior:
 *   - Authorization header attached automatically when logged in
 *   - 401 TOKEN_EXPIRED → silently POST /api/auth/refresh, then retry ONCE
 *   - any other auth failure (revoked/reused token, deactivated account)
 *     → tokens dropped, caller sees the request as logged-out
 *
 * Loaded before the page scripts; everything is exposed on window.Api.
 * (Helmet's CSP is script-src 'self', hence plain same-origin files.)
 */
(function () {
    const ACCESS_KEY = 'accessToken';
    const REFRESH_KEY = 'refreshToken';
    const USER_KEY = 'authUser';

    const getAccessToken = () => localStorage.getItem(ACCESS_KEY);
    const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);

    const saveSession = ({ accessToken, refreshToken, user }) => {
        if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
        if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
        if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    };

    const clearSession = () => {
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_KEY);
    };

    const isLoggedIn = () => Boolean(getAccessToken());

    /** One refresh at a time — concurrent 401s share the same promise so a
     *  rotated (single-use) refresh token is never presented twice. */
    let refreshPromise = null;
    const refreshSession = () => {
        if (!refreshPromise) {
            refreshPromise = (async () => {
                const refreshToken = getRefreshToken();
                if (!refreshToken) return false;
                try {
                    const res = await fetch('/api/auth/refresh', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ refreshToken }),
                    });
                    if (!res.ok) {
                        clearSession();
                        return false;
                    }
                    const body = await res.json();
                    saveSession(body.data);
                    return true;
                } catch {
                    return false;
                }
            })().finally(() => {
                refreshPromise = null;
            });
        }
        return refreshPromise;
    };

    /**
     * fetch() with auth + refresh-and-retry. Returns { res, body }.
     * `body` is the parsed JSON (or {} when the response has no JSON).
     */
    const apiFetch = async (path, options = {}, allowRetry = true) => {
        const headers = { ...(options.headers || {}) };
        if (options.body && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
        const token = getAccessToken();
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(path, { ...options, headers });
        const body = await res.json().catch(() => ({}));

        if (res.status === 401) {
            if (body.code === 'TOKEN_EXPIRED' && allowRetry && getRefreshToken()) {
                if (await refreshSession()) return apiFetch(path, options, false);
            }
            // Refresh failed / token revoked / user gone — session is dead.
            clearSession();
        }
        if (res.status === 403 && body.code === 'ACCOUNT_DEACTIVATED') {
            clearSession();
        }

        return { res, body };
    };

    const logout = async () => {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
            // Best-effort revoke; the local session is cleared regardless.
            try {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken }),
                });
            } catch {
                /* offline logout is still a logout */
            }
        }
        clearSession();
    };

    window.Api = { apiFetch, saveSession, clearSession, isLoggedIn, logout };
})();
