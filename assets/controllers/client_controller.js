import { Controller } from '@hotwired/stimulus';

export default class extends Controller {

    tokenExpirationInterval = null;
    devicePollTimeout = null;
    deviceAuthorizationData = null;
    deviceAuthorizationIntervalMs = 5000;
    deviceAuthorizationExpiresAt = null;
    deviceCountdownInterval = null;

    static targets = [
        'clientId',
        'clientSecret',
        'scopes',
        'result',
        'tokenInfo',
        'apiResult',
        'testEmailApiButton',
        'testProfileApiButton',
        'testClientApiButton',
        'testAdminApiButton',
        'resetButton',
        'refreshButton',
        'passwordDialog',
        'passwordForm',
        'dialogUsername',
        'dialogPassword',
        'deviceDialog',
        'deviceResult',
        'deviceInstructions',
        'deviceCountdown',
        'deviceStatus',
        'deviceCancelButton'
    ];

    static grantTypes = {
        code: {
            name: 'Authorization Code',
            handler: 'authorizeCode'
        },
        pkce: {
            name: 'Authorization Code + PKCE',
            handler: 'authorizeCodePkce'
        },
        implicit: {
            name: 'Implicit',
            handler: 'authorizeImplicit'
        },
        password: {
            name: 'Password Credentials',
            handler: 'authorizePasswordCredentials'
        },
        clientCredentials: {
            name: 'Client Credentials',
            handler: 'authorizeClientCredentials'
        }
    };

    connect() {
        this.clearTokenExpirationInterval();
        sessionStorage.removeItem('oauth2_code_verifier');
        this.loadStoredCredentials();
        this.checkForAuthorizationCallback();
        this.displayStoredToken();

        window.addEventListener('hashchange', () => this.checkForAuthorizationCallback());
        this.passwordFormTarget.addEventListener('submit', (e) => this.handlePasswordFormSubmit(e));
    }

    generateCodeVerifier() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        let codeVerifier = '';
        const array = new Uint8Array(96);
        crypto.getRandomValues(array);
        for (let i = 0; i < array.length; i++) {
            codeVerifier += chars[array[i] % chars.length];
        }
        return codeVerifier;
    }

    handlePasswordFormSubmit(event) {
        event.preventDefault();

        const submitter = event.submitter;
        const action = submitter?.getAttribute('value');

        if (action === 'login') {
            const username = this.dialogUsernameTarget.value;
            const password = this.dialogPasswordTarget.value;
            this.authorizePasswordCredentials(username, password);
        }

        this.clearPasswordForm();

        const modal = bootstrap.Modal.getInstance(this.passwordDialogTarget);
        if (modal) {
            modal.hide();
        }
    }

    clearPasswordForm() {
        this.dialogUsernameTarget.value = '';
        this.dialogPasswordTarget.value = '';
    }

    loadStoredCredentials() {
        const clientId = sessionStorage.getItem('oauth2_client_id');
        const clientSecret = sessionStorage.getItem('oauth2_client_secret');

        if (clientId) this.clientIdTarget.value = clientId;
        if (clientSecret) this.clientSecretTarget.value = clientSecret;
    }

    saveCredentials() {
        sessionStorage.setItem('oauth2_client_id', this.clientIdTarget.value.trim());
        sessionStorage.setItem('oauth2_client_secret', this.clientSecretTarget.value.trim());
        sessionStorage.setItem('oauth2_server_url', this.getServerUrl());
    }

    getServerUrl() {
        return window.location.origin;
    }

    getScopes() {
        const scopesSelect = this.scopesTarget;
        const selectedOptions = Array.from(scopesSelect.selectedOptions);
        return selectedOptions.map(option => option.value);
    }

    validateCredentials() {
        if (!this.clientIdTarget.value.trim()) {
            this.setResultError('validation', 'Client ID is required. Please fill in the Client ID field.');
            return false;
        }
        if (!this.clientSecretTarget.value.trim()) {
            this.setResultError('validation', 'Client Secret is required. Please fill in the Client Secret field.');
            return false;
        }
        return true;
    }

    getRedirectUri() {
        return window.location.origin + window.location.pathname;
    }

    checkForAuthorizationCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));

        if (hashParams.has('access_token')) {
            this.handleImplicitFlowToken(hashParams);
            return;
        }

        if (hashParams.has('error')) {
            this.handleImplicitFlowError(hashParams);
            return;
        }

        if (urlParams.has('error')) {
            this.handleAuthorizationCodeError(urlParams);
            return;
        }

        if (urlParams.has('code')) {
            this.handleAuthorizationCode(urlParams.get('code'));
        }
    }

    handleImplicitFlowToken(hashParams) {
        const token = hashParams.get('access_token');
        const tokenType = hashParams.get('token_type') || 'Bearer';
        const expiresIn = hashParams.get('expires_in');

        sessionStorage.setItem('oauth2_access_token', token);
        sessionStorage.setItem('oauth2_token_type', tokenType);
        if (expiresIn) {
            sessionStorage.setItem('oauth2_expires_in', expiresIn);
        }

        this.clearResultMessage('implicit');
        this.displayStoredToken();
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    handleImplicitFlowError(hashParams) {
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description') || '';
        this.setResultError('implicit', `${error} - ${errorDescription}`);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    handleAuthorizationCodeError(urlParams) {
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description') || '';
        const codeVerifier = sessionStorage.getItem('oauth2_code_verifier');
        const grantType = codeVerifier ? 'pkce' : 'code';
        this.setResultError(grantType, `${error} - ${errorDescription}`);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    handleAuthorizationCode(code) {
        const codeVerifier = sessionStorage.getItem('oauth2_code_verifier');
        if (codeVerifier) {
            this.exchangeCodeForTokenPkce(code, codeVerifier);
        } else {
            this.exchangeCodeForToken(code);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    authorizeCode() {
        if (!this.validateCredentials()) return;

        this.saveCredentials();
        sessionStorage.removeItem('oauth2_code_verifier');

        const authUrl = this.buildAuthorizationUrl({
            responseType: 'code'
        });

        window.location.href = authUrl;
    }

    authorizeCodePkce() {
        if (!this.validateCredentials()) return;

        this.saveCredentials();

        const codeVerifier = this.generateCodeVerifier();
        sessionStorage.setItem('oauth2_code_verifier', codeVerifier);
        this.generateCodeChallenge(codeVerifier).then(codeChallenge => {
            const authUrl = this.buildAuthorizationUrl({
                responseType: 'code',
                codeChallenge,
                codeChallengeMethod: 'S256'
            });
            window.location.href = authUrl;
        }).catch(error => {
            this.setResultError('pkce', error.message);
        });
    }

    authorizeImplicit() {
        if (!this.validateCredentials()) return;

        this.saveCredentials();
        sessionStorage.removeItem('oauth2_code_verifier');

        const authUrl = this.buildAuthorizationUrl({
            responseType: 'token'
        });

        window.location.href = authUrl;
    }

    authorizeDevice() {
        if (!this.validateCredentials()) return;

        this.saveCredentials();
        this.deviceResultTarget.innerHTML = '';
        this.deviceInstructionsTarget.innerHTML = '';
        this.deviceStatusTarget.innerHTML = '';
        this.deviceCountdownTarget.innerHTML = '';

        this.deviceResultTarget.innerHTML = '<p>⏳ Requesting device authorization...</p>';
        const deviceUrl = new URL(this.getServerUrl());
        deviceUrl.pathname = '/oauth2/device-code';

        const body = new URLSearchParams();
        body.append('client_id', this.clientIdTarget.value.trim());
        const scopes = this.getScopes();
        if (scopes.length) {
            body.append('scope', scopes.join(' '));
        }
        const clientSecret = this.clientSecretTarget.value.trim();
        if (clientSecret) {
            body.append('client_secret', clientSecret);
        }

        fetch(deviceUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        })
            .then(response => {
                if (!response.ok) {
                    return response.json().catch(() => ({})).then(errorData => {
                        const description = errorData.error_description || `HTTP ${response.status}`;
                        throw new Error(description);
                    });
                }
                return response.json();
            })
            .then(data => {
                if (!data.device_code || !data.user_code || !data.verification_uri) {
                    throw new Error('Missing fields in device authorization response.');
                }

                this.deviceAuthorizationData = {
                    device_code: data.device_code,
                    interval: (data.interval || 5) * 1000
                };
                this.deviceAuthorizationIntervalMs = this.deviceAuthorizationData.interval;
                this.deviceAuthorizationExpiresAt = data.expires_in ? Date.now() + (data.expires_in * 1000) : null;

                const verificationUri = this.escapeHtml(data.verification_uri);
                const verificationUriComplete = data.verification_uri_complete ? this.escapeHtml(data.verification_uri_complete) : null;
                const userCode = this.escapeHtml(data.user_code);

                const instructionsHtml = `
                    <div class="alert alert-info">
                        <p class="mb-2"><strong>Step 1:</strong> Visit <a href="${verificationUri}" target="_blank" rel="noopener noreferrer" class="alert-link">${verificationUri}</a></p>
                        <p class="mb-2"><strong>Step 2:</strong> Enter the user code:</p>
                        <div class="text-center my-3">
                            <mark style="font-size: 1.5rem; padding: 0.5rem 1rem;">${userCode}</mark>
                        </div>
                        ${verificationUriComplete ? `<p class="mb-0"><strong>Shortcut:</strong> <a href="${verificationUriComplete}" target="_blank" rel="noopener noreferrer" class="alert-link">Use the direct verification link</a></p>` : ''}
                    </div>
                `;

                this.deviceResultTarget.innerHTML = '<div class="alert alert-success mb-0">✅ Device authorization started. Follow the instructions below.</div>';
                this.deviceInstructionsTarget.innerHTML = instructionsHtml;
                this.deviceStatusTarget.innerHTML = '<p class="mb-0">⏳ Waiting for you to authorize the device...</p>';
                if (this.hasDeviceCancelButtonTarget) {
                    this.deviceCancelButtonTarget.disabled = false;
                }

                this.startDeviceCountdown();
                this.scheduleDevicePolling(this.deviceAuthorizationIntervalMs);
            })
            .catch(error => {
                this.resetDeviceAuthorizationUI();
                this.deviceResultTarget.innerHTML = `<div class="alert alert-danger mb-0">❌ Device authorization failed: ${this.escapeHtml(error.message)}</div>`;
            });
    }

    buildAuthorizationUrl(options = {}) {
        const authUrl = new URL(this.getServerUrl());
        authUrl.pathname = '/oauth2/authorize';
        authUrl.searchParams.append('client_id', this.clientIdTarget.value.trim());
        authUrl.searchParams.append('response_type', options.responseType);
        authUrl.searchParams.append('redirect_uri', this.getRedirectUri());
        authUrl.searchParams.append('scope', this.getScopes().join(' '));
        authUrl.searchParams.append('state', this.generateState());

        if (options.codeChallenge) {
            authUrl.searchParams.append('code_challenge', options.codeChallenge);
            authUrl.searchParams.append('code_challenge_method', options.codeChallengeMethod);
        }

        return authUrl.toString();
    }



    authorizePasswordCredentials(username, password) {
        if (!this.validateCredentials()) return;

        this.saveCredentials();

        const tokenUrl = new URL(this.getServerUrl());
        tokenUrl.pathname = '/oauth2/token';

        const body = new URLSearchParams();
        body.append('grant_type', 'password');
        body.append('username', username);
        body.append('password', password);
        body.append('client_id', this.clientIdTarget.value);
        body.append('client_secret', this.clientSecretTarget.value);
        body.append('scope', this.getScopes().join(' '));

        this.requestToken(tokenUrl.toString(), body)
            .then(data => {
                this.storeToken(data);
                this.clearResultMessage('password');
                this.displayStoredToken();
            })
            .catch(error => {
                this.setResultError('password', error.message);
            });
    }

    authorizeClientCredentials() {
        if (!this.validateCredentials()) return;

        this.saveCredentials();

        const tokenUrl = new URL(this.getServerUrl());
        tokenUrl.pathname = '/oauth2/token';

        const body = new URLSearchParams();
        body.append('grant_type', 'client_credentials');
        body.append('client_id', this.clientIdTarget.value);
        body.append('client_secret', this.clientSecretTarget.value);
        body.append('scope', this.getScopes().join(' '));

        const credentials = btoa(`${this.clientIdTarget.value}:${this.clientSecretTarget.value}`);

        this.requestToken(tokenUrl.toString(), body, credentials)
            .then(data => {
                this.storeToken(data);
                this.clearResultMessage('clientCredentials');
                this.displayStoredToken();
            })
            .catch(error => {
                this.setResultError('clientCredentials', error.message);
            });
    }

    cancelDeviceAuthorization() {
        this.resetDeviceAuthorizationUI();
        // Cerrar el modal
        if (this.hasDeviceDialogTarget) {
            const modal = bootstrap.Modal.getInstance(this.deviceDialogTarget);
            if (modal) {
                modal.hide();
            }
        }
    }

    handleDeviceDialogShow() {
        // Iniciar autorización automáticamente al abrir el modal
        this.authorizeDevice();
    }

    handleDeviceDialogClose() {
        // Cancelar la autorización si está en curso
        if (this.deviceAuthorizationData) {
            this.resetDeviceAuthorizationUI();
        }
    }

    openPasswordDialog() {
        // Validar credenciales antes de abrir el modal
        if (!this.validateCredentials()) {
            return;
        }

        // Abrir el modal programáticamente
        const modal = new bootstrap.Modal(this.passwordDialogTarget);
        modal.show();
    }

    openDeviceDialog() {
        // Validar credenciales antes de abrir el modal
        if (!this.validateCredentials()) {
            return;
        }

        // Abrir el modal programáticamente
        const modal = new bootstrap.Modal(this.deviceDialogTarget);
        modal.show();
    }

    pollDeviceToken() {
        if (!this.deviceAuthorizationData) {
            return;
        }

        if (this.deviceAuthorizationExpiresAt && Date.now() >= this.deviceAuthorizationExpiresAt) {
            this.handleDeviceAuthorizationError('⏱️ Device code expired', 'The verification code has expired. Please close this dialog and try again.');
            return;
        }

        const tokenUrl = new URL(this.getServerUrl());
        tokenUrl.pathname = '/oauth2/token';

        const body = new URLSearchParams();
        body.append('grant_type', 'urn:ietf:params:oauth:grant-type:device_code');
        body.append('device_code', this.deviceAuthorizationData.device_code);
        body.append('client_id', this.clientIdTarget.value.trim());
        const clientSecret = this.clientSecretTarget.value.trim();
        if (clientSecret) {
            body.append('client_secret', clientSecret);
        }

        fetch(tokenUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        })
            .then(async response => {
                if (response.ok) {
                    return { success: true, data: await response.json() };
                }

                const errorPayload = await response.json().catch(() => ({}));
                return { success: false, status: response.status, error: errorPayload };
            })
            .then(result => {
                if (result.success) {
                    this.storeToken(result.data);
                    this.deviceResultTarget.innerHTML = '<div class="alert alert-success mb-0">✅ Device authorized successfully! Access token received.</div>';
                    this.deviceStatusTarget.innerHTML = '';
                    this.deviceInstructionsTarget.innerHTML = '';
                    this.resetDeviceAuthorizationUI();
                    this.displayStoredToken();

                    // Close the modal
                    if (this.hasDeviceDialogTarget) {
                        const modal = bootstrap.Modal.getInstance(this.deviceDialogTarget);
                        if (modal) {
                            modal.hide();
                        }
                    }
                    return;
                }

                const errorCode = result.error?.error;
                switch (errorCode) {
                    case 'authorization_pending':
                        this.deviceStatusTarget.innerHTML = '<p>⏳ Waiting for user confirmation...</p>';
                        this.scheduleDevicePolling(this.deviceAuthorizationIntervalMs);
                        break;
                    case 'slow_down':
                        this.deviceAuthorizationIntervalMs += 5000;
                        this.deviceStatusTarget.innerHTML = '<p>🐢 Received slow_down response. Polling less frequently...</p>';
                        this.scheduleDevicePolling(this.deviceAuthorizationIntervalMs);
                        break;
                    case 'access_denied':
                    case 'authorization_declined':
                        this.handleDeviceAuthorizationError('🚫 Access Denied', 'The user rejected the authorization request.');
                        break;
                    case 'expired_token':
                    case 'expired_token_hint':
                    case 'expired_device_code':
                        this.handleDeviceAuthorizationError('⏱️ Code Expired', 'The verification code has expired. Please close this dialog and try again.');
                        break;
                    default:
                        const description = result.error?.error_description || 'Unknown error while polling for token.';
                        this.handleDeviceAuthorizationError('❌ Error', description);
                        break;
                }
            })
            .catch(error => {
                this.deviceStatusTarget.innerHTML = `<p>⚠️ Network issue while polling: ${this.escapeHtml(error.message)}. Retrying...</p>`;
                this.scheduleDevicePolling(this.deviceAuthorizationIntervalMs);
            });
    }

    handleDeviceAuthorizationError(title, message) {
        // Detener polling y cuenta atrás
        this.clearDevicePolling();
        this.clearDeviceCountdown();
        
        // Limpiar estado de autorización
        this.deviceAuthorizationData = null;
        this.deviceAuthorizationIntervalMs = 5000;
        this.deviceAuthorizationExpiresAt = null;
        
        // Mostrar mensaje de error
        this.deviceResultTarget.innerHTML = `<div class="alert alert-danger mb-0"><strong>${this.escapeHtml(title)}</strong><br>${this.escapeHtml(message)}</div>`;
        this.deviceInstructionsTarget.innerHTML = '';
        this.deviceCountdownTarget.innerHTML = '';
        this.deviceStatusTarget.innerHTML = '';
        
        // Deshabilitar botón de cancelar
        if (this.hasDeviceCancelButtonTarget) {
            this.deviceCancelButtonTarget.disabled = true;
        }
    }

    scheduleDevicePolling(delay) {
        this.clearDevicePolling();
        this.devicePollTimeout = setTimeout(() => this.pollDeviceToken(), delay);
    }

    clearDevicePolling() {
        if (this.devicePollTimeout) {
            clearTimeout(this.devicePollTimeout);
            this.devicePollTimeout = null;
        }
    }

    clearDeviceCountdown() {
        if (this.deviceCountdownInterval) {
            clearInterval(this.deviceCountdownInterval);
            this.deviceCountdownInterval = null;
        }
    }

    startDeviceCountdown() {
        this.clearDeviceCountdown();

        if (!this.deviceAuthorizationExpiresAt || !this.hasDeviceCountdownTarget) {
            return;
        }

        const updateCountdown = () => {
            const now = Date.now();
            const remainingMs = this.deviceAuthorizationExpiresAt - now;

            if (remainingMs <= 0) {
                this.deviceCountdownTarget.innerHTML = '<div class="alert alert-danger mb-0">⏱️ Code expired!</div>';
                this.clearDeviceCountdown();
                return;
            }

            const remainingSeconds = Math.ceil(remainingMs / 1000);
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;

            let timeString;
            if (minutes > 0) {
                timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            } else {
                timeString = `${seconds}s`;
            }

            let alertClass = 'alert-info';
            if (remainingSeconds <= 30) {
                alertClass = 'alert-danger';
            } else if (remainingSeconds <= 60) {
                alertClass = 'alert-warning';
            }

            this.deviceCountdownTarget.innerHTML = `<div class="alert ${alertClass} mb-0">⏱️ Code expires in: <strong>${timeString}</strong></div>`;
        };

        updateCountdown();
        this.deviceCountdownInterval = setInterval(updateCountdown, 1000);
    }

    resetDeviceAuthorizationUI() {
        this.clearDevicePolling();
        this.clearDeviceCountdown();
        this.deviceAuthorizationData = null;
        this.deviceAuthorizationIntervalMs = 5000;
        this.deviceAuthorizationExpiresAt = null;
        if (this.hasDeviceInstructionsTarget) {
            this.deviceInstructionsTarget.innerHTML = '';
        }
        if (this.hasDeviceCountdownTarget) {
            this.deviceCountdownTarget.innerHTML = '';
        }
        if (this.hasDeviceResultTarget) {
            this.deviceResultTarget.innerHTML = '';
        }
        if (this.hasDeviceStatusTarget) {
            this.deviceStatusTarget.innerHTML = '';
        }
        if (this.hasDeviceCancelButtonTarget) {
            this.deviceCancelButtonTarget.disabled = true;
        }
    }

    buildPasswordCredentialsBody(username, password) {
        const body = new URLSearchParams();
        body.append('grant_type', 'password');
        body.append('username', username);
        body.append('password', password);
        body.append('client_id', this.clientIdTarget.value);
        body.append('client_secret', this.clientSecretTarget.value);
        body.append('scope', this.getScopes().join(' '));
        return body;
    }

    buildClientCredentialsBody() {
        const body = new URLSearchParams();
        body.append('grant_type', 'client_credentials');
        body.append('client_id', this.clientIdTarget.value);
        body.append('client_secret', this.clientSecretTarget.value);
        body.append('scope', this.getScopes().join(' '));
        return body;
    }

    requestToken(tokenUrl, body, basicAuth = null) {
        const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        if (basicAuth) {
            headers['Authorization'] = `Basic ${basicAuth}`;
        }

        return fetch(tokenUrl, {
            method: 'POST',
            headers,
            body: body.toString(),
        }).then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`HTTP ${response.status}: ${text}`);
                });
            }
            return response.json();
        });
    }

    storeToken(data) {
        sessionStorage.setItem('oauth2_access_token', data.access_token);
        sessionStorage.setItem('oauth2_token_type', data.token_type || 'Bearer');
        sessionStorage.setItem('oauth2_expires_in', data.expires_in);
        if (data.refresh_token) {
            sessionStorage.setItem('oauth2_refresh_token', data.refresh_token);
        }
        sessionStorage.setItem('oauth2_token_timestamp', Date.now());
    }

    clearResultMessage(grantType) {
        this.resultTarget.innerHTML = '';
    }

    setResultError(grantType, message) {
        this.resultTarget.innerHTML = `<p>❌ ${this.escapeHtml(message)}</p>`;
    }

    exchangeCodeForToken(code) {
        const tokenUrl = new URL(this.getServerUrl());
        tokenUrl.pathname = '/oauth2/token';

        const body = new URLSearchParams();
        body.append('grant_type', 'authorization_code');
        body.append('code', code);
        body.append('redirect_uri', this.getRedirectUri());
        body.append('client_id', this.clientIdTarget.value);
        body.append('client_secret', this.clientSecretTarget.value);

        this.requestToken(tokenUrl.toString(), body)
            .then(data => {
                this.storeToken(data);
                this.clearResultMessage('code');
                this.displayStoredToken();
            })
            .catch(error => {
                this.setResultError('code', error.message);
            });
    }

    exchangeCodeForTokenPkce(code, codeVerifier) {
        const tokenUrl = new URL(sessionStorage.getItem('oauth2_server_url') || window.location.origin);
        tokenUrl.pathname = '/oauth2/token';

        const body = new URLSearchParams();
        body.append('grant_type', 'authorization_code');
        body.append('code', code);
        body.append('redirect_uri', this.getRedirectUri());
        body.append('client_id', sessionStorage.getItem('oauth2_client_id'));
        body.append('client_secret', sessionStorage.getItem('oauth2_client_secret'));
        body.append('code_verifier', codeVerifier);

        this.requestToken(tokenUrl.toString(), body)
            .then(data => {
                this.storeToken(data);
                sessionStorage.removeItem('oauth2_code_verifier');
                this.clearResultMessage('codePkce');
                this.displayStoredToken();
            })
            .catch(error => {
                this.setResultError('codePkce', error.message);
            });
    }

    displayStoredToken() {
        const token = sessionStorage.getItem('oauth2_access_token');
        const tokenType = sessionStorage.getItem('oauth2_token_type');
        const expiresIn = sessionStorage.getItem('oauth2_expires_in');
        const refreshToken = sessionStorage.getItem('oauth2_refresh_token');
        const tokenTimestamp = sessionStorage.getItem('oauth2_token_timestamp');

        if (token) {
            let expirationInfo = '';
            if (expiresIn && tokenTimestamp) {
                const expirationTime = parseInt(tokenTimestamp) + (parseInt(expiresIn) * 1000);
                const now = Date.now();
                const remainingSeconds = Math.floor((expirationTime - now) / 1000);

                if (remainingSeconds > 0) {
                    expirationInfo = `<p id="expirationInfo"><strong>Expires in:</strong> <span id="remainingSeconds">${remainingSeconds}</span> seconds (<span id="remainingMinutes">${Math.floor(remainingSeconds / 60)}</span> minutes)</p>`;

                    this.clearTokenExpirationInterval();

                    this.tokenExpirationInterval = setInterval(() => {
                        this.updateTokenExpirationCounter(expirationTime);
                    }, 1000);
                } else {
                    expirationInfo = `<p style="color: #dc3545;"><strong>⚠️ Token Expired!</strong> Use Refresh Token to get a new one.</p>`;
                    this.clearTokenExpirationInterval();
                }
            }

            const refreshTokenInfo = refreshToken
                ? `<p><strong>✅ Refresh Token Available:</strong> You can refresh the token when it expires</p>`
                : `<p style="color: #ffc107;"><strong>⚠️ No Refresh Token:</strong> You cannot refresh this token. Request a new one.</p>`;

            const decodedInfo = this.decodeJwtIfValid(token);
            const html = `
                <p><strong>Token Type:</strong> ${this.escapeHtml(tokenType)}</p>
                ${expirationInfo}
                ${refreshTokenInfo}
                <details>
                    <summary>🔐 Raw Token</summary>
                    <code style="word-break: break-all;">${this.escapeHtml(token)}</code>
                </details>
                ${decodedInfo}
            `;

            this.tokenInfoTarget.innerHTML = html;


            this.testEmailApiButtonTarget.disabled = false;
            this.testProfileApiButtonTarget.disabled = false;
            this.testClientApiButtonTarget.disabled = false;
            this.testAdminApiButtonTarget.disabled = false;
            this.resetButtonTarget.disabled = false;

            this.refreshButtonTarget.disabled = !refreshToken;
        } else {
            this.tokenInfoTarget.innerHTML = '<p>No token stored</p>';
            this.disableApiButtons();
            this.clearTokenExpirationInterval();
        }
    }

    updateTokenExpirationCounter(expirationTime) {
        const remainingSecondsElement = document.getElementById('remainingSeconds');
        const remainingMinutesElement = document.getElementById('remainingMinutes');

        if (!remainingSecondsElement || !remainingMinutesElement) {
            this.clearTokenExpirationInterval();
            return;
        }

        const now = Date.now();
        const remainingSeconds = Math.floor((expirationTime - now) / 1000);

        if (remainingSeconds > 0) {
            remainingSecondsElement.textContent = remainingSeconds;
            remainingMinutesElement.textContent = Math.floor(remainingSeconds / 60);
        } else {
            const expirationInfoElement = document.getElementById('expirationInfo');
            if (expirationInfoElement) {
                expirationInfoElement.innerHTML = '<p style="color: #dc3545;"><strong>⚠️ Token Expired!</strong> Use Refresh Token to get a new one.</p>';
            }
            this.clearTokenExpirationInterval();
        }
    }

    clearTokenExpirationInterval() {
        if (this.tokenExpirationInterval) {
            clearInterval(this.tokenExpirationInterval);
            this.tokenExpirationInterval = null;
        }
    }

    decodeJwtIfValid(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return '';

            const header = JSON.parse(atob(parts[0]));
            const payload = JSON.parse(atob(parts[1]));

            return `
                <details>
                    <summary>📖 JWT Decoded</summary>
                    <pre>Header: ${JSON.stringify(header, null, 2)}</pre>
                    <pre>Payload: ${JSON.stringify(payload, null, 2)}</pre>
                </details>
            `;
        } catch (e) {
            return '';
        }
    }

    enableApiButtons() {
        this.testEmailApiButtonTarget.disabled = false;
        this.testProfileApiButtonTarget.disabled = false;
        this.testClientApiButtonTarget.disabled = false;
        this.testAdminApiButtonTarget.disabled = false;
        this.refreshButtonTarget.disabled = false;
        this.resetButtonTarget.disabled = false;
    }

    disableApiButtons() {
        this.testEmailApiButtonTarget.disabled = true;
        this.testProfileApiButtonTarget.disabled = true;
        this.testClientApiButtonTarget.disabled = true;
        this.testAdminApiButtonTarget.disabled = true;
        this.refreshButtonTarget.disabled = true;
        this.resetButtonTarget.disabled = true;
    }

    testEmailApi() {
        this.testApi(`${this.getServerUrl()}/api/email`);
    }

    testProfileApi() {
        this.testApi(`${this.getServerUrl()}/api/profile`);
    }

    testClientApi() {
        this.testApi(`${this.getServerUrl()}/api/client`);
    }

    testAdminApi() {
        this.testApi(`${this.getServerUrl()}/api/admin`);
    }

    testApi(endpoint) {
        const token = sessionStorage.getItem('oauth2_access_token');

        if (!token) {
            this.apiResultTarget.innerHTML = '<p>❌ Error: No token available</p>';
            return;
        }

        this.apiResultTarget.innerHTML = '<p>⏳ Loading...</p>';

        fetch(endpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            },
        })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`HTTP ${response.status}: ${text}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                const html = `
                    <p>✅ Successful response:</p>
                    <pre>${this.escapeHtml(JSON.stringify(data, null, 2))}</pre>
                `;
                this.apiResultTarget.innerHTML = html;
            })
            .catch(error => {
                this.apiResultTarget.innerHTML = `<p>❌ Error: ${this.escapeHtml(error.message)}</p>`;
            });
    }

    resetToken() {
        sessionStorage.removeItem('oauth2_access_token');
        sessionStorage.removeItem('oauth2_token_type');
        sessionStorage.removeItem('oauth2_expires_in');
        sessionStorage.removeItem('oauth2_refresh_token');
        this.displayStoredToken();
        this.clearAllResults();
    }

    refreshToken() {
        if (!this.validateCredentials()) return;

        const refreshToken = sessionStorage.getItem('oauth2_refresh_token');

        if (!refreshToken) {
            this.setResultError('refresh', 'No refresh token available. Get a new token first using one of the authorization flows.');
            return;
        }

        const tokenUrl = new URL(this.getServerUrl());
        tokenUrl.pathname = '/oauth2/token';

        const body = new URLSearchParams();
        body.append('grant_type', 'refresh_token');
        body.append('refresh_token', refreshToken);
        body.append('client_id', this.clientIdTarget.value);
        body.append('client_secret', this.clientSecretTarget.value);

        this.resultTarget.innerHTML = '<p>⏳ Refreshing token...</p>';

        this.requestToken(tokenUrl.toString(), body)
            .then(data => {
                this.storeToken(data);
                if (data.refresh_token) {
                    sessionStorage.setItem('oauth2_refresh_token', data.refresh_token);
                }
                this.displayStoredToken();
                this.resultTarget.innerHTML = '<p>✅ Token refreshed successfully! New access token obtained.</p>';
            })
            .catch(error => {

                if (error.message.includes('invalid_grant')) {
                    sessionStorage.removeItem('oauth2_refresh_token');
                    this.displayStoredToken();
                    this.setResultError('refresh', 'Refresh token expired or revoked. Please authenticate again using an authorization flow.');
                } else {
                    this.setResultError('refresh', error.message);
                }
            });
    }

    clearAllResults() {
        this.resultTarget.innerHTML = '';
        this.apiResultTarget.innerHTML = '';
    }

    generateState() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let state = '';
        for (let i = 0; i < 32; i++) {
            state += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return state;
    }

    generateCodeChallenge(codeVerifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);

        return crypto.subtle.digest('SHA-256', data).then(hashBuffer => {
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const binaryString = String.fromCharCode(...hashArray);
            const base64 = btoa(binaryString);
            return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        });
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, char => map[char]);
    }
}
