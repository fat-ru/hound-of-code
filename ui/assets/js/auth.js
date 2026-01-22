/**
 * Authentication module for Hound
 */
var Auth = (function() {
    var TOKEN_KEY = 'hound_token';
    var USER_KEY = 'hound_user';

    /**
     * Make an API request with optional authentication
     */
    function apiRequest(url, options) {
        options = options || {};
        return new Promise(function(resolve, reject) {
            var xhr = new XMLHttpRequest();
            var method = options.method || 'GET';
            console.log('[Auth] API Request:', method, url);

            var token = getToken();
            if (token) {
                console.log('[Auth] Sending token:', token.substring(0, 20) + '...');
            } else {
                console.log('[Auth] No token available');
            }

            xhr.open(method, url);

            xhr.setRequestHeader('Content-Type', 'application/json');

            // Add auth token if available
            if (token) {
                xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            }

            xhr.onload = function() {
                console.log('[Auth] API Response:', xhr.status, url);
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        resolve(JSON.parse(xhr.responseText));
                    } catch (e) {
                        resolve(xhr.responseText);
                    }
                } else {
                    try {
                        var error = JSON.parse(xhr.responseText);
                        reject(error.error ? new Error(error.error) : new Error('Request failed with status ' + xhr.status));
                    } catch (e) {
                        reject(new Error('Request failed with status ' + xhr.status));
                    }
                }
            };

            xhr.onerror = function() {
                reject(new Error('Network error'));
            };

            if (options.body) {
                xhr.send(JSON.stringify(options.body));
            } else {
                xhr.send();
            }
        });
    }

    /**
     * Get the stored token
     */
    function getToken() {
        try {
            var token = localStorage.getItem(TOKEN_KEY);
            console.log('[Auth] getToken:', token ? 'found' : 'not found');
            return token;
        } catch (e) {
            console.error('[Auth] Error getting token:', e);
            return null;
        }
    }

    /**
     * Get the stored user
     */
    function getUser() {
        try {
            var userJson = localStorage.getItem(USER_KEY);
            if (!userJson) {
                console.log('[Auth] getUser: no user in localStorage');
                return null;
            }
            var user = JSON.parse(userJson);
            console.log('[Auth] getUser:', user.username);
            return user;
        } catch (e) {
            console.error('[Auth] Error getting user:', e);
            return null;
        }
    }

    /**
     * Check if user is logged in
     */
    function isLoggedIn() {
        return !!getToken() && !!getUser();
    }

    /**
     * Check if current user is admin
     */
    function isAdmin() {
        var user = getUser();
        return user && user.role === 'admin';
    }

    /**
     * Set the token
     */
    function setToken(token) {
        try {
            localStorage.setItem(TOKEN_KEY, token);
        } catch (e) {
            console.error('Failed to store token');
        }
    }

    /**
     * Set the user
     */
    function setUser(user) {
        try {
            localStorage.setItem(USER_KEY, JSON.stringify(user));
        } catch (e) {
            console.error('Failed to store user');
        }
    }

    /**
     * Clear authentication data
     */
    function logout() {
        try {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
        } catch (e) {
            console.error('Failed to clear auth data');
        }
    }

    /**
     * Login with username and password
     */
    function login(username, password) {
        return apiRequest('api/v1/auth/login', {
            method: 'POST',
            body: { username: username, password: password }
        });
    }

    /**
     * Register a new user
     */
    function register(username, password) {
        return apiRequest('api/v1/auth/register', {
            method: 'POST',
            body: { username: username, password: password }
        });
    }

    /**
     * Get current user info
     */
    function getMe() {
        return apiRequest('api/v1/auth/me');
    }

    /**
     * Get all users (admin only)
     */
    function getUsers() {
        return apiRequest('api/v1/users');
    }

    /**
     * Create a new user (admin only)
     */
    function createUser(username, password, role) {
        return apiRequest('api/v1/users', {
            method: 'POST',
            body: { username: username, password: password, role: role }
        });
    }

    /**
     * Update a user (admin only)
     */
    function updateUser(id, data) {
        return apiRequest('api/v1/users/' + id, {
            method: 'PUT',
            body: data
        });
    }

    /**
     * Delete a user (admin only)
     */
    function deleteUser(id) {
        return apiRequest('api/v1/users/' + id, {
            method: 'DELETE'
        });
    }

    /**
     * Get all repo configs
     */
    function getRepoConfigs(query) {
        var url = 'api/v1/repos/config';
        if (query) {
            url += '?q=' + encodeURIComponent(query);
        }
        return apiRequest(url);
    }

    /**
     * Create a repo config
     */
    function createRepoConfig(data) {
        return apiRequest('api/v1/repos/config', {
            method: 'POST',
            body: data
        });
    }

    /**
     * Update a repo config
     */
    function updateRepoConfig(id, data) {
        return apiRequest('api/v1/repos/config/' + id, {
            method: 'PUT',
            body: data
        });
    }

    /**
     * Delete a repo config
     */
    function deleteRepoConfig(id) {
        return apiRequest('api/v1/repos/config/' + id, {
            method: 'DELETE'
        });
    }

    // Public API
    return {
        getToken: getToken,
        getUser: getUser,
        isLoggedIn: isLoggedIn,
        isAdmin: isAdmin,
        setToken: setToken,
        setUser: setUser,
        logout: logout,
        login: login,
        register: register,
        getMe: getMe,
        getUsers: getUsers,
        createUser: createUser,
        updateUser: updateUser,
        deleteUser: deleteUser,
        getRepoConfigs: getRepoConfigs,
        createRepoConfig: createRepoConfig,
        updateRepoConfig: updateRepoConfig,
        deleteRepoConfig: deleteRepoConfig
    };
})();
